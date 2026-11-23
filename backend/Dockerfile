# API and worker image (deploy/docker-compose.yml). Local development does not use Docker.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# ffmpeg/ffprobe: video checks and posters (docs/ARCHITECTURE.md §7).
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
RUN useradd --system --uid 10001 --home /app zotdor \
    && mkdir -p /app/staticfiles /data/media \
    && chown -R zotdor /app/staticfiles /data/media
USER zotdor

ENV DJANGO_DEBUG=false \
    MEDIA_ROOT=/data/media

EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "60", "--access-logfile", "-"]
