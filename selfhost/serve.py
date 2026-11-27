"""WSGI server for the self-hosted API on Windows (docs/SELFHOST.md).

Listens on 127.0.0.1 only: the public traffic comes through the ngrok agent on this machine,
which adds X-Forwarded-Proto/-For. Those headers are trusted from 127.0.0.1 and nowhere else.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

from waitress import serve  # type: ignore[import-untyped]  # noqa: E402

from config.wsgi import application  # noqa: E402

if __name__ == "__main__":
    serve(
        application,
        host="127.0.0.1",
        port=int(os.environ.get("PORT", "8000")),
        threads=int(os.environ.get("WEB_THREADS", "8")),
        trusted_proxy="127.0.0.1",
        trusted_proxy_count=1,
        trusted_proxy_headers={"x-forwarded-for", "x-forwarded-proto", "x-forwarded-host"},
        clear_untrusted_proxy_headers=True,
        channel_timeout=120,
        ident="zotdor",
    )
