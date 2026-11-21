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
