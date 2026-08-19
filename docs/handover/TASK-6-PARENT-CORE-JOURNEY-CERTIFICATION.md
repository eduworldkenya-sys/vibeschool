# VibeSchool Task 6 — Parent Core Journey Certification Handover

Date: 2026-08-19
Status: **RECONCILING / SHARED-FOUNDATION HOLD**
Repository: `eduworldkenya-sys/vibeschool`
PR: `#285` — `fix(parent): certify core journey privacy boundaries`
Branch: `cert/parent-core-journey-task6-20260819`
Original merge base: `77051a4011d7712a275f76af41efed382f017398`
Current observed main: `30dc14a4fff04ed671e034cb4c3be9156dd3d976`
Last code/test head before this handover commit: `a0899cb2ec65e3d2d6e54d68d42f7505e7a7fc40`

> Exact-head certification is intentionally not claimed by this document. The branch is behind current main and Task 5 is still open/draft. Any later candidate commit invalidates affected exact-SHA gates and they must rerun.

## Promotion dependencies

Required order: `T2 → T1 → T3 → T8 → T4 → T5 → T6 → T7`.

- T1 has advanced `main` to `30dc14a4…` with auth authority/claim-boundary repairs.
- T6 is 35 commits ahead and 32 commits behind current `main` at the latest comparison, with merge base `77051a40…`.
- T5 PR #284 remains open, draft and unmerged at observed head `c458c80b…`.
- Therefore T6 cannot become INTEGRATION GREEN or merge.

## Reconciliation performed against Task 1

Task 1 introduced stricter role-transition and direct Parent learner-creation boundaries. Task 6's earlier candidate was semantically stale and contained a migration-version conflict.

Repairs:

1. Removed Task-6 migration `20260819021800_parent_canonical_student_creation_closure.sql`, which would have conflicted with Task 1 and reopened a service-role learner-creation path.
2. Carried Task 1's fail-closed `create_child_for_parent(text,date,uuid)` compatibility tombstone into the branch at `20260819235850_auth_legacy_parent_child_creation_tombstone.sql`.
3. Reconciled `/parent/create-child` to redirect to verified `/parent/link-child`.
4. Added post-Task-1 `20260819235910_parent_claim_least_authority_post_task1.sql` so Parent claim redemption:
   - requires the authenticated account already to be an active Parent;
   - accepts only `parent`/`shared` claim purposes;
   - is one-time and expiry aware;
   - reuses/reactivates one logical family relationship;
   - does not grant `is_primary` or `can_pickup` authority;
   - cannot destructively rewrite Teacher/Admin/Student account roles;
   - grants execution only to `authenticated`.

## Production family identity — read-only evidence

Observed production `parent_student_links`:

- total links: 2
- visible/non-`none` links: 2
- `access_level='none'`: 0
- duplicate visible Parent↔Student pairs: 0
- missing canonical students: 0
- missing corresponding `profiles`: 0
- both linked `profiles` are active Parent-role profiles
- corresponding `parent_profiles` rows: missing for both links

Interpretation: the two relationship records are not orphaned user identities, but Parent profile projection/provisioning is inconsistent and must be reconciled with Task 1/Task 3 before final certification.

## Production RLS drift — read-only evidence

Current production still contains pre-Task-6 Parent policies that authorize by historical link existence without revocation semantics on several surfaces, including attendance, homework, Parent messages, legacy academic results and finance. The Task-6 privacy migration converges those reads on `public.is_parent_of_student(student_id)` and/or explicit active-link + finance-permission checks.

Production also still exposes a Parent INSERT policy on authoritative `finance_fee_payments`; Task 6 removes that path in favor of governed payment claims.

Do not treat current production as Task-6-certified until the prerequisite schema is promoted and Task-6 migrations are applied through the authorized release path.

## SECURITY DEFINER audit and repairs

Read-only production inspection found additional consequential RPC bypasses because SECURITY DEFINER functions do not inherit caller RLS.

Closed on branch in `20260819235920_parent_consequential_rpc_revocation_closure.sql`:

- `parent_start_conversation(...)`: legacy sibling-ambiguous generic conversation entrypoint has all client/runtime EXECUTE revoked; canonical path is child-scoped.
- `parent_start_child_thread(...)`: rebuilt around current `student_classes`, exact child `student_id`, school-scoped recipient authority, active participants and active family relationship; existing threads cannot be reused across siblings/schools.
- `parent_set_student_self_use(...)`: now rechecks the active family relationship at mutation time so revocation terminates the stale-session write path.
- `parent_get_student_kcse_brief(...)`: now explicitly filters `assessment_gradebook_entries.released_at is not null`; SECURITY DEFINER can no longer bypass result-release privacy.

Permanent static contract: `scripts/validate-parent-consequential-rpcs.py`.

## Family Life cross-child BOLA repair

Production policies for `child_goals`, `child_skills`, `child_books` and `child_events` only required `parent_id = auth.uid()`. That allowed a Parent to target an unrelated valid `student_id` while naming themselves as owner.

Closed on branch in `20260819235930_parent_family_life_bola_closure.sql`:

- all Parent reads/inserts/updates/deletes on those family support tables require both self ownership and `public.is_parent_of_student(student_id)`;
- milestones must match the owning goal's `student_id` and active Parent relationship;
- revoked relationships lose the whole Family Life surface immediately;
- `parent_get_linked_pathway_passports()` now filters inactive/revoked links and exposes EXECUTE only to `authenticated`.

Permanent static contract: `scripts/validate-parent-family-life-authority.py`.

## Existing Task-6 privacy closures retained

`20260819021500_parent_core_journey_privacy_closure.sql` currently closes/reconciles:

- canonical active relationship helper;
- attendance Parent read revocation;
- homework + submission revocation;
- Parent teacher-message revocation;
- released modern gradebook only;
- locked legacy exam publication boundary;
- fail-closed `traditional_grades` Parent access;
- published learning-summary relationship convergence;
- Parent fee-ledger INSERT removal;
- finance read requiring active link + `can_view_finance`;
- class learning resources scoped through active learner relationships;
- homework-answer revocation;
- family badge revocation;
- Parent access to internal child audit logs removed.

`20260819021600_parent_communication_revocation_closure.sql` closes:

- child-scoped Parent event revocation;
- VibeConnect thread/participant/message reads after revocation;
- VibeConnect message send after revocation;
- thread creation/update relationship TOCTOU defense.

## Parent Command Center R1 production drift

Exact current production read-only checks show:

- `public.parent_events`: absent
- `public.parent_payment_claims`: absent
- `public.vc_threads.student_id`: absent
- `public.parent_start_child_thread`: absent

Repository `main` contains Parent Command Center R1 migrations such as `20260818183000_parent_child_scoped_vibeconnect.sql`, but the production migration ledger does not contain that R1 version family.

Release rule: promote the already-repository-owned prerequisites through the normal migration chain first. Do not manually synthesize production parity and do not apply Task-6 migrations ahead of them.

## Legacy identity-domain issue requiring Task 3 reconciliation

Production `student_profiles.profile_id` currently represents the authenticated profile identity, not canonical `students.id`. Existing Parent policies on `student_profiles` compare `parent_student_links.student_id` directly to `student_profiles.profile_id`, which is a mixed identity-domain contract.

Observed production: 1 `student_profiles` row; it matches `students.profile_id`, not `students.id`.

Do not patch this independently in Task 6 before Task 3 canonical identity promotion. Mark the corresponding Parent profile visibility certification `RECONCILE REQUIRED` after Task 3.

## CI evidence

At prior code head `0ccef716…`:

PASS:
- Parent Core Journey Contract
- Supabase Migration Security Contract
- CI Production Build Contract
- Student One Full Journey
- Student One Legacy Identity Recovery
- Auth Gateway Contract

NOT FINAL / still running at that head when inspected:
- TypeScript and Production Build Gate
- Task 2 Database Reconstruction Integrity
- TBL-011 Isolated Clean Rebuild
- Auth & Onboarding Hardening
- TBL-012 repository extractor

Later commits added Family Life BOLA closure and its permanent regression contract, so all affected exact-head evidence must rerun. Historical green runs are supporting evidence only, not final candidate certification.

## Production safety state

Foundation hold remains active.

No Task-6 work in this reconciliation has:

- mutated Parent/Student production rows;
- applied a production migration;
- changed production RLS/grants;
- deployed an Edge Function;
- enabled production flags;
- intentionally triggered Vercel;
- repaired production family data manually.

Production access has remained read-only.

## Open gates / current blockers

### Upstream blockers

- Task 3 canonical learner/profile identity promotion and reconciliation.
- Task 8 authorization/grant/RPC/security reconciliation.
- Task 4 Teacher evidence lifecycle reconciliation.
- Task 5 Student lifecycle promotion; Task 5 is the direct promotion predecessor and is currently open/draft.

### Task-6 gates still required after upstream promotion

- exact-current-main branch synchronization/reconciliation;
- migration-version collision scan after every upstream merge;
- disposable clean reconstruction from zero;
- production-equivalent upgrade path;
- generated Supabase TypeScript contract verification;
- full RLS SELECT/INSERT/UPDATE/DELETE matrix;
- grant minimization after Task 8 reconciliation;
- SECURITY DEFINER inventory re-run;
- two-Parent BOLA matrix across all required resources;
- full revocation matrix using same live session semantics;
- claim concurrency/double redemption tests;
- cross-school and transfer behavior;
- authenticated browser positive/negative Parent E2E;
- logout/re-login continuity;
- Android/weak-network/accessibility baseline;
- security/performance advisor review on final schema;
- production preflight, forward migration, postflight, controlled privacy attack and browser E2E;
- exact-head CI for the final candidate;
- zero owned P0/P1;
- merge only after all upstream dependencies and final gates are green.

## Current verdict

**RECONCILING / SHARED-FOUNDATION HOLD**

Task 6 has closed additional real P0 authorization defects during reconciliation, but it is intentionally not called complete, integration-green or merged. Promotion is forbidden until Task 5 and the remaining upstream foundation are promoted and this branch is reconciled against exact-current `main`.
