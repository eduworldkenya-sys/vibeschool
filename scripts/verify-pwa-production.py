#!/usr/bin/env python3
from __future__ import annotations

import json
import time
import urllib.request

BASE = "https://www.vibeschool.co.ke"
ATTEMPTS = 30
DELAY_SECONDS = 10


def fetch(path: str) -> tuple[bytes, str]:
    req = urllib.request.Request(
        BASE + path,
        headers={"User-Agent": "VibeSchool-PWA-Production-Smoke/2.0"},
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
            if "vibeschool-v5" in text and "SKIP_WAITING" in text:
                print(f"production release detected on attempt {attempt}")
                return
            last_error = AssertionError("production service worker is still the previous version")
        except Exception as exc:
            last_error = exc
        if attempt < ATTEMPTS:
            time.sleep(DELAY_SECONDS)
    raise AssertionError(f"new PWA release did not become visible: {last_error}")


def main() -> int:
    wait_for_release()

    home, home_type = fetch("/")
    manifest_bytes, manifest_type = fetch("/manifest.webmanifest")
    icon192, icon192_type = fetch("/pwa-icons/v2/192")
    icon512, icon512_type = fetch("/pwa-icons/v2/512")
    maskable, maskable_type = fetch("/pwa-icons/v2/maskable-512")
    apple_icon, apple_icon_type = fetch("/apple-icon")
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

    icons = {entry.get("src"): entry for entry in manifest.get("icons", [])}
    expected_icons = {
        "/pwa-icons/v2/192": ("192x192", "any"),
        "/pwa-icons/v2/512": ("512x512", "any"),
        "/pwa-icons/v2/maskable-512": ("512x512", "maskable"),
    }
    for src, (sizes, purpose) in expected_icons.items():
        entry = icons.get(src)
        if not entry:
            raise AssertionError(f"manifest missing {src}")
        if entry.get("type") != "image/png" or entry.get("sizes") != sizes or entry.get("purpose") != purpose:
            raise AssertionError(f"manifest icon contract invalid for {src}: {entry}")

    shortcut_urls = {entry.get("url") for entry in manifest.get("shortcuts", [])}
    if not {"/student", "/teacher"}.issubset(shortcut_urls):
        raise AssertionError("production manifest is missing Student/Teacher shortcuts")

    for label, payload, content_type in [
        ("192", icon192, icon192_type),
        ("512", icon512, icon512_type),
        ("maskable", maskable, maskable_type),
        ("apple", apple_icon, apple_icon_type),
    ]:
        if not payload.startswith(b"\x89PNG\r\n\x1a\n"):
            raise AssertionError(f"production icon {label} is not a real PNG payload")
        if "image/png" not in content_type:
            raise AssertionError(f"unexpected icon {label} content type: {content_type}")

    sw_text = sw.decode("utf-8", errors="replace")
    for marker in [
        "vibeschool-v5",
        "SKIP_WAITING",
        "url.pathname.startsWith('/api/')",
        "url.pathname.startsWith('/auth/')",
        "url.pathname.startsWith('/pwa-icons/')",
    ]:
        if marker not in sw_text:
            raise AssertionError(f"production service worker missing safety marker: {marker}")

    offline_text = offline.decode("utf-8", errors="replace")
    if "You’re offline" not in offline_text:
        raise AssertionError("production offline fallback is missing its offline state")
    if "Your account data is not stored in the offline cache." not in offline_text:
        raise AssertionError("production offline fallback is missing its privacy boundary")

    if "text/html" not in home_type:
        raise AssertionError(f"unexpected home content type: {home_type}")
    if "json" not in manifest_type:
        raise AssertionError(f"unexpected manifest content type: {manifest_type}")
    if "text/html" not in offline_type:
        raise AssertionError(f"unexpected offline content type: {offline_type}")

    print("PWA PRODUCTION SMOKE PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
