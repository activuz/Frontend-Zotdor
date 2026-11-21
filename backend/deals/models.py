"""Deals created when a seller accepts a bid, plus ratings and "deal failed" claims (BR-33..34, BR-50)."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class Deal(models.Model):
    class DealStatus(models.TextChoices):
        ACTIVE = "active"
        COMPLETED = "completed"
        FAILED = "failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    auction = models.OneToOneField("auctions.Auction", on_delete=models.PROTECT, related_name="deal")
    bid = models.OneToOneField("auctions.Bid", on_delete=models.PROTECT, related_name="deal")
    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="sales")
    buyer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="purchases")
    price = models.BigIntegerField()
    commission_amount = models.BigIntegerField()
    status = models.CharField(max_length=10, choices=DealStatus.choices, default=DealStatus.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "deals"
        indexes = [models.Index(fields=["status", "created_at"])]

    def __str__(self) -> str:
        return f"deal {self.id}"


class Rating(models.Model):
    id = models.BigAutoField(primary_key=True)
    deal = models.ForeignKey(Deal, on_delete=models.CASCADE, related_name="ratings")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    target = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="ratings_received")
    score = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True, max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ratings"
        constraints = [
            models.UniqueConstraint(fields=["deal", "author"], name="rating_once_per_side"),
            models.CheckConstraint(condition=models.Q(score__gte=1, score__lte=5), name="rating_score_1_5"),
        ]


class DealClaim(models.Model):
    class ClaimStatus(models.TextChoices):
        OPEN = "open"
        APPROVED = "approved"
        REJECTED = "rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    deal = models.ForeignKey(Deal, on_delete=models.CASCADE, related_name="claims")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    reason = models.TextField(max_length=1000)
    status = models.CharField(max_length=10, choices=ClaimStatus.choices, default=ClaimStatus.OPEN)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    resolution_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "deal_claims"
