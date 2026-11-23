"""Auction business logic (BR-10..35). Views stay thin; everything rule-related lives here."""

from __future__ import annotations

import contextlib
import math
import uuid
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from django.conf import settings as django_settings
from django.core.files.uploadedfile import UploadedFile
from django.db import IntegrityError, transaction
from django.db.models import Max, Q
from django.db.models.functions import Now
from django.utils import timezone
from rest_framework import status as http

from auctions import media as media_store
from auctions import storage
from auctions.models import (
    EDITABLE_STATUSES,
    Auction,
    AuctionBidder,
    AuctionCheck,
    AuctionEvent,
    AuctionMedia,
    Bid,
    CaptureSession,
    Status,
    Watch,
)
from core.errors import DomainError
from core.models import PlatformSettings
from deals.models import Deal
from deals.services import refresh_user_stats
from moderation import checks
from notifications.services import notify
from wallet import services as wallet

if TYPE_CHECKING:
    from accounts.models import User

HOLD_REF = "auction"

# --- helpers ------------------------------------------------------------------------------


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(a)), 1)


def user_point(user: User) -> tuple[float, float] | None:
    if user.lat is not None and user.lng is not None:
        return float(user.lat), float(user.lng)
    if user.district_id and user.district is not None:
        return float(user.district.lat), float(user.district.lng)
    return None


def format_age(months: int | None) -> str:
    if months is None:
        return ""
    if months < 12:
        return f"{months} oylik"
    years, rest = divmod(months, 12)
    return f"{years} yosh" if rest == 0 else f"{years} yosh {rest} oy"


def build_title(a: Auction) -> str:
    """BR-15: the title is generated from structured fields, never typed by the seller."""
    parts = [
        a.animal_type.name if a.animal_type else "",
        a.animal_class.name if a.animal_class else "",
        a.breed.name if a.breed else a.breed_other,
        format_age(a.age_months),
    ]
    return " · ".join(p for p in parts if p)[:160]


def _event(auction: Auction, old: str, new: str, actor: User | None, reason: str = "") -> None:
    AuctionEvent.objects.create(auction=auction, from_status=old, to_status=new, actor=actor, reason=reason)


ALLOWED: dict[str, set[str]] = {
    Status.DRAFT: {Status.PENDING_REVIEW, Status.REJECTED, Status.SCHEDULED, Status.LIVE},
    Status.REJECTED: {Status.DRAFT, Status.PENDING_REVIEW, Status.SCHEDULED, Status.LIVE},
    Status.PENDING_REVIEW: {Status.SCHEDULED, Status.LIVE, Status.REJECTED, Status.CANCELLED, Status.BLOCKED},
    Status.SCHEDULED: {Status.LIVE, Status.CANCELLED, Status.BLOCKED},
    Status.LIVE: {Status.ENDED, Status.SOLD, Status.UNSOLD, Status.CANCELLED, Status.BLOCKED},
    Status.ENDED: {Status.SOLD, Status.UNSOLD, Status.BLOCKED},
    Status.SOLD: set(),
    Status.UNSOLD: set(),
    Status.CANCELLED: set(),
    Status.BLOCKED: set(),
}


def transition(auction: Auction, new: str, *, actor: User | None = None, reason: str = "") -> None:
    """The only way to change Auction.status (AGENTS.md). Caller holds the row lock."""
    old = auction.status
    if new not in ALLOWED[old]:
        raise DomainError(
            "invalid_transition", "Bu amalni hozirgi holatda bajarib boʻlmaydi.", http.HTTP_409_CONFLICT
        )
    auction.status = new
    auction.save()
    _event(auction, old, new, actor, reason)


def _lock(auction_id: uuid.UUID) -> Auction:
    found = Auction.objects.select_for_update().filter(id=auction_id).first()
    if found is None:
        raise DomainError("not_found", "Auksion topilmadi.", http.HTTP_404_NOT_FOUND)
    return found


def _own(auction: Auction, user: User) -> None:
    if auction.seller_id != user.id:
        raise DomainError("permission_denied", "Bu auksion sizniki emas.", http.HTTP_403_FORBIDDEN)


def _require_active_user(user: User) -> None:
    if user.is_blocked:
        raise DomainError("user_blocked", "Akkauntingiz bloklangan.", http.HTTP_403_FORBIDDEN)


# --- drafts ---------------------------------------------------------------------------------

DRAFT_FIELDS = (
    "direction",
    "animal_type",
    "animal_class",
    "breed",
    "breed_other",
    "age_months",
    "weight_kg",
    "weight_is_estimated",
    "description",
    "asking_price",
    "region",
    "district",
    "start_now",
    "starts_at",
    "duration_minutes",
)


def _apply_fields(auction: Auction, data: dict[str, Any]) -> None:
    for name in DRAFT_FIELDS:
        if name in data:
            setattr(auction, name, data[name])
    if auction.district is not None:
        auction.region = auction.district.region
        auction.lat, auction.lng = auction.district.lat, auction.district.lng
    auction.title = build_title(auction)


@transaction.atomic
def create_draft(user: User, data: dict[str, Any]) -> Auction:
    _require_active_user(user)
    auction = Auction(seller=user)
    if "district" not in data and user.district is not None:
        data = {**data, "district": user.district}
    _apply_fields(auction, data)
    auction.save()
    _event(auction, "", Status.DRAFT, user)
    return auction


@transaction.atomic
def update_draft(auction_id: uuid.UUID, user: User, data: dict[str, Any]) -> Auction:
    auction = _lock(auction_id)
    _own(auction, user)
    if auction.status not in EDITABLE_STATUSES:
        raise DomainError(
            "not_editable", "Eʼlon qilingan auksionni tahrirlab boʻlmaydi.", http.HTTP_409_CONFLICT
        )
    _apply_fields(auction, data)
    auction.save()
    return auction


@transaction.atomic
def delete_draft(auction_id: uuid.UUID, user: User) -> None:
    auction = _lock(auction_id)
    _own(auction, user)
    if auction.status not in EDITABLE_STATUSES:
        raise DomainError("not_editable", "Faqat qoralamani oʻchirish mumkin.", http.HTTP_409_CONFLICT)
    auction.delete()


# --- media ----------------------------------------------------------------------------------


@transaction.atomic
def open_capture_session(auction_id: uuid.UUID, user: User, user_agent: str = "") -> CaptureSession:
    auction = _lock(auction_id)
    _own(auction, user)
    if auction.status not in EDITABLE_STATUSES:
        raise DomainError("not_editable", "Bu auksionga media qoʻshib boʻlmaydi.", http.HTTP_409_CONFLICT)
    return CaptureSession.objects.create(
        user=user,
        auction=auction,
        user_agent=user_agent[:300],
        expires_at=timezone.now() + timedelta(minutes=django_settings.CAPTURE_SESSION_TTL_MINUTES),
    )


def _check_media_allowed(
    auction: Auction, user: User, kind: str, session_id: uuid.UUID, settings: PlatformSettings
) -> CaptureSession:
    _own(auction, user)
    if auction.status not in EDITABLE_STATUSES:
        raise DomainError("not_editable", "Bu auksionga media qoʻshib boʻlmaydi.", http.HTTP_409_CONFLICT)
    session = CaptureSession.objects.filter(id=session_id, auction=auction, user=user).first()
    if session is None or session.expires_at <= timezone.now():
        raise DomainError("capture_session_expired", "Kamera seansi tugadi. Kamerani qaytadan oching.")
    if kind not in (AuctionMedia.Kind.PHOTO, AuctionMedia.Kind.VIDEO):
        raise DomainError("unsupported_media", "Notoʻgʻri media turi.")
    existing = auction.media.exclude(status=AuctionMedia.MediaStatus.FAILED).filter(kind=kind).count()
    limit = settings.photos_max if kind == AuctionMedia.Kind.PHOTO else settings.videos_max
    if existing >= limit:
        noun = "rasm" if kind == AuctionMedia.Kind.PHOTO else "video"
        raise DomainError("too_many_media", f"Koʻpi bilan {limit} ta {noun} qoʻshish mumkin.")
    return session


def add_media(
    auction_id: uuid.UUID,
    user: User,
    upload: UploadedFile[bytes],
    kind: str,
    session_id: uuid.UUID,
    client_meta: dict[str, Any],
) -> AuctionMedia:
    settings = PlatformSettings.load()
    # Cheap check first, then the upload OUTSIDE any transaction (it may be an HTTP call to
    # Nhost), then the same checks again under the row lock before the row is created.
    with transaction.atomic():
        _check_media_allowed(_lock(auction_id), user, kind, session_id, settings)
    try:
        stored, size = media_store.store_original(auction_id, upload, kind)
    except media_store.StorageUnavailable as exc:
        # Our storage failed, not the user's file: 503 so it is not mistaken for a bad upload.
        raise DomainError("storage_unavailable", str(exc), http.HTTP_503_SERVICE_UNAVAILABLE) from exc
    except media_store.MediaError as exc:
        raise DomainError("file_too_large", str(exc), http.HTTP_413_REQUEST_ENTITY_TOO_LARGE) from exc
    try:
        with transaction.atomic():
            auction = _lock(auction_id)
            session = _check_media_allowed(auction, user, kind, session_id, settings)
            position = (auction.media.aggregate(m=Max("position"))["m"] or 0) + 1
            item = AuctionMedia.objects.create(
                auction=auction,
                capture_session=session,
                kind=kind,
                position=position,
                original_path=stored,
                size_bytes=size,
                client_meta={k: str(v)[:200] for k, v in list(client_meta.items())[:20]},
            )
    except BaseException:
        storage.delete(stored)
        raise
    if kind == AuctionMedia.Kind.PHOTO or django_settings.MEDIA_PROCESS_SYNC:
        media_store.process(item, settings.video_max_s)
    else:
        from auctions.tasks import process_video

        transaction.on_commit(lambda: process_video.defer(media_id=str(item.id)))
    return item


@transaction.atomic
def delete_media(auction_id: uuid.UUID, media_id: uuid.UUID, user: User) -> None:
    auction = _lock(auction_id)
    _own(auction, user)
    if auction.status not in EDITABLE_STATUSES:
        raise DomainError("not_editable", "Eʼlon qilingan auksion mediasini oʻzgartirib boʻlmaydi.", 409)
    item = auction.media.filter(id=media_id).first()
    if item is None:
        raise DomainError("not_found", "Fayl topilmadi.", http.HTTP_404_NOT_FOUND)
    refs = [item.original_path, item.file_path, item.thumb_path]
    item.delete()
    # Files go only once the row is gone for good; a rollback keeps them.
    transaction.on_commit(lambda: _delete_files(refs))


def _delete_files(refs: list[str]) -> None:
    for ref in refs:
        storage.delete(ref)


# --- submit / publish -----------------------------------------------------------------------


@dataclass(frozen=True)
class SubmitResult:
    auction: Auction
    outcome: str  # published | pending_review | rejected
    results: list[checks.CheckResult]


def _validate_ready(a: Auction, s: PlatformSettings) -> None:
    missing = [
        label
        for label, value in (
            ("yoʻnalish", a.direction_id),
            ("hayvon turi", a.animal_type_id),
            ("toifa", a.animal_class_id),
            ("yoshi", a.age_months),
            ("narx", a.asking_price),
            ("tuman", a.district_id),
            ("davomiylik", a.duration_minutes),
        )
        if not value
    ]
    if missing:
        raise DomainError("incomplete", "Toʻldirilmagan maydonlar: " + ", ".join(missing) + ".")
    if a.animal_type is None or a.animal_class is None or a.direction is None:
        raise DomainError("incomplete", "Hayvon turi, toifa va yoʻnalishni tanlang.")
    if a.animal_class.animal_type_id != a.animal_type_id or (
        a.breed and a.breed.animal_type_id != a.animal_type_id
    ):
        raise DomainError("invalid_taxonomy", "Toifa yoki zot tanlangan hayvon turiga mos emas.")
    if not a.animal_type.directions.filter(id=a.direction.id).exists():
        raise DomainError("invalid_taxonomy", "Bu hayvon turi tanlangan yoʻnalishga kirmaydi.")
    duration = a.duration_minutes or 0
    if not s.min_duration_min <= duration <= s.max_duration_min:
        raise DomainError(
            "invalid_duration",
            f"Davomiylik {s.min_duration_min} daqiqadan {s.max_duration_min // 60} soatgacha boʻlsin.",
        )
    if not a.start_now:
        if a.starts_at is None:
            raise DomainError("invalid_start", "Boshlanish vaqtini tanlang.")
        now = timezone.now()
        if a.starts_at < now - timedelta(minutes=1):
            raise DomainError("invalid_start", "Boshlanish vaqti oʻtib ketgan.")
        if a.starts_at > now + timedelta(days=s.max_schedule_ahead_days):
            raise DomainError(
                "invalid_start",
                f"Boshlanishni koʻpi bilan {s.max_schedule_ahead_days} kun oldinga belgilash mumkin.",
            )
    if a.media.filter(status=AuctionMedia.MediaStatus.PROCESSING).exists():
        raise DomainError("media_processing", "Video hali qayta ishlanmoqda. Birozdan keyin yuboring.")


def _schedule(a: Auction) -> None:
    now = timezone.now()
    start = now if a.start_now or a.starts_at is None or a.starts_at < now else a.starts_at
    a.starts_at = start
    a.ends_at = start + timedelta(minutes=a.duration_minutes or 0)
    a.decision_deadline = a.ends_at + timedelta(hours=PlatformSettings.load().decision_window_h)


def _go_public(a: Auction, actor: User | None) -> None:
    _schedule(a)
    a.published_at = timezone.now()
    transition(
        a, Status.LIVE if a.starts_at and a.starts_at <= timezone.now() else Status.SCHEDULED, actor=actor
    )


@transaction.atomic
def submit(auction_id: uuid.UUID, user: User) -> SubmitResult:
    """Run checks; on pass publish, on warn queue for a moderator, on fail reject with reasons.

    The commission hold (BR-41) is placed for pass and warn, and released if a moderator
    later rejects the auction.
    """
    _require_active_user(user)
    a = _lock(auction_id)
    _own(a, user)
    if a.status not in EDITABLE_STATUSES:
        raise DomainError("not_editable", "Bu auksion allaqachon yuborilgan.", http.HTTP_409_CONFLICT)
    s = PlatformSettings.load()
    _validate_ready(a, s)

    results = checks.run_all(a, s)
    run_id = uuid.uuid4()
    AuctionCheck.objects.bulk_create(
        AuctionCheck(
            auction=a, run_id=run_id, check_name=r.name, result=r.result, message=r.message, details=r.details
        )
        for r in results
    )
    if any(r.result == checks.FAIL for r in results):
        a.rejection_reason = " ".join(r.message for r in results if r.result == checks.FAIL)
        if a.status != Status.REJECTED:
            transition(a, Status.REJECTED, actor=user, reason="automatic checks")
        else:
            a.save()
        return SubmitResult(a, "rejected", results)

    price = a.asking_price or 0
    a.commission_rate_bp = s.commission_rate_bp
    a.min_bid = -(-price * s.min_bid_pct // 100)
    a.max_bid = price * s.max_bid_pct // 100
    a.hold_amount = wallet.commission_for(price, s.commission_rate_bp)
    a.rejection_reason = ""
    wallet.hold(user, HOLD_REF, a.id, a.hold_amount)

    if any(r.result == checks.WARN for r in results):
        transition(a, Status.PENDING_REVIEW, actor=user, reason="automatic checks: warnings")
        notify(user, "auction_pending", "Auksioningiz moderatorga yuborildi", a.title, f"/a/{a.id}")
        return SubmitResult(a, "pending_review", results)

    _go_public(a, user)
    notify(user, "auction_published", "Auksioningiz eʼlon qilindi", a.title, f"/a/{a.id}")
    return SubmitResult(a, "published", results)


@transaction.atomic
def cancel(auction_id: uuid.UUID, user: User, reason: str = "") -> Auction:
    """BR-18: any time before start; while live only without bids."""
    a = _lock(auction_id)
    _own(a, user)
    if a.status == Status.LIVE and a.bids.filter(status=Bid.BidStatus.ACTIVE).exists():
        raise DomainError(
            "has_bids", "Taklif tushgan jonli auksionni bekor qilib boʻlmaydi.", http.HTTP_409_CONFLICT
        )
    if a.status not in (Status.PENDING_REVIEW, Status.SCHEDULED, Status.LIVE):
        raise DomainError("invalid_transition", "Bu auksionni bekor qilib boʻlmaydi.", http.HTTP_409_CONFLICT)
    a.cancel_reason = reason[:500]
    a.closed_at = timezone.now()
    transition(a, Status.CANCELLED, actor=user, reason=reason)
    wallet.release_hold(HOLD_REF, a.id)
    _notify_watchers(a, "Auksion bekor qilindi", exclude={user.id})
    return a


# --- moderation actions ---------------------------------------------------------------------


@transaction.atomic
def approve(auction_id: uuid.UUID, moderator: User, note: str = "") -> Auction:
    a = _lock(auction_id)
    if a.status != Status.PENDING_REVIEW:
        raise DomainError("invalid_transition", "Auksion moderatsiyada emas.", http.HTTP_409_CONFLICT)
    a.moderation_note = note
    _go_public(a, moderator)
    notify(a.seller, "auction_published", "Auksioningiz tasdiqlandi va eʼlon qilindi", a.title, f"/a/{a.id}")
    return a


@transaction.atomic
def reject(auction_id: uuid.UUID, moderator: User, reason: str) -> Auction:
    if not reason.strip():
        raise DomainError("reason_required", "Rad etish sababini yozing.")
    a = _lock(auction_id)
    if a.status != Status.PENDING_REVIEW:
        raise DomainError("invalid_transition", "Auksion moderatsiyada emas.", http.HTTP_409_CONFLICT)
    a.rejection_reason = reason
    transition(a, Status.REJECTED, actor=moderator, reason=reason)
    wallet.release_hold(HOLD_REF, a.id)
    notify(a.seller, "auction_rejected", "Auksion rad etildi", reason, f"/sell/{a.id}")
    return a


@transaction.atomic
def block(auction_id: uuid.UUID, moderator: User, reason: str) -> Auction:
    """BR-61: hold released, active bids voided."""
    if not reason.strip():
        raise DomainError("reason_required", "Bloklash sababini yozing.")
    a = _lock(auction_id)
    had_hold = a.status in (Status.PENDING_REVIEW, Status.SCHEDULED, Status.LIVE, Status.ENDED)
    transition(a, Status.BLOCKED, actor=moderator, reason=reason)
    a.closed_at = timezone.now()
    a.save(update_fields=["closed_at"])
    a.bids.filter(status=Bid.BidStatus.ACTIVE).update(status=Bid.BidStatus.VOID)
    if had_hold:
        wallet.release_hold(HOLD_REF, a.id)
    notify(a.seller, "auction_blocked", "Auksioningiz bloklandi", reason, f"/a/{a.id}")
    return a


# --- bidding ---------------------------------------------------------------------------------


@transaction.atomic
def place_bid(auction_id: uuid.UUID, user: User, amount: int) -> Bid:
    _require_active_user(user)
    # The time window is checked by the database (NFR-03): a late worker never lets a bid in.
    a = (
        Auction.objects.select_for_update()
        .filter(
            id=auction_id, status__in=(Status.SCHEDULED, Status.LIVE), starts_at__lte=Now(), ends_at__gt=Now()
        )
        .first()
    )
    if a is None:
        raise DomainError("auction_not_live", "Auksion hozir taklif qabul qilmaydi.", http.HTTP_409_CONFLICT)
    if a.status == Status.SCHEDULED:
        transition(a, Status.LIVE)
    if a.seller_id == user.id:
        raise DomainError("own_auction", "Oʻz auksioningizga taklif bera olmaysiz.", http.HTTP_403_FORBIDDEN)
    if amount < (a.min_bid or 0):
        raise DomainError(
            "bid_too_low", f"Taklif kamida {a.min_bid:,} soʻm boʻlishi kerak.".replace(",", " ")
        )
    if a.max_bid and amount > a.max_bid:
        raise DomainError(
            "bid_too_high", f"Taklif koʻpi bilan {a.max_bid:,} soʻm boʻlishi mumkin.".replace(",", " ")
        )
    last = Bid.objects.filter(auction=a, bidder=user).order_by("-created_at").first()
    if last and timezone.now() - last.created_at < timedelta(seconds=10):
        raise DomainError("rate_limited", "Bir necha soniyadan keyin qayta urinib koʻring.", 429)

    previous_top = (
        Bid.objects.filter(auction=a, status=Bid.BidStatus.ACTIVE).order_by("-amount", "created_at").first()
    )
    Bid.objects.filter(auction=a, bidder=user, status=Bid.BidStatus.ACTIVE).update(
        status=Bid.BidStatus.SUPERSEDED
    )
    if not AuctionBidder.objects.filter(auction=a, user=user).exists():
        next_no = (AuctionBidder.objects.filter(auction=a).aggregate(m=Max("pseudonym_no"))["m"] or 0) + 1
        AuctionBidder.objects.create(auction=a, user=user, pseudonym_no=next_no)
    bid = Bid.objects.create(auction=a, bidder=user, amount=amount)

    active = Bid.objects.filter(auction=a, status=Bid.BidStatus.ACTIVE)
    a.active_bids_count = active.count()
    a.bidders_count = AuctionBidder.objects.filter(auction=a).count()
    a.top_bid_amount = active.aggregate(m=Max("amount"))["m"]
    a.save(update_fields=["active_bids_count", "bidders_count", "top_bid_amount", "updated_at"])

    if a.active_bids_count == 1:
        notify(a.seller, "first_bid", "Auksioningizga birinchi taklif tushdi", a.title, f"/a/{a.id}")
    new_top = active.order_by("-amount", "created_at").first()
    if (
        previous_top is not None
        and previous_top.bidder_id != user.id
        and new_top is not None
        and new_top.bidder_id != previous_top.bidder_id
    ):
        notify(previous_top.bidder, "outbid", "Taklifingiz 1-oʻrindan tushdi", a.title, f"/a/{a.id}")
    return bid


def tier_for(rank: int) -> str:
    """BR-25: 1 green, 2–3 yellow, 4+ red."""
    return "green" if rank == 1 else "yellow" if rank <= 3 else "red"


@dataclass(frozen=True)
class RankedBid:
    bid: Bid
    rank: int
    tier: str
    pseudonym: str


def ranked_bids(a: Auction) -> list[RankedBid]:
    names = dict(AuctionBidder.objects.filter(auction=a).values_list("user_id", "pseudonym_no"))
    bids = Bid.objects.filter(auction=a, status=Bid.BidStatus.ACTIVE).order_by("-amount", "created_at")
    return [
        RankedBid(b, i, tier_for(i), f"Xaridor #{names.get(b.bidder_id, '?')}")
        for i, b in enumerate(bids, start=1)
    ]


# --- decision ---------------------------------------------------------------------------------


def can_accept_now(a: Auction, now: Any = None) -> tuple[bool, Any]:
    """Returns (allowed, early_accept_from)."""
    now = now or timezone.now()
    s = PlatformSettings.load()
    early_from = a.starts_at + timedelta(minutes=s.early_accept_min_minutes) if a.starts_at else None
    if a.status == Status.LIVE and a.ends_at and now < a.ends_at:
        return bool(early_from and now >= early_from), early_from
    if a.status in (Status.LIVE, Status.ENDED) and a.decision_deadline and now <= a.decision_deadline:
        return True, early_from
    return False, early_from


@dataclass(frozen=True)
class DecisionRow:
    ranked: RankedBid
    distance_km: float | None
    tags: list[str]


def decision_rows(a: Auction) -> tuple[list[DecisionRow], list[DecisionRow]]:
    """All rows (by amount) and the recommended block: top 3 by amount ∪ top 3 nearest (BR-31)."""
    ranked = ranked_bids(a)
    rows: list[DecisionRow] = []
    for r in ranked:
        bidder = r.bid.bidder
        point = user_point(bidder)
        dist = (
            haversine_km(float(a.lat), float(a.lng), point[0], point[1])
            if point and a.lat is not None and a.lng is not None
            else None
        )
        rows.append(DecisionRow(r, dist, []))
    highest = {row.ranked.bid.id for row in rows[:3]}
    nearest = {
        row.ranked.bid.id
        for row in sorted((r for r in rows if r.distance_km is not None), key=lambda r: r.distance_km or 0)[
            :3
        ]
    }
    for row in rows:
        if row.ranked.bid.id in highest:
            row.tags.append("highest")
        if row.ranked.bid.id in nearest:
            row.tags.append("nearest")
    recommended = [row for row in rows if row.tags]
    return rows, recommended


@transaction.atomic
def accept_bid(auction_id: uuid.UUID, user: User, bid_id: uuid.UUID) -> Deal:
    """BR-30..35: create the deal, charge commission, reveal contacts, close the auction."""
    a = _lock(auction_id)
    _own(a, user)
    allowed, early_from = can_accept_now(a)
    if not allowed:
        if a.status == Status.LIVE and early_from and timezone.now() < early_from:
            raise DomainError(
                "early_accept_too_soon",
                "Auksion boshlanganidan keyin kamida 10 daqiqa oʻtishi kerak.",
                http.HTTP_409_CONFLICT,
            )
        raise DomainError(
            "decision_window_closed", "Xaridorni tanlash muddati tugagan.", http.HTTP_409_CONFLICT
        )
    bid = Bid.objects.select_for_update().filter(id=bid_id, auction=a, status=Bid.BidStatus.ACTIVE).first()
    if bid is None:
        raise DomainError("bid_not_active", "Bu taklif endi faol emas.", http.HTTP_409_CONFLICT)

    now = timezone.now()
    early = a.status == Status.LIVE
    commission = wallet.commission_for(bid.amount, a.commission_rate_bp or 0)
    deal = Deal.objects.create(
        auction=a, bid=bid, seller=a.seller, buyer=bid.bidder, price=bid.amount, commission_amount=commission
    )
    wallet.capture_commission(HOLD_REF, a.id, commission, charge_ref_type="deal", charge_ref_id=deal.id)
    refresh_user_stats(a.seller)
    refresh_user_stats(bid.bidder)
    if early:
        a.ends_at = now
    a.accepted_bid = bid
    a.closed_at = now
    transition(a, Status.SOLD, actor=user, reason="early accept" if early else "")

    notify(
        bid.bidder,
        "bid_accepted",
        "Taklifingiz qabul qilindi",
        f"{a.title}. Sotuvchi kontaktlari ochildi.",
        f"/deals/{deal.id}",
    )
    for other in (
        Bid.objects.filter(auction=a, status=Bid.BidStatus.ACTIVE).exclude(id=bid.id).select_related("bidder")
    ):
        text = (
            "Auksion muddatidan oldin yakunlandi" if early else "Auksion yakunlandi, taklifingiz tanlanmadi"
        )
        notify(other.bidder, "bid_not_selected", text, a.title, f"/a/{a.id}")
    return deal


@transaction.atomic
def reject_all(auction_id: uuid.UUID, user: User, reason: str = "") -> Auction:
    a = _lock(auction_id)
    _own(a, user)
    if a.status != Status.ENDED:
        raise DomainError("invalid_transition", "Hozir bu amalni bajarib boʻlmaydi.", http.HTTP_409_CONFLICT)
    _close_unsold(a, actor=user, reason=reason or "seller rejected all bids")
    return a


def _close_unsold(a: Auction, *, actor: User | None, reason: str) -> None:
    a.closed_at = timezone.now()
    transition(a, Status.UNSOLD, actor=actor, reason=reason)
    wallet.release_hold(HOLD_REF, a.id)
    for b in Bid.objects.filter(auction=a, status=Bid.BidStatus.ACTIVE).select_related("bidder"):
        notify(
            b.bidder, "bid_not_selected", "Auksion yakunlandi, taklifingiz tanlanmadi", a.title, f"/a/{a.id}"
        )


def _notify_watchers(a: Auction, title: str, *, exclude: set[Any] | None = None) -> None:
    exclude = exclude or set()
    for w in Watch.objects.filter(auction=a).select_related("user"):
        if w.user_id not in exclude:
            notify(w.user, "watch_update", title, a.title, f"/a/{a.id}")


# --- worker ----------------------------------------------------------------------------------


def tick() -> dict[str, int]:
    """Advance time-based states. Idempotent; safe to run every minute from several workers."""
    counts = {"started": 0, "ended": 0, "expired": 0}
    now = timezone.now()
    for aid in Auction.objects.filter(status=Status.SCHEDULED, starts_at__lte=now).values_list(
        "id", flat=True
    ):
        with transaction.atomic():
            a = (
                Auction.objects.select_for_update(skip_locked=True)
                .filter(id=aid, status=Status.SCHEDULED)
                .first()
            )
            if a:
                transition(a, Status.LIVE)
                notify(a.seller, "auction_started", "Auksioningiz boshlandi", a.title, f"/a/{a.id}")
                _notify_watchers(a, "Siz kuzatayotgan auksion boshlandi")
                counts["started"] += 1
    for aid in Auction.objects.filter(status=Status.LIVE, ends_at__lte=now).values_list("id", flat=True):
        with transaction.atomic():
            a = Auction.objects.select_for_update(skip_locked=True).filter(id=aid, status=Status.LIVE).first()
            if not a:
                continue
            if a.bids.filter(status=Bid.BidStatus.ACTIVE).exists():
                transition(a, Status.ENDED)
                notify(
                    a.seller,
                    "auction_ended",
                    "Auksion tugadi — xaridorni tanlang",
                    f"{a.active_bids_count} ta taklif. "
                    f"Tanlash uchun {PlatformSettings.load().decision_window_h} soat bor.",
                    f"/a/{a.id}/decision",
                )
            else:
                _close_unsold(a, actor=None, reason="no bids")
                notify(a.seller, "auction_unsold", "Auksion taklifsiz tugadi", a.title, f"/a/{a.id}")
            counts["ended"] += 1
    for aid in Auction.objects.filter(status=Status.ENDED, decision_deadline__lt=now).values_list(
        "id", flat=True
    ):
        with transaction.atomic():
            a = (
                Auction.objects.select_for_update(skip_locked=True)
                .filter(id=aid, status=Status.ENDED)
                .first()
            )
            if a:
                _close_unsold(a, actor=None, reason="decision window expired")
                notify(
                    a.seller,
                    "auction_unsold",
                    "Tanlash muddati tugadi, auksion sotilmadi",
                    a.title,
                    f"/a/{a.id}",
                )
                counts["expired"] += 1
    return counts


# --- watchlist --------------------------------------------------------------------------------


def watch(auction_id: uuid.UUID, user: User) -> None:
    a = Auction.objects.filter(id=auction_id).first()
    if a is None:
        raise DomainError("not_found", "Auksion topilmadi.", http.HTTP_404_NOT_FOUND)
    with contextlib.suppress(IntegrityError):
        Watch.objects.get_or_create(user=user, auction=a)


def unwatch(auction_id: uuid.UUID, user: User) -> None:
    Watch.objects.filter(user=user, auction_id=auction_id).delete()


def visible_to(user: User | None) -> Q:
    q = Q(
        status__in=[
            s.value for s in (Status.SCHEDULED, Status.LIVE, Status.ENDED, Status.SOLD, Status.UNSOLD)
        ]
    )
    if user is not None and user.is_authenticated:
        q |= Q(seller=user)
        if user.is_moderator_or_admin:
            q = Q()
    return q


def decimal_or_none(value: Decimal | None) -> float | None:
    return float(value) if value is not None else None
