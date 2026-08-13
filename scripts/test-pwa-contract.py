#!/usr/bin/env python3
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


def forbid(text: str, needle: str, label: str) -> None:
    if needle in text:
        raise AssertionError(f"{label}: forbidden {needle!r}")


def main() -> int:
    manifest = read("app/manifest.ts")
    layout = read("app/layout.tsx")
    icon_route = read("app/pwa-icons/v2/[variant]/route.tsx")
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
        "'/pwa-icons/v2/192'",
        "'/pwa-icons/v2/512'",
        "'/pwa-icons/v2/maskable-512'",
        "type: 'image/png'",
        "purpose: 'maskable'",
        "url: '/student'",
        "url: '/teacher'",
    ]:
        require(manifest, value, "manifest")

    forbid(manifest, "/icons/icon.png?size=", "manifest")
    forbid(manifest, "/icons/icon-192.svg", "manifest")
    forbid(layout, "/icons/icon.png?size=", "layout")
    require(layout, "'/pwa-icons/v2/192'", "layout")
    require(layout, "<PwaServiceWorker />", "layout")
    require(layout, "<PwaInstallPrompt />", "layout")

    for value in [
        "'192': { size: 192, maskable: false }",
        "'512': { size: 512, maskable: false }",
        "'maskable-512': { size: 512, maskable: true }",
        "new ImageResponse",
        "'Cache-Control': 'public, max-age=31536000, immutable'",
        "#070B1F",
    ]:
        require(icon_route, value, "PNG icon route")

    require(apple_icon, "width: 180", "Apple touch icon")
    require(apple_icon, "height: 180", "Apple touch icon")
    require(apple_icon, "contentType = 'image/png'", "Apple touch icon")

    require(sw, "vibeschool-v5", "service worker")
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
    require(install, "iphone|ipad|ipod", "iOS install path")
    require(install, "Add to Home Screen", "iOS install path")
    require(install, "/pwa-icons/v2/192", "install artwork")
    require(offline, "Your account data is not stored in the offline cache.", "offline page")

    print("PWA CONTRACT PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
