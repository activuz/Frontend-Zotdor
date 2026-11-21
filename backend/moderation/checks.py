"""Automatic pre-publication checks (BR-16, BR-17; docs/ARCHITECTURE.md §7).

Each check returns pass / warn / fail with a message the seller can act on.
fail → rejected, warn → moderator queue, all pass → published. New checks (e.g. a pose
model) are added to CHECKS without touching the rest of the pipeline.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import timedelta
from typing import TYPE_CHECKING, Any, Protocol

from django.utils import timezone

from moderation.wordlist import PROFANITY_ROOTS

if TYPE_CHECKING:
    from auctions.models import Auction
    from core.models import PlatformSettings

PASS, WARN, FAIL = "pass", "warn", "fail"


@dataclass(frozen=True)
class CheckResult:
    name: str
    result: str
    message: str = ""
    details: dict[str, Any] = field(default_factory=dict)


class Check(Protocol):
    name: str

    def run(self, auction: Auction, settings: PlatformSettings) -> CheckResult: ...


def _normalize(text: str) -> str:
    text = text.lower()
    for src, dst in (("ʻ", "'"), ("ʼ", "'"), ("‘", "'"), ("’", "'"), ("`", "'")):  # noqa: RUF001
        text = text.replace(src, dst)
    return text


# Uzbek mobile/landline operator prefixes after +998.
_OPERATORS = "20|33|50|55|61|62|65|66|67|69|70|71|72|73|74|75|76|77|78|79|88|90|91|93|94|95|97|98|99"
# Operator code + 7 digits, separators allowed ("90 123-45-67", "+998 (90) 1234567"), and no
# digits glued on either side, so prices like "95 000 000" (8 digits) do not match.
_PHONE = re.compile(rf"(?<!\d)(?:\+?\s*998\D{{0,3}})?(?:{_OPERATORS})(?:[\s\-.()]{{0,3}}\d){{7}}(?![\s\-.]?\d)")
_HANDLE = re.compile(r"(?<![\w.])@[a-z0-9_]{4,}", re.IGNORECASE)
_LINK = re.compile(r"(https?://|www\.|t\s*\.\s*me|telegram\s*\.\s*me|\b[a-z0-9-]+\.(uz|com|ru|me|org|net)\b)", re.I)


class TextContacts:
    name = "text_contacts"

    def run(self, auction: Auction, settings: PlatformSettings) -> CheckResult:
        text = _normalize(f"{auction.description} {auction.breed_other}")
        found = []
        if _PHONE.search(text):
            found.append("telefon raqami")
        if _HANDLE.search(text):
            found.append("Telegram username")
        if _LINK.search(text):
            found.append("havola")
        if found:
            return CheckResult(
                self.name,
                FAIL,
                f"Tavsifda {', '.join(found)} bor. Kontaktlar faqat bitimdan keyin ochiladi — ularni olib tashlang.",
            )
        return CheckResult(self.name, PASS)


class TextProfanity:
    name = "text_profanity"

    def run(self, auction: Auction, settings: PlatformSettings) -> CheckResult:
        words = re.findall(r"[\w']+", _normalize(f"{auction.description} {auction.breed_other}"))
        if any(word.startswith(root) for word in words for root in PROFANITY_ROOTS):
            return CheckResult(self.name, FAIL, "Tavsifda haqoratli soʻz bor. Uni olib tashlang.")
        return CheckResult(self.name, PASS)


class MediaCount:
    name = "media_count"

    def run(self, auction: Auction, settings: PlatformSettings) -> CheckResult:
        ready = auction.media.filter(status="ready")
        photos = ready.filter(kind="photo").count()
        videos = ready.filter(kind="video").count()
        problems = []
        if photos < settings.photos_min:
            problems.append(f"yana {settings.photos_min - photos} ta rasm oling")
        if photos > settings.photos_max:
            problems.append(f"rasmlar {settings.photos_max} tadan oshmasin")
        if videos < settings.videos_min:
            problems.append(f"kamida {settings.videos_min} ta video oling")
        if videos > settings.videos_max:
            problems.append(f"videolar {settings.videos_max} tadan oshmasin")
        if problems:
            return CheckResult(self.name, FAIL, "Media yetarli emas: " + "; ".join(problems) + ".")
        return CheckResult(self.name, PASS)


class MediaFreshness:
    """Every file must come from a capture session of this auction, taken recently."""

    name = "media_freshness"
    MAX_AGE = timedelta(hours=24)

    def run(self, auction: Auction, settings: PlatformSettings) -> CheckResult:
        cutoff = timezone.now() - self.MAX_AGE
        stale = auction.media.filter(status="ready").exclude(
            capture_session__auction=auction, received_at__gte=cutoff
        )
        if stale.exists():
            return CheckResult(
                self.name, FAIL, "Baʼzi rasm yoki videolar 24 soatdan oldin olingan. Ularni qaytadan oling."
            )
        return CheckResult(self.name, PASS)


class MediaQuality:
    name = "media_quality"
    MIN_SHORT_SIDE = 720

    def run(self, auction: Auction, settings: PlatformSettings) -> CheckResult:
        small = [
            m.id
            for m in auction.media.filter(status="ready", kind="photo")
            if m.width and m.height and min(m.width, m.height) < self.MIN_SHORT_SIDE
        ]
        if small:
            return CheckResult(self.name, WARN, "Baʼzi rasmlar past sifatli.", {"media": [str(i) for i in small]})
        return CheckResult(self.name, PASS)


class MediaDuplicate:
    """Photos nearly identical to another seller's photos suggest a copied listing."""

    name = "media_duplicate"
    MAX_DISTANCE = 6

    def run(self, auction: Auction, settings: PlatformSettings) -> CheckResult:
        from auctions.media import hamming
        from auctions.models import AuctionMedia

        mine = [m.phash for m in auction.media.filter(kind="photo", status="ready") if m.phash is not None]
        if not mine:
            return CheckResult(self.name, PASS)
        others = (
            AuctionMedia.objects.filter(kind="photo", status="ready", phash__isnull=False)
            .exclude(auction__seller=auction.seller)
            .order_by("-received_at")
            .values_list("phash", "auction_id")[:20000]
        )
        hits = {str(aid) for ph, aid in others for m in mine if hamming(m, ph) <= self.MAX_DISTANCE}
        if hits:
            return CheckResult(
                self.name, WARN, "Rasmlar boshqa sotuvchining eʼloniga juda oʻxshash.", {"auctions": sorted(hits)}
            )
        return CheckResult(self.name, PASS)


CHECKS: list[Check] = [TextContacts(), TextProfanity(), MediaCount(), MediaFreshness(), MediaQuality(), MediaDuplicate()]


def run_all(auction: Auction, settings: PlatformSettings) -> list[CheckResult]:
    return [check.run(auction, settings) for check in CHECKS]
