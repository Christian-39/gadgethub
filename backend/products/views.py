import hashlib
import json
from django.shortcuts import get_object_or_404
from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.core.cache import cache
from .models import ProductCache, WishlistItem, CartItem
from .serializers import WishlistItemSerializer
from payuee.services import PayueeService

payuee = PayueeService()


def _stable_cache_key(prefix, payload):
    """
    Deterministic cache key for a request payload.

    The previous implementation used `hash(str(request.data))`. Python
    randomizes str/dict hash() per-process by default (PYTHONHASHSEED),
    so the exact same request produced a DIFFERENT cache key on every
    worker process (and even across restarts of the same worker) -
    meaning the cache almost never actually hit, and every product
    list/search request round-tripped to Payuee. This is the main
    reason products loaded slowly. A content hash is stable everywhere.
    """
    normalized = json.dumps(payload, sort_keys=True, default=str)
    digest = hashlib.md5(normalized.encode('utf-8')).hexdigest()
    return f"{prefix}:{digest}"


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 24
    page_size_query_param = 'limit'
    max_page_size = 100

class ProductCategoriesView(APIView):
    """
    Payuee does not expose a "list categories" endpoint - the category
    taxonomy is instead a fixed, documented set of values accepted by
    the `category` filter on POST /v1/products and /v1/products/search
    (outfits, jewelry, kids-accessories, cars-car-parts, tools,
    gadgets, others). This view is the single source of truth for
    that taxonomy on our side, so the frontend no longer needs to
    duplicate/guess it in three different hardcoded lists.
    """
    permission_classes = [permissions.AllowAny]

    CATEGORIES = [
        {'id': 'gadgets', 'name': 'Gadgets', 'icon': '💻'},
        {'id': 'outfits', 'name': 'Fashion', 'icon': '👕'},
        {'id': 'jewelry', 'name': 'Jewelry', 'icon': '💍'},
        {'id': 'cars-car-parts', 'name': 'Auto Parts', 'icon': '🚗'},
        {'id': 'tools', 'name': 'Tools', 'icon': '🔧'},
        {'id': 'kids-accessories', 'name': 'Kids', 'icon': '🧸'},
        {'id': 'others', 'name': 'Others', 'icon': '📦'},
    ]

    def get(self, request):
        return Response({'success': self.CATEGORIES})


class ProductListView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        cache_key = _stable_cache_key('products', request.data)
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        try:
            data = payuee.get_products(request.data)
            # Sync to cache DB
            for prod in data.get('success', []):
                ProductCache.objects.update_or_create(
                    payuee_id=prod['ID'],
                    defaults={
                        'title': prod['title'],
                        'description': prod.get('description', ''),
                        'selling_price': prod['selling_price'] / 100,
                        'currency': prod.get('currency', 'NGN'),
                        'category': prod['category'],
                        'stock_remaining': prod.get('stock_remaining', 0),
                        'stock_status': prod.get('stock_availability_status', 'in-stock'),
                        'vendor_id': prod['eshop_user_id'],
                        'vendor_type': prod.get('vendor_type', 'basic'),
                        'product_url_id': prod['product_url_id'],
                        'images': prod.get('product_image', []),
                        'sizes': prod.get('clothing_sizes', '') or prod.get('shoe_sizes', ''),
                        'weight': prod.get('net_weight', 0),
                        'estimated_delivery': prod.get('estimated_delivery', 7),
                        'featured': prod.get('featured', False),
                        'on_sale': prod.get('on_sale', False),
                        'sales_count': prod.get('sales', 0),
                    }
                )
            cache.set(cache_key, data, 300)
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

class ProductSearchView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        cache_key = _stable_cache_key('product_search', request.data)
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        try:
            data = payuee.search_products(request.data)
            cache.set(cache_key, data, 120)
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

class ProductDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, product_id):
        cache_key = f"product:{product_id}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        try:
            data = payuee.get_product_detail(product_id)
            prod = data.get('success', {})
            if prod:
                ProductCache.objects.update_or_create(
                    payuee_id=prod['ID'],
                    defaults={
                        'title': prod['title'],
                        'description': prod.get('description', ''),
                        'selling_price': prod['selling_price'] / 100,
                        'currency': prod.get('currency', 'NGN'),
                        'category': prod['category'],
                        'stock_remaining': prod.get('stock_remaining', 0),
                        'stock_status': prod.get('stock_availability_status', 'in-stock'),
                        'vendor_id': prod['eshop_user_id'],
                        'vendor_type': prod.get('vendor_type', 'basic'),
                        'product_url_id': prod['product_url_id'],
                        'images': [img['url'] for img in prod.get('product_image', [])],
                        'sizes': prod.get('clothing_sizes', '') or prod.get('shoe_sizes', ''),
                        'weight': prod.get('net_weight', 0),
                        'estimated_delivery': prod.get('estimated_delivery', 7),
                        'featured': prod.get('featured', False),
                        'on_sale': prod.get('on_sale', False),
                        'sales_count': prod.get('sales', 0),
                        'review_count': prod.get('product_review_count', 0),
                    }
                )
            cache.set(cache_key, data, 600)
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

class WishlistView(generics.ListCreateAPIView):
    serializer_class = WishlistItemSerializer
    # This is a small, per-user list with no pagination UI on the
    # frontend - it was silently inheriting the project-wide
    # DEFAULT_PAGINATION_CLASS, which wraps list responses as
    # {"count", "next", "previous", "results"}. The wishlist page
    # expects a plain array, so every load was failing/rendering
    # empty ("Failed to load wishlist").
    pagination_class = None

    def get_queryset(self):
        return WishlistItem.objects.filter(user=self.request.user).select_related('product')

    def perform_create(self, serializer):
        product_id = self.request.data.get('product_id')
        product = get_object_or_404(ProductCache, payuee_id=product_id)
        WishlistItem.objects.get_or_create(user=self.request.user, product=product)

    def delete(self, request):
        product_id = request.data.get('product_id')
        WishlistItem.objects.filter(user=request.user, product__payuee_id=product_id).delete()
        return Response({'success': True})

class CartView(APIView):
    def get(self, request):
        items = CartItem.objects.filter(user=request.user, ordered=False).select_related('product')
        data = [{
            'id': str(item.id),
            'product': {
                'id': item.product.payuee_id,
                'title': item.product.title,
                'price': float(item.product.selling_price),
                'image': item.product.images[0] if item.product.images else '',
                'vendor_id': item.product.vendor_id,
            },
            'quantity': item.quantity,
            'size': item.size,
            'total': float(item.product.selling_price) * item.quantity,
        } for item in items]
        return Response(data)

    def post(self, request):
        product_id = request.data.get('product_id')
        quantity = request.data.get('quantity', 1)
        size = request.data.get('size', '')
        product = get_object_or_404(ProductCache, payuee_id=product_id)
        item, created = CartItem.objects.get_or_create(
            user=request.user, product=product, size=size, ordered=False,
            defaults={'quantity': quantity}
        )
        if not created:
            item.quantity += quantity
            item.save()
        return Response({'success': True, 'cart_count': CartItem.objects.filter(user=request.user, ordered=False).count()})

    def patch(self, request, item_id):
        item = get_object_or_404(CartItem, id=item_id, user=request.user, ordered=False)
        item.quantity = request.data.get('quantity', item.quantity)
        item.save()
        return Response({'success': True})

    def delete(self, request, item_id):
        CartItem.objects.filter(id=item_id, user=request.user, ordered=False).delete()
        return Response({'success': True})

class ProductReviewsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, product_id):
        page = request.query_params.get('page', 1)
        try:
            data = payuee.get_reviews(product_id, page)
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    def post(self, request, product_id):
        if not request.user.is_authenticated:
            return Response({'error': 'Authentication required'}, status=401)
        try:
            data = payuee.submit_review(
                product_id=product_id,
                user_id=request.user.id,
                name=f"{request.user.first_name} {request.user.last_name}",
                email=request.user.email,
                review=request.data.get('review'),
                rating=request.data.get('rating')
            )
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=500)