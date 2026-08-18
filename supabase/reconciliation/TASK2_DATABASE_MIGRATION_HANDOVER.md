# VibeSchool Task 2 — Database Migration & Clean-Build Integrity Handover

Status: IN PROGRESS / SHARED-FOUNDATION HOLD

## Starting state

- Baseline `main`: `77051a4011d7712a275f76af41efed382f017398`
- Working branch: `agent/task2-database-migration-integrity`
- Draft PR: `#282`
- Production Supabase project: `yauqsxggtuxuykcbrtzf`
- Production PostgreSQL: 17
- Production migration ledger at Task 2 start: 914 applied versions
- Production ledger first version: `20260520000000`
- Production ledger latest version at start: `20260818213841_measurement_kernel_founder_command`
- Repository migration count at first exact-branch rebuild: 659
- Repository first migration: `20260520000000_timetable_foundation_baseline.sql`
- Repository last migration at first rebuild: `20260819221000_hq_operating_system_v2.sql`
- Duplicate repository migration versions at first rebuild: 0
- First zero-to-current clean rebuild run: GitHub Actions `32194186349`
- First rebuild migration application: PASS — 659/659 repository migrations applied and local ledger count matched exactly
- First broad reconstructed-contract result: FAIL — missing `public.notifications`
- Production writes performed during discovery: none

## Shared-foundation hold

The user explicitly froze production and merge actions until the shared foundation ahead of Task 2 has merged to `main`.

Until that dependency is on `main`:

- continue implementation and testing only on `agent/task2-database-migration-integrity`
- do not merge PR #282
- do not mutate production Supabase
- do not apply production migrations
- do not modify production RLS or grants
- do not deploy Edge Functions
- do not repair production data
- do not intentionally trigger Vercel

Before final certification: fetch current `main`, reconcile every shared dependency change, inspect production again read-only, repeat dependency analysis, rebuild from zero, rerun security/application contracts and production build, then perform only explicitly permitted production-safe reconciliation.

Current shared dependency observed during Task 2: PR #281, Task 1 Authentication & Onboarding, which contains canonical repository representations of auth changes already observed in production. Task 2 must not duplicate or pre-empt that foundation while it remains unmerged.

## Known historical targets under explicit verification

| Object | Production observation | Task 2 treatment |
|---|---|---|
| `public.class_join_requests` | Exists and is used by parent/teacher application flows | Prove creation order, canonical FKs, RLS and policies from zero |
| `public.exam_results` | Exists | Prove creation order, canonical student identity, constraints, RLS and current contract from zero |
| `public.assessments` | Absent in current production catalog, but reconstructed by the repository chain | Classify as repository-only legacy drift; do not hide it with a false clean-build failure or destructive DROP; require modern assessment replacement contracts |
| `public.notifications` | Exists in production with 1 live row and is directly read/updated by student app | Recover as forward canonical migration without deleting or rewriting production data |

## Defect log

### T2-D001 — Reconciliation artifact is stale

- Severity: P1 migration-integrity
- Area: repository ↔ production migration history
- Evidence: `supabase/reconciliation/migration_classification.md` records a July snapshot of 60 local / 72 live migrations, while production had 914 ledger entries at Task 2 start.
- Root cause: static historical reconciliation was being treated too close to current truth.
- Repair: permanent Task 2 reconstruction gate now derives current repository inventory, rejects duplicate versions, rebuilds from blank local Supabase, compares repository migration count to reconstructed ledger and captures fresh evidence.

### T2-D002 — Application database typing bypass masked stale generated contracts

- Severity: P1 migration-integrity/application-contract
- Area: `lib/supabase.ts`, `lib/database.types.ts`
- Evidence: browser Supabase client had been widened so `.from(relation: string)` / `.rpc(fn: string)` accepted arbitrary strings and returned permissive types.
- Root cause: generated database types lagged rapid schema evolution, so typing was weakened instead of regenerated from canonical schema.
- Repair: permissive client compatibility cast removed. Strong `SupabaseClient<Database>` typing is restored. This correctly exposed the stale generated type file; clean-rebuild-generated types are now the required repair source.

### T2-D003 — `public.notifications` is a hidden production-only application prerequisite

- Severity: P0 pilot/database reconstruction
- Evidence: first blank rebuild successfully applied all 659 repository migrations but `public.notifications` was absent. Student notifications code directly reads/updates it; production contains the relation and 1 live row.
- Root cause: production acquired the relation outside the replayable repository chain.
- Repair: `20260819222000_task2_notifications_reconstruction.sql` creates/validates the contract, reconstructs RLS/policies, removes anonymous table privilege and preserves existing data. Production application is frozen pending shared-foundation merge.
- Preservation fingerprint captured before any future reconciliation: row count `1`; ordered ID-set MD5 `c62bc53c148e1511d1a869724cb5b560`.

### T2-D004 — Broad anonymous table grants on private learner relations

- Severity: P1 security/migration integrity
- Evidence: production read-only audit found broad `anon` table privileges on critical private learner relations including `students`, `student_classes`, `attendance`, `homework_submissions`, `assessment_attempts` and `assessment_responses`. Production RLS remains enabled on all public tables, but these grants are broader than the intended authenticated/identity-scoped boundary.
- Repair: `20260819223000_task2_private_table_anon_revoke.sql` is a forward, data-neutral repository repair. It has passed migration-security validation. Production grant mutation is frozen pending the shared foundation.

### T2-D005 — Clean-rebuild verifier incorrectly required legacy `public.assessments` to be absent

- Severity: P1 certification logic
- Evidence: Task 2 run `32195478191` applied all **661/661** repository migrations and matched the local ledger, then failed only because `task2_database_integrity_verify.sql` raised on reconstructed `public.assessments`.
- Root cause: verifier encoded production absence as a repository reconstruction requirement before drift classification was complete.
- Repair: verifier now accepts the repository’s historical `assessments` reconstruction as explicit repository-only legacy drift while still requiring `assessment_definitions`, `assessment_assignments`, `assessment_attempts`, `assessment_items` and `assessment_responses`. No destructive schema repair is authorized by this classification.

### T2-D006 — Generated `lib/database.types.ts` is materially stale

- Severity: P1 application/database contract
- Evidence: after removing the permissive Supabase client cast, TypeScript and Auth/Onboarding build gates exposed missing relations/RPCs across auth, Pathways, curriculum intelligence, support, finance, parent events, commerce and learner contracts. The Auth & Onboarding authority test itself passed before TypeScript failed.
- Root cause: generated database types do not represent the current replayable repository schema.
- Repair strategy: allow the Task 2 blank reconstruction workflow to reach `supabase gen types typescript --local`, capture the generated clean-schema contract, reconcile `lib/database.types.ts` from that authoritative output, then rerun TypeScript/build and all affected application gates. Do not hand-maintain a partial RPC/table union.

## Production integrity observations — read-only

- Public tables: 553; public tables without RLS: 0.
- Public unvalidated foreign keys: 0.
- Exam-result ↔ class school mismatches checked: 0.
- Teacher-class ↔ class school mismatches: 0.
- Timetable-slot ↔ class school mismatches: 0.
- Duplicate active student-profile group found: none.
- Public SECURITY DEFINER functions without an explicit search_path: 0.
- Anonymous-executable HQ SECURITY DEFINER functions: 0.
- Catalog-wide `student_id` FK audit found canonical `students(id)` targets across current student-domain relations.
- Production migration ledger advanced concurrently during Task 2 from 914 to 919 versions; the newly observed auth mutations have canonical forward representations in shared Task 1 PR #281 and must be reconciled after that foundation merges.

## Drift log

### DRIFT-001 — Notifications relation

- Classification: Dangerous.
- Repository at first rebuild: absent.
- Production: present, RLS enabled, live data present.
- Application: direct student dependency.
- Resolution: forward reconstruction migration added to Task 2 branch; production reconciliation frozen.

### LEGACY-001 — `public.assessments`

- Classification: Repository-only legacy drift.
- Production: absent at latest allowed read-only inspection.
- Repository clean reconstruction: present.
- Current direct application `.from("assessments")` search: none found.
- Replacement: modern assessment engine relations are mandatory in the reconstruction verifier.
- Resolution: preserve and classify until exact-current-main comparison proves whether a forward retirement migration is necessary and safe. Do not edit historical migrations or drop it merely to imitate production.

### DRIFT-002 — Production auth ledger ahead of main

- Classification: Concurrent shared-foundation drift.
- Production: five additional auth-related migration ledger entries appeared during Task 2.
- Main: unchanged at the time of observation.
- Shared repository representation: PR #281 contains forward canonical auth migrations corresponding to those production changes.
- Resolution: wait for shared foundation to merge, synchronize Task 2 with that `main`, then rerun all affected reconstruction and application gates.

## Repairs introduced

- `scripts/sql/task2_database_integrity_verify.sql` — broad read-only reconstruction contract for critical relations, historical targets, RLS, FKs, auth/identity RPCs, SECURITY DEFINER search paths, grants and validated FKs.
- `.github/workflows/task2-database-integrity.yml` — permanent disposable zero-to-current rebuild gate with filename/version validation, exact ledger count, failure injection, application/Edge Function contract inventory, clean-schema type generation and evidence capture.
- `scripts/task2_extract_application_db_contracts.py` — inventories literal application and Supabase Edge Function `.from()` / `.rpc()` dependencies for reconstruction verification.
- `supabase/migrations/20260819222000_task2_notifications_reconstruction.sql` — forward recovery of production-only notifications contract with data-preserving reconciliation.
- `supabase/migrations/20260819223000_task2_private_table_anon_revoke.sql` — explicit anonymous-grant hardening for critical private learner relations.
- `lib/supabase.ts` — permissive generated-type bypass removed; canonical `Database` typing restored.

## Certification ledger

| Gate | Evidence / head | Result | Notes |
|---|---|---|---|
| Repository inventory | initial + `32195478191` | PASS | latest completed reconstruction inventory: 661 migrations, 661 distinct versions |
| Zero-to-current migration application | `32195478191` | PASS | 661/661 migrations applied from completely empty local Supabase; ledger expected=661 actual=661 |
| Broad reconstruction contract | `32195478191` | FAIL → verifier repaired | only failure was incorrect `assessments` absence assertion; rerun required |
| TBL-011 isolated clean rebuild | Task 2 head before verifier repair | PASS | independent blank rebuild gate green |
| Supabase Migration Security Contract | Task 2 head before verifier repair | PASS | notifications + anon-revoke repairs accepted |
| Student One Full Journey | Task 2 head before verifier repair | PASS | |
| Student One Legacy Identity Recovery | Task 2 head before verifier repair | PASS | |
| TBL-012 repository extractor | Task 2 head before verifier repair | PASS | |
| CI Production Build Contract | Task 2 head before verifier repair | PASS | existing compatibility path; strict typed gate still fails |
| Auth/onboarding authority contract | run `32195478178` | PASS before TypeScript | workflow failed later only due stale DB types |
| Strong TypeScript / production build | run `32195478169` | FAIL | stale `lib/database.types.ts` now exposed; repair pending clean generated types |
| Generated/application types | current | FAIL → repair | must be regenerated from blank reconstruction |
| Application relation/RPC inventory vs clean DB | pending next Task 2 rerun | pending | previous run stopped before scanner due verifier error |
| Failure injection | pending next Task 2 rerun | pending | previous run stopped before this stage |
| Exact-current-main reconciliation | blocked by shared foundation | pending | Task 1 PR #281 not yet merged at last check |
| Production-safe reconciliation | frozen | pending | no production mutation allowed before shared foundation |
| Final production health | frozen | pending | final read-only + permitted reconciliation verification after foundation |

## Merge condition

PR #282 remains draft and unmerged. Do not merge until the shared foundation is on current `main`, Task 2 is synchronized with it, production is re-inspected, every affected gate is rerun at the exact candidate commit, and the full Definition of Done is green with zero unresolved P0 and P1 migration-integrity defects.
