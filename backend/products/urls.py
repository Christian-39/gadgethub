from django.urls import path
from . import views

urlpatterns = [
    path('list/', views.ProductListView.as_view()),
    path('search/', views.ProductSearchView.as_view()),
    path('detail/<int:product_id>/', views.ProductDetailView.as_view()),
    path('reviews/<int:product_id>/', views.ProductReviewsView.as_view()),
    path('wishlist/', views.WishlistView.as_view()),
    path('cart/', views.CartView.as_view()),
    path('cart/<uuid:item_id>/', views.CartView.as_view()),
]