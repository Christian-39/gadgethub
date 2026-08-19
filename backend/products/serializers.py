from rest_framework import serializers
from .models import ProductCache, WishlistItem


class ProductCacheMiniSerializer(serializers.ModelSerializer):
    """Compact product shape used when nesting a product inside another
    resource (wishlist items, cart items, etc)."""

    class Meta:
        model = ProductCache
        fields = [
            'payuee_id', 'title', 'selling_price', 'currency',
            'images', 'stock_remaining', 'stock_status',
        ]


class WishlistItemSerializer(serializers.ModelSerializer):
    """
    WishlistView (generics.ListCreateAPIView) previously had no
    serializer_class at all, which made every request against it -
    GET (list) and POST (create) alike - fail with a Django
    AssertionError before perform_create() was ever reached. That
    error wasn't returned as JSON, so the frontend's generic error
    fallback surfaced it as a bare "Request failed", and nothing was
    ever actually saved. This serializer is what was missing.
    """
    product = ProductCacheMiniSerializer(read_only=True)
    product_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = WishlistItem
        fields = ['id', 'product', 'product_id', 'created_at']
        read_only_fields = ['id', 'created_at']
