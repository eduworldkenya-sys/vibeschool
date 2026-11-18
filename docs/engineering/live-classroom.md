# VibeSchool Live — school pilot (#1791)

The first increment shares teacher-authored lesson text, formative quiz/exercise/poll prompts and separately controlled answer reveal with learners enrolled in a real school class. Teachers can start/resume/pause/end and observe joined learners, answers and hand raises. All participants are existing canonical students; the private tables store session participation and responses, NOT academic grades or timetable attendance. UI refreshes the authoritative RPC every four seconds while visible; no media streaming or new accounts.

Release flag: NEXT_PUBLIC_VIBE_LIVE_ENABLED=true enables the teacher ClassHub action and school-learner Home shortcut in a build. Default off. Apply and verify the migration in an authorized pre-production environment before enabling. Verify two separate learner sessions, teacher, unrelated learner, removed enrollment, stale prompt, answer concealment and ended/expired sessions. Verify actual mobile use and measure network/locking at expected class size, then enable a bounded pilot. Never misrepresent joined counts as online presence or official attendance.

School-only pilot. Tuition, actual scheduled/prepared lesson package binding and teaching tools, official assessments/exam timing, grade/progress integration, groups, whiteboard, replay, media and parent summaries remain separate follow-ups to issue #1791. Do not enable formal exams until canonical assessment authority and answer-release rules are integrated. Disable the flag to roll back UI; retain private session records and review retention/erasure rules before general rollout.

## Reproduce isolated SQL test

Run `npm install --prefix /tmp/live-test --no-audit --no-fund @electric-sql/pglite@0.3.14`, then `node scripts/test-live-classroom-pilot.mjs`. This exercises the actual migration against synthetic canonical membership fixtures, not production records. The helper fixtures stand in for the existing teacher authority functions. The test does not prove production schema deployment or real browser concurrency.
