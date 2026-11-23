import pytest
from rest_framework.test import APIClient

from core.models import PlatformSettings

pytestmark = pytest.mark.django_db


def test_public_config_reflects_platform_settings() -> None:
    s = PlatformSettings.load()
    s.commission_rate_bp = 30
    s.save()
    response = APIClient().get("/api/v1/config")
    assert response.status_code == 200
    body = response.json()
    assert body["commission_rate_bp"] == 30
    assert body["photos_min"] == s.photos_min
    assert body["topup_min"] > 0
