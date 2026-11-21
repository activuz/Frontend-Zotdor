"""The only code allowed to change money (AGENTS.md, BR-40..46).

Every public function runs in a transaction, locks the user's Wallet row, writes one
WalletEntry per bucket change and updates the cached balance on the Wallet. The ledger
is the source of truth; `reconcile()` re-derives balances from it.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import timedelta
from typing import TYPE_CHECKING

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import status

from core.errors import DomainError
from core.models import PlatformSettings
from wallet.models import Bucket, EntryType, Hold, Wallet, WalletEntry

if TYPE_CHECKING:
    from accounts.models import User


def commission_for(amount: int, rate_bp: int) -> int:
    """Commission in whole so‘m, rounded up (A-11). rate_bp=20 means 0.2%."""
    if amount <= 0:
        return 0
    return -(-amount * rate_bp // 10_000)


def _locked_wallet(user: User) -> Wallet:
    Wallet.objects.get_or_create(user=user)
    return Wallet.objects.select_for_update().get(user=user)


def _post(
    wallet: Wallet,
    bucket: Bucket,
    entry_type: EntryType,
    amount: int,
    *,
    ref_type: str = "",
    ref_id: uuid.UUID | None = None,
    actor: User | None = None,
    note: str = "",
) -> WalletEntry:
    """Apply one signed change to a bucket of a LOCKED wallet and record it."""
    field = {Bucket.MAIN: "main_balance", Bucket.BONUS: "bonus_balance", Bucket.HOLD: "held_amount"}[bucket]
    new_balance = getattr(wallet, field) + amount
    setattr(wallet, field, new_balance)
    wallet.save(update_fields=[field, "bonus_expires_at", "updated_at"])
    return WalletEntry.objects.create(
        user_id=wallet.user_id,
        bucket=bucket,
        type=entry_type,
        amount=amount,
        balance_after=new_balance,
        ref_type=ref_type,
        ref_id=ref_id,
        actor=actor,
        note=note,
    )


def get_wallet(user: User) -> Wallet:
    wallet, _ = Wallet.objects.get_or_create(user=user)
    return wallet


# --- bonus ----------------------------------------------------------------------------


@transaction.atomic
def grant_signup_bonus(user: User) -> WalletEntry | None:
    """BR-43: once per account; non-withdrawable, spent on commission first, expires."""
    wallet = _locked_wallet(user)
    if WalletEntry.objects.filter(user=user, type=EntryType.BONUS_GRANT).exists():
        return None
    settings = PlatformSettings.load()
    if settings.signup_bonus <= 0:
        return None
    wallet.bonus_expires_at = timezone.now() + timedelta(days=settings.bonus_ttl_days)
    return _post(wallet, Bucket.BONUS, EntryType.BONUS_GRANT, settings.signup_bonus)


def expire_bonuses() -> int:
    """Zero out expired bonus balances. Returns how many wallets were affected."""
    count = 0
    due = Wallet.objects.filter(bonus_balance__gt=0, bonus_expires_at__lte=timezone.now())
    for user_id in due.values_list("user_id", flat=True):
        with transaction.atomic():
            wallet = Wallet.objects.select_for_update().get(user_id=user_id)
            expires = wallet.bonus_expires_at
            if wallet.bonus_balance > 0 and expires is not None and expires <= timezone.now():
                _post(wallet, Bucket.BONUS, EntryType.BONUS_EXPIRE, -wallet.bonus_balance)
                count += 1
    return count


# --- holds and commission -----------------------------------------------------------------

INSUFFICIENT = "Balansingizda yetarli mablagʻ yoʻq. Balansni toʻldiring."
DEBT = "Balansingizda qarz bor. Uni yopmaguningizcha yangi auksion ochib boʻlmaydi."


@transaction.atomic
def hold(user: User, ref_type: str, ref_id: uuid.UUID, amount: int) -> Hold:
    """Reserve `amount` for an object (BR-41). Refused while the user has debt (BR-42)."""
    if amount <= 0:
        raise ValueError("hold amount must be positive")
    wallet = _locked_wallet(user)
    if wallet.has_debt:
        raise DomainError("wallet_debt", DEBT, status.HTTP_409_CONFLICT)
    if wallet.available < amount:
        raise DomainError("insufficient_balance", INSUFFICIENT, status.HTTP_409_CONFLICT)
    created = Hold.objects.create(user=user, ref_type=ref_type, ref_id=ref_id, amount=amount)
    _post(wallet, Bucket.HOLD, EntryType.HOLD, amount, ref_type=ref_type, ref_id=ref_id)
    return created


def _active_hold(ref_type: str, ref_id: uuid.UUID) -> Hold:
    found = Hold.objects.select_for_update().filter(ref_type=ref_type, ref_id=ref_id).first()
    if found is None or found.status != Hold.Status.ACTIVE:
        raise ValueError(f"no active hold for {ref_type}:{ref_id}")
    return found


def _close_hold(h: Hold, wallet: Wallet, new_status: str) -> None:
    _post(wallet, Bucket.HOLD, EntryType.HOLD_RELEASE, -h.amount, ref_type=h.ref_type, ref_id=h.ref_id)
    h.status = new_status
    h.closed_at = timezone.now()
    h.save(update_fields=["status", "closed_at"])


@transaction.atomic
def release_hold(ref_type: str, ref_id: uuid.UUID) -> None:
    """Return a reservation in full (cancelled / unsold / blocked auction)."""
    h = _active_hold(ref_type, ref_id)
    wallet = _locked_wallet(h.user)
    _close_hold(h, wallet, Hold.Status.RELEASED)


@dataclass(frozen=True)
class CommissionCharge:
    total: int
    from_bonus: int
    from_main: int


@transaction.atomic
def capture_commission(
    ref_type: str, ref_id: uuid.UUID, amount: int, *, charge_ref_type: str, charge_ref_id: uuid.UUID
) -> CommissionCharge:
    """Close the hold and charge the real commission: bonus first, then main (BR-42, BR-43).

    The main balance may go negative when the commission exceeds what is left.
    """
    h = _active_hold(ref_type, ref_id)
    wallet = _locked_wallet(h.user)
    _close_hold(h, wallet, Hold.Status.CAPTURED)

    from_bonus = min(wallet.bonus_balance, amount)
    from_main = amount - from_bonus
    for bucket, part in ((Bucket.BONUS, from_bonus), (Bucket.MAIN, from_main)):
        if part:
            _post(wallet, bucket, EntryType.COMMISSION, -part, ref_type=charge_ref_type, ref_id=charge_ref_id)
    return CommissionCharge(total=amount, from_bonus=from_bonus, from_main=from_main)


@transaction.atomic
def refund_commission(user: User, charge_ref_type: str, charge_ref_id: uuid.UUID, *, actor: User) -> int:
    """Return a charged commission to the buckets it came from (approved "deal failed" claim, BR-34)."""
    wallet = _locked_wallet(user)
    charged = WalletEntry.objects.filter(
        user=user, type=EntryType.COMMISSION, ref_type=charge_ref_type, ref_id=charge_ref_id
    )
    if WalletEntry.objects.filter(
        user=user, type=EntryType.COMMISSION_REFUND, ref_type=charge_ref_type, ref_id=charge_ref_id
    ).exists():
        raise DomainError(
            "already_refunded", "Bu komissiya allaqachon qaytarilgan.", status.HTTP_409_CONFLICT
        )
    total = 0
    for entry in charged:
        _post(
            wallet,
            Bucket(entry.bucket),
            EntryType.COMMISSION_REFUND,
            -entry.amount,
            ref_type=charge_ref_type,
            ref_id=charge_ref_id,
            actor=actor,
        )
        total += -entry.amount
    return total


@transaction.atomic
def credit_topup(user: User, amount: int, payment_id: uuid.UUID) -> WalletEntry:
    """A confirmed payment (Click or the fake provider) adds to the main balance."""
    wallet = _locked_wallet(user)
    return _post(wallet, Bucket.MAIN, EntryType.TOPUP, amount, ref_type="payment", ref_id=payment_id)


@transaction.atomic
def debit_refund_payout(user: User, amount: int, refund_id: uuid.UUID, *, actor: User) -> WalletEntry:
    """Staff paid money back outside the system (BR-45); remove it from the main balance."""
    wallet = _locked_wallet(user)
    if wallet.main_balance - wallet.held_amount < amount and wallet.main_balance < amount:
        raise DomainError("insufficient_balance", "Asosiy balansda bu summa yoʻq.", status.HTTP_409_CONFLICT)
    return _post(
        wallet,
        Bucket.MAIN,
        EntryType.REFUND_PAYOUT,
        -amount,
        ref_type="refund_request",
        ref_id=refund_id,
        actor=actor,
    )


# --- manual operations (staff panel, phase 7) -----------------------------------------------


@transaction.atomic
def adjust(user: User, bucket: Bucket, amount: int, *, actor: User, note: str) -> WalletEntry:
    """Staff correction or manual top-up before Click exists (BR-44). Always audited."""
    if bucket == Bucket.HOLD:
        raise ValueError("holds are adjusted through hold/release, never directly")
    if not note.strip():
        raise DomainError("note_required", "Tuzatish sababini yozing.")
    wallet = _locked_wallet(user)
    if bucket == Bucket.BONUS and wallet.bonus_balance + amount < 0:
        raise DomainError("bonus_negative", "Bonus balansi manfiy boʻlishi mumkin emas.")
    return _post(wallet, bucket, EntryType.ADJUSTMENT, amount, actor=actor, note=note)


# --- integrity ------------------------------------------------------------------------------


@dataclass(frozen=True)
class Mismatch:
    user_id: uuid.UUID
    field: str
    cached: int
    ledger: int


def reconcile() -> list[Mismatch]:
    """Compare cached balances with ledger sums and active holds. Empty list = consistent."""
    sums: dict[tuple[uuid.UUID, str], int] = {
        (row["user_id"], row["bucket"]): row["total"] or 0
        for row in WalletEntry.objects.values("user_id", "bucket").annotate(total=Sum("amount"))
    }
    active_holds: dict[uuid.UUID, int] = {
        row["user_id"]: row["total"] or 0
        for row in Hold.objects.filter(status=Hold.Status.ACTIVE)
        .values("user_id")
        .annotate(total=Sum("amount"))
    }
    problems: list[Mismatch] = []
    for w in Wallet.objects.all():
        checks = [
            ("main_balance", w.main_balance, sums.get((w.user_id, Bucket.MAIN), 0)),
            ("bonus_balance", w.bonus_balance, sums.get((w.user_id, Bucket.BONUS), 0)),
            ("held_amount", w.held_amount, sums.get((w.user_id, Bucket.HOLD), 0)),
            ("held_vs_holds", w.held_amount, active_holds.get(w.user_id, 0)),
        ]
        problems += [
            Mismatch(w.user_id, f, cached, ledger) for f, cached, ledger in checks if cached != ledger
        ]
    return problems
