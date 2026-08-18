# VibeSchool Task 2 — Database Migration & Clean-Build Integrity Handover

Status: IN PROGRESS

## Starting state

- Baseline `main`: `77051a4011d7712a275f76af41efed382f017398`
- Working branch: `agent/task2-database-migration-integrity`
- Draft PR: `#282`
- Production Supabase project: `yauqsxggtuxuykcbrtzf`
- Production PostgreSQL: 17
- Production migration ledger: 914 applied versions
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

## Known historical targets under explicit verification

| Object | Production observation at start | Task 2 treatment |
|---|---|---|
| `public.class_join_requests` | Exists and is used by parent/teacher application flows | Prove creation order, FKs, RLS, policies and current contract from zero |
| `public.exam_results` | Exists | Prove creation order, identity semantics, FKs, RLS and current contract from zero |
| `public.assessments` | Does not exist in current production catalog | Confirm intentional legacy retirement and prove replacement assessment engine reconstructs |
| `public.notifications` | Exists in production with 1 live row and is directly read/updated by student app | Recover as forward canonical migration without deleting or rewriting production data |

## Defect log

### T2-D001 — Reconciliation artifact is stale

- Severity: P1 migration-integrity
- Area: repository ↔ production migration history
- Evidence: `supabase/reconciliation/migration_classification.md` records a July snapshot of 60 local / 72 live migrations, while production had 914 ledger entries at Task 2 start.
- Root cause: reconciliation classification was captured as a static historical snapshot and is not a current-truth certification mechanism.
- Risk: a stale artifact can appear authoritative while omitting hundreds of later migrations and current drift.
- Repair: IN PROGRESS — `.github/workflows/task2-database-integrity.yml` now derives current repository migration inventory, rejects duplicate versions, rebuilds from blank local Supabase, compares repository migration count to reconstructed ledger, and captures evidence rather than trusting static counts.

### T2-D002 — Application database typing bypass masks stale generated contracts

- Severity: P1 migration-integrity/application-contract
- Area: `lib/supabase.ts`, `lib/database.types.ts`
- Evidence: the typed `SupabaseClient<Database>` is cast to a compatibility type whose `.from(relation: string)` and `.rpc(fn: string)` return `any`, explicitly allowing application code to compile when generated database types lag the schema.
- Root cause: application typing was deliberately weakened to absorb fast schema evolution.
- Risk: removed/renamed relations and RPCs can compile despite stale database contracts.
- Repair: pending clean-rebuild-generated type reconciliation; final Task 2 certification must not rely on stale types hidden by this bypass.

### T2-D003 — `public.notifications` is a hidden production-only application prerequisite

- Severity: P0 pilot/database reconstruction
- Area: notifications application contract / migration source of truth
- Evidence: first blank rebuild successfully applied all 659 repository migrations but `public.notifications` was absent. `app/student/notifications/page.tsx` directly reads and updates that relation. Production contains the relation, RLS policies, and 1 live row.
- Root cause: production acquired the notification table outside the currently replayable repository migration chain.
- Risk: a new environment built from GitHub succeeds at SQL migration application yet the student notifications surface fails at runtime.
- Repair: forward migration `20260819222000_task2_notifications_reconstruction.sql` creates the table when absent, verifies compatible shape when already present, reconstructs RLS/policies, removes unnecessary anonymous table privileges, and preserves existing production data. Pending fresh zero-to-current certification.

## Production integrity observations

- Public unvalidated foreign keys: 0.
- Exam-result ↔ class school mismatches sampled by structural query: 0.
- Teacher-class ↔ class school mismatches: 0.
- Timetable-slot ↔ class school mismatches: 0.
- Duplicate active student-profile group found: none.
- Public SECURITY DEFINER functions without an explicit search_path: 0.
- Anonymous-executable HQ SECURITY DEFINER functions: 0.
- Catalog-wide `student_id` FK audit found canonical `students(id)` targets across current student-domain relations.

## Drift log

### DRIFT-001 — Notifications relation

- Classification: Dangerous.
- Repository at first rebuild: absent.
- Production: present, RLS enabled, live data present.
- Application: direct student client dependency.
- Resolution: forward reconstruction migration added on Task 2 branch; production reconciliation must be non-destructive and preserve the existing row.

### LEGACY-001 — `public.assessments`

- Classification: Legacy / intentional retirement hypothesis, pending final contract proof.
- Production: absent.
- Current application direct `.from("assessments")` search: none found.
- Replacement: modern assessment engine relations (`assessment_definitions`, `assessment_assignments`, `assessment_attempts`, `assessment_items`, `assessment_responses`) are required by Task 2 reconstruction contract.

## Repairs introduced

- `scripts/sql/task2_database_integrity_verify.sql` — broad read-only reconstruction contract for critical relations, historical targets, RLS, FKs, auth/identity RPCs, SECURITY DEFINER search paths, grants and validated FKs.
- `.github/workflows/task2-database-integrity.yml` — permanent disposable zero-to-current rebuild gate with filename/version validation, exact ledger count, contract rerun and evidence capture.
- `supabase/migrations/20260819222000_task2_notifications_reconstruction.sql` — forward recovery of production-only notifications contract with data-preserving reconciliation.

## Safety decisions

- Production remains read-only during discovery/reconstruction analysis until a fully certified forward reconciliation candidate exists.
- No production reset will be performed.
- No ambiguous production identity data will be mutated.
- Destructive reconciliation, if ever required, must follow expand → backfill → verify → constrain → contract and will require explicit escalation if irreversible.
- Vercel non-main deployments are disabled in `vercel.json`; Task 2 branch work proceeds without preview deployments.
- The notification repair is intentionally forward-only and does not modify the existing production row.

## Certification ledger

| Gate | Exact commit | Result | Notes |
|---|---|---|---|
| Repository inventory | `9d32739b8ae97bb66ec41d7f87342711257bcc45` | PASS (initial) | 659 migrations, no duplicate numeric versions; must repeat at final head |
| Production inventory | baseline | PARTIAL PASS | 914 applied versions; structural/security inventory underway |
| Application DB-contract inventory | baseline | FAIL → repair | typing bypass and hidden notifications dependency found |
| Zero-to-current isolated rebuild | `9d32739b8ae97bb66ec41d7f87342711257bcc45` | MIGRATIONS PASS / CONTRACT FAIL | 659/659 applied; missing notifications exposed |
| Known target dependency reconstruction | pending | pending | `class_join_requests`, `assessments`, `exam_results` |
| RLS/policy/grant reconstruction | pending | pending | |
| SECURITY DEFINER audit | production baseline | PASS (prod structural) | zero unpinned; zero anon HQ secdef; clean rebuild still pending |
| Data-integrity/FK certification | production baseline | PARTIAL PASS | zero unvalidated FKs and sampled school-identity mismatches |
| Migration history parity | pending | pending | 659 repository files vs 914 production ledger versions requires classification |
| Generated/application types | pending | FAIL → repair | compatibility client masks stale generated types |
| Database contract tests | pending | pending | |
| Auth/onboarding contracts | pending | pending | |
| Student identity contracts | pending | pending | |
| Teacher/student/parent/admin contracts | pending | pending | |
| TypeScript | branch CI | running/pending exact head | |
| Production build | branch CI | running/pending exact head | |
| Permanent clean-rebuild CI gate | `9d32739b8ae97bb66ec41d7f87342711257bcc45` | FAIL usefully | first run exposed DRIFT-001; repair commit `82079d43...` pending rerun |
| Exact-current-main reconciliation | pending | pending | |
| Production-safe reconciliation | pending | pending | |
| Final production health | pending | pending | |

## Merge condition

Do not merge until the full Task 2 Definition of Done is green at the exact candidate commit, with zero unresolved P0 database/migration defects and zero unresolved P1 migration-integrity defects.
