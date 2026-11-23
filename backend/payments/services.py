"""Top-ups via Click (SHOP API Prepare/Complete) or the local fake provider; refund requests.

Click protocol details must be re-checked against Click's official merchant docs when the
contract is signed (docs/API.md). Everything here is idempotent: Click may retry callbacks.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from typing import TYPE_CHECKING, Any
from urllib.parse import urlencode

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status as http

from core.errors import DomainError
from notifications.services import notify
from payments.models import Payment, RefundRequest
from wallet import services as wallet

if TYPE_CHECKING:
    from accounts.models import User


def _som(amount: int) -> str:
    return f"{amount:,}".replace(",", " ") + " soʻm"


# --- top-up --------------------------------------------------------------------------------


def start_topup(user: User, amount: int) -> tuple[Payment, str]:
    if not settings.TOPUP_MIN <= amount <= settings.TOPUP_MAX:
        raise DomainError(
            "invalid_amount",
            f"Summa {_som(settings.TOPUP_MIN)} dan {_som(settings.TOPUP_MAX)} gacha boʻlishi kerak.",
        )
    provider = settings.PAYMENTS_PROVIDER
    if provider == Payment.Provider.CLICK:
        if not (settings.CLICK_SERVICE_ID and settings.CLICK_MERCHANT_ID and settings.CLICK_SECRET_KEY):
            raise DomainError(
                "payments_unavailable", "Toʻlov tizimi hali ulanmagan.", http.HTTP_503_SERVICE_UNAVAILABLE
            )
        payment = Payment.objects.create(user=user, provider=Payment.Provider.CLICK, amount=amount)
        query = urlencode(
            {
                "service_id": settings.CLICK_SERVICE_ID,
                "merchant_id": settings.CLICK_MERCHANT_ID,
                "amount": amount,
                "transaction_param": str(payment.id),
                "return_url": f"{settings.FRONTEND_URL.rstrip('/')}/wallet?payment={payment.id}",
            }
        )
        return payment, f"https://my.click.uz/services/pay?{query}"
    if provider == Payment.Provider.FAKE and settings.DEBUG:
        payment = Payment.objects.create(user=user, provider=Payment.Provider.FAKE, amount=amount)
        return payment, f"/wallet/test-payment/{payment.id}"
    raise DomainError(
        "payments_unavailable", "Toʻlov tizimi hali ulanmagan.", http.HTTP_503_SERVICE_UNAVAILABLE
    )


@transaction.atomic
def _complete(payment: Payment, raw: dict[str, Any] | None = None) -> None:
    payment.status = Payment.PaymentStatus.COMPLETED
    payment.completed_at = timezone.now()
    if raw is not None:
        payment.raw_complete = raw
    payment.save()
    wallet.credit_topup(payment.user, payment.amount, payment.id)
    notify(payment.user, "topup", "Balans toʻldirildi", f"+{_som(payment.amount)}", "/wallet")


@transaction.atomic
def complete_fake(payment_id: uuid.UUID, user: User) -> Payment:
    """Development only (DEBUG + PAYMENTS_PROVIDER=fake): simulates a successful payment."""
    if not (settings.DEBUG and settings.PAYMENTS_PROVIDER == Payment.Provider.FAKE):
        raise DomainError("not_found", "Topilmadi.", http.HTTP_404_NOT_FOUND)
    payment = Payment.objects.select_for_update().filter(id=payment_id, user=user, provider="fake").first()
    if payment is None:
        raise DomainError("not_found", "Toʻlov topilmadi.", http.HTTP_404_NOT_FOUND)
    if payment.status != Payment.PaymentStatus.COMPLETED:
        _complete(payment)
    return payment


def get_own(payment_id: uuid.UUID, user: User) -> Payment:
    payment = Payment.objects.filter(id=payment_id, user=user).first()
    if payment is None:
        raise DomainError("not_found", "Toʻlov topilmadi.", http.HTTP_404_NOT_FOUND)
    return payment


# --- Click callbacks -------------------------------------------------------------------------

OK, SIGN_FAILED, BAD_AMOUNT, BAD_ACTION, ALREADY_PAID, NO_ORDER, NO_TRANSACTION, BAD_REQUEST, CANCELLED = (
    0,
    -1,
    -2,
    -3,
    -4,
    -5,
    -6,
    -8,
    -9,
)
NOTES = {
    OK: "Success",
    SIGN_FAILED: "SIGN CHECK FAILED!",
    BAD_AMOUNT: "Incorrect parameter amount",
    BAD_ACTION: "Action not found",
    ALREADY_PAID: "Already paid",
    NO_ORDER: "User does not exist",
    NO_TRANSACTION: "Transaction does not exist",
    BAD_REQUEST: "Error in request from click",
    CANCELLED: "Transaction cancelled",
}


def _expected_sign(p: dict[str, str], action: str) -> str:
    prepare_id = p.get("merchant_prepare_id", "") if action == "1" else ""
    raw = (
        f"{p.get('click_trans_id', '')}{p.get('service_id', '')}{settings.CLICK_SECRET_KEY}"
        f"{p.get('merchant_trans_id', '')}{prepare_id}{p.get('amount', '')}{action}{p.get('sign_time', '')}"
    )
    return hashlib.md5(raw.encode()).hexdigest()  # noqa: S324 - mandated by the Click protocol


def _answer(p: dict[str, str], error: int, **extra: Any) -> dict[str, Any]:
    return {
        "click_trans_id": p.get("click_trans_id"),
        "merchant_trans_id": p.get("merchant_trans_id"),
        "error": error,
        "error_note": NOTES[error],
        **extra,
    }


def _common(p: dict[str, str], action: str) -> tuple[int, Payment | None]:
    if not settings.CLICK_SECRET_KEY:
        return BAD_REQUEST, None
    if p.get("action") != action:
        return BAD_ACTION, None
    if not secrets.compare_digest(p.get("sign_string", ""), _expected_sign(p, action)):
        return SIGN_FAILED, None
    if p.get("service_id") != str(settings.CLICK_SERVICE_ID):
        return BAD_REQUEST, None
    try:
        payment = Payment.objects.select_for_update().get(id=uuid.UUID(p.get("merchant_trans_id", "")))
    except (ValueError, Payment.DoesNotExist):
        return NO_ORDER, None
    try:
        if int(float(p.get("amount", "0"))) != payment.amount:
            return BAD_AMOUNT, payment
    except ValueError:
        return BAD_AMOUNT, payment
    return OK, payment


@transaction.atomic
def click_prepare(p: dict[str, str]) -> dict[str, Any]:
    error, payment = _common(p, "0")
    if error != OK or payment is None:
        return _answer(p, error)
    if payment.status == Payment.PaymentStatus.COMPLETED:
        return _answer(p, ALREADY_PAID)
    if payment.status == Payment.PaymentStatus.CANCELLED:
        return _answer(p, CANCELLED)
    try:
        trans_id = int(p.get("click_trans_id", ""))
    except ValueError:
        return _answer(p, BAD_REQUEST)
    payment.status = Payment.PaymentStatus.PREPARED
    payment.provider_trans_id = trans_id
    payment.provider_paydoc_id = int(p["click_paydoc_id"]) if p.get("click_paydoc_id", "").isdigit() else None
    payment.raw_prepare = dict(p)
    payment.save()
    return _answer(p, OK, merchant_prepare_id=trans_id)


@transaction.atomic
def click_complete(p: dict[str, str]) -> dict[str, Any]:
    error, payment = _common(p, "1")
    if error != OK or payment is None:
        return _answer(p, error)
    if str(payment.provider_trans_id) != p.get("merchant_prepare_id"):
        return _answer(p, NO_TRANSACTION)
    if payment.status == Payment.PaymentStatus.COMPLETED:
        return _answer(p, ALREADY_PAID, merchant_confirm_id=payment.provider_trans_id)
    if payment.status == Payment.PaymentStatus.CANCELLED:
        return _answer(p, CANCELLED)
    if p.get("error", "0") != "0":
        payment.status = Payment.PaymentStatus.CANCELLED
        payment.raw_complete = dict(p)
        payment.save()
        return _answer(p, CANCELLED)
    _complete(payment, dict(p))
    return _answer(p, OK, merchant_confirm_id=payment.provider_trans_id)


# --- refund requests (BR-45) -------------------------------------------------------------------


def create_refund_request(user: User, amount: int, click_reference: str, reason: str) -> RefundRequest:
    if amount <= 0:
        raise DomainError("invalid_amount", "Summani kiriting.")
    if amount > wallet.get_wallet(user).main_balance:
        raise DomainError("invalid_amount", "Summa asosiy balansdan katta boʻlishi mumkin emas.")
    if not click_reference.strip() or not reason.strip():
        raise DomainError("incomplete", "Toʻlov raqami va sababni yozing.")
    if RefundRequest.objects.filter(user=user, status=RefundRequest.RefundStatus.OPEN).exists():
        raise DomainError("already_open", "Sizda koʻrib chiqilayotgan ariza bor.", http.HTTP_409_CONFLICT)
    return RefundRequest.objects.create(
        user=user, amount=amount, click_reference=click_reference.strip()[:64], reason=reason.strip()
    )


@transaction.atomic
def resolve_refund(refund_id: uuid.UUID, staff: User, done: bool, note: str) -> RefundRequest:
    req = RefundRequest.objects.select_for_update().select_related("user").filter(id=refund_id).first()
    if req is None:
        raise DomainError("not_found", "Ariza topilmadi.", http.HTTP_404_NOT_FOUND)
    if req.status != RefundRequest.RefundStatus.OPEN:
        raise DomainError("already_resolved", "Ariza allaqachon koʻrib chiqilgan.", http.HTTP_409_CONFLICT)
    if done:
        wallet.debit_refund_payout(req.user, req.amount, req.id, actor=staff)
        req.status = RefundRequest.RefundStatus.DONE
        notify(
            req.user,
            "refund_done",
            "Pul qaytarildi",
            f"{_som(req.amount)} Click orqali qaytarildi.",
            "/wallet",
        )
    else:
        if not note.strip():
            raise DomainError("reason_required", "Rad etish sababini yozing.")
        req.status = RefundRequest.RefundStatus.REJECTED
        notify(req.user, "refund_rejected", "Pulni qaytarish arizasi rad etildi", note, "/wallet")
    req.handled_by = staff
    req.note = note
    req.handled_at = timezone.now()
    req.save()
    return req
