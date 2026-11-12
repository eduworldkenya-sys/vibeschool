# P0 — School emergency disruption / lesson preservation

Implementation branch: `feat/timetable-emergency-disruption-p0-20261112`
Integration target: `integration/intelligent-timetable`

## Contract

A verified school administrator can preview and record a **full-day school-wide**
unplanned closure within the school's configured academic term. Supported reason
codes: demonstrations, severe weather, industrial action, insecurity, health
emergency and other. This workflow is not an automatic news-driven closure
service. A source report alone never changes a school calendar.

Canonical authorities remain:
- `school_calendar_exceptions`: the active suppression for the school/date
- `timetable_slots`: recurring schedule identity, not rewritten by closure
- `teaching_occurrences`: dated lesson history and recovery ancestry
- `schedule_recovery_occurrence`: the existing recovery writer
- `school_disruption_audit`: immutable admin action evidence only, not a
  second calendar or teaching lifecycle

The admin page is `/admin/calendar/disruptions`, linked from School Hub.
Before confirming, the administrator sees eligible slot count, existing
completed lessons, in-progress lessons and already-suppressed status. In-progress
lessons block confirmation rather than being misclassified or overwritten.

An approved closure materializes missing eligible occurrences as missed, or
changes only existing `planned/ready` occurrences to missed. It records the
prior state/reason for reversal. Completed and unrelated missed occurrences
are never overwritten. The teacher's existing missed-lesson recovery writer
remains responsible for the subsequent make-up lesson.

Every ordinary teaching transition on a suppressed date is blocked by a
database trigger, including the legacy start writer. The closure and start
paths share a date-level advisory lock. A concurrent daily generator that
attempts to create a planned occurrence is converted to an auditable missed
record. A recovery appointment on the closed date is rejected. The original
timetable stays unchanged; ordinary lesson assignment is not secretly moved.

Reopening retains the calendar exception and append-only action history, marks
the exception non-suppressing and restores eligible future-day occurrence
states. Past lessons are **not** automatically marked taught: if they remain
unrecovered, they remain missed. A day with another active calendar suppression
cannot be reopened through this workflow.

## Deliberately outside P0

- Partial-day, period-specific and class-specific interruption scopes
- Official Ministry of Education calendar ingestion and provenance checks
- Term capacity calculation from real dated periods rather than
  `term_weeks × lessons_per_week`
- Alternating Week A/B schedules (current recurrence contract is
  `EVERY_WEEK`)
- Automatic teacher/parent notifications, source verification and auto closure
- Remote teaching during a school closure requires a separately approved
  exception; ordinary start actions intentionally fail closed in P0
- Automatic scheme reallocation: preserve curriculum outcomes and teacher
  authority; existing recovery remains the path for a missed lesson
- Independent-teacher calendar UX: this P0 is school-admin only

## Verification gates

1. `node --test scripts/test-school-disruptions.mjs` (static contract).
2. `npm run test:timetable`, `npm run typecheck`, `npm run build` on exact
   feature-branch head.
3. An isolated clean database migration/rebuild and migrations ledger check.
4. Database auth tests: anon, unauthorized teacher, other-school admin,
   legitimate school admin, and repeat/stale requests.
5. Database state tests: a planned lesson, ready lesson, completed lesson,
   in-progress lesson, never-materialized lesson, concurrent daily generation,
   different calendar suppression, reopened future day and reopened past day.
6. Authenticated admin UI preview/confirm/reopen and a teacher timetable /
   missed-lesson recovery smoke test.

No production migration or rollout is authorized by this document. The
pre-existing TBL-012 live schema parity and migration-ledger discrepancies
must be reconciled before a production claim or promotion. Never fabricate
approval, current CI results or observed production behavior.
