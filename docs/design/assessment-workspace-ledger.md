# Assessment workspace capability ledger

Base: ae2f494ecf9110d10d81dcaacf279520b7ef3c76. Branch: redesign/assessment-workspace.

Evidence is current source and executable tests, not route/table presence. Connected writes remain blocked until a recoverable backup is verified.

| Capability | Initial state | Evidence / affected journey | Disposition |
|---|---|---|---|
| Canonical marking, feedback, release | Working service / broken UI | marking.ts uses guarded exq RPCs; page Number('') accepts an empty score as zero; per-answer save reloads all drafts | Repair UI validation, draft reconciliation and read-back |
| Marking schemes, moderation, correction lock | Shallow | response carries markingGuide/correctAnswer but neither is rendered; history/moderation APIs exist; released attempts locked server-side | Reuse APIs and expose accessible details |
| Marking inbox / scope | Shallow | queue service discards assignment/student IDs returned by RPC; all-school totals and queue are mixed | Retain IDs; reconcile against current authorized assignment metadata |
| Assessment analysis | Shallow / misleading | old page combines all assessments; summary RPC averages mixed release states; details have learner attempt/release state | Show assessment-specific denominators, release scopes and source records |
| Learning outcomes direct entry | Broken | page requires assignmentId and only instructs the teacher to enter from analytics | Shared valid context/assessment selector |
| Coverage vs mastery | Shallow | curriculum RPC returns linked outcomes and evidence; no taught-coverage field | Preserve mastery rules and label unknown taught coverage rather than inventing it |
| Learner support reader | Working | listInterventionQueue uses current school/class/subject authority and paginated canonical rows; failures remain errors | Preserve and extend details/history |
| Support lifecycle actions | Broken | in-progress records offer Start; createInterventionAssessment always creates remedial_practice including extension support | Correct state actions and canonical extension generation |
| Dismissal reason / history | Broken server contract | latest exq_update_intervention ignores p_completion_note; canonical completion_note/evidence_snapshot exist | Prepare guarded server repair with isolated DB tests; live activation blocked |
| Support evidence-based completion | Working canonical authority | latest exq_evaluate_intervention requires actual follow-up evidence; direct completed status is denied | Keep evaluation as completion authority |
| Exam-result semantics | Active repair | PR739 head10bc2631, conflicting/failing checks; variable denominator and explicit result states already prepared there | Do not duplicate, cherry-pick or represent PR739 as verified |
| Legacy homework/exercises, exam markbook, question bank | Existing separate capabilities | canonical assessment attempts coexist with legacy stores; questionBank.ts and established routes remain | Preserve routes and clearly distinguish activity vs assignment context |
| Connected teacher write acceptance | Blocked | backup is not verified; existing Supabase migration-history mismatch | No production write tests or migration-history repair |

## Dependency map

Four assessment routes → shared authorized context and assignment metadata → existing operating-context RPC, current enrollment, assessment definitions/assignments/attempts → existing marking, analytics, curriculum and intervention RPCs. Released result propagation and mastery evaluation remain their canonical server operations. No parallel question, mark, assessment or enrollment store is introduced.

## Verification ledger

Local verification passed on 2026-10-10:

- Four actual page components and shared adapters: populated/empty/error/retry, stale-context rejection, malformed payload failure, blank/zero/partial marks, single-question navigation and draft preservation, pending moderation, private finalization versus release, inconsistent release-state privacy, support state actions and ignored-note read-back.
- Browser: 48 page/state/viewport cases at 320, 390, 768 and 1440px. No document overflow, page errors or selected WCAG 2 A/AA and 2.1 AA axe violations. Keyboard focus and screenshots checked. These use synthetic network data, not a production teacher session.
- Isolated PostgreSQL: actual prepared SQL, current-school/ownership/RLS boundaries, moderation locks, review-date/history preservation, dismissal/reopen reasons, extension practice idempotency, released-evidence completion, unchanged-evidence closed-plan protection and repeated migration installation. Outcome propagation dependencies are fixture boundaries; production propagation is not certified.
- Existing progress support and actual-component report regressions pass. Dependency verification, TypeScript, lint and production build pass; lint retains existing repository warnings.

The old `test-assessment-workspace-redesign.mjs` CAT route assertion fails on unchanged main: it expects the former direct CAT builder instead of the existing lesson-planning journey. This unrelated landing-page contract was not weakened or changed; the new workflow verifies the four routes in this mission.

## Final implementation and activation boundary

Marking now uses scoped work stages, one-question marking, actual guides, preserved drafts, zero/partial validation, pending moderation locks and separate release. Results uses explicit private/shared scope, actual denominators, missing learners, comparable matched results, question evidence and safe exports. Outcomes provides direct entry, released evidence, source-question links and honest unknown teaching coverage. Learner support provides state-correct actions, extension distinction, review dates, explicit class-scoped refresh and canonical lifecycle history.

The SQL repair is prepared and tested locally, but **not applied to connected Supabase**. Existing production functions ignore support notes, lack the added current-context/moderation guards and do not preserve closed-plan refresh semantics. Frontend read-back exposes incompatible saves as failures. Do not merge or activate this combined change as production-ready until backup and server acceptance are verified.

Required next step: follow [the secure read-only manual backup procedure](../security/TEACHER_OS_MANUAL_BACKUP.md), configure PostgreSQL credentials and an encryption recipient through secure settings, and restore-rehearse the encrypted snapshot. No credentials belong in chat or Git. The Management API token is not being retried. Then separately authorize security-sensitive canonical function activation, reconcile existing migration-history drift without destructive shortcuts, and run dedicated-account live acceptance tests. No connected writes, schema activation, production deployment or migration-history edits were performed by this mission.

Exact-head GitHub CI, review and preview deployment are tracked on the published PR. PR739 remains a separate conflicting exam-result repair; no duplicate schema or cherry-pick is introduced. Issue753 is broader than these four pages and remains open.
