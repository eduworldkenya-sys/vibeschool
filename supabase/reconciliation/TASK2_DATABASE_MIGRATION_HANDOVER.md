# VibeSchool Task 2 — Database Migration & Clean-Build Integrity Handover

Status: 🟣 RECONCILING

## Integration position

- Promotion order: **T2 → T1 → T3 → T8 → T4 → T5 → T6 → T7**.
- Task 2 is the first shared-foundation promotion candidate. Task 1 is downstream and must not be imported into the Task 2 release contract.
- Baseline/current `main` observed during this reconciliation: `77051a4011d7712a275f76af41efed382f017398`.
- Working branch: `agent/task2-database-migration-integrity`.
- Draft PR: `#282`.
- Current candidate head after ownership/type-scope repair: `60bdca6287bb68a1408f2cbfdf94ed1a12ed2850`.
- Production Supabase project: `yauqsxggtuxuykcbrtzf`.
- No production mutation, production migration, RLS/grant mutation, Edge deployment, data repair, feature activation, or intentional deployment was performed during this reconciliation.

## Task 2 release boundary

Task 2 certifies deterministic reconstruction and security of the shared database foundation. It does **not** certify every literal database contract referenced by all parallel/downstream VibeSchool work.

The permanent Task 2 gate therefore records two different sets:

1. **Task-2-owned foundation contracts** — hard release blockers.
2. **Full application literal contracts** — drift evidence that must be handed to the owning downstream task when outside the Task 2 boundary.

This prevents a downstream feature or Task 1 RPC from being fabricated into Task 2 merely to make a broad scanner green.

### Task-2-owned shared RPCs

- `get_my_role`
- `get_my_onboarding_state`
- `get_my_auth_access_state`
- `current_student_id`

`get_my_auth_journey_state` is explicitly **Task 1 owned** and is excluded from the Task 2 reconstruction gate. Clean-reconstruction-generated database types independently confirm the four Task 2 primitives above are present while the Task 1 composite RPC is absent.

## Reconstruction state

Latest completed pre-repair evidence:

- Repository migration files: **662**.
- Clean local rebuild: **662/662 applied**.
- Duplicate repository migration versions: **0**.
- Failure injection: **PASS**.
- Generated database types from the reconstructed database: **PASS** and non-empty.
- Full literal application inventory: **222 relations / 190 RPCs**.
- Earlier broad literal scan: **86 relations / 21 RPCs** absent from clean reconstruction. These are retained as drift evidence and are no longer automatically treated as Task-2-owned defects.

The current exact-head run must supersede these pre-repair numbers before promotion.

## Repairs introduced

### T2-D001 — Stale reconciliation evidence

A permanent exact-head workflow now inventories repository migrations, rejects invalid/duplicate versions, rebuilds a disposable Supabase database from zero, verifies local migration-ledger equality, generates database types, performs failure injection, runs reconstruction/security contracts, and uploads evidence.

### T2-D002 — Production-only `notifications` dependency

`20260819222000_task2_notifications_reconstruction.sql` recovers `public.notifications` into replayable repository truth with explicit shape validation, RLS, scoped policies and grants while preserving existing production data when eventually applied through the governed migration process.

### T2-D003 — Anonymous grants on private relations

`20260819223000_task2_private_table_anon_revoke.sql` codifies removal of anonymous privileges from private learner/user relations. The migration-security workflow accepts the repair. Production remains untouched by this branch-level certification.

### T2-D004 — Identity/profile reconstruction gaps

`20260819224000_task2_identity_profile_reconstruction.sql` recovers role-profile/audit/catalogue contracts needed by repository reconstruction, with FK/role verification, RLS and explicit grants.

### T2-D005 — Incorrect Task 1 dependency in Task 2 verifier

The Task 2 verifier previously required `get_my_auth_journey_state`. That created an inverted dependency: T2 could not pass until T1 existed even though the approved integration order requires T2 first. The verifier now requires only the shared auth/identity primitives owned by T2.

### T2-D006 — Full-app literal scan incorrectly acted as Task 2 ownership

`scripts/task2_extract_application_db_contracts.py` now emits both the complete diagnostic inventory and explicit Task-2-required relation/RPC lists. `.github/workflows/task2-database-integrity.yml` blocks on the owned subset and preserves the complete missing inventory as `DRIFT_REQUIRES_OWNER_RECONCILIATION` evidence.

### T2-D007 — Strict client typing change expanded Task 2 into downstream feature repair

Task 2 had removed the compatibility layer in `lib/supabase.ts`, causing unrelated parallel features to fail TypeScript because their schema contracts are not yet reconciled into one generated type truth. That change was outside the migration-foundation boundary and was reverted to current-main behavior. Task 2 still generates and validates clean-reconstruction database types as independent evidence; restoring the existing application compatibility client does not weaken the reconstruction/security gate.

## Read-only production checkpoint — 2026-08-19

Latest read-only inspection during this reconciliation:

- Production migration ledger: **923** applied entries at inspection time.
- Public tables: **553**.
- Public tables without RLS: **0**.
- Unvalidated public foreign keys: **0**.
- Public `SECURITY DEFINER` functions without explicit `search_path`: **0**.
- Anonymous-executable HQ `SECURITY DEFINER` functions: **0**.

The production ledger advanced concurrently during Task 2 work. This is recorded as drift evidence; no assumption is made that an earlier 914/919 snapshot remains current.

## Known drift classifications

- `public.assessments`: repository-only legacy reconstruction; modern assessment-engine relations remain mandatory. Do not destructively drop it merely to mimic production.
- Production-only / downstream application objects: retain in the full literal drift artifact and reconcile with their owning tasks after the Task 2 foundation merges.
- Objects absent from both production and clean reconstruction are application-contract gaps, not migration-history facts; they must be repaired by their owning tasks unless promoted into the shared foundation through an explicit dependency decision.

## Current exact-head gate

Candidate: `60bdca6287bb68a1408f2cbfdf94ed1a12ed2850`.

Already green on this head at the latest checkpoint:

- Supabase Migration Security Contract
- CI Production Build Contract
- Student One Full Journey
- Student One Legacy Identity Recovery

Still running/pending at the latest checkpoint:

- Task 2 Database Reconstruction Integrity
- TBL-011 Isolated Clean Rebuild
- TBL-012 M(repo) extractor
- Auth & Onboarding Hardening
- TypeScript and Production Build Gate

Do not promote based on partial green evidence. The exact candidate head must finish all applicable workflows successfully.

## Merge condition

PR #282 may move to **🟢 INTEGRATION GREEN** and merge only when all of the following are true at one exact head:

1. Current `main` has not advanced, or the Task 2 branch has been reconciled onto the new current `main`.
2. Clean zero-to-current repository reconstruction passes.
3. Task-2-owned relation/RPC reconstruction passes.
4. Failure injection and broad security/reconstruction verifier pass, including rerun/idempotent certification.
5. Migration-security, auth/authorization regressions, student journey, TypeScript, lint/build and production-build gates pass.
6. Generated DB-type evidence is successfully produced from the clean reconstruction.
7. Full application drift is preserved/classified rather than hidden.
8. Final read-only production drift/security comparison is current.
9. No unresolved P0/P1 defect remains inside the Task 2 ownership boundary.

After merge, mark **T1, T3, T8, T4, T5, T6 and T7 = 🟠 RECONCILE REQUIRED** and begin Task 1 reconciliation against the new `main`.
