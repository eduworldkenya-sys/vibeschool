# Parent Dashboard Trust Audit

## Rule
Every parent-visible child-specific surface must establish the parent -> child relationship server-side before returning child data. Missing evidence must never be rendered as positive evidence.

## Audited surfaces

- Home: moved to `get_parent_dashboard()`; conservative attendance evidence.
- Child detail: moved to `get_parent_child_dashboard(uuid)`.
- Assessments: removed direct `students` / `parent_student_links` reads from the browser; target selection now comes from the parent-scoped dashboard and the assessment RPC returns the authorized child name.
- Published report cards: existing RPC boundary verified; published/locked state is enforced server-side.
- Homework detail: direct homework, submission, profile and student reads removed; added `get_parent_homework_detail(uuid)` with parent-child + class-enrollment authorization and a compatibility fallback for the legacy `students.class_id` relationship.
- Messages: the existing RLS model correctly limits existing threads/messages to participants, but the parent compose flow creates participants in the browser and searches arbitrary school profiles. The current participant insert policy only allows a user to insert their own participant row, so the current compose flow is not a trustworthy parent-to-teacher creation contract. This is now a P1 repair: replace it with a parent-scoped server RPC that only permits messaging the child's assigned teacher(s) and authorized school staff.

## Pilot blockers still being checked

1. Cross-parent adversarial access for every child-scoped route/action.
2. Replace browser-side parent message thread creation/contact discovery with an authorized parent communication RPC.
3. Parent-visible sensitive domains and whether each has an authoritative published source.
4. Mobile time-to-useful-information and dashboard RPC latency.
5. Production migration verification before deployment.
