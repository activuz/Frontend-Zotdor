"""Problems reported by users from the site (FR-19), handled by staff in the panel."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class BugReport(models.Model):  # noqa: DJ008 - internal table, shown only in the panel
    class ReportStatus(models.TextChoices):
        NEW = "new"
        RESOLVED = "resolved"
        CLOSED = "closed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    message = models.TextField(max_length=2000)
    # Guests only: how to reach them (phone or Telegram), as typed. Logged-in users have a phone.
    contact = models.CharField(max_length=64, blank=True)
    # Context collected by the browser, so staff can reproduce the problem.
    page_url = models.CharField(max_length=500, blank=True)
    user_agent = models.CharField(max_length=300, blank=True)
    viewport = models.CharField(max_length=20, blank=True)
    error_text = models.TextField(blank=True, max_length=2000)
    ip = models.GenericIPAddressField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=ReportStatus.choices, default=ReportStatus.NEW)
    handled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    handled_note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    handled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "bug_reports"
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["ip", "created_at"]),
        ]
