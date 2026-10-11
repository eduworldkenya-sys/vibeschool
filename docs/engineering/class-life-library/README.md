# Class Life, Leadership & Library — canonical closure plan

**Status:** Implementation candidate. Do not merge/deploy until the active pilot-work mission releases its code and database scopes and the release gates pass. **Visual design is frozen.**

## Verified on production (11 Oct 2026)

- The canonical learner identity is `students.id` and current class membership is `student_classes`.
- `teacher_classes` differentiates class-teacher authority from assigned subject teaching.
- Class duties: 1 roster / 2 assigned learner rows. Classroom/subject groups: 27 / 22 memberships.
- `library_books` and `library_borrowings` both contain **0 rows**.
- Class-operations RPCs from merged PR #746 are present in the database. Its 2026-10-06 migration is in production history.
- `app/admin/resources/page.tsx` currently logs name-only borrowings and separately mutates book stock; `app/admin/reports/students/page.tsx` orders by a non-existent `borrowed_date`.
- `class_groups` and `class_group_members` are canonical; no class-specific formal learner appointment ledger was found.
- PR #749 independently handles mobile duty picker/search (not formal appointments).

## Canonical responsibilities

| Record | Authority | Invariants |
|---|---|---|
| Learner | `students.id` | Never create an alternate student identity |
| Class membership | `student_classes` | Current membership required for new appointments and loans |
| Class teacher | `teacher_classes.is_class_teacher` | Can appoint class-wide learner officers |
| Subject/group teacher | `teacher_classes` + `class_groups.subject_id` | Can appoint leader only for authorized subject group |
| Daily/weekly duties | `class_duty_rosters` and members | Rotating assignments, not formal leadership |
| Formal learner appointments | `class_learner_appointments` (candidate) | Class, role, term, dates, authorization, transfer and handover history |
| Learning groups | `class_groups` and members | Never re-create group membership inside appointments |
| School library catalogue | `library_books` | Library authority belongs to school, not class |
| Physical inventory | `library_book_copies` (candidate) | Book title owns numbered school inventory copies |
| Inventory adjustments | `library_inventory_events` (candidate) | Server-authorized restock/repair events with idempotency and actor provenance |
| Loan ledger | `library_borrowings` | One canonical learner/staff ID, copy ID, issue/due/return times, condition, idempotency |

## Work prepared without changing the visual system

1. Admin resources: existing issue/return sheet now selects a **registered** learner or staff member; issues and returns call atomic, guarded RPCs. Existing catalogue cards also expose a copy-management sheet for administrator-approved repair/restock and use a loan-safe archive RPC. There is no new page design.
2. Student report: real `name`, `issued_at`, `due_date` and `returned_at` fields replace invented columns; overdue is derived using the canonical Nairobi calendar date.
3. `canonical_library_migration_candidate.sql`: staged admin issuance/return RPCs, school identity checks, borrower integrity, and legacy REST write restriction.
4. `canonical_learner_leadership_migration_candidate.sql`: term-bound class rep, deputy, prefect and group leader appointments; future handovers; automatic closure on class exit/group membership removal; scope-checked class and learner history reads.
5. `canonical_library_copies_migration_candidate.sql`: staged per-physical-copy inventory with unique accession and active loan, automatic copy allocation/return, lost/damaged quarantine, authorized copy repair and idempotent restock audit, and guarded archive that refuses titles with outstanding loans. Preserves the existing teacher issue API.
6. `scripts/test-class-life-library-authority.mjs`: isolated PostgreSQL tests for idempotency, concurrent stock constraints, school isolation, future leadership, group authorization and transfer lifecycle. Exact-head CI workflow exercises these candidates.

## Integrated Class Hub and learner views (still draft until DB is live)

Two small reusable panels are integrated into the current Class Hub and learner views, preserving the existing compact Teacher OS styling:

- `ClassLeadershipPanel.tsx` accepts `classId`, canonical `learners`, `canManage`, `scope='class'|'group'`, optional `group`, and canonical `termEndOn`. It reads active/future appointments, schedules representatives/deputies/prefects or an authorized group leader, preserves idempotent appointment request IDs, and ends assignments without deleting history. The server rejects unauthorized actions regardless of the prop.
- `LearnerLeadershipHistoryPanel.tsx` accepts `classId` and `studentId`. It reads the canonical appointment history and shows completed/serving/scheduled leadership without exposing new learner permissions.
- Class officer panel now mounts alongside the existing duty roster in `app/teacher/classhub/[id]/operations/page.tsx` using `classData.learners` and `classData.isClassTeacher`. This page also preserves the mobile duty picker, searchable learner selection and past-duty visibility from PR #749. Group officer controls mount lazily on demand in existing group cards (no 27-RPC fan-out), use the **actual persisted member IDs**, and authorize only assignment-appropriate teachers. Read-only learner appointment history mounts within the existing About tab. All three connected views preserve navigation and the approved design.
- Only render these panels after the backend migration is confirmed in production. Their current branch presence alone does not activate them. Use the server-provided school term end date; if missing, the backend rejects out-of-term appointments.

The merged pilot blocker PR #760 had left an unreleased scope lease. Dedicated PR #763 reconciled this stale lease with a verified SHA-256 journal event and merged to main at `cf73d30416d09bc03ee11849c59aaa92834ca434`, releasing the scope. New writes must still follow Cyborg mission and release gates.

## Release order — not optional

1. **Lease released on main by #763.** Reconcile the latest `main` and the one-file #749 duty picker before release; its functionality was carried into this draft branch rather than creating duplicate roster logic.
2. Inspect the actual production migration ledger and current live constraints/functions. Determine whether any new library records were created. If so, the physical-copy candidate must be adapted and tested against those loans; do not force backfill.
3. Create proper numbered migrations via `supabase migration new`, apply them on a production-equivalent isolated database, then run negative-path security tests as real authenticated **admin, class teacher, subject teacher, learner and outsider** for two schools.
4. Class officer, group officer and learner history views are integrated in this **unmerged** branch. Confirm with the real school-scoped RPCs and prove mobile/desktop interaction; production admin/library UI must remain unchanged until the RPCs exist.
5. Confirm the staged existing-pattern copy-management sheet against deployed `school_list_library_copies`, `school_repair_library_copy`, `school_restock_library_book` and `school_archive_library_book` RPCs. Never silently convert damaged/lost stock to available. Validate book accessions, school ownership, retry idempotency, archive refusal while borrowed and aggregate stock reconciliation. Re-check the report for school scoping.
6. Re-run the exact-head full TypeScript/build, RLS, concurrency, migration, accessibility and Android/desktop authenticated journeys. Check access grants because Supabase will enforce explicit Data API grants on all existing projects starting October 30, 2026. Review P0 risks independently before merging.
7. Apply the database migration before activating app code; verify migrations, permissions, zero stock drift, and teacher/admin profile projection in production. Only then enable a tightly bounded pilot using disposable school test data.
8. After live verification, mark the original defect list with exact evidence for each item and close the pull request as complete.

## Never certify from code alone

A green isolated database test does **not** prove the live school library works. No real library circulation can be demonstrated with a production catalogue containing zero books. Do not seed invented school inventory or impersonate learners in production.

## Verification commands after checkout

```bash
npm install --prefix /tmp/class-life-db --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.5.8
WORKBOOK_PGLITE_MODULE=/tmp/class-life-db/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-class-life-library-authority.mjs
```

**Do not merge draft PR #761 or claim rollout readiness while the required database migration is intentionally staged only in docs.**
