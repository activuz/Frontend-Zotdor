"""Where media files live (docs/ARCHITECTURE.md §7–8).

Two backends, chosen by STORAGE_BACKEND:

- ``local`` (VPS and development): files under MEDIA_ROOT, served by nginx at /media/.
  A stored reference is the path relative to MEDIA_ROOT, e.g. ``auctions/<id>/x.webp``.
- ``nhost`` (Render + Nhost production): files in Nhost Storage. A stored reference is
  ``nhost:<file id>``; public files are read straight from Nhost by the browser.

References carry their backend, so ``url()`` keeps working for old rows after a switch.
Processing always happens on a local temporary copy (Pillow / ffmpeg need real files).
"""

from __future__ import annotations

import contextlib
import json
import logging
import shutil
import tempfile
import urllib.error
import urllib.request
import uuid
from collections.abc import Iterator
from pathlib import Path

from django.conf import settings

logger = logging.getLogger(__name__)

NHOST_PREFIX = "nhost:"
USER_AGENT = "zotdor-api/1.0 (+https://zotdor.uz)"


class StorageError(Exception):
    pass


def _local_root() -> Path:
    return Path(settings.MEDIA_ROOT)


def _nhost_base() -> str:
    base = str(getattr(settings, "NHOST_STORAGE_URL", "") or "").rstrip("/")
    if not base:
        raise StorageError("NHOST_STORAGE_URL is not configured")
    return base


def _multipart(fields: list[tuple[str, str, bytes, str | None]]) -> tuple[bytes, str]:
    """Encode (name, filename, content, content_type) parts; filename "" means a plain field."""
    boundary = uuid.uuid4().hex
    chunks: list[bytes] = []
    for name, filename, content, content_type in fields:
        disposition = f'form-data; name="{name}"' + (f'; filename="{filename}"' if filename else "")
        head = f"--{boundary}\r\nContent-Disposition: {disposition}\r\n"
        if content_type:
            head += f"Content-Type: {content_type}\r\n"
        chunks += [head.encode(), b"\r\n", content, b"\r\n"]
    chunks.append(f"--{boundary}--\r\n".encode())
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def _request(method: str, url: str, data: bytes | None = None, content_type: str = "") -> bytes:
    headers = {
        "x-hasura-admin-secret": str(getattr(settings, "NHOST_ADMIN_SECRET", "")),
        # Nhost sits behind Cloudflare, which bans the default "Python-urllib/x.y" agent
        # with 403 "error code: 1010". Any explicit agent passes.
        "User-Agent": USER_AGENT,
    }
    if content_type:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=data, headers=headers, method=method)  # noqa: S310
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:  # noqa: S310 (configured https host)
            body: bytes = resp.read()
            return body
    except urllib.error.HTTPError as exc:
        detail = exc.read()[:300].decode(errors="replace")
        raise StorageError(f"Nhost storage {method} {exc.code}: {detail}") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise StorageError(f"Nhost storage {method} failed: {exc}") from exc


def backend() -> str:
    return str(getattr(settings, "STORAGE_BACKEND", "local"))


def save(source: Path, key: str, content_type: str, *, public: bool) -> str:
    """Store a local file and return its reference. ``key`` is a path like auctions/<id>/x.webp."""
    if backend() == "nhost":
        file_id = str(uuid.uuid4())
        bucket = getattr(settings, "NHOST_PUBLIC_BUCKET" if public else "NHOST_PRIVATE_BUCKET")
        name = Path(key).name
        body, ctype = _multipart(
            [
                ("bucket-id", "", str(bucket).encode(), None),
                ("metadata[]", "", json.dumps({"id": file_id, "name": name}).encode(), "application/json"),
                ("file[]", name, source.read_bytes(), content_type),
            ]
        )
        raw = _request("POST", f"{_nhost_base()}/v1/files", body, ctype)
        try:
            processed = json.loads(raw or b"{}").get("processedFiles") or []
            if processed and processed[0].get("id"):
                file_id = str(processed[0]["id"])
        except (ValueError, AttributeError):
            pass
        return f"{NHOST_PREFIX}{file_id}"
    target = _local_root() / key
    target.parent.mkdir(parents=True, exist_ok=True)
    if source.resolve() != target.resolve():
        shutil.copyfile(source, target)
    return key


@contextlib.contextmanager
def local_copy(ref: str) -> Iterator[Path]:
    """Yield a readable local path for a stored file (a temporary download for Nhost)."""
    if ref.startswith(NHOST_PREFIX):
        data = _request("GET", f"{_nhost_base()}/v1/files/{ref[len(NHOST_PREFIX) :]}")
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "original"
            path.write_bytes(data)
            yield path
        return
    yield _local_root() / ref


def url(ref: str) -> str:
    """Public URL for a processed file; empty reference → empty string."""
    if not ref:
        return ""
    if ref.startswith(NHOST_PREFIX):
        return f"{_nhost_base()}/v1/files/{ref[len(NHOST_PREFIX) :]}"
    return f"{settings.MEDIA_URL.rstrip('/')}/{ref}"


def delete(ref: str) -> None:
    """Best effort: a leftover file is harmless, a failed request must not break the caller."""
    if not ref:
        return
    try:
        if ref.startswith(NHOST_PREFIX):
            _request("DELETE", f"{_nhost_base()}/v1/files/{ref[len(NHOST_PREFIX) :]}")
        else:
            (_local_root() / ref).unlink(missing_ok=True)
    except (StorageError, OSError):
        logger.warning("could not delete stored file %s", ref, exc_info=True)
