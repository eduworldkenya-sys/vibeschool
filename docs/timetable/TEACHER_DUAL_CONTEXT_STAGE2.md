# Teacher dual-context timetable — Stage 2 (2026-11-12)

## What is implemented
One Teacher OS timetable page now projects two **existing, independently authorised**
schedule sources and a read-only combined view.

- **School:** `lib/timetable/engine.ts` continues loading recurring timetable slots
  for school IDs returned by `get_my_teacher_school_context`. A teacher linked
  to a school opens here first; the selected school's period grid, academic
  allocation checks and scheme/teaching actions retain their existing authority.
- **Independent:** `vibetutor_my_lessons` supplies the teacher's existing
  private tuition sessions under accepted-invitation access. The teacher
  timetable can render these without any school membership or artificial
  school ID. School slots, periods, classes, attendance, lesson edits and
  occurrence generation are hidden/disabled in Independent mode.
- **All:** for teachers with verified school memberships only, combine
  the authorised school and tuition datasets in presentation. Keep their
  original school/tuition identities; do not merge database records.

`lib/timetable/teacherScheduleView.ts` is a pure read-model projector over
these canonical sources, **not a second scheduling engine**. No additional
school, teacher, learner, timetable, or tuition table is introduced.

## Identity, data isolation and error truth
- `auth.getUser()` and `profiles.role='teacher'` must succeed. The Stage 1
  `resolveTeacherTeachingIdentity` validates the server-filtered membership
  list. Unverified, malformed or stale school membership fails closed.
- School mode is the initial tab for a linked teacher. Independent mode is
  the initial and only tab for a teacher without a linked school.
- The system never uses `profiles.school_id`, client-selected schools,
  user IDs masquerading as school IDs, or stored browser preferences to
  fabricate permission.
- School modification controls work only in the active authorised school's
  **School** view. All and Independent are read-only for school patterns.
- The slot drawer's school occurrence guard never mounts in Independent mode.
- The page clears previous school data before identity/week reload and on
  sign-out. The shared tuition hook clears old private records on auth changes
  and read failure.
- Tuition RPC errors and in-flight reads are never represented as confirmed
  zero lessons. Private lessons are Nairobi-time dated and retained in their
  original tuition identities.
- Curriculum Map, Scheme, lesson-plan preparation and unscheduled teaching
  retain their existing, separately authorised flows, irrespective of
  whether an official school timetable has been set.

## What is NOT in Stage 2
- No arbitrary personal/offline independent recurring-slot writer exists
  yet. The Independent timetable currently displays **existing accepted
  tuition bookings**; personal schedule creation and editable personal
  templates are Stage 4.
- Stage 3 adds authoritative school publication/default selection where
  the school has confirmed its timetable; current Stage 2 is safe view
  routing only and cannot grant individual teachers authority over
  school-wide published schedules.
- No production data, school membership, attendance, scheme identity or
  historical timetable slot is edited by this branch.
- The separate timetable integration acceptance gates and production
  migration ledger remain outstanding until independently verified.

## Verification
Run `npm run test:timetable`, typecheck/build, governance and exact-head
CI. `scripts/test-teacher-dual-context-schedule.mjs` exercises school-first,
no-school, multi-school and combined read behavior, editing denial and
school/tuition separation. A signed-in teacher smoke replay is still required
before production certification.
