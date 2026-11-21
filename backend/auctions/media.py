"""Media storage and processing (docs/ARCHITECTURE.md §7).

Files live under MEDIA_ROOT/auctions/<auction_id>/ with random names. Content is
verified by opening it (Pillow / ffprobe); the client's Content-Type is never trusted.
"""

from __future__ import annotations

import json
import logging
import subprocess
import uuid
from pathlib import Path

from django.conf import settings
from django.core.files.uploadedfile import UploadedFile
from PIL import Image, ImageOps, UnidentifiedImageError

from auctions.models import AuctionMedia

logger = logging.getLogger(__name__)

PHOTO_SIZE = 1600
THUMB_SIZE = 480
VIDEO_MIN_S = 3
VIDEO_MAX_S_GRACE = 2  # allow a little over the configured limit for recorder jitter


class MediaError(Exception):
    """User-facing reason why a file was refused."""


def _dir(auction_id: uuid.UUID) -> Path:
    path = Path(settings.MEDIA_ROOT) / "auctions" / str(auction_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def rel(path: Path) -> str:
    return path.relative_to(Path(settings.MEDIA_ROOT)).as_posix()


def url(rel_path: str) -> str:
    return f"{settings.MEDIA_URL.rstrip('/')}/{rel_path}" if rel_path else ""


def store_original(auction_id: uuid.UUID, upload: UploadedFile, kind: str) -> tuple[Path, int]:
    limit = settings.PHOTO_MAX_BYTES if kind == AuctionMedia.Kind.PHOTO else settings.VIDEO_MAX_BYTES
    if upload.size is None or upload.size > limit:
        raise MediaError("Fayl hajmi juda katta.")
    target = _dir(auction_id) / f"orig-{uuid.uuid4().hex}"
    with target.open("wb") as fh:
        for chunk in upload.chunks():
            fh.write(chunk)
    return target, upload.size


def dhash(image: Image.Image) -> int:
    """64-bit difference hash; near-identical photos differ by only a few bits."""
    small = image.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    pixels = list(small.getdata())
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


def process_photo(media: AuctionMedia) -> None:
    source = Path(settings.MEDIA_ROOT) / media.original_path
    try:
        with Image.open(source) as probe:
            probe.verify()
        with Image.open(source) as img:
            image = ImageOps.exif_transpose(img).convert("RGB")  # also drops EXIF/GPS
    except (UnidentifiedImageError, OSError) as exc:
        raise MediaError("Rasm faylini ochib boʻlmadi.") from exc

    folder = source.parent
    name = uuid.uuid4().hex
    full = image.copy()
    full.thumbnail((PHOTO_SIZE, PHOTO_SIZE))
    full_path = folder / f"{name}.webp"
    full.save(full_path, "WEBP", quality=82, method=4)
    thumb = image.copy()
    thumb.thumbnail((THUMB_SIZE, THUMB_SIZE))
    thumb_path = folder / f"{name}-thumb.webp"
    thumb.save(thumb_path, "WEBP", quality=78, method=4)

    media.width, media.height = image.size
    media.phash = dhash(image)
    media.file_path = rel(full_path)
    media.thumb_path = rel(thumb_path)
    media.status = AuctionMedia.MediaStatus.READY


def _run(argv: list[str], timeout: int) -> subprocess.CompletedProcess[bytes]:
    return subprocess.run(argv, capture_output=True, timeout=timeout, check=False)  # noqa: S603


def process_video(media: AuctionMedia, max_seconds: int) -> None:
    source = Path(settings.MEDIA_ROOT) / media.original_path
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

    folder = source.parent
    name = uuid.uuid4().hex
    out = folder / f"{name}.mp4"
    poster = folder / f"{name}-poster.webp"
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
    media.file_path = rel(out)
    media.thumb_path = rel(poster) if frame.returncode == 0 and poster.exists() else ""
    media.status = AuctionMedia.MediaStatus.READY


def process(media: AuctionMedia, video_max_s: int) -> None:
    """Process one stored upload; on failure the row is marked failed with a reason."""
    try:
        if media.kind == AuctionMedia.Kind.PHOTO:
            process_photo(media)
        else:
            process_video(media, video_max_s)
    except MediaError as exc:
        media.status = AuctionMedia.MediaStatus.FAILED
        media.error = str(exc)
    media.save()
