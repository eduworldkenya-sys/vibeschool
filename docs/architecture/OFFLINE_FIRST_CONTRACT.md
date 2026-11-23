# VibeSchool Offline-First Contract (incremental release)

## Goal
Keep the installed PWA useful when offline, save supported work locally and synchronize only after server confirmation. Offline must never bypass Supabase/RLS authority or mix accounts on a shared phone.

## Capability classes
- **OFFLINE_LOCAL:** public standalone games and explicitly downloaded public resources; no server writes.
- **OFFLINE_SYNC:** private tasks, practice, assessments, teaching drafts and progress **only after** a per-module implementation certifies encrypted/account-scoped storage, durable idempotent outbox, authenticated reconciliation and conflict handling.
- **ONLINE_REQUIRED:** first login and token refresh when unauthenticated, payments, live teacher/student communication, private new data, formal exam authorization, publication and external delivery.

## Delivered in foundation release
- Existing PWA service worker revised to versioned public asset caching and safe offline fallback.
- User-initiated download of public game pages, application scripts and styles from Marketing Studio. Includes VibeSpin, VibeCoin, VibeSphere and VibeGames.
- Offline fallback offers links to previously prepared public games.
- No caching of authenticated routes, server API responses, RSC/prefetch results or private Supabase traffic.
- Existing browser-local game configuration retained, without adding a new independent game engine.
- Offline readiness is device-specific and subject to available storage and browser eviction.

## NOT delivered yet; explicitly blocked from being advertised as offline-ready
- Student home, personalized learning content, assessments, revision and mistakes.
- Teacher schemes, lesson plans, assignments, school-linked attendance and parents.
- Private data outbox or automatic sync across devices.
- Full offline readiness across all browser/OS combinations.
- Formal exams and any payment flow offline.

## Next releases, in order
1. Account-aware local storage interface with per-account partitioning and logout wipe policy; opt-in downloadable curriculum packs.
2. Grade 4 mathematics learner offline reading and five-question topic practice; stable local attempt IDs with server-side dedupe.
3. Teacher offline draft lessons and scheme preparation with version/conflict UI.
4. Parent read-only saved summaries where authorised, with shared-device safety.
5. Additional subject packs, storage quota monitoring, reset/reinstall recovery, retries and offline observability.

## Promotion gates for each module
1. Prepare content while online; verify complete file and data manifest before claiming ready.
2. Cold-start in airplane mode with no existing tab.
3. Navigate, interact and save after restart without internet.
4. Network returns mid-operation: exactly-once persisted effect with retry and conflict handling.
5. Test across accounts on a shared device, logout, expiry, app update and storage eviction.
6. Independent CI and real Android/iOS PWA tests for declared offline scope.
7. Record exact tested build and supported devices. Never claim 100% offline for a server-owned operation.

Do not indiscriminately cache dynamic routes or authorization-bearing responses. User agreement to offline-first is not permission to weaken privacy/security controls.

## Offline public-book feature retired (2026-11-23)
The prior free-public-book download pilot was defective and removed by owner direction. Online textbook reading remains available subject to the normal server checks. Do not reintroduce downloaded textbook copies, the `/offline/books` route, or reader save buttons. The service worker retains separately approved offline games and the general offline fallback, but no book download preparation. Existing public-book snapshots are retired on service-worker activation; no student progress database is modified.

## RESERVED / MUTED: 24-hour subscription content controls — REQUIRED BEFORE CHARGING
**DO NOT ENABLE PAID CONTENT OFFLINE by simply caching the current public reader.** When subscription payments are activated, launch must be blocked until all of the following are implemented and separately independently certified:
1. Server-confirmed payment → signed, scoped, time-limited offline entitlement linked to subscription, learner/device, publication and server expiration; verify signature and expiration on every local open.
2. Encrypted account-isolated offline content, tenant separation on shared devices, logout hygiene, local tamper/clock rollback handling, no private payload in Cache Storage shared public cache.
3. No offline renewal or extension without server-authorized fresh licence; expiry closes access even when downloaded; user-owned progress must remain accessible subject to privacy controls.
4. Cancellation/revocation is only discoverable online or after offline entitlement expiration; risk bounded by short validity window. Browser/PWA DRM is not tamper-proof.
5. End-to-end M-PESA reconciliation, authorized entitlement expiry (24 hours measured by server, not device), conflict, device offline/reconnect and abuse tests.
6. If offline books are ever approved again, build a new protected reader storage and runtime authority path instead of restoring the retired public-book pilot. **Do not switch on the payment gate or paid offline downloads until these prerequisites pass.**

Book downloads are retired; the above is historical future planning, not activated code.

## Offline scope after public-book retirement
Offline games and the branded fallback continue. Textbooks require an online authorized reader and are not saved locally as book snapshots. Future offline textbook capabilities require a separate explicit product decision and security review.
