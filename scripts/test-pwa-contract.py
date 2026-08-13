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
    sw = read("public/sw.js")
    offline = read("public/offline.html")
    install = read("components/pwa/PwaInstallPrompt.tsx")
    manager = read("components/pwa/PwaServiceWorker.tsx")
    icon192 = read("public/icons/icon-192.svg")
    icon512 = read("public/icons/icon-512.svg")

    for value in [
        "name: 'VibeSchool'",
        "short_name: 'VibeSchool'",
        "start_url: '/'",
        "scope: '/'",
        "display: 'standalone'",
        "background_color: '#070B1F'",
        "theme_color: '#070B1F'",
        "'/icons/icon-192.svg'",
        "'/icons/icon-512.svg'",
        "purpose: 'maskable'",
    ]:
        require(manifest, value, "manifest")

    forbid(manifest, "/icons/icon.png?size=", "manifest")
    forbid(layout, "/icons/icon.png?size=", "layout")
    require(layout, "<PwaServiceWorker />", "layout")
    require(layout, "<PwaInstallPrompt />", "layout")

    require(sw, "url.pathname.startsWith('/api/')", "service worker")
    require(sw, "url.pathname.startsWith('/auth/')", "service worker")
    require(sw, "event.data?.type === 'SKIP_WAITING'", "service worker")
    require(sw, "'/offline.html'", "service worker")
    forbid(sw, "cache.addAll(['/'])", "service worker")

    require(manager, "navigator.serviceWorker.register('/sw.js', { scope: '/' })", "service worker manager")
    require(manager, "controllerchange", "service worker manager")
    require(install, "beforeinstallprompt", "install prompt")
    require(install, "DISMISS_MS", "install prompt")
    require(offline, "/icons/icon-192.svg", "offline page")

    for label, icon in [("192", icon192), ("512", icon512)]:
        require(icon, "#070B1F", f"icon {label}")
        require(icon, "linearGradient", f"icon {label}")
        forbid(icon, ">VIBE<", f"icon {label}")

    print("PWA CONTRACT PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
