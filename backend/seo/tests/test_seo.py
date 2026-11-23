from __future__ import annotations

from datetime import timedelta
from typing import Any

import pytest
from django.test import Client
from django.utils import timezone

from accounts.models import User
from auctions.models import Auction, Status
from reference.models import Region

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _site(settings: Any) -> None:
    settings.FRONTEND_URL = "https://web.zotdor.uz"


def _auction(status: str, **fields: Any) -> Auction:
    seller, _ = User.objects.get_or_create(phone="+998901112233")
    return Auction.objects.create(seller=seller, status=status, title="Qoramol · Buqa · 3 yosh", **fields)


def test_sitemap_lists_open_and_recent_auctions_only() -> None:
    live = _auction(Status.LIVE)
    scheduled = _auction(Status.SCHEDULED)
    sold_recent = _auction(Status.SOLD)
    sold_old = _auction(Status.SOLD)
    Auction.objects.filter(id=sold_old.id).update(updated_at=timezone.now() - timedelta(days=60))
    hidden = [_auction(s) for s in (Status.DRAFT, Status.PENDING_REVIEW, Status.BLOCKED, Status.CANCELLED)]

    response = Client().get("/api/seo/sitemap.xml")
    assert response.status_code == 200
    assert response["Content-Type"].startswith("application/xml")
    body = response.content.decode()
    assert "<loc>https://web.zotdor.uz/</loc>" in body
    assert "<loc>https://web.zotdor.uz/search</loc>" in body
    for a in (live, scheduled, sold_recent):
        assert f"https://web.zotdor.uz/a/{a.id}" in body
    for a in (sold_old, *hidden):
        assert str(a.id) not in body


def test_new_auction_appears_without_extra_steps() -> None:
    assert "/a/" not in Client().get("/api/seo/sitemap.xml").content.decode()
    a = _auction(Status.LIVE)
    assert f"/a/{a.id}" in Client().get("/api/seo/sitemap.xml").content.decode()


def test_share_page_has_escaped_open_graph_tags() -> None:
    region = Region.objects.create(name="Surxondaryo viloyati")
    a = _auction(Status.LIVE, region=region, asking_price=25_000_000, description='Zoʻr <b>buqa</b> "semiz"')
    response = Client().get(f"/api/seo/a/{a.id}")
    assert response.status_code == 200
    html = response.content.decode()
    assert '<meta property="og:title" content="Qoramol · Buqa · 3 yosh — Zotdor.uz">' in html
    assert f'<meta property="og:url" content="https://web.zotdor.uz/a/{a.id}">' in html
    assert "Surxondaryo viloyati. Sotuvchi narxi 25 000 000 soʻm" in html
    assert "<b>" not in html and "&lt;b&gt;" in html


def test_share_page_hides_non_public_auctions() -> None:
    a = _auction(Status.DRAFT)
    response = Client().get(f"/api/seo/a/{a.id}")
    assert response.status_code == 404
    assert "Qoramol" not in response.content.decode()


def test_api_host_is_not_indexed() -> None:
    response = Client().get("/robots.txt")
    assert response.content.decode() == "User-agent: *\nDisallow: /\n"
