#!/usr/bin/env python3
from __future__ import annotations

import json
import time
import urllib.request

BASE = "https://www.vibeschool.co.ke"
ATTEMPTS = 24
DELAY_SECONDS = 10


def fetch(path: str) -> tuple[bytes, str]:
    req = urllib.request.Request(
        BASE + path,
        headers={"User-Agent": "VibeSchool-PWA-Production-Smoke/1.0"},
    )
    with urllib.request.urlopen(req, timeout=20) as response:
        if response.status != 200:
            raise AssertionError(f"{path}: HTTP {response.status}")
        return response.read(), response.headers.get("content-type", "")


def wait_for_release() -> None:
    last_error: Exception | None = None
    for attempt in range(1, ATTEMPTS + 1):
        try:
            sw, _ = fetch("/sw.js")
            text = sw.decode("utf-8", errors="replace")
            if "vibeschool-v4" in text and "SKIP_WAITING" in text:
                print(f"production release detected on attempt {attempt}")
                return
            last_error = AssertionError("production service worker is still the previous version")
        except Exception as exc:  # production may be between deployments
            last_error = exc
        if attempt < ATTEMPTS:
            time.sleep(DELAY_SECONDS)
    raise AssertionError(f"new PWA release did not become visible: {last_error}")


def main() -> int:
    wait_for_release()

    home, home_type = fetch("/")
    manifest_bytes, manifest_type = fetch("/manifest.webmanifest")
    icon192, icon192_type = fetch("/icons/icon-192.svg")
    icon512, icon512_type = fetch("/icons/icon-512.svg")
    maskable, maskable_type = fetch("/icons/icon-maskable-512.svg")
    sw, _ = fetch("/sw.js")
    offline, offline_type = fetch("/offline.html")

    if b"manifest.webmanifest" not in home:
        raise AssertionError("production home does not advertise the web manifest")

    manifest = json.loads(manifest_bytes.decode("utf-8"))
    expected = {
        "name": "VibeSchool",
        "short_name": "VibeSchool",
        "start_url": "/",
        "scope": "/",
        "display": "standalone",
        "background_color": "#070B1F",
        "theme_color": "#070B1F",
    }
    for key, value in expected.items():
        if manifest.get(key) != value:
            raise AssertionError(f"manifest {key}: expected {value!r}, got {manifest.get(key)!r}")

    icon_sources = {entry.get("src") for entry in manifest.get("icons", [])}
    for required in {
        "/icons/icon-192.svg",
        "/icons/icon-512.svg",
        "/icons/icon-maskable-512.svg",
    }:
        if required not in icon_sources:
            raise AssertionError(f"manifest missing {required}")

    for label, payload in [("192", icon192), ("512", icon512), ("maskable", maskable)]:
        text = payload.decode("utf-8", errors="replace")
        if "<svg" not in text or "#070B1F" not in text:
            raise AssertionError(f"production icon {label} is not the refreshed VibeSchool asset")
        if ">VIBE<" in text:
            raise AssertionError(f"production icon {label} still contains legacy tiny wordmark")

    sw_text = sw.decode("utf-8", errors="replace")
    for marker in ["vibeschool-v4", "SKIP_WAITING", "url.pathname.startsWith('/api/')", "url.pathname.startsWith('/auth/')"]:
        if marker not in sw_text:
            raise AssertionError(f"production service worker missing safety marker: {marker}")

    offline_text = offline.decode("utf-8", errors="replace")
    if "You’re offline" not in offline_text or "private account data is not stored" not in offline_text:
        raise AssertionError("production offline fallback is stale or incomplete")

    if "text/html" not in home_type:
        raise AssertionError(f"unexpected home content type: {home_type}")
    if "json" not in manifest_type:
        raise AssertionError(f"unexpected manifest content type: {manifest_type}")
    for label, content_type in [("192", icon192_type), ("512", icon512_type), ("maskable", maskable_type)]:
        if "svg" not in content_type:
            raise AssertionError(f"unexpected icon {label} content type: {content_type}")
    if "text/html" not in offline_type:
        raise AssertionError(f"unexpected offline content type: {offline_type}")

    print("PWA PRODUCTION SMOKE PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
