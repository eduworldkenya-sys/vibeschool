# Parent Dashboard Trust Audit

## Rule
Every parent-visible child-specific surface must establish the parent -> child relationship server-side before returning child data. Missing evidence must never be rendered as positive evidence.

## Audited surfaces

- Home: moved to `get_parent_dashboard()`; conservative attendance evidence.
- Child detail: moved to `get_parent_child_dashboard(uuid)`.
- Assessments: removed direct `students` / `parent_student_links` reads from the browser; target selection now comes from the parent-scoped dashboard and the assessment RPC returns the authorized child name.
- Published report cards: existing RPC boundary verified; published/locked state is enforced server-side.
- Homework detail: direct homework, submission, profile and student reads removed; added `get_parent_homework_detail(uuid)` with parent-child + current-class authorization.
- Messages: remains under audit because the surface performs multiple direct communication-table reads and creates threads from the browser. Its RLS/policy contract must be verified before the parent communication surface is called pilot-ready.

## Pilot blockers still being checked

1. Cross-parent adversarial access for every child-scoped route/action.
2. Communication authorization and contact discovery.
3. Parent-visible sensitive domains and whether each has an authoritative published source.
4. Mobile time-to-useful-information and dashboard RPC latency.
5. Production migration verification before deployment.
