from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils import timezone
from datetime import datetime, timedelta
from .models import WalletTransaction
from payuee.services import PayueeService

payuee = PayueeService()

class WalletBalanceView(APIView):
    def get(self, request):
        try:
            balance_data = payuee.get_wallet_balance()
            # balance in kobo
            naira = balance_data.get('wallet_balance', 0) / 100
            return Response({
                'balance': naira,
                'currency': balance_data.get('currency', 'NGN'),
                'formatted': f"₦{naira:,.2f}"
            })
        except Exception as e:
            return Response({'error': str(e)}, status=500)

class WalletFundingDetailsView(APIView):
    def get(self, request):
        try:
            data = payuee.get_wallet_funding_details()
            return Response(data)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

class TransactionHistoryView(APIView):
    def get(self, request):
        tx_type = request.query_params.get('type')
        search = request.query_params.get('search', '')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        queryset = WalletTransaction.objects.filter(user=request.user)
        if tx_type:
            queryset = queryset.filter(transaction_type=tx_type)
        if search:
            queryset = queryset.filter(description__icontains=search)
        if start_date:
            queryset = queryset.filter(created_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__date__lte=end_date)

        data = [{
            'id': str(t.id),
            'type': t.transaction_type,
            'amount': float(t.amount),
            'formatted_amount': f"₦{t.amount:,.2f}",
            'balance_after': float(t.balance_after),
            'description': t.description,
            'reference': t.reference,
            'date': t.created_at.strftime('%Y-%m-%d %H:%M')
        } for t in queryset[:100]]

        return Response(data)

class DownloadReceiptView(APIView):
    def get(self, request, transaction_id):
        tx = WalletTransaction.objects.get(id=transaction_id, user=request.user)
        receipt = {
            'receipt_no': f"GH-WTX-{str(tx.id)[:8].upper()}",
            'date': tx.created_at.strftime('%Y-%m-%d %H:%M'),
            'type': tx.transaction_type.upper(),
            'amount': f"₦{tx.amount:,.2f}",
            'balance_after': f"₦{tx.balance_after:,.2f}",
            'description': tx.description,
            'reference': tx.reference,
        }
        return Response(receipt)