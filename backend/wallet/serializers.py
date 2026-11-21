from __future__ import annotations

from rest_framework import serializers

from wallet.models import EntryType, Wallet, WalletEntry

ENTRY_TITLES: dict[str, str] = {
    EntryType.TOPUP: "Balans toʻldirildi",
    EntryType.BONUS_GRANT: "Roʻyxatdan oʻtish bonusi",
    EntryType.BONUS_EXPIRE: "Bonus muddati tugadi",
    EntryType.HOLD: "Auksion uchun band qilindi",
    EntryType.HOLD_RELEASE: "Band qilingan summa boʻshatildi",
    EntryType.COMMISSION: "Komissiya",
    EntryType.COMMISSION_REFUND: "Komissiya qaytarildi",
    EntryType.REFUND_PAYOUT: "Pul qaytarildi",
    EntryType.ADJUSTMENT: "Administrator tuzatishi",
}


class WalletSerializer(serializers.ModelSerializer[Wallet]):
    available = serializers.IntegerField(read_only=True)
    has_debt = serializers.BooleanField(read_only=True)

    class Meta:
        model = Wallet
        fields = ["main_balance", "bonus_balance", "bonus_expires_at", "held_amount", "available", "has_debt"]
        read_only_fields = fields


class WalletEntrySerializer(serializers.ModelSerializer[WalletEntry]):
    title = serializers.SerializerMethodField()

    class Meta:
        model = WalletEntry
        fields = ["id", "bucket", "type", "title", "amount", "balance_after", "note", "created_at"]
        read_only_fields = fields

    def get_title(self, obj: WalletEntry) -> str:
        return ENTRY_TITLES.get(obj.type, obj.type)
