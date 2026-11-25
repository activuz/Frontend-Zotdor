"""Browser geolocation: /me/location (docs/API.md "Auth")."""

from __future__ import annotations

from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from reference.models import District, Region

pytestmark = pytest.mark.django_db

URL = "/api/v1/me/location"


@pytest.fixture
def places() -> tuple[District, District]:
    surx = Region.objects.create(name="Surxondaryo viloyati")
    tosh = Region.objects.create(name="Toshkent shahri")
    termiz = District.objects.create(
        region=surx, name="Termiz shahri", lat=Decimal("37.2242"), lng=Decimal("67.2783")
    )
    chilonzor = District.objects.create(
        region=tosh, name="Chilonzor tumani", lat=Decimal("41.2756"), lng=Decimal("69.2034")
    )
    return termiz, chilonzor


def client_for(user: User) -> APIClient:
    c = APIClient()
    c.force_authenticate(user)
    return c


def test_location_is_rounded_and_fills_empty_profile(places: tuple[District, District]) -> None:
    termiz, _ = places
    user = User.objects.create_user(phone="+998901234567", first_name="Ali")
    response = client_for(user).put(URL, {"lat": 37.231234, "lng": 67.281987}, format="json")
    assert response.status_code == 200
    assert response.json()["has_location"] is True
    user.refresh_from_db()
    assert (user.lat, user.lng) == (Decimal("37.231"), Decimal("67.282"))  # ~100 m, never exact
    assert (user.region, user.district) == (termiz.region, termiz)


def test_location_never_overwrites_chosen_region(places: tuple[District, District]) -> None:
    _, chilonzor = places
    user = User.objects.create_user(
        phone="+998901234567", first_name="Ali", region=chilonzor.region, district=chilonzor
    )
    client_for(user).put(URL, {"lat": 37.23, "lng": 67.28}, format="json")
    user.refresh_from_db()
    assert user.district == chilonzor
    assert user.lat == Decimal("37.230")


@pytest.mark.parametrize("body", [{"lat": 55.75, "lng": 37.61}, {"lat": "x", "lng": 1}, {}])
def test_bad_or_foreign_location_is_refused(
    places: tuple[District, District], body: dict[str, object]
) -> None:
    user = User.objects.create_user(phone="+998901234567", first_name="Ali")
    response = client_for(user).put(URL, body, format="json")
    assert response.status_code == 400
    assert response.json()["error"]["code"] in {"location_outside", "invalid_location"}
    user.refresh_from_db()
    assert user.lat is None


def test_location_can_be_cleared(places: tuple[District, District]) -> None:
    user = User.objects.create_user(phone="+998901234567", first_name="Ali")
    c = client_for(user)
    c.put(URL, {"lat": 41.28, "lng": 69.2}, format="json")
    response = c.delete(URL)
    assert response.status_code == 200 and response.json()["has_location"] is False
    user.refresh_from_db()
    assert user.lat is None and user.lng is None


def test_location_needs_login() -> None:
    assert APIClient().put(URL, {"lat": 41.28, "lng": 69.2}, format="json").status_code in (401, 403)
