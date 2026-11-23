"""Deal follow-up: ratings (BR-50/51), "deal failed" claims (BR-34), completion."""

from __future__ import annotations

import uuid
from datetime import timedelta
from decimal import Decimal
from typing import TYPE_CHECKING

from django.db import IntegrityError, transaction
from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework import status as http

from core.errors import DomainError
from core.models import PlatformSettings
from deals.models import Deal, DealClaim, Rating
from notifications.services import notify
from wallet import services as wallet

if TYPE_CHECKING:
    from accounts.models import User


def get_for_party(deal_id: uuid.UUID, user: User) -> Deal:
    deal = Deal.objects.select_related("auction", "seller", "buyer").filter(id=deal_id).first()
    if deal is None or user.id not in (deal.seller_id, deal.buyer_id):
        raise DomainError("not_found", "Bitim topilmadi.", http.HTTP_404_NOT_FOUND)
    return deal


def can_rate(deal: Deal, user: User) -> bool:
    window = timedelta(days=PlatformSettings.load().rating_window_days)
    return (
        deal.status != Deal.DealStatus.FAILED
        and timezone.now() <= deal.created_at + window
        and not Rating.objects.filter(deal=deal, author=user).exists()
    )


def can_claim(deal: Deal, user: User) -> bool:
    window = timedelta(days=PlatformSettings.load().claim_window_days)
    return (
        user.id == deal.seller_id
        and deal.status == Deal.DealStatus.ACTIVE
        and timezone.now() <= deal.created_at + window
        and not deal.claims.filter(status=DealClaim.ClaimStatus.OPEN).exists()
    )


def refresh_user_stats(user: User) -> None:
    agg = Rating.objects.filter(target=user).aggregate(avg=Avg("score"), n=Count("id"))
    user.rating_avg = Decimal(str(round(agg["avg"], 2))) if agg["avg"] is not None else None
    user.rating_count = agg["n"]
    user.deals_count = (
        Deal.objects.filter(Q(seller=user) | Q(buyer=user)).exclude(status=Deal.DealStatus.FAILED).count()
    )
    user.save(update_fields=["rating_avg", "rating_count", "deals_count"])


@transaction.atomic
def rate(deal_id: uuid.UUID, user: User, score: int, comment: str = "") -> Rating:
    deal = get_for_party(deal_id, user)
    if not 1 <= score <= 5:
        raise DomainError("invalid_score", "Baho 1 dan 5 gacha boʻlishi kerak.")
    if not can_rate(deal, user):
        raise DomainError("cannot_rate", "Bu bitimni baholab boʻlmaydi.", http.HTTP_409_CONFLICT)
    from moderation.checks import _normalize
    from moderation.wordlist import PROFANITY_ROOTS  # reuse the description filter

    words = _normalize(comment).split()
    if any(w.startswith(root) for w in words for root in PROFANITY_ROOTS):
        raise DomainError("profanity", "Izohda haqoratli soʻz bor.")
    target = deal.buyer if user.id == deal.seller_id else deal.seller
    try:
        rating = Rating.objects.create(
            deal=deal, author=user, target=target, score=score, comment=comment.strip()
        )
    except IntegrityError as exc:
        raise DomainError("cannot_rate", "Siz bu bitimni allaqachon baholagansiz.", 409) from exc
    refresh_user_stats(target)
    notify(target, "rated", f"Sizga {score} baho qoʻyildi", deal.auction.title, f"/deals/{deal.id}")
    return rating


@transaction.atomic
def file_claim(deal_id: uuid.UUID, user: User, reason: str) -> DealClaim:
    deal = get_for_party(deal_id, user)
    if not reason.strip():
        raise DomainError("reason_required", "Nima boʻlganini qisqacha yozing.")
    if not can_claim(deal, user):
        raise DomainError("cannot_claim", "Bu bitim boʻyicha ariza berib boʻlmaydi.", http.HTTP_409_CONFLICT)
    return DealClaim.objects.create(deal=deal, author=user, reason=reason.strip())


@transaction.atomic
def resolve_claim(claim_id: uuid.UUID, moderator: User, approve: bool, note: str) -> DealClaim:
    claim = DealClaim.objects.select_for_update().select_related("deal").filter(id=claim_id).first()
    if claim is None:
        raise DomainError("not_found", "Ariza topilmadi.", http.HTTP_404_NOT_FOUND)
    if claim.status != DealClaim.ClaimStatus.OPEN:
        raise DomainError("already_resolved", "Ariza allaqachon koʻrib chiqilgan.", http.HTTP_409_CONFLICT)
    deal = Deal.objects.select_for_update().get(id=claim.deal_id)
    claim.status = DealClaim.ClaimStatus.APPROVED if approve else DealClaim.ClaimStatus.REJECTED
    claim.resolved_by = moderator
    claim.resolution_note = note
    claim.resolved_at = timezone.now()
    claim.save()
    if approve:
        refunded = wallet.refund_commission(deal.seller, "deal", deal.id, actor=moderator)
        deal.status = Deal.DealStatus.FAILED
        deal.save(update_fields=["status"])
        refresh_user_stats(deal.seller)
        refresh_user_stats(deal.buyer)
        notify(
            deal.seller,
            "claim_approved",
            "Arizangiz tasdiqlandi",
            f"Komissiya balansingizga qaytarildi: {refunded:,} soʻm.".replace(",", " "),
            "/wallet",
        )
    else:
        notify(deal.seller, "claim_rejected", "Arizangiz rad etildi", note, f"/deals/{deal.id}")
    return claim


def complete_due_deals() -> int:
    """Deals without an open claim become completed once the claim window has passed."""
    cutoff = timezone.now() - timedelta(days=PlatformSettings.load().claim_window_days)
    due = Deal.objects.filter(status=Deal.DealStatus.ACTIVE, created_at__lt=cutoff).exclude(
        claims__status=DealClaim.ClaimStatus.OPEN
    )
    count = 0
    for deal in due:
        deal.status = Deal.DealStatus.COMPLETED
        deal.completed_at = timezone.now()
        deal.save(update_fields=["status", "completed_at"])
        count += 1
    return count
