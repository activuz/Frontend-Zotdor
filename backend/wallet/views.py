from __future__ import annotations

from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema
from rest_framework.generics import ListAPIView
from rest_framework.pagination import CursorPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from wallet import services
from wallet.models import WalletEntry
from wallet.serializers import WalletEntrySerializer, WalletSerializer


class WalletView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=WalletSerializer)
    def get(self, request: Request) -> Response:
        user: User = request.user  # type: ignore[assignment]
        return Response(WalletSerializer(services.get_wallet(user)).data)


class EntryPagination(CursorPagination):
    ordering = "-id"
    page_size = 20
    max_page_size = 50
    page_size_query_param = "limit"


class WalletEntryListView(ListAPIView[WalletEntry]):
    permission_classes = [IsAuthenticated]
    serializer_class = WalletEntrySerializer
    pagination_class = EntryPagination

    def get_queryset(self) -> QuerySet[WalletEntry]:
        # Only the user's own ledger; hold bookkeeping is shown too so the history adds up.
        return WalletEntry.objects.filter(user=self.request.user)  # type: ignore[misc]
