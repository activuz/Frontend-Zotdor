"""Landing-page contact requests (FR-18)."""

from __future__ import annotations

import re
import uuid
from datetime import timedelta
from typing import TYPE_CHECKING, Any

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import status

from accounts.phone import normalize_phone
from core.errors import DomainError
from leads.models import Lead
from notifications.models import TelegramOutbox
from notifications.services import kick_sender
from reference.models import Region

if TYPE_CHECKING:
    from accounts.models import User

_SPACES = re.compile(r"\s+")


def create_lead(
    *,
    name: str,
    phone: str,
    role: str,
    region_id: object = None,
    message: str = "",
    source: str = "",
    ip: str | None = None,
) -> Lead:
    clean_name = _SPACES.sub(" ", name or "").strip()
    if not 2 <= len(clean_name) <= 80:
        raise DomainError("invalid_name", "Ismingizni kiriting (kamida 2 ta harf).")
    normalized = normalize_phone(phone)
    if normalized is None:
        raise DomainError("invalid_phone", "Telefon raqamini +998 XX XXX XX XX koʻrinishida kiriting.")
    if role not in Lead.Role.values:
        raise DomainError("invalid_role", "Kim ekaningizni tanlang: sotuvchi, xaridor yoki ikkalasi.")
    region = None
    if region_id not in (None, ""):
        try:
            region = Region.objects.filter(id=int(str(region_id))).first()
        except ValueError:
            region = None
        if region is None:
            raise DomainError("invalid_region", "Hududni roʻyxatdan tanlang.")
    clean_message = (message or "").strip()
    if len(clean_message) > 1000:
        raise DomainError("message_too_long", "Xabar 1000 belgidan oshmasligi kerak.")

    now = timezone.now()
    per_phone = Lead.objects.filter(phone=normalized, created_at__gte=now - timedelta(hours=24)).count()
    per_ip = Lead.objects.filter(ip=ip, created_at__gte=now - timedelta(hours=1)).count() if ip else 0
    if per_phone >= settings.LEADS_PER_PHONE_PER_DAY or per_ip >= settings.LEADS_PER_IP_PER_HOUR:
        raise DomainError(
            "rate_limited",
            "Arizangiz allaqachon qabul qilingan. Tez orada siz bilan bogʻlanamiz.",
            status.HTTP_429_TOO_MANY_REQUESTS,
        )

    with transaction.atomic():
        lead = Lead.objects.create(
            name=clean_name,
            phone=normalized,
            region=region,
            role=role,
            message=clean_message,
            source=(source or "").strip()[:64],
            ip=ip,
        )
        chat_id = settings.LEADS_TELEGRAM_CHAT_ID
        if chat_id:
            # Outbox, not a direct call: the worker sends it after commit.
            TelegramOutbox.objects.create(chat_id=int(chat_id), text=telegram_text(lead))
            transaction.on_commit(kick_sender)
    return lead


def telegram_text(lead: Lead) -> str:
    lines = [
        "Yangi ariza (zotdor.uz)",
        f"Ism: {lead.name}",
        f"Telefon: {lead.phone}",
        f"Kim: {lead.get_role_display()}",
    ]
    if lead.region:
        lines.append(f"Hudud: {lead.region.name}")
    if lead.source:
        lines.append(f"Manba: {lead.source}")
    if lead.message:
        lines.append(f"\n{lead.message}")
    return "\n".join(lines)


def set_status(lead_id: uuid.UUID, new_status: str, note: str, staff: User) -> tuple[Lead, dict[str, Any]]:
    """Staff marks a request as contacted or closed. Call inside transaction.atomic()."""
    if new_status not in (Lead.LeadStatus.CONTACTED, Lead.LeadStatus.CLOSED):
        raise DomainError("invalid", "Holatni tanlang.")
    # Lock only the lead row: `region` is nullable (LEFT JOIN), which FOR UPDATE cannot cover.
    lead = Lead.objects.select_for_update(of=("self",)).select_related("region").filter(id=lead_id).first()
    if lead is None:
        raise DomainError("not_found", "Ariza topilmadi.", status.HTTP_404_NOT_FOUND)
    before = {"status": lead.status, "note": lead.handled_note}
    lead.status = new_status
    lead.handled_note = note[:1000]
    lead.handled_by = staff
    lead.handled_at = timezone.now()
    lead.save(update_fields=["status", "handled_note", "handled_by", "handled_at"])
    return lead, before
