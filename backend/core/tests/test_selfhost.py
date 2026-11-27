"""Settings the self-hosted API depends on (docs/SELFHOST.md)."""

import os
import subprocess
import sys
from pathlib import Path

from django.test import Client, override_settings

BACKEND = Path(__file__).resolve().parents[2]
NO_DB = "postgres://x:x@127.0.0.1:1/x"  # settings only; nothing connects


@override_settings(CORS_ALLOWED_ORIGINS=["https://web.zotdor.uz"])
def test_cors_preflight_allows_ngrok_warning_header() -> None:
    response = Client().options(
        "/api/health",
        HTTP_ORIGIN="https://web.zotdor.uz",
        HTTP_ACCESS_CONTROL_REQUEST_METHOD="GET",
        HTTP_ACCESS_CONTROL_REQUEST_HEADERS="ngrok-skip-browser-warning",
    )
    allowed = response.headers.get("access-control-allow-headers", "")
    assert "ngrok-skip-browser-warning" in allowed


def _settings_with(**env: str) -> subprocess.CompletedProcess[str]:
    code = (
        "import django, os; os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'; django.setup(); "
        "from django.conf import settings as s; print(s.SESSION_COOKIE_SAMESITE, s.CSRF_COOKIE_SAMESITE)"
    )
    # Settings are read once per process, so each case runs in a fresh interpreter.
    return subprocess.run(  # noqa: S603 (fixed command, test-only)
        [sys.executable, "-c", code],
        cwd=BACKEND,
        env={**os.environ, "ZOTDOR_ENV_FILE": os.devnull, "DATABASE_URL": NO_DB, **env},
        capture_output=True,
        text=True,
        check=False,
    )


def test_cookie_samesite_none_for_foreign_api_host() -> None:
    result = _settings_with(COOKIE_SAMESITE="None", DJANGO_DEBUG="false")
    assert result.returncode == 0, result.stderr
    assert result.stdout.split() == ["None", "None"]


def test_cookie_samesite_none_refused_with_debug() -> None:
    result = _settings_with(COOKIE_SAMESITE="None", DJANGO_DEBUG="true")
    assert result.returncode != 0
    assert "COOKIE_SAMESITE=None" in result.stderr


def test_cookie_samesite_rejects_unknown_value() -> None:
    result = _settings_with(COOKIE_SAMESITE="lax-ish", DJANGO_DEBUG="false")
    assert result.returncode != 0
    assert "COOKIE_SAMESITE must be" in result.stderr
