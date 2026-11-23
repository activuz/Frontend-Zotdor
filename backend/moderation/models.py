"""User reports about auctions or users (BR-60)."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class Report(models.Model):  # noqa: DJ008 - internal table, not shown in admin
    class Target(models.TextChoices):
        AUCTION = "auction"
        USER = "user"

    class Reason(models.TextChoices):
        FAKE = "fake", "Soxta yoki boshqa joydan olingan"
        WRONG_INFO = "wrong_info", "Notoʻgʻri maʼlumot"
        ABUSE = "abuse", "Haqorat yoki nojoʻya xatti-harakat"
        FRAUD = "fraud", "Firibgarlik"
        OTHER = "other", "Boshqa"

    class ReportStatus(models.TextChoices):
        OPEN = "open"
        RESOLVED = "resolved"
        DISMISSED = "dismissed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    target_type = models.CharField(max_length=8, choices=Target.choices)
    target_id = models.UUIDField()
    reason = models.CharField(max_length=12, choices=Reason.choices)
    comment = models.TextField(blank=True, max_length=1000)
    status = models.CharField(max_length=10, choices=ReportStatus.choices, default=ReportStatus.OPEN)
    handled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    handled_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    handled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "reports"
        indexes = [models.Index(fields=["status", "created_at"])]
