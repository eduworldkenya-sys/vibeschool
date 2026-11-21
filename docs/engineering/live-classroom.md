# VibeSchool Live — unified pilot (#1791)

One private session engine and compact teacher/learner classroom for school, tuition, homeschool and approved open classes. School uses the current school/subject class authority and enrollment; tuition uses existing accepted invitations (optionally existing private groups); homeschool uses linked children; open discovery shows only published-tutor session titles to verified school-level learners, and admission still requires an accepted tuition connection including existing guardian approval. No new account system or duplicate enrolment. Muted post-secondary scope is preserved. The classroom type is persisted server side and every action rechecks the current canonical relationship.

Teach text, formative quiz/exercise/poll, shared clock, board snapshots, raise hand, reveal, pause/end and private answers. The board is teacher-drawn and shared by snapshot; no media stream. Learner Home, My Tutors, teacher ClassHub/My Tutoring and parent Home connect to the same engine. The immersive classroom uses a fixed teaching dock, full-screen stage, floating local preview and learner panel. Joined count is not live presence or official attendance.

Release flag: NEXT_PUBLIC_VIBE_LIVE_ENABLED=true enables the UI; default off. Apply the migration only after authorization and verification in an isolated/pre-production environment. Test multiple actual signed-in accounts and mobile browsers before activation. Private tables store formative responses, not formal grades. Existing curriculum-package binding, timetable occurrences, official timed assessments, replay, videos/voice, group collaboration and payments remain follow-ups. The open mode is discoverable, not unmoderated anonymous access; existing tutor connections remain the admission authority.

## Reproduce isolated SQL test

Run npm install --prefix /tmp/live-test --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.3.14 then node scripts/test-live-classroom-pilot.mjs. Tests execute the migration against synthetic canonical school, tuition, guardian and independent-learner fixtures. Production deployment and simultaneous browser connections are separate verification requirements.

## Teaching canvas increment (#1798)

Native text slides are authored as a bounded session-local deck (30 slides maximum; 4,000 characters per published slide). The current slide publishes using the existing scoped teach prompt, so joined learners and reconnecting learners see the authoritative current content; no duplicate session authority, raw HTML or public asset URL is introduced. Draft decks do not survive leaving the room. The drawing board includes stroke erasure with bounded snapshot undo/redo. Existing answer and access restrictions remain unchanged.

## Media extension boundary

The repository already uses Daily for scheduled private tuition (`lib/vibetutor/video.ts` and the existing private video route). Reuse that provider for this classroom, but do not reuse scheduled tuition IDs as live session IDs or allow a shared link to grant media admission. A future media endpoint must authorize every token with the live RPC using the current participant JWT, derive host/learner permissions and expiry from the returned room, and use a distinct private provider-room namespace with no recordings, learner publishing disabled by default, short-lived room-scoped tokens, server-side ejection on end/revocation, and explicit camera/mic/screen-share controls. Keep media separately default-off until verified. Local camera preview is not a broadcast. Photo/PDF/document upload and annotation require private session-entitled storage, validation, safe rendering, cleanup, and real multi-account evidence. They are not implemented by this increment.

## Whiteboard pages and export

The teacher may create up to 30 session-local draft pages and navigate between them; the current page is shared through the existing scoped board prompt. Publishing no longer closes the editor. Each page retains its strokes within the current room visit; undo/redo resets on page changes. SVG export includes all draft pages and uses only validated numeric coordinates. The exported file is local to the teacher. Drafts are not a durable archive and do not survive leaving the room or refreshing. This change preserves the 3,400-character/100-stroke page budget and existing learner authorization. Automatic synchronization, media annotation, shared text and colour, collaborative drawing and durable storage remain separate work.

## Live resources — initial integrated teaching increment (21 November 2026)

The teacher's Live dock now includes **Resources**, using existing libraries rather
than another textbook or resource authority. The picker shows:

- Active/public `learning_resources` learner-facing asset kinds only, with
  a directly authorized, rights-cleared, **certified**
  `learning_resource_versions` payload. Teacher notes, lesson plans, answer
  schemes, candidate/retired versions, unpublished roots and unsupported rich
  payloads cannot be presented through this picker.
- Existing teacher-owned supplementary `resources` only in a school Live
  session for their **same class**, with `publication_status='shared'`.
  This does not grant tuition or homeschool sessions access to school files.

A teacher explicitly presents one bounded text page (up to 30 pages per
resource) through the **existing** classroom `publish(kind='teach')` command.
The result is a content snapshot in the same ordered, authenticated lesson
history, visible to admitted participants and recovering after reconnects.
There is no new RPC, grant, media provider, file-publication path or DB table.
If material cannot be represented safely as text, the picker declines to
present it rather than silently truncating or sharing unreviewed data.

**Not yet implemented:** direct embedded PDF/photo/video/diagram presentation,
durable lesson-plan resource-version reference linking, rich formatting,
post-session original file availability, tutor-scoped private resource
grants, and independent resource analytics. These require separate scoped
authority and delivery contracts. Resource text snapshots do not imply that a
learner may navigate to the original teacher-only resource.
The feature remains behind the existing `NEXT_PUBLIC_VIBE_LIVE_ENABLED`
flag and requires real teacher/learner multi-account verification.

## Scheme-linked Live Resources (Stage 2 candidate, Issue #1856)

For an authorized **school** Live class, the Resources picker also reads the
teacher's exact class-scoped `scheme_of_work` rows and existing
`teaching_resource_links` with `target_type='scheme_lesson'`. It queries
only **active/public, school-level, learner-presentable** canonical resources,
and verifies the current Scheme link, root eligibility and exact certified,
rights-cleared `learning_resource_versions.id` again on each open.

- Prepared material is prioritized with the actual linked Scheme topic, never
  matched from titles or AI guesses.
- When a link pins `resource_version_id`, no "newest" fallback is allowed.
  Missing, retired or inaccessible pins fail closed. Legacy unpinned links
  resolve a certified version through the existing RLS and explicit gate.
- If Scheme discovery is unavailable, the picker gives a warning and retains
  existing generic resource browsing; no bogus prepared-status is inferred.
- Non-school Live sessions never query teacher school Scheme links.

This remains teacher-initiated text-page presentation into the existing Live
history; there is **no new document publication** or direct learner grant.
Exact lesson-plan occurrence binding, preserved original file links, richer
diagrams/PDF media, and post-class entitlement follow separately in Issue #1856.

## Private realtime invalidation transport (21 November 2026 candidate)

The existing authorized `vibe_live_command` remains the **only content-read authority**.
A new `realtime.messages` SELECT-only policy admits the current session host or
a joined, still-entitled learner to `vibe-live:<session-uuid>`. It rechecks active
profiles, host authority and learner identity, enrollment/tutor/guardian rules
through the same canonical `vibe_live.can_join`. The database emits only
`{"invalidate":true}` on committed room, prompt, answer, hand, question and
private-message changes; there is no lesson text, answer, roster or DM content
in broadcast payloads. Browser clients use private authenticated channels to
request a fresh authorized room snapshot and retain the existing adaptive
polling on lost connectivity, missed events or token errors. Browser client
publishing and anonymous channel admission are not granted.

**Security boundary:** Realtime's subscription-policy cache may persist after
an enrollment revocation until token refresh. Since only an empty invalidation
signal is broadcast, there is no classroom content disclosure. The subsequent
canonical RPC enforces current authority or revokes the local room. Do not
reuse this channel for raw student messages, presence names, media data or
private lesson content.

**Performance boundary:** An event can trigger immediate RPC refresh rather
than waiting for the next polling interval, but no subsecond p95 latency or
production WS availability is claimed without a real two-account mobile
latency trial. Retain the polling fallback, monotonic history, version checks
and fail-closed permission responses.


## Teacher-moderated Live text, private typing and Open-class waiting room

All three features extend the existing authorized `vibe_live_command`; there
is **no new public messaging endpoint or direct table access**.

- **Open-class waiting:** School-level eligible, authenticated learners with
  existing tutor/guardian entitlement can request entry, but may not join until
  that session's teacher explicitly admits them. An unknown learner cannot
  bypass tutor connections by knowing the room URL. Denied requests remain
  denied for that session. A teacher sees pending, still-eligible learners and
  may admit/decline; an admission never overrides current enrollment.
- **Class chat:** Off by default. The teacher explicitly enables it, may close
  it immediately and can hide messages without deleting moderation records.
  Only active-session teacher/joined learners may send, capped in length,
  volume and rate. Learners may report another participant's message; reports
  and hidden content remain available only through the authenticated
  teacher's audited projection. No learner-to-learner direct messages.
- **Private typing:** The existing teacher/learner conversation reports only
  a per-peer boolean. Entries expire after 7 seconds without a new heartbeat;
  the backend suppresses updates faster than 2 seconds. This is not a
  delivery/read receipt and never exposes other learners' activity.
- **Transport:** The previously authorized private room Realtime channel sends
  only `{"invalidate":true}`; it does not carry chat messages, student names,
  moderation reports, waiting-room identities or typing content. Authorized
  RPC re-fetches are authoritative; bounded polling remains available.
- **Privacy:** All new tables enable RLS and deny direct client access,
  including anonymous and service roles. Role, session, classroom, student,
  school/tutor and guardian conditions remain fail-closed. Real guardian,
  mobile and multi-device production acceptance still must be verified;
  PGlite/Chromium disposable fixtures are not real production attendance.

## Audio-only Live Voice candidate (21 November 2026)

**Status: implementation candidate; DISABLED pending exact-head CI, independent
authorization assurance, real signed-in teacher/learner device testing and
approved runtime commissioning.** A GitHub merge or READY web deployment does
not authorize activation of the media service.

- Reuse the existing Daily integration already used for private tuition. Do not
  add a second SFU provider, classroom enrollment, student identity or lesson
  state. Provider rooms use the distinct `vs-live-<session UUID>` namespace.
- Two independent rollout switches, BOTH required:
  `NEXT_PUBLIC_VIBE_LIVE_VOICE_ENABLED=true` for the user interface;
  `VIBE_LIVE_VOICE_SERVER_ENABLED=true` for authenticated media issuance.
  Both default to off. `DAILY_API_KEY` stays server-side only. Daily usage can
  incur provider charges even with no new subscription.
- A user's JWT must be verified afresh. The private token endpoint calls the
  existing `vibe_live_command(get)` and validates that the session is active,
  the participant is authorized and the current entitlement allows entry.
  The teacher is derived from the canonical RPC, not the browser. A learner
  participant ID is resolved from their own protected student identity.
- The Daily room is private, bounded to the existing session expiry with
  `eject_at_room_exp`, recording, video, screen sharing and chat disabled; audio-only is enforced with meeting-token `canSend=['audio']` and `canReceive.base.video=false`.
  Meeting tokens are short-lived. Learners join receive-only; the teacher may
  grant/revoke only audio publication to a currently raised-hand learner.
  The learner must personally switch their microphone on. The UI never turns
  on a remote microphone.
- Voice has separate client state and media cleanup and MUST NOT reset lesson
  history, slides, whiteboards, answers or notes. On teacher end, attempt
  server-mediated room destruction and remote ejection.
- The teacher roster is not proof of real-time audio presence. Each issued
  Daily token now has a `120-second maximum expiry` and
  `eject_at_token_exp=true`: Daily must eject an already-connected participant
  when that token expires, even if the teacher's browser has closed.
  Connected browsers proactively leave and request a **new canonical Live
  authorization** before token expiry, then rejoin audio. A revoked learner
  fails that new authorization, and their previous media admission expires
  independently of the teacher. This is a **bounded maximum window**, NOT
  immediate revocation: up to ~120 seconds after the last admitted token.
  Ordinary reconnects may briefly interrupt audio approximately every 90
  seconds; this limitation needs a smoother, server-monitored strategy before
  broad launch. Suspended tabs may need manual reconnection.
- Client roster reconciliation adds fast-path removal and publishing revocation
  while the teacher is online. It is **not trusted as the only security
  mechanism**. Real Daily provider acceptance must prove that the token expiry
  ejects already-connected callers, teacher participant-admin can grant/revoke
  **audio-only** permissions without full owner privileges, and unauthorized
  mobile clients cannot bypass mic restrictions. Direct server-side emergency
  ejection/revocation and mobile continuity are still acceptance requirements.
- Run `npm run test:live-voice` and full repository CI, test two different
  authenticated Android devices, browser microphone consent, speaker output,
  teacher approval, hand queue, blocked learner publishing, internet loss,
  mobile-data changes, 10–20 listeners, and ending/revoking mid-call. Check
  provider room configuration and actual provider permission enforcement.
- Do not enable until operational Daily budget/usage review, real-device
  privacy and latency evidence, independent security assurance and explicit
  governed production activation. Rollback: disable either feature flag
  immediately; remove active provider rooms via authorized API if necessary.

## Teacher-followed reading and learner independent scroll (21 November 2026)

- The canonical `vibe_live.command` adds a teacher-only `present` action;
  there is no new URL, unauthenticated publish path or direct browser table access.
  A scoped presenter update contains only the authorized session's existing
  prompt ID, the current-prompt snapshot ID and a scroll fraction (0–1).
  The client emits bounded position writes, serializes in-flight requests and
  the database rejects malformed or foreign-session prompt IDs.
- On publishing a new lesson page, the presenter pointer resets atomically to
  that page and position zero. A delayed scroll from a previous current prompt
  is ignored. Presenting an older page remains possible without duplicating
  its content or resetting lesson history.
- Joined learners follow the teacher by default; **Browse freely** suspends
  automatic navigation. Their own touch, wheel, keyboard scrolling or lesson
  history selection likewise detaches. **Jump to teacher** restores sync at
  the exact authorized presenter page and proportional position. Ratios avoid
  pixel mismatch across teacher desktops and learner Android phones.
- The private Realtime channel broadcasts only `invalidate:true`, which
  prompts a canonical scoped RPC re-read; bounded polling remains the fallback.
  Teacher controls do not override learner scroll, and learners cannot control
  another learner's viewport. Paused, ended, unauthorized and revoked rooms
  cannot accept presenter updates.
- Native long-text lesson content and shared teaching resource text use the
  classroom `stageContent` scroll container. The PDF iframe is an isolated
  browser PDF viewer: its **internal PDF scroll cannot currently be read** or
  synchronized by this feature; do not claim PDF page-by-page follow support.
  An accessible page-aware PDF renderer would be separate work.
- The migration must pass disposable SQL authorization and actual Chromium
  multi-account tests, independent security assurance and production rollout.
  A GitHub PR is not evidence of deployed synchronization.
