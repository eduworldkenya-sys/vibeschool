# L0 Recovery Update Log

This log is the forensic record of the foundation-recovery loop. Each entry records what was observed, what was changed, why it was changed, and what evidence must be used to judge the result.

## 2026-08-10 — Current Production Truth Recorded

A read-only audit recorded these current production facts in Issue #65:

- Production migration ledger: **552 rows**.
- Public tables: **413**.
- Public views: **19**.
- Public functions: **871**.
- Public policies: **636**.
- Non-internal triggers: **210**.
- All public tables have RLS enabled; one has FORCE RLS.
- **541 SECURITY DEFINER** public functions exist.
- **9 SECURITY DEFINER + anon EXECUTE** functions are an explicit security review set.
- No public SECURITY DEFINER functions with an unset `search_path` were found in the inspected catalog query.
- The isolated blank rebuild still fails at `20260521083057_report_schedules.sql` because `public.schools` is absent from the repository rebuild.
- The existing `hq_workforce_*` subsystem is substantial and already contains worker, skill, certification, run, handoff, context, verification, and memory concepts.
- Many inspected HQ/workforce objects do not have `school_id`; this is **not** permission to add it indiscriminately. Each object must first be classified as platform-global, school-scoped, or derived/bridge.

The earlier 546/339/198/348/141 reconciliation snapshot is explicitly stale. The current 552-row production ledger is the authoritative current observation and must be compared with a fresh repository migration inventory.

## 2026-08-10 — L0 Instrument Integrity / Telemetry Repair

### Problem observed

PR #74's L0 structural-diff workflow completed with failure, while the GitHub job logs returned `BlobNotFound`/404 and no trustworthy artifact was available. The workflow could terminate before the evidence upload stage.

### Root-cause finding

Production linking was a hard failure point, and the CLI setup action was also outside the evidence ledger. The recovery instrument could therefore fail before recording whether the failure was authentication, CLI setup, database startup, migration execution, schema dumping, Migra, or artifact publication.

### Decision

Do not infer success from missing telemetry. Every recoverable command must record its exit code, and the evidence directory must exist before risky operations begin.

### Changes applied

- `facd68517aa9b30a810a47a12e697f6e1351e5de` made production linking, local start/reset, dumps, and Migra non-fatal and recorded their exit codes.
- `9ad107dd72c9337d4d4b147c10578d13741bf59a` moved CLI installation into a captured shell step so CLI setup itself becomes evidence rather than an opaque action failure.
- `docs/L0_DECISION_PLAYBOOK.md` remains the frozen interpretation procedure.
- This log is the growing forensic record of why each recovery-loop change was made.

### Safety assessment

- Production writes: **none**.
- Worker Engine implementation: **none**.
- Baseline SQL: **none**.
- Production migration ledger: **untouched**.
- Purpose: telemetry/recovery process only.

## Current Run Result

The workflow run associated with commit `9ad107dd72c9337d4d4b147c10578d13741bf59a` completed **FAILURE** and still produced **no GitHub Actions artifact**. Because the artifact is absent, **G1 is FAIL** and the structural diff is not admissible evidence.

This does **not** prove that the database foundation changed or that the Migra result is empty. It proves only that the current telemetry path still has an unobserved failure before artifact publication.

### Current gate state

| Gate / item | State | Meaning |
|---|---|---|
| G1 Migra artifact | **FAIL** | No artifact; diff cannot be interpreted |
| G2 Exit codes | **FAIL** | No uploaded evidence ledger |
| G3 Inventories | **FAIL** | No uploaded inventories for this run |
| G4 Expected crash | **UNPROVEN** | Rebuild log is inaccessible through the current GitHub log endpoint |
| Four-bucket classification | **BLOCKED** | Trust gate not passed |
| Outcome A/B | **BLOCKED** | No structural evidence |
| Worker Engine coding | **BLOCKED** | L0 remains RED |

## Reverse-Engineering Loop Now Open

The next action is **not schema repair**. The instrument itself is now the system under investigation.

The next telemetry revision must make the earliest failure boundary observable before another interpretation attempt. Required evidence sequence:

1. repository checkout;
2. evidence-directory initialization;
3. CLI availability/version;
4. production link status;
5. local Docker/Supabase start status;
6. local rebuild status;
7. local dump status;
8. production dump status;
9. Migra status;
10. artifact publication status.

The first missing sequence element becomes the next defect to solve.

## Absolute Rule

No `schools` migration, baseline migration, RLS rewrite, HQ migration, or Worker Engine implementation is authorized by this log. Evidence first; intervention second.
