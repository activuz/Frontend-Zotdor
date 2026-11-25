"""auctions.storage: local layout is unchanged; Nhost requests are well-formed (no network)."""

from __future__ import annotations

import io
import json
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest

from auctions import storage
from config.env import database_from_url


class _Resp(io.BytesIO):
    def __enter__(self) -> _Resp:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()


@pytest.fixture
def nhost(settings: Any) -> Any:
    settings.STORAGE_BACKEND = "nhost"
    settings.NHOST_STORAGE_URL = "https://sub.storage.eu-central-1.nhost.run/"
    settings.NHOST_ADMIN_SECRET = "secret"
    settings.NHOST_PUBLIC_BUCKET = "media-public"
    settings.NHOST_PRIVATE_BUCKET = "media-private"
    return settings


def test_local_save_url_and_delete(settings: Any, tmp_path: Path) -> None:
    settings.STORAGE_BACKEND = "local"
    settings.MEDIA_ROOT = str(tmp_path / "media")
    src = tmp_path / "a.webp"
    src.write_bytes(b"x")
    ref = storage.save(src, "auctions/1/a.webp", "image/webp", public=True)
    assert ref == "auctions/1/a.webp"
    assert (tmp_path / "media/auctions/1/a.webp").read_bytes() == b"x"
    assert storage.url(ref) == "/media/auctions/1/a.webp"
    with storage.local_copy(ref) as path:
        assert path.read_bytes() == b"x"
    storage.delete(ref)
    assert not (tmp_path / "media/auctions/1/a.webp").exists()


def test_nhost_upload_uses_bucket_and_admin_secret(nhost: Any, tmp_path: Path) -> None:
    src = tmp_path / "a.webp"
    src.write_bytes(b"img")
    seen: dict[str, Any] = {}
    file_id = "11111111-2222-3333-4444-555555555555"

    def fake(req: Any, timeout: int) -> _Resp:
        seen.update(url=req.full_url, method=req.get_method(), headers=dict(req.headers), body=req.data)
        return _Resp(json.dumps({"processedFiles": [{"id": file_id}]}).encode())

    with patch("urllib.request.urlopen", fake):
        ref = storage.save(src, "auctions/1/a.webp", "image/webp", public=False)

    assert ref == f"nhost:{file_id}"
    assert seen["url"] == "https://sub.storage.eu-central-1.nhost.run/v1/files"
    assert seen["method"] == "POST"
    assert seen["headers"]["X-hasura-admin-secret"] == "secret"
    # Cloudflare in front of Nhost answers 403 "error code: 1010" to the default Python-urllib agent.
    assert seen["headers"]["User-agent"] == storage.USER_AGENT
    assert "urllib" not in storage.USER_AGENT.lower()
    assert b'name="bucket-id"' in seen["body"]
    assert b"media-private" in seen["body"]
    assert b'name="file[]"; filename="a.webp"' in seen["body"]
    assert storage.url(ref) == f"https://sub.storage.eu-central-1.nhost.run/v1/files/{file_id}"


def test_nhost_local_copy_downloads_to_a_temp_file(nhost: Any) -> None:
    with patch("urllib.request.urlopen", lambda req, timeout: _Resp(b"raw")):
        with storage.local_copy("nhost:abc") as path:
            assert path.read_bytes() == b"raw"
        assert not path.exists()


def test_delete_never_raises(nhost: Any) -> None:
    def boom(req: Any, timeout: int) -> _Resp:
        raise OSError("down")

    with patch("urllib.request.urlopen", boom):
        storage.delete("nhost:abc")


def test_database_url_passes_sslmode() -> None:
    cfg = database_from_url(
        "postgres://postgres:p%40ss@sub.db.eu-central-1.nhost.run:5432/sub?sslmode=require"
    )
    assert cfg["HOST"] == "sub.db.eu-central-1.nhost.run"
    assert cfg["PASSWORD"] == "p@ss"
    assert cfg["OPTIONS"] == {"sslmode": "require"}
    assert "OPTIONS" not in database_from_url("postgres://u:p@localhost/db")
