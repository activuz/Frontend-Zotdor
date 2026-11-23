"""CSRF for split hosting: the SPA takes the token from /auth/csrf, never from document.cookie."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from accounts.models import User

pytestmark = pytest.mark.django_db


def _client() -> APIClient:
    user = User.objects.create_user(phone="+998901112233", first_name="Ali")
    client = APIClient(enforce_csrf_checks=True)
    client.force_login(user)
    return client


def test_token_from_response_body_authorizes_unsafe_requests() -> None:
    client = _client()
    token = client.get("/api/v1/auth/csrf").json()["csrf_token"]
    assert token
    response = client.patch("/api/v1/me", {"first_name": "Vali"}, format="json", HTTP_X_CSRFTOKEN=token)
    assert response.status_code == 200, response.content


def test_missing_or_stale_token_has_its_own_error_code() -> None:
    client = _client()
    client.get("/api/v1/auth/csrf")
    response = client.patch("/api/v1/me", {"first_name": "Vali"}, format="json", HTTP_X_CSRFTOKEN="wrong")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "csrf_failed"


def test_other_permission_errors_keep_their_code() -> None:
    response = APIClient().get("/api/panel/stats")
    assert response.json()["error"]["code"] in {"not_authenticated", "permission_denied"}
