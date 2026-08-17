from django.urls import path
from . import views

urlpatterns = [
    path('shipping-fees/', views.ShippingFeesView.as_view()),
    path('create/', views.CreateOrderView.as_view()),
    path('list/', views.OrderListView.as_view()),
    path('detail/<uuid:order_id>/', views.OrderDetailView.as_view()),
    path('detail/<uuid:order_id>/cancel/', views.CancelOrderView.as_view()),
    path('detail/<uuid:order_id>/report/', views.ReportOrderView.as_view()),
    path('detail/<uuid:order_id>/receipt/', views.OrderReceiptView.as_view()),
]