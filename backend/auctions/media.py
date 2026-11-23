"""Media storage and processing (docs/ARCHITECTURE.md §7).

Files are kept by auctions.storage (local MEDIA_ROOT or Nhost) under keys
auctions/<auction_id>/<random name>. Content is verified by opening it (Pillow / ffprobe);
the client's Content-Type is never trusted. Originals go to private storage and keep EXIF;
only processed copies (EXIF stripped) are public.
"""

from __future__ import annotations

import json
import logging
import subprocess
import tempfile
import uuid
from pathlib import Path

from django.conf import settings
from django.core.files.uploadedfile import UploadedFile
from PIL import Image, ImageOps, UnidentifiedImageError

from auctions import storage
from auctions.models import AuctionMedia

logger = logging.getLogger(__name__)

PHOTO_SIZE = 1600
THUMB_SIZE = 480
VIDEO_MIN_S = 3
VIDEO_MAX_S_GRACE = 2  # allow a little over the configured limit for recorder jitter


class MediaError(Exception):
    """User-facing reason why a file was refused."""


def _key(auction_id: uuid.UUID | str, name: str) -> str:
    return f"auctions/{auction_id}/{name}"


def url(ref: str) -> str:
    return storage.url(ref)


def store_original(auction_id: uuid.UUID, upload: UploadedFile[bytes], kind: str) -> tuple[str, int]:
    """Save the upload as-is to private storage; returns (reference, size)."""
    limit = settings.PHOTO_MAX_BYTES if kind == AuctionMedia.Kind.PHOTO else settings.VIDEO_MAX_BYTES
    if upload.size is None or upload.size > limit:
        raise MediaError("Fayl hajmi juda katta.")
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "upload"
        with path.open("wb") as fh:
            for chunk in upload.chunks():
                fh.write(chunk)
        try:
            ref = storage.save(
                path, _key(auction_id, f"orig-{uuid.uuid4().hex}"), "application/octet-stream", public=False
            )
        except storage.StorageError as exc:
            logger.exception("could not store upload")
            raise MediaError("Faylni saqlab boʻlmadi. Qayta urinib koʻring.") from exc
    return ref, upload.size


def dhash(image: Image.Image) -> int:
    """64-bit difference hash; near-identical photos differ by only a few bits."""
    small = image.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    flatten = getattr(small, "get_flattened_data", None) or small.getdata  # Pillow ≥13 / older
    pixels = list(flatten())
    bits = 0
    for row in range(8):
        for col in range(8):
            left = pixels[row * 9 + col]
            right = pixels[row * 9 + col + 1]
            bits = (bits << 1) | (1 if left > right else 0)
    # Store as signed 64-bit for PostgreSQL bigint.
    return bits - (1 << 64) if bits >= (1 << 63) else bits


def hamming(a: int, b: int) -> int:
    return ((a & 0xFFFFFFFFFFFFFFFF) ^ (b & 0xFFFFFFFFFFFFFFFF)).bit_count()


def process_photo(media: AuctionMedia, source: Path, out_dir: Path) -> None:
    try:
        with Image.open(source) as probe:
            probe.verify()
        with Image.open(source) as img:
            image = ImageOps.exif_transpose(img).convert("RGB")  # also drops EXIF/GPS
    except (UnidentifiedImageError, OSError) as exc:
        raise MediaError("Rasm faylini ochib boʻlmadi.") from exc

    name = uuid.uuid4().hex
    full = image.copy()
    full.thumbnail((PHOTO_SIZE, PHOTO_SIZE))
    full_path = out_dir / f"{name}.webp"
    full.save(full_path, "WEBP", quality=82, method=4)
    thumb = image.copy()
    thumb.thumbnail((THUMB_SIZE, THUMB_SIZE))
    thumb_path = out_dir / f"{name}-thumb.webp"
    thumb.save(thumb_path, "WEBP", quality=78, method=4)

    media.width, media.height = image.size
    media.phash = dhash(image)
    media.file_path = storage.save(
        full_path, _key(media.auction_id, full_path.name), "image/webp", public=True
    )
    media.thumb_path = storage.save(
        thumb_path, _key(media.auction_id, thumb_path.name), "image/webp", public=True
    )
    media.status = AuctionMedia.MediaStatus.READY


def _run(argv: list[str], timeout: int) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(argv, capture_output=True, timeout=timeout, check=False)  # noqa: S603


def process_video(media: AuctionMedia, max_seconds: int, source: Path, out_dir: Path) -> None:
    try:
        probe = _run(
            [
                settings.FFPROBE_BIN,
                "-v",
                "error",
                "-print_format",
                "json",
                "-show_format",
                "-show_streams",
                str(source),
            ],
            timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        logger.exception("ffprobe failed")
        raise MediaError("Videoni tekshirib boʻlmadi.") from exc
    try:
        info = json.loads(probe.stdout or b"{}")
        video = next(s for s in info.get("streams", []) if s.get("codec_type") == "video")
        duration = float(info.get("format", {}).get("duration") or video.get("duration") or 0)
    except (StopIteration, ValueError) as exc:
        raise MediaError("Bu fayl video emas.") from exc
    if duration < VIDEO_MIN_S:
        raise MediaError(f"Video kamida {VIDEO_MIN_S} soniya boʻlishi kerak.")
    if duration > max_seconds + VIDEO_MAX_S_GRACE:
        raise MediaError(f"Video {max_seconds} soniyadan uzun boʻlmasligi kerak.")

    name = uuid.uuid4().hex
    out = out_dir / f"{name}.mp4"
    poster = out_dir / f"{name}-poster.webp"
    try:
        result = _run(
            [
                settings.FFMPEG_BIN,
                "-y",
                "-v",
                "error",
                "-i",
                str(source),
                "-t",
                str(max_seconds + VIDEO_MAX_S_GRACE),
                "-vf",
                "scale='min(1280,iw)':-2",
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "28",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-b:a",
                "96k",
                "-movflags",
                "+faststart",
                str(out),
            ],
            timeout=180,
        )
        if result.returncode != 0:
            raise MediaError("Videoni qayta ishlab boʻlmadi.")
        frame = _run(
            [
                settings.FFMPEG_BIN,
                "-y",
                "-v",
                "error",
                "-ss",
                "1",
                "-i",
                str(out),
                "-frames:v",
                "1",
                str(poster),
            ],
            timeout=60,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        logger.exception("ffmpeg failed")
        raise MediaError("Videoni qayta ishlab boʻlmadi.") from exc

    media.duration_ms = int(duration * 1000)
    media.width = int(video.get("width") or 0) or None
    media.height = int(video.get("height") or 0) or None
    media.file_path = storage.save(out, _key(media.auction_id, out.name), "video/mp4", public=True)
    media.thumb_path = (
        storage.save(poster, _key(media.auction_id, poster.name), "image/webp", public=True)
        if frame.returncode == 0 and poster.exists()
        else ""
    )
    media.status = AuctionMedia.MediaStatus.READY


def process(media: AuctionMedia, video_max_s: int) -> None:
    """Process one stored upload; on failure the row is marked failed with a reason."""
    try:
        with storage.local_copy(media.original_path) as source, tempfile.TemporaryDirectory() as tmp:
            if media.kind == AuctionMedia.Kind.PHOTO:
                process_photo(media, source, Path(tmp))
            else:
                process_video(media, video_max_s, source, Path(tmp))
    except MediaError as exc:
        media.status = AuctionMedia.MediaStatus.FAILED
        media.error = str(exc)
    except storage.StorageError:
        logger.exception("storage failed while processing %s", media.id)
        media.status = AuctionMedia.MediaStatus.FAILED
        media.error = "Faylni saqlab boʻlmadi. Qayta oling."
    media.save()
