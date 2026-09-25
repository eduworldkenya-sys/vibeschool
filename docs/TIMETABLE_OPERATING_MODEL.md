# VibeSchool Timetable Operating Model

## Product invariant

The timetable is the operational clock of Teacher OS. It must answer five questions without guessing:

1. What must be taught?
2. Who is responsible for teaching it?
3. When does it normally recur?
4. What actually happened on the dated school day?
5. What should happen next?

Canonical chain:

**Teaching obligation -> recurring timetable pattern -> dated occurrence -> teaching session -> evidence/progress -> next occurrence**

These are separate identities. A recurring Monday period is never itself proof that teaching happened.

## Authority model

### Teaching obligation
Authority comes from class/subject allocation plus teacher assignment and academic term. It states required weekly load, not a clock time.

### Recurring pattern
The timetable slot expresses the effective-dated weekly pattern. A slot may consume one or more allocation units and may bind to a configured school period.

### Dated occurrence
The teaching occurrence is the dated identity for operational teaching. Exactly one ordinary occurrence may exist for a slot/date pair. Schedule edits must not rewrite historical occurrences.

### Teaching session
Starting, completing, cancelling, missing, substituting or recovering a lesson changes occurrence lifecycle. Time passing alone never marks curriculum as taught.

## Hard constraints

A persisted schedule must reject teacher, class or room overlap; invalid school/class/subject identity; unassigned teachers; reversed times; invalid effective ranges; invalid weekdays; and duplicate slot identity. Hard constraints are never converted into suggestion scores.

## Allocation intelligence

For every class/subject/term expose expected units, scheduled units, missing/excess units, teacher assignment health and explicit unknown-allocation state. Zero-slot obligations remain visible.

## Recurrence

MVP authority is weekly recurrence. Alternating-week patterns stay unsupported until they have dated semantics and conflict enforcement. Double/practical lessons use explicit allocation and consecutive-period rules, never label inference.

## School day

Teacher priority is **Now -> Next -> Later**, not the grid. Teacher, student, admin, Pulse, attendance, lesson plan, homework and scheme pacing must consume the same authority.

## Exceptions

A dated exception never mutates the recurring pattern retroactively. Holidays/closures do not create false missed lessons. Absence preserves scheduled responsibility. Cancellation stays auditable. Recovery links to the original. Substitution preserves scheduled and actual teacher identity. Revisions expire old patterns and activate new patterns by effective date.

## Curriculum progression

Only a valid completed occurrence may advance taught coverage. Planned, ready, active, missed, cancelled or elapsed slots do not count as taught. The next lesson comes from scheme/curriculum authority using completed teaching truth.

## Creation modes

VibeSchool supports two entry paths over one model: entry/import of an existing school timetable, and assisted generation from allocations/constraints. Generated suggestions pass the same server validation as manual entries.

## Roles

Teacher sees own obligations and daily teaching. Student sees the valid class/group schedule. School admin manages school-wide allocation, conflicts, revisions and publication. Parent has downstream visibility only. Twin consumes timetable truth but never invents schedule authority.

## Release boundary

Release requires allocation truth, recurrence/effective dating, conflict integrity, zero-slot visibility, dated occurrences, lifecycle actions, missed/cancelled/recovery semantics, downstream lesson lineage, scheme progression from completed teaching only, consistent cross-surface reads, authorization and deterministic tests.

## First-release non-goal

Do not block teacher launch on an advanced optimizer. Automatic generation, preference scoring and complex cycles come later. First make an existing Kenyan school timetable operationally trustworthy inside Teacher OS.
