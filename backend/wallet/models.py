"""Wallet, immutable ledger and holds (docs/DATABASE.md "wallet", BR-40..46).

Balances change ONLY through wallet.services, which writes a WalletEntry and the new
balance in the same transaction with the Wallet row locked. Amounts are whole so‘m.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class Wallet(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, primary_key=True, related_name="wallet"
    )
    main_balance = models.BigIntegerField(default=0)  # may go negative (BR-42 debt)
    bonus_balance = models.BigIntegerField(default=0)
    bonus_expires_at = models.DateTimeField(null=True, blank=True)
    held_amount = models.BigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "wallets"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(bonus_balance__gte=0), name="wallet_bonus_non_negative"
            ),
            models.CheckConstraint(condition=models.Q(held_amount__gte=0), name="wallet_held_non_negative"),
        ]

    def __str__(self) -> str:
        return f"wallet {self.user_id}"

    @property
    def available(self) -> int:
        return self.main_balance + self.bonus_balance - self.held_amount

    @property
    def has_debt(self) -> bool:
        return self.main_balance < 0


class Bucket(models.TextChoices):
    MAIN = "main"
    BONUS = "bonus"
    HOLD = "hold"


class EntryType(models.TextChoices):
    TOPUP = "topup"
    BONUS_GRANT = "bonus_grant"
    BONUS_EXPIRE = "bonus_expire"
    BONUS_CASHBACK = "bonus_cashback"
    BONUS_CASHBACK_REVERSAL = "bonus_cashback_reversal"
    HOLD = "hold"
    HOLD_RELEASE = "hold_release"
    COMMISSION = "commission"
    COMMISSION_REFUND = "commission_refund"
    REFUND_PAYOUT = "refund_payout"
    ADJUSTMENT = "adjustment"


class WalletEntry(models.Model):
    """Append-only. Sum of `amount` per (user, bucket) equals that bucket's balance."""

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    bucket = models.CharField(max_length=8, choices=Bucket.choices)
    type = models.CharField(max_length=24, choices=EntryType.choices)
    amount = models.BigIntegerField()
    balance_after = models.BigIntegerField()
    ref_type = models.CharField(max_length=24, blank=True)
    ref_id = models.UUIDField(null=True, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "wallet_entries"
        indexes = [models.Index(fields=["user", "-id"]), models.Index(fields=["ref_type", "ref_id"])]

    def __str__(self) -> str:
        return f"{self.type} {self.amount} ({self.bucket})"


class Hold(models.Model):
    """Funds reserved for one referenced object (an auction, BR-41)."""

    class Status(models.TextChoices):
        ACTIVE = "active"
        RELEASED = "released"
        CAPTURED = "captured"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    ref_type = models.CharField(max_length=24)
    ref_id = models.UUIDField()
    amount = models.BigIntegerField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "holds"
        constraints = [
            models.UniqueConstraint(fields=["ref_type", "ref_id"], name="hold_one_per_ref"),
            models.CheckConstraint(condition=models.Q(amount__gt=0), name="hold_amount_positive"),
        ]

    def __str__(self) -> str:
        return f"hold {self.amount} {self.status}"
