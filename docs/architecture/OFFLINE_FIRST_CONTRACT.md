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
