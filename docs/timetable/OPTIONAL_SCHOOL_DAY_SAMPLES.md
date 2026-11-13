# Optional VibeSchool school-day samples

## Purpose
Timetable sample times are **examples**, never automatic defaults or certified
periods for a school. The teacher may preview and edit any sample. A school
administrator alone may apply an explicitly confirmed school-day draft.

Entry: `/teacher/timetable` offers a compact, one-time sample chooser to every signed-in teacher, including teachers with existing lessons, tuition-only teachers and teachers without a school. Once a sample is chosen, the chooser disappears from their main timetable and the sample opens in `/teacher/timetable/setup?sample=<sample-id>`. The display preference is kept per signed-in user **in the current browser only**. It is never an indication that a real timetable was applied. A different browser or cleared browser data can display the chooser again.

`/teacher/timetable/setup` is the permanent **Timetable setup** destination from the timetable toolbar for **all teachers**. It can reopen the most recently chosen built-in sample and any personal templates saved on that device. Independent teachers may preview, edit, save and export personal drafts without a school connection. With a connected school, authorised school administrators can separately confirm and apply real bell periods through the existing guarded RPCs; other teachers cannot. Samples never overwrite real lessons or confirmed school periods, and selecting a sample alone does not create a school or tuition timetable.
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

## Activity colours and canonical reading

Timetable lesson slots remain neutral. Break uses a pale blue, lunch pale
orange, assembly lavender, games and clubs pale green, examinations pale rose,
and other activities subdued grey. The UI uses the shared
`lib/timetable/periodAppearance.ts` palette in the weekly sheet, daily
activity strip, personal drafts and school-day editor. Labels always accompany
colour, including when printing or for readers who cannot distinguish colours.

Timetable setup and all school-specific timetable views read the member-authorised
`get_my_school_day_blocks` snapshot, filtering by school ID. School-wide
editing continues through admin-checked block RPCs. These colours are
presentation-only: they do not create school periods, change protected
statuses, alter lesson allocation or turn a sample into a real timetable.
A school without confirmed bell periods still shows no official breaks/lunch.
