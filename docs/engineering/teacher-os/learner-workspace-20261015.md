# Learner workspace repair — 15 October 2026

Base: `0a7313ada899314864a6ab027a0876f28e1146fe`, verified against origin/main and Vercel production before repair. Scope: the learner-profile audit and the user's instruction “Solve it”. This is a bounded slice of Teacher OS mission `CYBORG-20261011060017-a545fa`; other mission requirements and the separate formal-leadership PR #761 remain open.

## Root causes and repair

- Groups and resources navigated to class-wide workspaces. They now open learner-specific native-modal sheets. Group membership uses the existing RLS-protected group membership table; smart lists retain their authoritative resolver. Saved memberships load in one batch rather than one request per group. Optional full-workspace links remain explicit.
- Assess and snapshot actions lost learner context. Default actions now select the learner's assessment, attendance and work views; individual work opens in a learner-specific sheet. Full assessment/support/work links preserve learner and subject context.
- Recognition and Notes scrolled to one generic editor. Separate sheets now filter their respective records and retain separate drafts. Notes preserve author-private visibility; recognition preserves the existing event visibility policy. Stable request identities prevent duplicate note writes on retry. No new visibility policy is introduced.
- Roles previously pointed only to free text. It now displays canonical duty assignments with dates/history and existing team/club positions. Shared class roster management is an explicit full-workspace action. The old responsibilities field is labelled supplementary context, not an appointment authority. Formal learner leadership is deliberately not duplicated while #761 is pending.
- “View all” was a noninteractive span. It now opens the learner's school-life menu. Subject views exclude class-teacher-only actions and identity editing.
- Activity creation saved the class catalog entry without enrolling the learner. From a learner profile, creation now adds that learner as a participant using the existing participation RPC. A committed activity ID and stable participation request ID survive a partial failure inside the editor; Retry Save finishes the operation without another activity. Unknown create responses never auto-enroll; duplicate names require selecting the existing activity. The editor explicitly distinguishes shared activity edits from personal participation edits.
- The activity strip and editor now use the same accessible native dialog, with focus containment/return, Escape handling, scroll locking and close prevention during pending writes. Participation updates refresh the strip without page navigation.
- Oversized empty snapshot and pastel metric cards are compact and neutral. School-life actions wrap visibly on narrow screens. Evidence copy is shorter. The Twin control is inline on learner pages, avoiding overlap with records.
- Quick learner creation still requires only name and class context, with optional admission number. A successful class-roster creation exposes “Add more information”. About uses collapsible sections. Optional identity edits include admission number, date of birth and gender through the existing `teacher_manage_class_learner` RPC, including expected-state concurrency protection and retry identity. Teaching-context records retain the existing append-only event authority.

## Dependencies and boundaries

No database migration, new identity store, RLS change, grant change, runtime activation or production data write is introduced. All eight required RPC signatures were read from production: operations snapshot/issue/return, activity snapshot/save/membership, group resolver and learner identity edit. Anonymous execution was denied and authenticated execution granted for each; the live identity editor contains its stale-edit guard. These metadata checks do not substitute for authenticated live end-to-end tests.

Group reads and writes remain subject-scoped in subject views; class-teacher-only school-life and About controls remain unavailable there. Production contracts and isolated SQL authorization tests, rather than synthetic browser fixtures, establish the permission evidence.

## Verification

- Production build, TypeScript, lint (existing repository warnings), governance and strategic-remediation contracts.
- Actual learner page, snapshot, participation, identity and sheet components exercised through a synthetic network boundary at 320, 390, 768 and 1440 pixels. Assertions cover in-place groups and membership, learner-only loans and return, roles, individual work, recognition/private-draft separation, partial activity-save recovery, optional identity save and stale-edit rejection, loading failure/retry, focus return, subject scope and no page errors/horizontal overflow.
- Mutation control temporarily removed automatic learner enrollment; the browser regression failed on the missing Retry Save path. The original source was restored before positive verification.
- Unchanged isolated school-life SQL tests: class teacher writes, bulk retry, cross-school/subject denial, immutable history and school-admin scope.
- Unchanged isolated class/school operations SQL tests: authorization, library operations, retries and handovers.
- Existing school-life, canonical learner record, class/school responsibility, workbook and classroom contracts.

A required workbook contract on the base still expected the legacy `teacher_save_exam_results` name and equality checks. Current main already uses `teacher_save_exam_result_state(s)` and rejects mismatched response identities/states. This repair updates only those stale test assertions, adds school/class/subject response assertions, and preserves all workbook behavioral checks. Exam implementation is unchanged.

## Exact-head CI repair

The initial candidate `2c46bf2fdd21b7901ed7a835ca2284f6c91f057d` failed Teacher Pilot Task 4 run `38735438808` because the Class Operating System static contract required the removed presentation strings “TEACHER NOTES & ACTIONS” and “VibeSchool will not invent”. The underlying event persistence, canonical truth summary and authority assertions passed. The contract now requires separate private-note/recognition/follow-up controls and the canonical evidence-sufficiency condition plus its new insufficient-evidence message. This preserves the behavioral guard while permitting the approved shorter UI copy. Application source is unchanged by this CI-only repair; the final candidate must pass fresh checks.

## Release evidence and recovery

Exact candidate SHA and CI/integration evidence are the associated PR head and provider records; this preflight note is not an assertion that merge/deployment already occurred. A local fixture build is not production certification. No Vercel preview should be triggered: existing vercel.json disables deployments outside main. After merge, verify the resulting main deployment separately.

Rollback: revert the application commit. Existing group, identity, event, loan and participation records remain canonical; no schema rollback or destructive cleanup is required. Activity creation may have committed before participation failed; use the retained ID to finish, or select the existing activity after reopening. Never delete a shared activity to hide partial completion.

Residual verification: a real signed-in teacher on the deployed revision, physical Android keyboard/assistive-technology checks, and the separately governed formal-leadership release. Do not label this repair as full Teacher OS or pilot certification.
