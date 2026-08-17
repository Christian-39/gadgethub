from django.urls import path
from . import views

urlpatterns = [
    path('stats/', views.DashboardStatsView.as_view()),
    path('charts/', views.DashboardChartsView.as_view()),
    path('recent-orders/', views.RecentOrdersView.as_view()),
    path('support-tickets/', views.SupportTicketsView.as_view()),
    path('webhook-logs/', views.WebhookLogsView.as_view()),
]