"""Auctions, their media, checks, events and bids (docs/DATABASE.md "auctions", "media").

Status changes only through auctions.services.transition(); each one is an AuctionEvent.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class Status(models.TextChoices):
    DRAFT = "draft", "Qoralama"
    PENDING_REVIEW = "pending_review", "Moderatsiyada"
    REJECTED = "rejected", "Rad etilgan"
    SCHEDULED = "scheduled", "Rejalashtirilgan"
    LIVE = "live", "Jonli"
    ENDED = "ended", "Tugagan"
    SOLD = "sold", "Sotilgan"
    UNSOLD = "unsold", "Sotilmagan"
    CANCELLED = "cancelled", "Bekor qilingan"
    BLOCKED = "blocked", "Bloklangan"


PUBLIC_STATUSES = (Status.SCHEDULED, Status.LIVE, Status.ENDED, Status.SOLD, Status.UNSOLD)
EDITABLE_STATUSES = (Status.DRAFT, Status.REJECTED)


class Auction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="auctions")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT, db_index=True)
    title = models.CharField(max_length=160, blank=True)

    direction = models.ForeignKey("reference.Direction", on_delete=models.PROTECT, null=True, blank=True)
    animal_type = models.ForeignKey("reference.AnimalType", on_delete=models.PROTECT, null=True, blank=True)
    animal_class = models.ForeignKey("reference.AnimalClass", on_delete=models.PROTECT, null=True, blank=True)
    breed = models.ForeignKey("reference.Breed", on_delete=models.PROTECT, null=True, blank=True)
    breed_other = models.CharField(max_length=64, blank=True)
    age_months = models.PositiveSmallIntegerField(null=True, blank=True)
    weight_kg = models.PositiveIntegerField(null=True, blank=True)
    weight_is_estimated = models.BooleanField(default=True)
    description = models.TextField(blank=True, max_length=2000)

    asking_price = models.BigIntegerField(null=True, blank=True)
    min_bid = models.BigIntegerField(null=True, blank=True)
    max_bid = models.BigIntegerField(null=True, blank=True)
    commission_rate_bp = models.PositiveSmallIntegerField(null=True, blank=True)
    hold_amount = models.BigIntegerField(null=True, blank=True)

    region = models.ForeignKey("reference.Region", on_delete=models.PROTECT, null=True, blank=True)
    district = models.ForeignKey("reference.District", on_delete=models.PROTECT, null=True, blank=True)
    lat = models.DecimalField(max_digits=7, decimal_places=4, null=True, blank=True)
    lng = models.DecimalField(max_digits=7, decimal_places=4, null=True, blank=True)

    start_now = models.BooleanField(default=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    duration_minutes = models.PositiveSmallIntegerField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    decision_deadline = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    accepted_bid = models.ForeignKey(
        "auctions.Bid", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    top_bid_amount = models.BigIntegerField(null=True, blank=True)
    active_bids_count = models.PositiveIntegerField(default=0)
    bidders_count = models.PositiveIntegerField(default=0)

    rejection_reason = models.TextField(blank=True)
    moderation_note = models.TextField(blank=True)
    cancel_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "auctions"
        indexes = [
            models.Index(fields=["status", "ends_at"]),
            models.Index(fields=["status", "starts_at"]),
            models.Index(fields=["seller", "status"]),
            models.Index(fields=["animal_type", "status"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(asking_price__isnull=True) | models.Q(asking_price__gt=0),
                name="auction_price_positive",
            ),
        ]

    def __str__(self) -> str:
        return self.title or str(self.id)


class AuctionEvent(models.Model):
    id = models.BigAutoField(primary_key=True)
    auction = models.ForeignKey(Auction, on_delete=models.CASCADE, related_name="events")
    from_status = models.CharField(max_length=16)
    to_status = models.CharField(max_length=16)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True)
    reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "auction_events"
        ordering = ["id"]


class CaptureSession(models.Model):
    """Uploads are accepted only inside a short-lived session opened right before the camera."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    auction = models.ForeignKey(Auction, on_delete=models.CASCADE, related_name="capture_sessions")
    expires_at = models.DateTimeField()
    user_agent = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "capture_sessions"


class AuctionMedia(models.Model):
    class Kind(models.TextChoices):
        PHOTO = "photo"
        VIDEO = "video"

    class MediaStatus(models.TextChoices):
        PROCESSING = "processing"
        READY = "ready"
        FAILED = "failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    auction = models.ForeignKey(Auction, on_delete=models.CASCADE, related_name="media")
    capture_session = models.ForeignKey(CaptureSession, on_delete=models.PROTECT, related_name="media")
    kind = models.CharField(max_length=8, choices=Kind.choices)
    position = models.PositiveSmallIntegerField(default=0)
    status = models.CharField(max_length=12, choices=MediaStatus.choices, default=MediaStatus.PROCESSING)
    error = models.CharField(max_length=200, blank=True)
    original_path = models.CharField(max_length=300)
    file_path = models.CharField(max_length=300, blank=True)
    thumb_path = models.CharField(max_length=300, blank=True)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    duration_ms = models.PositiveIntegerField(null=True, blank=True)
    size_bytes = models.PositiveIntegerField(default=0)
    phash = models.BigIntegerField(null=True, blank=True, db_index=True)
    received_at = models.DateTimeField(auto_now_add=True)
    client_meta = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "auction_media"
        ordering = ["position", "received_at"]


class AuctionCheck(models.Model):
    class Result(models.TextChoices):
        PASS = "pass"
        WARN = "warn"
        FAIL = "fail"

    id = models.BigAutoField(primary_key=True)
    auction = models.ForeignKey(Auction, on_delete=models.CASCADE, related_name="checks")
    run_id = models.UUIDField()
    check_name = models.CharField(max_length=40)
    result = models.CharField(max_length=4, choices=Result.choices)
    message = models.CharField(max_length=300, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "auction_checks"


class AuctionBidder(models.Model):
    """Stable per-auction pseudonym "Xaridor #N" (BR-24)."""

    auction = models.ForeignKey(Auction, on_delete=models.CASCADE, related_name="bidders")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    pseudonym_no = models.PositiveIntegerField()
    first_bid_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "auction_bidders"
        constraints = [
            models.UniqueConstraint(fields=["auction", "user"], name="bidder_once_per_auction"),
            models.UniqueConstraint(fields=["auction", "pseudonym_no"], name="bidder_pseudonym_unique"),
        ]


class Bid(models.Model):
    class BidStatus(models.TextChoices):
        ACTIVE = "active"
        SUPERSEDED = "superseded"
        VOID = "void"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    auction = models.ForeignKey(Auction, on_delete=models.CASCADE, related_name="bids")
    bidder = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="bids")
    amount = models.BigIntegerField()
    status = models.CharField(max_length=10, choices=BidStatus.choices, default=BidStatus.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "bids"
        indexes = [models.Index(fields=["auction", "status", "-amount", "created_at"])]
        constraints = [
            models.UniqueConstraint(
                fields=["auction", "bidder"],
                condition=models.Q(status="active"),
                name="bid_one_active_per_bidder",
            ),
            models.CheckConstraint(condition=models.Q(amount__gt=0), name="bid_amount_positive"),
        ]


class Watch(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    auction = models.ForeignKey(Auction, on_delete=models.CASCADE, related_name="watchers")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "watchlist"
        constraints = [models.UniqueConstraint(fields=["user", "auction"], name="watch_once")]
