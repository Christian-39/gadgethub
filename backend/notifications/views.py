from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Notification

class NotificationListView(generics.ListAPIView):
    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        unread_count = queryset.filter(is_read=False).count()
        data = [{
            'id': str(n.id),
            'title': n.title,
            'message': n.message,
            'type': n.notification_type,
            'is_read': n.is_read,
            'action_url': n.action_url,
            'created_at': n.created_at.strftime('%Y-%m-%d %H:%M')
        } for n in queryset[:50]]
        return Response({'notifications': data, 'unread_count': unread_count})

class MarkReadView(APIView):
    def post(self, request, notification_id):
        Notification.objects.filter(id=notification_id, user=request.user).update(is_read=True)
        return Response({'success': True})

class MarkAllReadView(APIView):
    def post(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'success': True})