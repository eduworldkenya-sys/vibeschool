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
