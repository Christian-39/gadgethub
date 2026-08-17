from django.urls import path
from . import views

urlpatterns = [
    path('tickets/', views.TicketListCreateView.as_view()),
    path('faqs/', views.FAQListView.as_view()),
]