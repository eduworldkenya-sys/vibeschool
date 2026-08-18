# Task 4 — Teacher Pilot Journey Production Certification

## Release state

- Branch: `task4/teacher-pilot-certification-20260819`
- PR: #286 (draft)
- Merge: **withheld**
- Production Supabase mutation: **withheld**
- Production migrations/RLS/grants: **withheld**
- Edge Functions: **not deployed**
- Vercel: **not intentionally triggered**
- Final production certification: **blocked until shared foundation ahead of Task 4 has merged and this branch is synchronized with exact current main**

## Starting state

Task 4 began from main `77051a4011d7712a275f76af41efed382f017398`.

The teacher journey already contained substantial timetable, lesson lifecycle, assessment and evidence infrastructure, but daily workflow surfaces resolved school/class/student identity inconsistently. The largest recurring defects were legacy `profiles.school_id`, `students.class_id`, optional `teacher_profiles` assumptions, and client-side workflow fragments that bypassed the existing teaching-occurrence anchor.

## Implemented on this branch

### Teacher home and navigation

- `/teacher` now enters the operational Today/Pulse home.
- Pulse notification action opens a real teacher notification inbox.
- Permanent Task 4 CI now checks teacher navigation destinations, mobile bottom navigation, offline state and route-level loading/error recovery.

### Notifications

- Added scoped teacher inbox with read/unread state, loading/error/empty states and safe deep links.
- Notification handling follows the actual production notification vocabulary; homework submission notifications resolve the homework's class before navigating.

### Teacher operating context

- Added `teacher_active_school_preferences` plus membership-checked `teacher_set_active_school` and `teacher_get_operating_context` contracts.
- Active school selection is persistent but is never authorization: every selected school must still be a current teacher membership.
- Deterministic fallback prefers the teacher school with the most current teaching assignments.
- The migration has no dependency on production-only `teacher_profiles`; clean reconstruction must be able to build it from repository migrations.

### Attendance

- Replaced legacy `timestamp` reads with the real attendance `date` contract.
- Exact lesson attendance resolves `teaching_occurrences`.
- Student roster uses current `student_classes` enrollment.
- Batch write authority validates teacher assignment, school/class, learner enrollment and exact occurrence where supplied.
- Interrupted mobile work is retained locally; successful save clears the retained draft.
- Duplicate/retry behavior remains server-guarded.

### Homework

- Teacher homework overview uses canonical active-school context and current `student_classes` enrollment.
- Class homework creation/metrics no longer derive roster truth from legacy `students.class_id`.
- Client-side notification fan-out using invalid notification types was removed from the teacher creation path.
- Existing lesson-plan/teaching-occurrence lineage and retry protection are retained.

### Lesson planning / Teach Now

- Existing `teaching_occurrences` remains the single teaching-session anchor; no competing session model was introduced.
- Lesson workspace continues to use guarded start/completion authority, exact attendance handoff, evidence, reflection, homework lineage and scheme coverage.
- Lesson context derives school from the exact teacher class+subject assignment and learners from current `student_classes`.

### Progress and learner view

- Teacher progress creation is restricted to completed teaching occurrences through guarded authority; disconnected client inserts were removed.
- Teacher learner roster uses current enrollment and includes authorized subject teachers, not only class teachers.
- Learner detail was simplified around real evidence: attendance, homework/submission state, canonical assessment gradebook, CBC evidence and exam results.

### Teacher profile

- Rebuilt the professional profile against the actual database contract instead of querying nonexistent production columns hidden behind `any` casts.
- School/classes/subjects are resolved from canonical teacher operating context.

### Assessment/results

- Existing canonical EXQ assessment workflow is retained: idempotent lesson assessment requests, teacher-reviewed drafts, assignments/attempts, marking and gradebook projection.
- Existing database policies for canonical and legacy result models use teacher assignments and current student enrollment.

## Permanent regression coverage

Added/strengthened:

- `.github/workflows/teacher-pilot-task4.yml`
- `scripts/test-teacher-pilot-task4-contract.mjs`

The contract currently checks:

- canonical teacher home
- navigation route existence and mobile/offline shell
- notification destination/scope
- attendance schema, occurrence identity, retry retention and guarded writer
- clean-build-safe teacher operating context
- canonical homework/student enrollment
- production-compatible profile fields
- occurrence-anchored progress
- Plan → Teach → Attendance/Homework/Assessment → Evidence/Reflection/Progress links
- idempotent, teacher-reviewed assessment generation
- recoverable teacher route error/loading states

## Defects found and root causes

| Severity | Defect | Root cause | State |
|---|---|---|---|
| P0 | Attendance reload queried nonexistent `timestamp` | Repository/frontend schema drift | Repaired |
| P0 | Attendance writer authorized learner through `students.class_id` | Legacy enrollment identity | Repaired |
| P0 | Learner detail authorized membership through `students.class_id` | Legacy enrollment identity | Repaired |
| P0 | Teacher profile queried nonexistent professional columns | Runtime schema hidden by `as any` | Repaired |
| P1 | `/teacher` bypassed Today/Pulse | Old Week redirect | Repaired |
| P1 | Notification bell had dead/coming-soon action | Missing teacher inbox route | Repaired |
| P1 | Homework roster/metrics used `students.class_id` | Legacy enrollment identity | Repaired |
| P1 | Homework attempted invalid client notification type | Client-side fan-out disagreed with DB CHECK | Repaired |
| P1 | Progress allowed disconnected direct records | Progress was not occurrence-anchored | Repaired |
| P1 | Subject teachers omitted from learner list | Roster restricted to `is_class_teacher` | Repaired |
| P1 | Scheme boot uses optional `teacher_profiles`/single school membership assumptions | Shared school-context drift | **Open; defer reconciliation to shared foundation merge** |

## CI evidence

At branch head `bef3ab46a2583ef530e8aa0ca3112b4203d932b2` after the clean-build-safe context repair:

Green at last observation:

- Supabase Migration Security Contract
- Teacher Pilot Task 4
- Teacher Profile Trust Contract
- Portal UX Contract
- CI Production Build Contract
- Student One Full Journey
- Student One Legacy Identity Recovery
- School discovery contract
- TBL-012 M(repo) extractor

Still executing at that observation:

- TypeScript and Production Build Gate
- Auth & Onboarding Hardening
- TBL-011 Isolated Clean Rebuild

A later documentation/navigation-test commit may trigger a fresh CI set; final evidence must always be taken from the exact candidate head.

## Clean rebuild correction

The first Task 4 operating-context migration incorrectly referenced production `teacher_profiles`. TBL-011 correctly failed because that relation is not reconstructable at that point in the repository migration chain. The dependency was removed rather than papered over with a production-only prerequisite. Migration Security then passed.

## Shared-foundation hold

Task 4 must **not** be merged or production-certified ahead of the shared foundation tasks. In particular, the remaining scheme multi-school resolver must be reconciled against the canonical school/identity contract that lands on main rather than introducing a competing Task 4-only resolver into the large scheme surface.

## Final-certification procedure after the shared foundation merges

1. Fetch exact current `main`.
2. Rebase/reconcile Task 4 and inspect all concurrent auth, school-context, canonical-student, database and teacher changes.
3. Resolve or remove any superseded Task 4 compatibility code.
4. Reinspect production Supabase read-only for the resulting schema/RPC/RLS contracts.
5. Rerun Task 4, Migration Security, TBL-011, TBL-012, Auth/Onboarding, canonical Student One, Teacher Profile, TypeScript/build and every affected teacher-domain gate.
6. Run negative teacher authorization tests and failure injection against the reconciled candidate.
7. Run Android/mobile full teacher E2E on a production-like environment.
8. Only after all candidate gates are green, apply the intended release process in the order authorized by the owner. Until then PR #286 remains draft and unmerged.

## Remaining P2 / optional enhancements

Keep visual polish, richer progress analytics and additional notification categories separate from pilot blockers. No optional enhancement may weaken canonical identity, occurrence lineage, clean reconstruction or authorization boundaries.
