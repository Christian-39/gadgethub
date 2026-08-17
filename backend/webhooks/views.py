import json
import logging
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from payuee.services import PayueeService
from orders.models import Order, OrderTimeline
from wallet.models import WalletTransaction

logger = logging.getLogger('payuee')

@method_decorator(csrf_exempt, name='dispatch')
class PayueeWebhookView(APIView):
    permission_classes = []

    def post(self, request):
        payload = request.body
        signature = request.headers.get('X-Payuee-Signature', '')
        timestamp = request.headers.get('X-Payuee-Timestamp', '')
        public_key = request.headers.get('X-Payuee-Public-Key', '')

        # IP Whitelist check
        client_ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', '')).split(',')[0].strip()
        if client_ip != '84.8.135.142' and not settings.DEBUG:
            logger.warning(f"Webhook from unauthorized IP: {client_ip}")
            return Response({'error': 'Unauthorized IP'}, status=403)

        # Timestamp validation (5 minutes)
        import time
        try:
            if abs(int(time.time()) - int(timestamp)) > 300:
                return Response({'error': 'Timestamp expired'}, status=401)
        except ValueError:
            return Response({'error': 'Invalid timestamp'}, status=401)

        # Signature verification
        if not PayueeService.verify_webhook(payload, signature, timestamp):
            return Response({'error': 'Invalid signature'}, status=401)

        try:
            event = json.loads(payload)
        except json.JSONDecodeError:
            return Response({'error': 'Invalid JSON'}, status=400)

        event_type = event.get('event_type')
        order_data = event.get('order', {})
        payuee_order_id = event.get('order_id')

        logger.info(f"Webhook received: {event_type} for order {payuee_order_id}")

        # Find local order
        try:
            local_order = Order.objects.filter(payuee_order_ids__contains=[payuee_order_id]).first()
        except Exception:
            local_order = None

        handlers = {
            'order.created': self._handle_created,
            'order.on_hold': self._handle_hold,
            'order.scanned': self._handle_scanned,
            'order.delivered': self._handle_delivered,
            'order.refunded': self._handle_refunded,
            'order.cancelled': self._handle_cancelled,
            'order.report': self._handle_report,
        }

        handler = handlers.get(event_type)
        if handler:
            handler(local_order, order_data, event)

        return Response({'status': 'success'}, status=200)

    def _handle_created(self, order, data, event):
        if order:
            order.status = 'pending'
            order.save()
            OrderTimeline.objects.create(order=order, status='escrow_locked', description='Funds locked in escrow')

    def _handle_hold(self, order, data, event):
        if order:
            order.status = 'hold'
            order.save()
            OrderTimeline.objects.create(order=order, status='hold', description='Insufficient wallet balance. Please fund your wallet.')

    def _handle_scanned(self, order, data, event):
        if order:
            order.qr_scanned = True
            order.save()
            OrderTimeline.objects.create(order=order, status='qr_scanned', description='QR code scanned at delivery')

    def _handle_delivered(self, order, data, event):
        if order:
            order.status = 'delivered'
            order.delivered_at = timezone.now()
            order.save()
            OrderTimeline.objects.create(order=order, status='delivered', description='Order delivered and verified')

    def _handle_refunded(self, order, data, event):
        if order:
            order.status = 'refunded'
            order.save()
            OrderTimeline.objects.create(order=order, status='refunded', description='Order refunded')
            WalletTransaction.objects.create(
                user=order.user,
                transaction_type='refund',
                amount=order.total_cost,
                balance_after=0,  # Will be updated by balance fetch
                description=f'Refund for order {order.id}',
                payuee_order_id=str(order.payuee_order_ids[0]) if order.payuee_order_ids else ''
            )

    def _handle_cancelled(self, order, data, event):
        if order:
            order.status = 'cancelled'
            order.save()
            OrderTimeline.objects.create(order=order, status='cancelled', description='Order cancelled')

    def _handle_report(self, order, data, event):
        if order:
            OrderTimeline.objects.create(order=order, status='reported', description='Order reported for review')