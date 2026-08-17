import uuid
from django.db import models

class WebhookLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_type = models.CharField(max_length=50)
    order_id = models.CharField(max_length=50, blank=True)
    payload = models.JSONField()
    signature = models.CharField(max_length=255)
    timestamp = models.CharField(max_length=20)
    status = models.CharField(max_length=20, default='pending')  # pending, processed, failed
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)