from django.urls import path
from . import views

urlpatterns = [
    path('payuee/', views.PayueeWebhookView.as_view()),
]