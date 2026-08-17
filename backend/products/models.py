import uuid
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class ProductCache(models.Model):
    payuee_id = models.IntegerField(unique=True)
    title = models.CharField(max_length=500)
    description = models.TextField()
    selling_price = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=10, default='NGN')
    category = models.CharField(max_length=100)
    stock_remaining = models.IntegerField(default=0)
    stock_status = models.CharField(max_length=50)
    vendor_id = models.IntegerField()
    vendor_type = models.CharField(max_length=50)
    product_url_id = models.CharField(max_length=255)
    images = models.JSONField(default=list)
    sizes = models.CharField(max_length=255, blank=True)
    weight = models.FloatField(default=0)
    estimated_delivery = models.IntegerField(default=7)
    featured = models.BooleanField(default=False)
    on_sale = models.BooleanField(default=False)
    sales_count = models.IntegerField(default=0)
    rating_avg = models.FloatField(default=0)
    review_count = models.IntegerField(default=0)
    cached_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['category']),
            models.Index(fields=['vendor_id']),
            models.Index(fields=['selling_price']),
            models.Index(fields=['featured']),
        ]

class WishlistItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='wishlist_items')
    product = models.ForeignKey(ProductCache, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'product']

class CartItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='cart_items')
    product = models.ForeignKey(ProductCache, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)
    size = models.CharField(max_length=50, blank=True)
    ordered = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'product', 'size']