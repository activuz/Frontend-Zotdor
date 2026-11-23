"""Contact requests left on the landing page (zotdor.uz), handled by staff in the panel (FR-18)."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class Lead(models.Model):  # noqa: DJ008 - internal table, shown only in the panel
    class Role(models.TextChoices):
        SELLER = "seller", "Sotuvchi"
        BUYER = "buyer", "Xaridor"
        BOTH = "both", "Sotuvchi va xaridor"

    class LeadStatus(models.TextChoices):
        NEW = "new"
        CONTACTED = "contacted"
        CLOSED = "closed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=80)
    phone = models.CharField(max_length=13)
    region = models.ForeignKey("reference.Region", on_delete=models.PROTECT, null=True, blank=True)
    role = models.CharField(max_length=6, choices=Role.choices)
    message = models.TextField(blank=True, max_length=1000)
    source = models.CharField(max_length=64, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=LeadStatus.choices, default=LeadStatus.NEW)
    handled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    handled_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    handled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "leads"
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["phone", "created_at"]),
            models.Index(fields=["ip", "created_at"]),
        ]
