#!/usr/bin/env python3
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    p = ROOT / path
    if not p.is_file():
        raise AssertionError(f"missing required PWA file: {path}")
    return p.read_text(encoding="utf-8")


def require(text: str, needle: str, label: str) -> None:
    if needle not in text:
        raise AssertionError(f"{label}: missing {needle!r}")


def require_pattern(text: str, pattern: str, label: str) -> None:
    if re.search(pattern, text, flags=re.MULTILINE) is None:
        raise AssertionError(f"{label}: missing pattern {pattern!r}")


def forbid(text: str, needle: str, label: str) -> None:
    if needle in text:
        raise AssertionError(f"{label}: forbidden {needle!r}")


def main() -> int:
    manifest = read("app/manifest.ts")
    layout = read("app/layout.tsx")
    icon_route = read("app/pwa-icons/v3/[variant]/route.tsx")
    apple_icon = read("app/apple-icon.tsx")
    sw = read("public/sw.js")
    offline = read("public/offline.html")
    install = read("components/pwa/PwaInstallPrompt.tsx")
    manager = read("components/pwa/PwaServiceWorker.tsx")

    for value in [
        "name: 'VibeSchool'",
        "short_name: 'VibeSchool'",
        "start_url: '/'",
        "scope: '/'",
        "display: 'standalone'",
        "background_color: '#070B1F'",
        "theme_color: '#070B1F'",
        "'/pwa-icons/v3/192'",
        "'/pwa-icons/v3/512'",
        "'/pwa-icons/v3/maskable-512'",
        "type: 'image/png'",
        "purpose: 'maskable'",
        "url: '/student'",
        "url: '/teacher'",
    ]:
        require(manifest, value, "manifest")

    # v3 is the only active manifest identity. The v2 route may remain temporarily
    # for backward compatibility with already-installed clients, but new metadata
    # and install surfaces must not advertise it.
    forbid(manifest, "/pwa-icons/v2/", "manifest")
    forbid(layout, "/pwa-icons/v2/", "layout")
    forbid(install, "/pwa-icons/v2/", "install prompt")
    forbid(manifest, "/icons/icon.png?size=", "manifest")
    forbid(manifest, "/icons/icon-192.svg", "manifest")
    forbid(layout, "/icons/icon.png?size=", "layout")

    for value in [
        "'/pwa-icons/v3/32'",
        "'/pwa-icons/v3/48'",
        "'/pwa-icons/v3/192'",
        "/icons/vibeschool-logo.png",
    ]:
        require(layout, value, "layout")

    # These are semantic ownership checks, not formatter/style checks. JSX may be
    # compacted or pretty-printed without invalidating service-worker/install wiring.
    require_pattern(layout, r"import\s+PwaServiceWorker\s+from\s+['\"]@/components/pwa/PwaServiceWorker['\"]", "layout service worker import")
    require_pattern(layout, r"<\s*PwaServiceWorker\s*/\s*>", "layout service worker mount")
    require_pattern(layout, r"import\s+PwaInstallPrompt\s+from\s+['\"]@/components/pwa/PwaInstallPrompt['\"]", "layout install prompt import")
    require_pattern(layout, r"<\s*PwaInstallPrompt\s*/\s*>", "layout install prompt mount")

    for value in [
        "'32': { size: 32, maskable: false }",
        "'48': { size: 48, maskable: false }",
        "'192': { size: 192, maskable: false }",
        "'512': { size: 512, maskable: false }",
        "'maskable-512': { size: 512, maskable: true }",
        "new ImageResponse",
        "'/icons/vibeschool-logo.png'",
        "'Cache-Control': 'public, max-age=31536000, immutable'",
        "#070B1F",
    ]:
        require(icon_route, value, "PNG icon route")

    require(apple_icon, "width: 180", "Apple touch icon")
    require(apple_icon, "height: 180", "Apple touch icon")
    require(apple_icon, "contentType = 'image/png'", "Apple touch icon")
    require(apple_icon, "/icons/vibeschool-logo.png", "Apple touch icon")

    # Changing the offline shell or safe public precache set requires a service-worker
    # generation change so existing installed clients actually receive the new fallback.
    require(sw, "vibeschool-v7", "service worker")
    require(sw, "'/sandbox'", "service worker safe public sandbox")
    require(sw, "url.pathname.startsWith('/api/')", "service worker")
    require(sw, "url.pathname.startsWith('/auth/')", "service worker")
    require(sw, "url.pathname.startsWith('/pwa-icons/')", "service worker")
    require(sw, "event.data?.type === 'SKIP_WAITING'", "service worker")
    require(sw, "'/offline.html'", "service worker")
    forbid(sw, "cache.addAll(['/'])", "service worker")

    require(manager, "navigator.serviceWorker.register('/sw.js', { scope: '/' })", "service worker manager")
    require(manager, "controllerchange", "service worker manager")
    require(install, "beforeinstallprompt", "install prompt")
    require(install, "DISMISS_MS", "install prompt")
    require(install, "/pwa-icons/v3/192", "install artwork")
    install_lower = install.lower()
    for token in ["iphone", "ipad", "ipod"]:
        require(install_lower, token, "iOS install path")
    require(install, "Add to Home Screen", "iOS install path")

    require(offline, "/icons/vibeschool-logo.png", "offline page")
    require(offline, "Your account data is not stored in the offline cache.", "offline page")

    print("PWA CONTRACT PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
