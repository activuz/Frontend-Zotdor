"""Django settings for the Zotdor backend. All environment-specific values come from env."""

from __future__ import annotations

from pathlib import Path

import django_stubs_ext
from django.core.exceptions import ImproperlyConfigured

from config import env

# Allows generic annotations such as admin.ModelAdmin[User] at runtime.
django_stubs_ext.monkeypatch()

BASE_DIR = Path(__file__).resolve().parent.parent
env.load_dotenv(BASE_DIR / ".env")

DEBUG = env.get_bool("DJANGO_DEBUG", default=False)
SECRET_KEY = env.get("DJANGO_SECRET_KEY")
ALLOWED_HOSTS = env.get_list("ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "drf_spectacular",
    "procrastinate.contrib.django",
    "core",
    "reference",
    "accounts",
    "telegram_bot",
    "wallet",
    "notifications",
    "auctions",
    "moderation",
    "deals",
    "payments",
    "panel_api",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {"default": env.database_from_url(env.get("DATABASE_URL"))}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"

# Users never set passwords (login is via Telegram); only the emergency
# superuser for Django admin does.
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 12}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
]

LANGUAGE_CODE = "uz"
TIME_ZONE = "Asia/Tashkent"  # display zone; values are stored in UTC
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = Path(env.get("MEDIA_ROOT", str(BASE_DIR / "media")))

# --- File storage (auctions/storage.py) -------------------------------------
# local: MEDIA_ROOT + nginx (VPS, development). nhost: Nhost Storage (Render production).
STORAGE_BACKEND = env.get("STORAGE_BACKEND", "local")
# e.g. https://<subdomain>.storage.<region>.nhost.run
NHOST_STORAGE_URL = env.get("NHOST_STORAGE_URL", "")
NHOST_ADMIN_SECRET = env.get("NHOST_ADMIN_SECRET", "")
NHOST_PUBLIC_BUCKET = env.get("NHOST_PUBLIC_BUCKET", "media-public")
NHOST_PRIVATE_BUCKET = env.get("NHOST_PRIVATE_BUCKET", "media-private")
if STORAGE_BACKEND not in ("local", "nhost"):
    raise ImproperlyConfigured("STORAGE_BACKEND must be 'local' or 'nhost'")
if STORAGE_BACKEND == "nhost" and not (NHOST_STORAGE_URL and NHOST_ADMIN_SECRET):
    raise ImproperlyConfigured("STORAGE_BACKEND=nhost needs NHOST_STORAGE_URL and NHOST_ADMIN_SECRET")

# --- Security -------------------------------------------------------------
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = not DEBUG
CSRF_TRUSTED_ORIGINS = env.get_list("CSRF_TRUSTED_ORIGINS")
# Split hosting (web.zotdor.uz → api.zotdor.uz): the SPA must read the CSRF cookie set by the
# API, so it is shared with the parent domain (".zotdor.uz"). Empty = host-only (same origin).
CSRF_COOKIE_DOMAIN = env.get("CSRF_COOKIE_DOMAIN", "") or None
SESSION_COOKIE_DOMAIN = env.get("SESSION_COOKIE_DOMAIN", "") or None
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True

CORS_ALLOWED_ORIGINS = env.get_list("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True

# --- API ------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "core.errors.exception_handler",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Zotdor API",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "ENUM_NAME_OVERRIDES": {
        "AuctionStatusEnum": "auctions.models.Status",
        "UserRoleEnum": "accounts.models.User.Role",
    },
}

# --- Telegram login (docs/ARCHITECTURE.md §6) ----------------------------
# Empty values are allowed so tests and tooling run without a bot; the auth
# endpoints refuse to start a login when the bot is not configured.
TELEGRAM_BOT_TOKEN = env.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_BOT_USERNAME = env.get("TELEGRAM_BOT_USERNAME", "").lstrip("@")
TELEGRAM_WEBHOOK_SECRET = env.get("TELEGRAM_WEBHOOK_SECRET", "")
LOGIN_REQUEST_TTL_SECONDS = 600
LOGIN_RATE_PER_PHONE_PER_HOUR = 5
LOGIN_RATE_PER_IP_PER_HOUR = 20

# --- Media (docs/ARCHITECTURE.md §7) ---------------------------------------
FFMPEG_BIN = env.get("FFMPEG_BIN", "ffmpeg")
FFPROBE_BIN = env.get("FFPROBE_BIN", "ffprobe")
# Process videos inside the request in development (no worker needed); in production the
# worker does it so uploads return quickly.
MEDIA_PROCESS_SYNC = env.get_bool("MEDIA_PROCESS_SYNC", default=DEBUG)
PHOTO_MAX_BYTES = 15 * 1024 * 1024
VIDEO_MAX_BYTES = 60 * 1024 * 1024
CAPTURE_SESSION_TTL_MINUTES = 20
DATA_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024

# Public site origin, used in Telegram messages and payment return links.
FRONTEND_URL = env.get("FRONTEND_URL", "http://localhost:3000")

# --- Payments --------------------------------------------------------------
PAYMENTS_PROVIDER = env.get("PAYMENTS_PROVIDER", "fake")  # "click" | "fake"
CLICK_SERVICE_ID = env.get("CLICK_SERVICE_ID", "")
CLICK_MERCHANT_ID = env.get("CLICK_MERCHANT_ID", "")
CLICK_MERCHANT_USER_ID = env.get("CLICK_MERCHANT_USER_ID", "")
CLICK_SECRET_KEY = env.get("CLICK_SECRET_KEY", "")
TOPUP_MIN = 10_000
TOPUP_MAX = 10_000_000

# --- Worker ---------------------------------------------------------------
WORKER_HEARTBEAT_STALE_SECONDS = 180

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"plain": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "plain"}},
    "root": {"handlers": ["console"], "level": env.get("LOG_LEVEL", "INFO")},
}
