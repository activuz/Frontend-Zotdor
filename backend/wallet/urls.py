from django.urls import path

from wallet.views import WalletEntryListView, WalletView

urlpatterns = [
    path("wallet", WalletView.as_view(), name="wallet"),
    path("wallet/entries", WalletEntryListView.as_view(), name="wallet-entries"),
]
