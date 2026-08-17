from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import timedelta
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from django.contrib.auth import get_user_model
from orders.models import Order, OrderTimeline
from wallet.models import WalletTransaction
from products.models import ProductCache
from support.models import SupportTicket
from webhooks.models import WebhookLog

User = get_user_model()

class DashboardStatsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        today = timezone.now().date()
        thirty_days_ago = today - timedelta(days=30)

        revenue = Order.objects.filter(
            status__in=['delivered', 'confirmed'],
            created_at__date__gte=thirty_days_ago
        ).aggregate(total=Sum('total_cost'))['total'] or 0

        sales_count = Order.objects.filter(
            status='delivered',
            created_at__date__gte=thirty_days_ago
        ).count()

        orders_count = Order.objects.count()
        customers_count = User.objects.filter(is_staff=False).count()
        products_count = ProductCache.objects.count()
        reviews_count = ProductCache.objects.aggregate(total=Sum('review_count'))['total'] or 0

        return Response({
            'revenue': float(revenue),
            'sales_count': sales_count,
            'orders_count': orders_count,
            'customers_count': customers_count,
            'products_count': products_count,
            'reviews_count': reviews_count,
        })

class DashboardChartsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        today = timezone.now().date()
        
        # Daily sales for last 7 days
        daily_sales = []
        for i in range(6, -1, -1):
            date = today - timedelta(days=i)
            count = Order.objects.filter(
                created_at__date=date,
                status__in=['delivered', 'confirmed']
            ).count()
            daily_sales.append({
                'label': date.strftime('%a'),
                'value': count
            })

        # Monthly revenue for last 6 months
        monthly_revenue = []
        for i in range(5, -1, -1):
            month_start = today.replace(day=1) - timedelta(days=i*30)
            revenue = Order.objects.filter(
                created_at__year=month_start.year,
                created_at__month=month_start.month,
                status__in=['delivered', 'confirmed']
            ).aggregate(total=Sum('total_cost'))['total'] or 0
            monthly_revenue.append({
                'label': month_start.strftime('%b'),
                'value': float(revenue)
            })

        # Order status distribution
        status_counts = Order.objects.values('status').annotate(count=Count('id'))
        order_status = {item['status']: item['count'] for item in status_counts}

        return Response({
            'daily_sales': daily_sales,
            'monthly_revenue': monthly_revenue,
            'order_status': order_status,
        })

class RecentOrdersView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        orders = Order.objects.select_related('user').order_by('-created_at')[:10]
        return Response([{
            'id': str(o.id),
            'customer': o.customer_name,
            'total': float(o.total_cost),
            'status': o.status,
            'created_at': o.created_at.isoformat()
        } for o in orders])

class SupportTicketsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        tickets = SupportTicket.objects.select_related('user').order_by('-created_at')[:10]
        return Response([{
            'id': str(t.id),
            'subject': t.subject,
            'user': t.user.email,
            'status': t.status,
            'created_at': t.created_at.isoformat()
        } for t in tickets])

class WebhookLogsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        logs = WebhookLog.objects.order_by('-created_at')[:20]
        return Response([{
            'event_type': l.event_type,
            'order_id': l.order_id,
            'status': l.status,
            'created_at': l.created_at.isoformat()
        } for l in logs])