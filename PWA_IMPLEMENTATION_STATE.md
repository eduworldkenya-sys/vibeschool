# VibeSchool PWA Production Readiness

Status: IMPLEMENTING / TESTING

## Existing architecture retained

- Next.js App Router manifest route: `app/manifest.ts`
- Service worker: `public/sw.js`
- Offline fallback: `public/offline.html`
- Install experience: `components/pwa/PwaInstallPrompt.tsx`
- Service-worker lifecycle manager: `components/pwa/PwaServiceWorker.tsx`
- Vercel deployment remains main-only per `vercel.json`

## Safety boundary

The service worker does not cache API or authentication routes. Authenticated/private application data remains network-backed. Cached content is limited to the offline fallback and same-origin static presentation assets.

## Verification state

Repository PWA contract gate: pending CI
TypeScript / ESLint / production build: pending CI
Production deployment: not yet promoted
Production installability: not yet verified on refreshed build
Offline recovery: not yet production-verified
Update lifecycle: not yet production-verified

Do not mark the PWA production-verified until the deployment and device/browser gates have evidence.
