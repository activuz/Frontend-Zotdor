"""Seller-pinned auction location and media order (docs/API.md "Auksionlar", BR-11a, BR-12a, BR-33a)."""

from __future__ import annotations

import uuid
from datetime import timedelta
from decimal import Decimal
from typing import Any

import pytest
import time_machine
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from auctions import services
from auctions.models import Auction, Bid
from auctions.tests.test_auctions import draft_with_media, live_auction, make_user, taxonomy
from core.errors import DomainError
from reference.models import District

pytestmark = pytest.mark.django_db

# A point in Yunusobod, Tashkent.
PIN = {"lat": 41.364823, "lng": 69.288514}


@pytest.fixture(autouse=True)
def _media_root(settings: Any, tmp_path: Any, load_reference_data: None) -> None:
    settings.MEDIA_ROOT = str(tmp_path)


@pytest.fixture
def seller() -> User:
    return make_user("+998901000001")


@pytest.fixture
def buyer() -> User:
    return make_user("+998901000002", "Chilonzor tumani")


def client_for(user: User | None) -> APIClient:
    c = APIClient()
    if user is not None:
        c.force_authenticate(user)
    return c


def deal_for(seller: User, buyer: User, **over: object) -> str:
    a = live_auction(seller, **over)
    services.place_bid(a.id, buyer, 9_000_000)
    with time_machine.travel(timezone.now() + timedelta(minutes=61)):
        services.tick()
        deal = services.accept_bid(a.id, seller, Bid.objects.get(auction=a, bidder=buyer).id)
    return str(deal.id)


# --- pinned location ----------------------------------------------------------------------------


def test_pin_is_rounded_and_fills_nearest_district(seller: User) -> None:
    a = services.create_draft(seller, taxonomy())
    assert a.location_pinned is False
    body = client_for(seller).patch(f"/api/v1/auctions/{a.id}", PIN, format="json").json()
    a.refresh_from_db()
    assert a.location_pinned is True
    assert (a.lat, a.lng) == (Decimal("41.365"), Decimal("69.289"))
    assert a.district is not None and a.district != seller.district
    # The owner sees the stored pin to edit it; the district follows the pin.
    assert body["owner"]["pin"] == {"lat": 41.365, "lng": 69.289}
    assert body["district"]["id"] == a.district.id


def test_explicit_district_is_kept_with_pin(seller: User) -> None:
    a = services.create_draft(seller, taxonomy())
    chosen = District.objects.get(name="Chilonzor tumani")
    client_for(seller).patch(f"/api/v1/auctions/{a.id}", {**PIN, "district_id": chosen.id}, format="json")
    a.refresh_from_db()
    assert a.district == chosen and a.location_pinned


def test_district_change_does_not_move_pin(seller: User) -> None:
    a = services.create_draft(seller, taxonomy())
    services.update_draft(a.id, seller, dict(PIN))
    services.update_draft(a.id, seller, {"district": District.objects.get(name="Chilonzor tumani")})
    a.refresh_from_db()
    assert (a.lat, a.lng) == (Decimal("41.365"), Decimal("69.289"))


def test_clearing_pin_falls_back_to_district_centre(seller: User) -> None:
    a = services.create_draft(seller, taxonomy())
    services.update_draft(a.id, seller, dict(PIN))
    client_for(seller).patch(f"/api/v1/auctions/{a.id}", {"lat": None, "lng": None}, format="json")
    a.refresh_from_db()
    assert a.district is not None
    assert a.location_pinned is False
    assert (a.lat, a.lng) == (a.district.lat, a.district.lng)


@pytest.mark.parametrize(
    "payload", [{"lat": 48.85, "lng": 2.35}, {"lat": 41.3}, {"lng": 69.2}, {"lat": "x", "lng": 69.2}]
)
def test_bad_pin_is_refused(seller: User, payload: dict[str, object]) -> None:
    a = services.create_draft(seller, taxonomy())
    r = client_for(seller).patch(f"/api/v1/auctions/{a.id}", payload, format="json")
    assert r.status_code == 400
    a.refresh_from_db()
    assert a.location_pinned is False


def test_public_sees_only_approximate_area(seller: User, buyer: User) -> None:
    a = live_auction(seller, **PIN)
    for viewer in (None, buyer):
        body = client_for(viewer).get(f"/api/v1/auctions/{a.id}").json()
        # Centre of a ~1 km cell, never the pin itself (BR-33a).
        assert body["area"] == {"lat": 41.36, "lng": 69.29, "radius_m": 1500}
        assert body["owner"] is None


def test_unpinned_auction_has_no_area(seller: User) -> None:
    a = live_auction(seller)
    assert client_for(None).get(f"/api/v1/auctions/{a.id}").json()["area"] is None


def test_exact_pin_is_revealed_only_to_deal_parties(seller: User, buyer: User) -> None:
    deal_id = deal_for(seller, buyer, **PIN)
    for party in (buyer, seller):
        body = client_for(party).get(f"/api/v1/deals/{deal_id}").json()
        assert body["location"] == {"lat": 41.365, "lng": 69.289}


def test_deal_without_pin_has_no_location(seller: User, buyer: User) -> None:
    deal_id = deal_for(seller, buyer)
    assert client_for(buyer).get(f"/api/v1/deals/{deal_id}").json()["location"] is None


def test_pin_cannot_change_after_publish(seller: User) -> None:
    a = live_auction(seller)
    r = client_for(seller).patch(f"/api/v1/auctions/{a.id}", PIN, format="json")
    assert r.status_code == 409


# --- media order --------------------------------------------------------------------------------


def media_ids(a: Auction) -> list[str]:
    return [str(m.id) for m in Auction.objects.get(id=a.id).media.order_by("position", "received_at")]


def test_media_can_be_reordered_and_first_photo_is_cover(seller: User) -> None:
    a = draft_with_media(seller, photos=3, video=True)
    media = Auction.objects.get(id=a.id).media.order_by("position", "received_at")
    video = next(str(m.id) for m in media if m.kind == "video")
    photos = [m for m in media if m.kind == "photo"]
    # The video first, then the third photo: the cover is the first *photo* in the new order.
    new = [video, str(photos[2].id), str(photos[0].id), str(photos[1].id)]
    r = client_for(seller).put(f"/api/v1/auctions/{a.id}/media/order", {"ids": new}, format="json")
    assert r.status_code == 200
    body = r.json()
    assert [m["id"] for m in body["media"]] == new
    assert body["cover"]["thumb_url"].endswith(photos[2].thumb_path)


@pytest.mark.parametrize("change", ["missing", "extra", "duplicate"])
def test_reorder_needs_exactly_the_auction_media(seller: User, change: str) -> None:
    a = draft_with_media(seller, photos=2, video=False)
    ids = media_ids(a)
    bad = {
        "missing": ids[:1],
        "extra": [*ids, "00000000-0000-0000-0000-000000000000"],
        "duplicate": [ids[0], ids[0]],
    }[change]
    r = client_for(seller).put(f"/api/v1/auctions/{a.id}/media/order", {"ids": bad}, format="json")
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_order"
    assert media_ids(a) == ids


def test_only_owner_reorders_and_only_a_draft(seller: User, buyer: User) -> None:
    a = draft_with_media(seller, photos=2, video=False)
    ids = list(reversed(media_ids(a)))
    r = client_for(buyer).put(f"/api/v1/auctions/{a.id}/media/order", {"ids": ids}, format="json")
    assert r.status_code == 403
    live = live_auction(seller, seed=7)
    with pytest.raises(DomainError) as err:
        services.reorder_media(live.id, seller, [uuid.UUID(i) for i in reversed(media_ids(live))])
    assert err.value.code == "not_editable"
