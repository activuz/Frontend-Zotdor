"""Bug reports (FR-19): the "Xatolik haqida xabar berish" form."""

from __future__ import annotations

import uuid
from datetime import timedelta
from typing import TYPE_CHECKING, Any

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status

from core.errors import DomainError
from feedback.models import BugReport
from notifications.models import TelegramOutbox
from notifications.services import kick_sender

if TYPE_CHECKING:
    from accounts.models import User

MESSAGE_MIN = 10
MESSAGE_MAX = 2000


def _cut(value: object, limit: int) -> str:
    return str(value or "").strip()[:limit]


def create_report(
    *,
    user: User | None,
    message: str,
    contact: str = "",
    page_url: str = "",
    user_agent: str = "",
    viewport: str = "",
    error: str = "",
    ip: str | None = None,
) -> BugReport:
    text = (message or "").strip()
    if len(text) < MESSAGE_MIN:
        raise DomainError("message_too_short", "Nima boʻlganini batafsilroq yozing (kamida 10 ta belgi).")
    if len(text) > MESSAGE_MAX:
        raise DomainError("message_too_long", "Xabar 2000 belgidan oshmasligi kerak.")

    since = timezone.now() - timedelta(hours=1)
    who = Q(user=user) if user is not None else Q(ip=ip) if ip else None
    recent = BugReport.objects.filter(who, created_at__gte=since).count() if who is not None else 0
    if recent >= settings.BUG_REPORTS_PER_HOUR:
        raise DomainError(
            "rate_limited",
            "Xabaringiz allaqachon qabul qilingan. Birozdan keyin qayta yuboring.",
            status.HTTP_429_TOO_MANY_REQUESTS,
        )

    with transaction.atomic():
        report = BugReport.objects.create(
            user=user,
            message=text,
            # Context comes from the browser: truncate rather than refuse a report.
            contact="" if user is not None else _cut(contact, 64),
            page_url=_cut(page_url, 500),
            user_agent=_cut(user_agent, 300),
            viewport=_cut(viewport, 20),
            error_text=_cut(error, 2000),
            ip=ip,
        )
        chat_id = settings.SUPPORT_TELEGRAM_CHAT_ID
        if chat_id:
            # Outbox, not a direct call: the worker sends it after commit.
            TelegramOutbox.objects.create(chat_id=int(chat_id), text=telegram_text(report))
            transaction.on_commit(kick_sender)
    return report


def telegram_text(report: BugReport) -> str:
    who = report.user.phone if report.user is not None else (report.contact or "mehmon, kontakt yoʻq")
    lines = ["Xatolik haqida xabar", f"Kimdan: {who}"]
    if report.page_url:
        lines.append(f"Sahifa: {report.page_url}")
    lines.append(f"\n{report.message}")
    if report.error_text:
        lines.append(f"\nXato: {report.error_text[:500]}")
    return "\n".join(lines)


def set_status(
    report_id: uuid.UUID, new_status: str, note: str, staff: User
) -> tuple[BugReport, dict[str, Any]]:
    """Staff mark a report resolved or closed. Call inside transaction.atomic()."""
    if new_status not in (BugReport.ReportStatus.RESOLVED, BugReport.ReportStatus.CLOSED):
        raise DomainError("invalid", "Holatni tanlang.")
    report = BugReport.objects.select_for_update().filter(id=report_id).first()
    if report is None:
        raise DomainError("not_found", "Xabar topilmadi.", status.HTTP_404_NOT_FOUND)
    before = {"status": report.status, "note": report.handled_note}
    report.status = new_status
    report.handled_note = note[:1000]
    report.handled_by = staff
    report.handled_at = timezone.now()
    report.save(update_fields=["status", "handled_note", "handled_by", "handled_at"])
    return report, before
