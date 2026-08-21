from django.shortcuts import get_object_or_404
from django.conf import settings
from django.contrib.auth.hashers import check_password
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db import transaction
import logging
from .models import Order, OrderItem, OrderTimeline
from products.models import CartItem, ProductCache
from payuee.services import PayueeService
from accounts.models import AddressBook

payuee = PayueeService()
logger = logging.getLogger(__name__)

# A single-vendor shipping fee has no legitimate reason to exceed this
# in kobo (₦500,000). Nothing in the checkout flow was validating the
# `fee` Payuee returns before displaying it and folding it into the
# order total, so one anomalous value for a single vendor/product
# would flow straight through to the customer's screen unchecked -
# this is what let a value like ₦10,000,000,000,000,002 reach the UI.
MAX_PLAUSIBLE_SHIPPING_FEE_KOBO = 50_000_000

class ShippingFeesView(APIView):
    def post(self, request):
        try:
            data = payuee.calculate_shipping_fees(request.data)
        except Exception as e:
            logger.exception("Payuee shipping-fees call failed: %s", e)
            return Response({'error': str(e)}, status=500)

        # Payuee sometimes returns {"shipping": null} instead of []
        shipping = data.get('shipping') or []

        suspect = []
        for entry in shipping:
            fee = entry.get('fee')

            # Payuee occasionally returns fee as a JSON string — coerce it
            if isinstance(fee, str):
                try:
                    fee = float(fee)
                    entry['fee'] = fee
                except ValueError:
                    suspect.append({'reason': 'fee_is_non_numeric_string', 'entry': entry})
                    continue

            if fee is None:
                suspect.append({'reason': 'fee_is_null', 'entry': entry})
                continue

            if not isinstance(fee, (int, float)):
                suspect.append({'reason': 'fee_is_unexpected_type', 'type': type(fee).__name__, 'entry': entry})
                continue

            if fee > MAX_PLAUSIBLE_SHIPPING_FEE_KOBO:
                suspect.append({'reason': 'fee_too_large', 'fee': fee, 'entry': entry})
                continue

        if suspect:
            logger.error(
                "Implausible shipping fee from Payuee | request=%s | suspect=%s | full_response=%s",
                request.data, suspect, data,
            )
            return Response(
                {
                    'error': 'Shipping is temporarily unavailable for one or more items in your cart. Please try again shortly or contact support.',
                    'debug_payuee_response': data,      # ← look at this in DevTools
                    'debug_suspect_entries': suspect,   # ← tells you exactly which entry failed
                },
                status=502,
            )

        return Response(data)


class CreateOrderView(APIView):
    @transaction.atomic
    def post(self, request):
        cart_items = CartItem.objects.filter(user=request.user, ordered=False).select_related('product')
        if not cart_items:
            return Response({'error': 'Cart is empty'}, status=400)

        address_id = request.data.get('address_id')
        trans_code = request.data.get('trans_code')
        shipping = request.data.get('shipping', [])

        if not request.user.pin_created:
            return Response({'error': 'Transaction PIN required'}, status=400)

        # The frontend verifies the PIN as soon as it's fully typed (via
        # /auth/verify-pin/) for immediate feedback, but that's a UX
        # convenience only - nothing previously re-checked it here, so
        # whatever was submitted went straight through to Payuee as
        # trans_code with no local authority over it at all. This is
        # the actual, authoritative check.
        if not trans_code or not check_password(trans_code, request.user.transaction_pin):
            return Response({'error': 'Incorrect transaction PIN'}, status=400)

        address = get_object_or_404(AddressBook, id=address_id, user=request.user)

        # Group by vendor
        vendors = list(set([item.product.vendor_id for item in cart_items]))
        cart_payload = [{
            'product_id': item.product.payuee_id,
            'eshop_user_id': item.product.vendor_id,
            'quantity': item.quantity
        } for item in cart_items]

        # Build customer payload
        customer = {
            'email': request.user.email,
            'first_name': request.user.first_name,
            'last_name': request.user.last_name,
            'phone_number': request.user.phone_number or address.phone_number,
            'state': address.state,
            'city': address.city,
            'address_1': address.address_1,
            'address_2': address.address_2 or '',
            'latitude': address.latitude or 6.5244,
            'longitude': address.longitude or 3.3792,
            'order_note': request.data.get('order_note', ''),
            'save_address': True,
        }

        try:
            result = payuee.create_order(
                trans_code=trans_code,
                customer=customer,
                cart_items=[{
                    'product_id': item.product.payuee_id,
                    'cart_meta': {'quantity': item.quantity, 'outfit_size': item.size or ''}
                } for item in cart_items],
                shipping=shipping,
                webhook_url=settings.PAYUEE_WEBHOOK_URL
            )

            order_ids = result.get('order_ids', [])
            is_hold = result.get('status') == 'ON_HOLD'

            # Create local order record
            subtotal = sum(float(item.product.selling_price) * item.quantity for item in cart_items)
            shipping_cost = sum(s['fee'] for s in shipping) / 100

            order = Order.objects.create(
                user=request.user,
                payuee_order_ids=order_ids,
                status='hold' if is_hold else 'pending',
                subtotal=subtotal,
                shipping_cost=shipping_cost,
                total_cost=subtotal + shipping_cost,
                customer_email=request.user.email,
                customer_name=f"{request.user.first_name} {request.user.last_name}",
                customer_phone=request.user.phone_number or address.phone_number,
                delivery_state=address.state,
                delivery_city=address.city,
                delivery_address=f"{address.address_1} {address.address_2}",
                delivery_latitude=address.latitude,
                delivery_longitude=address.longitude,
                transaction_code=trans_code,
                shipping_method=shipping[0]['method_id'] if shipping else '',
                shipping_company=shipping[0]['company_name'] if shipping else '',
                receipt_data=result
            )

            for item in cart_items:
                OrderItem.objects.create(
                    order=order,
                    product_id=item.product.payuee_id,
                    title=item.product.title,
                    quantity=item.quantity,
                    unit_price=item.product.selling_price,
                    total_price=item.product.selling_price * item.quantity,
                    size=item.size,
                    image_url=item.product.images[0] if item.product.images else ''
                )
                item.ordered = True
                item.save()

            OrderTimeline.objects.create(order=order, status='created', description='Order created successfully')

            return Response({
                'success': True,
                'order_id': str(order.id),
                'payuee_order_ids': order_ids,
                'status': 'hold' if is_hold else 'pending',
                'message': result.get('message', 'Order created')
            })

        except Exception as e:
            return Response({'error': str(e)}, status=500)

class OrderListView(APIView):
    def get(self, request):
        page = request.query_params.get('page', 1)
        limit = request.query_params.get('limit', 15)
        status_filter = request.query_params.get('status')

        queryset = Order.objects.filter(user=request.user)
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Sync with Payuee
        try:
            payuee_orders = payuee.list_orders(page=int(page), limit=int(limit))
            # Update local statuses if needed
        except Exception:
            pass

        orders = queryset[(int(page)-1)*int(limit):int(page)*int(limit)]
        data = [{
            'id': str(o.id),
            'status': o.status,
            'total_cost': float(o.total_cost),
            'shipping_cost': float(o.shipping_cost),
            'created_at': o.created_at.isoformat(),
            'items': [{
                'title': i.title,
                'quantity': i.quantity,
                'image': i.image_url
            } for i in o.items.all()]
        } for o in orders]

        return Response({
            'data': data,
            'pagination': {
                'current_page': int(page),
                'total_pages': (queryset.count() + int(limit) - 1) // int(limit)
            }
        })

class OrderDetailView(APIView):
    def get(self, request, order_id):
        order = get_object_or_404(Order, id=order_id, user=request.user)
        # Fetch latest from Payuee
        payuee_data = {}
        if order.payuee_order_ids:
            try:
                payuee_data = payuee.get_order_detail(order.payuee_order_ids[0])
            except Exception:
                pass

        return Response({
            'id': str(order.id),
            'status': order.status,
            'total_cost': float(order.total_cost),
            'shipping_cost': float(order.shipping_cost),
            'subtotal': float(order.subtotal),
            'customer': {
                'name': order.customer_name,
                'email': order.customer_email,
                'phone': order.customer_phone,
            },
            'delivery': {
                'state': order.delivery_state,
                'city': order.delivery_city,
                'address': order.delivery_address,
            },
            'transaction_code': order.transaction_code,
            'qr_scanned': order.qr_scanned,
            'timeline': [{
                'status': t.status,
                'description': t.description,
                'created_at': t.created_at.isoformat()
            } for t in order.timeline.all()],
            'items': [{
                'product_id': i.product_id,
                'title': i.title,
                'quantity': i.quantity,
                'unit_price': float(i.unit_price),
                'total_price': float(i.total_price),
                'size': i.size,
                'image': i.image_url
            } for i in order.items.all()],
            'payuee_data': payuee_data
        })

class CancelOrderView(APIView):
    def post(self, request, order_id):
        order = get_object_or_404(Order, id=order_id, user=request.user)
        trans_code = request.data.get('trans_code')
        note = request.data.get('report_note', '')

        if order.status in ['delivered', 'cancelled', 'refunded']:
            return Response({'error': 'Order cannot be cancelled'}, status=400)

        try:
            for pid in order.payuee_order_ids:
                payuee.cancel_order(pid, trans_code, note)
            order.status = 'cancelled'
            order.cancelled_at = timezone.now()
            order.save()
            OrderTimeline.objects.create(order=order, status='cancelled', description=f'Cancelled: {note}')
            return Response({'success': 'Order cancelled'})
        except Exception as e:
            return Response({'error': str(e)}, status=500)

class ReportOrderView(APIView):
    def post(self, request, order_id):
        order = get_object_or_404(Order, id=order_id, user=request.user)
        note = request.data.get('report_note', '')

        try:
            for pid in order.payuee_order_ids:
                payuee.report_order(pid, note)
            order.report_note = note
            order.save()
            OrderTimeline.objects.create(order=order, status='reported', description=f'Reported: {note}')
            return Response({'success': 'Order reported'})
        except Exception as e:
            return Response({'error': str(e)}, status=500)

class OrderReceiptView(APIView):
    def get(self, request, order_id):
        order = get_object_or_404(Order, id=order_id, user=request.user)
        receipt = {
            'receipt_id': f"GH-{order.id[:8].upper()}",
            'date': order.created_at.strftime('%Y-%m-%d %H:%M'),
            'customer': order.customer_name,
            'email': order.customer_email,
            'items': [{
                'title': i.title,
                'qty': i.quantity,
                'price': f"₦{i.unit_price:,.2f}",
                'total': f"₦{i.total_price:,.2f}"
            } for i in order.items.all()],
            'subtotal': f"₦{order.subtotal:,.2f}",
            'shipping': f"₦{order.shipping_cost:,.2f}",
            'total': f"₦{order.total_cost:,.2f}",
            'status': order.status.upper(),
        }
        return Response(receipt)