"""Search and link-preview support for the SPA at FRONTEND_URL (docs/SEO.md).

- sitemap.xml is built from the database on every request (cached by proxies for 10 minutes),
  so a newly published auction appears in it without any extra step.
- Link previews: Telegram, Facebook and similar bots do not run JavaScript. Vercel routes only
  those bots to /api/seo/a/<id>, which returns static HTML with Open Graph tags. Search engines
  get the normal SPA (no cloaking).
"""

from __future__ import annotations

import uuid
from datetime import timedelta
from xml.sax.saxutils import escape as xml_escape

from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.utils import timezone
from django.utils.html import escape
from django.views.decorators.http import require_GET

from auctions import media as media_store
from auctions.models import Auction, AuctionMedia, Status

# Finished auctions stay in the sitemap this long after their last change, then drop out.
FINISHED_KEEP_DAYS = 30
OPEN_STATUSES = (Status.SCHEDULED, Status.LIVE)
FINISHED_STATUSES = (Status.ENDED, Status.SOLD, Status.UNSOLD)
STATIC_PAGES = [
    ("/", "hourly", "1.0"),
    ("/search", "hourly", "0.8"),
    ("/login", "monthly", "0.5"),
    ("/terms", "yearly", "0.3"),
    ("/privacy", "yearly", "0.3"),
    ("/offer", "yearly", "0.3"),
]
SITE_NAME = "Zotdor.uz"
DEFAULT_DESCRIPTION = (
    "Qoramol, qoʻy, echki va otlarni auksion orqali soting va sotib oling. "
    "Jonli auksionlar, faqat kamerada olingan suratlar, xaridor uchun bepul."
)


def _site() -> str:
    return str(settings.FRONTEND_URL).rstrip("/")


def sitemap_auctions() -> list[Auction]:
    """Auctions a search engine should know about: open ones, and recently finished ones."""
    recent = timezone.now() - timedelta(days=FINISHED_KEEP_DAYS)
    open_qs = Auction.objects.filter(status__in=OPEN_STATUSES)
    finished_qs = Auction.objects.filter(status__in=FINISHED_STATUSES, updated_at__gte=recent)
    rows = (open_qs | finished_qs).only("id", "status", "updated_at", "seller_id")
    return list(rows.order_by("-updated_at")[:45_000])


@require_GET
def sitemap_xml(request: HttpRequest) -> HttpResponse:
    site = _site()
    rows = [
        f"<url><loc>{xml_escape(site + path)}</loc><changefreq>{freq}</changefreq>"
        f"<priority>{prio}</priority></url>"
        for path, freq, prio in STATIC_PAGES
    ]
    auctions = sitemap_auctions()
    for a in auctions:
        is_open = a.status in OPEN_STATUSES
        rows.append(
            f"<url><loc>{xml_escape(f'{site}/a/{a.id}')}</loc>"
            f"<lastmod>{a.updated_at.date().isoformat()}</lastmod>"
            f"<changefreq>{'hourly' if is_open else 'weekly'}</changefreq>"
            f"<priority>{'0.9' if is_open else '0.4'}</priority></url>"
        )
    # Public seller profiles (/u/<id>) of everyone who has an auction in this sitemap.
    sellers: dict[str, str] = {}
    for a in auctions:
        day = a.updated_at.date().isoformat()
        sellers[str(a.seller_id)] = max(sellers.get(str(a.seller_id), day), day)
    for seller_id, day in sellers.items():
        rows.append(
            f"<url><loc>{xml_escape(f'{site}/u/{seller_id}')}</loc><lastmod>{day}</lastmod>"
            "<changefreq>weekly</changefreq><priority>0.5</priority></url>"
        )
    body = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(rows) + "\n</urlset>\n"
    )
    response = HttpResponse(body, content_type="application/xml; charset=utf-8")
    response["Cache-Control"] = "public, max-age=600"
    return response


@require_GET
def robots_txt(request: HttpRequest) -> HttpResponse:
    """The API host itself is not for search engines."""
    response = HttpResponse("User-agent: *\nDisallow: /\n", content_type="text/plain; charset=utf-8")
    response["Cache-Control"] = "public, max-age=86400"
    return response


def _som(amount: int) -> str:
    return f"{amount:,}".replace(",", " ") + " soʻm"


def auction_description(a: Auction) -> str:
    place = ", ".join(x.name for x in (a.district, a.region) if x)
    parts = [p for p in (place, f"Sotuvchi narxi {_som(a.asking_price)}" if a.asking_price else "") if p]
    head = ". ".join(parts)
    text = " ".join((a.description or "").split())
    full = f"{head}. {text}" if head and text else head or text or DEFAULT_DESCRIPTION
    return full if len(full) <= 200 else full[:197].rstrip() + "…"


def _cover_url(request: HttpRequest, a: Auction) -> str:
    photo = (
        AuctionMedia.objects.filter(
            auction=a, kind=AuctionMedia.Kind.PHOTO, status=AuctionMedia.MediaStatus.READY
        )
        .order_by("position")
        .first()
    )
    if photo is None:
        return ""
    url = media_store.url(photo.file_path)
    return url if url.startswith("http") else request.build_absolute_uri(url)


def _page(*, title: str, description: str, url: str, image: str, status: int = 200) -> HttpResponse:
    tags = [
        f"<title>{escape(title)}</title>",
        f'<meta name="description" content="{escape(description)}">',
        f'<link rel="canonical" href="{escape(url)}">',
        '<meta property="og:type" content="website">',
        f'<meta property="og:site_name" content="{SITE_NAME}">',
        '<meta property="og:locale" content="uz_UZ">',
        f'<meta property="og:title" content="{escape(title)}">',
        f'<meta property="og:description" content="{escape(description)}">',
        f'<meta property="og:url" content="{escape(url)}">',
        f'<meta name="twitter:card" content="{"summary_large_image" if image else "summary"}">',
        f'<meta name="twitter:title" content="{escape(title)}">',
        f'<meta name="twitter:description" content="{escape(description)}">',
    ]
    if image:
        tags += [
            f'<meta property="og:image" content="{escape(image)}">',
            f'<meta name="twitter:image" content="{escape(image)}">',
        ]
    html = (
        '<!doctype html><html lang="uz"><head><meta charset="utf-8">'
        + "".join(tags)
        + f"</head><body><h1>{escape(title)}</h1><p>{escape(description)}</p>"
        f'<p><a href="{escape(url)}">{escape(url)}</a></p></body></html>'
    )
    response = HttpResponse(html, status=status, content_type="text/html; charset=utf-8")
    response["Cache-Control"] = "public, max-age=300"
    return response


@require_GET
def auction_share(request: HttpRequest, auction_id: uuid.UUID) -> HttpResponse:
    a = (
        Auction.objects.select_related("region", "district")
        .filter(id=auction_id, status__in=[s.value for s in (*OPEN_STATUSES, *FINISHED_STATUSES)])
        .first()
    )
    if a is None:
        return _page(
            title=f"Auksion topilmadi — {SITE_NAME}",
            description=DEFAULT_DESCRIPTION,
            url=_site() + "/",
            image="",
            status=404,
        )
    return _page(
        title=f"{a.title or 'Chorva auksioni'} — {SITE_NAME}",
        description=auction_description(a),
        url=f"{_site()}/a/{a.id}",
        image=_cover_url(request, a),
    )
