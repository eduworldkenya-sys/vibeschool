# VibeSchool Live — unified pilot (#1791)

One private session engine and compact teacher/learner classroom for school, tuition, homeschool and approved open classes. School uses the current school/subject class authority and enrollment; tuition uses existing accepted invitations (optionally existing private groups); homeschool uses linked children; open discovery shows only published-tutor session titles to verified school-level learners, and admission still requires an accepted tuition connection including existing guardian approval. No new account system or duplicate enrolment. Muted post-secondary scope is preserved. The classroom type is persisted server side and every action rechecks the current canonical relationship.

Teach text, formative quiz/exercise/poll, shared clock, board snapshots, raise hand, reveal, pause/end and private answers. The board is teacher-drawn and shared by snapshot; no media stream. Learner Home, My Tutors, teacher ClassHub/My Tutoring and parent Home connect to the same engine. Teacher presentation and response dashboard use tabs. Joined count is not live presence or official attendance.

Release flag: NEXT_PUBLIC_VIBE_LIVE_ENABLED=true enables the UI; default off. Apply the migration only after authorization and verification in an isolated/pre-production environment. Test multiple actual signed-in accounts and mobile browsers before activation. Private tables store formative responses, not formal grades. Existing curriculum-package binding, timetable occurrences, official timed assessments, replay, videos/voice, group collaboration and payments remain follow-ups. The open mode is discoverable, not unmoderated anonymous access; existing tutor connections remain the admission authority.

## Reproduce isolated SQL test

Run npm install --prefix /tmp/live-test --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.3.14 then node scripts/test-live-classroom-pilot.mjs. Tests execute the migration against synthetic canonical school, tuition, guardian and independent-learner fixtures. Production deployment and simultaneous browser connections are separate verification requirements.
