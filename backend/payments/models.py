"""Wallet top-ups (Click or the local fake provider) and manual refund requests (BR-44, BR-45)."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class Payment(models.Model):
    class Provider(models.TextChoices):
        CLICK = "click"
        FAKE = "fake"

    class PaymentStatus(models.TextChoices):
        CREATED = "created"
        PREPARED = "prepared"
        COMPLETED = "completed"
        CANCELLED = "cancelled"
        FAILED = "failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="payments")
    provider = models.CharField(max_length=8, choices=Provider.choices)
    amount = models.BigIntegerField()
    status = models.CharField(max_length=10, choices=PaymentStatus.choices, default=PaymentStatus.CREATED)
    provider_trans_id = models.BigIntegerField(null=True, blank=True, unique=True)
    provider_paydoc_id = models.BigIntegerField(null=True, blank=True)
    raw_prepare = models.JSONField(null=True, blank=True)
    raw_complete = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "payments"


class RefundRequest(models.Model):
    class RefundStatus(models.TextChoices):
        OPEN = "open"
        DONE = "done"
        REJECTED = "rejected"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="refund_requests")
    amount = models.BigIntegerField()
    click_reference = models.CharField(max_length=64)
    reason = models.TextField(max_length=1000)
    status = models.CharField(max_length=10, choices=RefundStatus.choices, default=RefundStatus.OPEN)
    handled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    handled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "refund_requests"
