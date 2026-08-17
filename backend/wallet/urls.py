from django.urls import path
from . import views

urlpatterns = [
    path('balance/', views.WalletBalanceView.as_view()),
    path('funding-details/', views.WalletFundingDetailsView.as_view()),
    path('transactions/', views.TransactionHistoryView.as_view()),
    path('receipt/<uuid:transaction_id>/', views.DownloadReceiptView.as_view()),
]