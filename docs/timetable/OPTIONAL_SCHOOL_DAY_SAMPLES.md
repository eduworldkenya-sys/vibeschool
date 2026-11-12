# Optional VibeSchool school-day samples

## Purpose
Timetable sample times are **examples**, never automatic defaults or certified
periods for a school. The teacher may preview and edit any sample. A school
administrator alone may apply an explicitly confirmed school-day draft.

Entry: `/teacher/timetable` for new teachers with no school lessons, including independent teachers; the same editable samples remain at `/teacher/timetable/setup` for authorised school-period setup.
The empty timetable shows all four sample previews immediately. Selecting a card loads a local draft, never real slots or school periods. Independently registered teachers can edit, save on their device and export, but cannot publish periods without server-confirmed school-admin permission. No sample is a default school timetable.
There is no second timetable engine or curriculum allocation table.

## Available examples
- Kenya Ministry-style Grades 4–6: 7 × 35-minute daily lesson periods with protected assembly, breaks, lunch and non-formal activities. This is a source-informed **sample**, not proof of a particular school's bell times.
- Lower Primary Grades 1–3: illustrative 30-minute slots; **not** a national duration claim.
- Junior School Grades 7–9: illustrative 40-minute slots; KICD subject allocations are separately verified.
- Flexible / tuition planning: optional Tuesday, Thursday and Saturday sessions. This does not change existing school-vs-tuition identity or enrolment logic.
- Create my own: starts blank and requires the teacher to enter the times.

A sample populates the editor only upon explicit *Preview & edit* action.
School-day times, activities, day scope, protected breaks and labels are editable.
Draft validation rejects missing labels, invalid times and overlapping all-day/day-
specific blocks. This does not replace authoritative allocation, slot, teacher,
class, scheme, dated occurrence, or teaching-evidence constraints.

## My Template
Personal drafts are stored **on this device and in this browser only**, under
a signed-in user + school-scoped storage key. There is no false claim of
server-backed or cross-device persistence. The operator may export/import a
versioned JSON file for transfer and reuse. Files are validated, bounded to
100 blocks and never executed as code. Imported drafts are not auto-applied.

## Applying to a school
The authenticated school admin selects a sample, edits the draft, confirms the
real times and explicitly authorises the write. The UI rechecks the canonical
`can_manage_my_school_timetable` RPC and current school periods before calling
`save_school_period_block` for each block. The existing server RPC also enforces
school admin membership and protected time ranges. A non-empty existing school
period configuration is **not overwritten**, avoiding accidental loss of
linked timetable slots. On failure, the UI attempts to delete only the new IDs
created during the attempt and reloads current school data. These existing
individual RPCs are not a single atomic batch, so the operator is warned
to inspect remaining periods if rollback fails.

Applying creates school-day *periods*, not curricular subject placements.
It does not mark any lesson taught, create scheme links, assign teachers,
change national KICD weekly allocations, or reconcile historic test slots.
Never advertise a sample as Gilgil's confirmed schedule.

## Release and verification boundary
- Run `node scripts/test-school-day-samples.mjs` as part of the existing
  `npm run test:timetable` suite, then typecheck, lint and app build.
- Confirm an unprivileged teacher can save/export/import a personal draft but
  cannot alter school periods; confirm an administrator can explicitly apply
  a corrected valid sample to a **test school with zero periods**.
- Confirm a school with existing periods is read-only for template application,
  and verify invalid/overlapping and simultaneous edits fail closed.
- Production timetable schema has separate pending versioned migrations (see
  `HANDOVER.md`, TBL-012). A merged UI change alone is not deployment or
  production certification. Do not mutate Gilgil's timetable from a sample.
