from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import SupportTicket, FAQ
from .serializers import SupportTicketSerializer, FAQSerializer

class TicketListCreateView(generics.ListCreateAPIView):
    serializer_class = SupportTicketSerializer

    def get_queryset(self):
        return SupportTicket.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class FAQListView(generics.ListAPIView):
    queryset = FAQ.objects.filter(is_active=True)
    serializer_class = FAQSerializer
    pagination_class = None