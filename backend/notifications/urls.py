from django.urls import path
from . import views

urlpatterns = [
    path('', views.NotificationListView.as_view()),
    path('<uuid:notification_id>/read/', views.MarkReadView.as_view()),
    path('read-all/', views.MarkAllReadView.as_view()),
]