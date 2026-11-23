#!/bin/sh
# Container entrypoint for the API (Render web service; see render.yaml and docs/DEPLOYMENT.md).
# On the VPS, deploy/docker-compose.yml runs migrations in its own service and overrides this.
set -e

python manage.py migrate --noinput

# Cheaper single-service setup: run the task worker inside the web container.
# Use a separate Render worker instead when traffic grows (RUN_WORKER_IN_WEB=false).
if [ "${RUN_WORKER_IN_WEB:-false}" = "true" ]; then
  python manage.py procrastinate worker --concurrency 2 &
fi

exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers "${WEB_CONCURRENCY:-2}" \
  --timeout 120 \
  --access-logfile -
