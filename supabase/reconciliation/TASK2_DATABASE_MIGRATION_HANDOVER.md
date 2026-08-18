# VibeSchool Task 2 — Database Migration & Clean-Build Integrity Handover

Status: IN PROGRESS

## Starting state

- Baseline `main`: `77051a4011d7712a275f76af41efed382f017398`
- Working branch: `agent/task2-database-migration-integrity`
- Production Supabase project: `yauqsxggtuxuykcbrtzf`
- Production PostgreSQL: 17
- Production migration ledger: 914 applied versions
- Production ledger first version: `20260520000000`
- Production ledger latest version at start: `20260818213841_measurement_kernel_founder_command`
- Repository migration count: pending current-tree derivation/certification
- First zero-to-current clean rebuild result: pending exact-branch CI run
- Production writes performed at start: none

## Known historical targets under explicit verification

| Object | Production observation at start | Task 2 treatment |
|---|---|---|
| `public.class_join_requests` | Exists and is used by parent/teacher application flows | Prove creation order, FKs, RLS, policies and current contract from zero |
| `public.exam_results` | Exists | Prove creation order, identity semantics, FKs, RLS and current contract from zero |
| `public.assessments` | Does not exist in current production catalog | Determine whether intentional historical retirement or unresolved drift; prove current app does not require hidden production state |

## Defect log

### T2-D001 — Reconciliation artifact is stale

- Severity: P1 migration-integrity
- Area: repository ↔ production migration history
- Evidence: `supabase/reconciliation/migration_classification.md` records a July snapshot of 60 local / 72 live migrations, while production now has 914 ledger entries.
- Root cause: reconciliation classification was captured as a static historical snapshot and is not a current-truth certification mechanism.
- Risk: a stale artifact can appear authoritative while omitting hundreds of later migrations and current drift.
- Repair: pending — replace/augment with a current deterministic parity gate derived from repository files and live/disposable state rather than trusting embedded counts.

## Drift log

No production drift classification is final until repository reconstruction and application-contract inventory are complete.

## Safety decisions

- Production is read-only during discovery/reconstruction analysis.
- No production reset will be performed.
- No ambiguous production identity data will be mutated.
- Destructive reconciliation, if ever required, must follow expand → backfill → verify → constrain → contract and will require explicit escalation if irreversible.
- Vercel non-main deployments are disabled in `vercel.json`; Task 2 branch work can proceed without preview deployments.

## Certification ledger

| Gate | Exact commit | Result | Notes |
|---|---|---|---|
| Repository inventory | pending | pending | |
| Production inventory | pending | pending | |
| Application DB-contract inventory | pending | pending | |
| Zero-to-current isolated rebuild | pending | pending | |
| Known target dependency reconstruction | pending | pending | `class_join_requests`, `assessments`, `exam_results` |
| RLS/policy/grant reconstruction | pending | pending | |
| SECURITY DEFINER audit | pending | pending | |
| Data-integrity/FK certification | pending | pending | |
| Migration history parity | pending | pending | |
| Generated/application types | pending | pending | |
| Database contract tests | pending | pending | |
| Auth/onboarding contracts | pending | pending | |
| Student identity contracts | pending | pending | |
| Teacher/student/parent/admin contracts | pending | pending | |
| TypeScript | pending | pending | |
| Production build | pending | pending | |
| Permanent clean-rebuild CI gate | pending | pending | |
| Exact-current-main reconciliation | pending | pending | |
| Production-safe reconciliation | pending | pending | |
| Final production health | pending | pending | |

## Merge condition

Do not merge until the full Task 2 Definition of Done is green at the exact candidate commit, with zero unresolved P0 database/migration defects and zero unresolved P1 migration-integrity defects.
