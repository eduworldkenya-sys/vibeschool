# L0 Recovery Update Log

This log is the forensic record of the foundation-recovery loop. Each entry records what was observed, what was changed, why it was changed, and what evidence must be used to judge the result.

## 2026-08-10 — L0 Instrument Integrity / Telemetry Repair

### Problem observed

PR #74's L0 structural-diff workflow completed with failure, but the GitHub job logs returned `BlobNotFound`/404 and no trustworthy artifact was available. The prior workflow could terminate during production linking before the evidence upload stage.

### Root-cause finding

The workflow treated production linking as a hard prerequisite before evidence initialization could survive the failure. With `set -euo pipefail`, a link failure could abort the job before the recovery evidence directory was uploaded. This made the instrument unable to distinguish:

- production authentication/link failure;
- local rebuild failure;
- schema dump failure;
- Migra failure;
- artifact/upload failure.

### Decision

Do not infer success from missing telemetry. The workflow must continue after each evidence-producing command, record its exit code, and upload the evidence directory with `if: always()`.

### Change applied

Commit `facd68517aa9b30a810a47a12e697f6e1351e5de` updates `.github/workflows/l0-structural-schema-diff.yml` to:

- create the evidence directory and exit-code ledger before risky operations;
- capture the production-link exit code instead of aborting the job;
- capture local Supabase start/reset exit codes;
- capture local and production schema-dump exit codes;
- capture Migra exit code;
- preserve separate logs for link, start, rebuild, dumps, Migra, status, and Docker diagnostics;
- preserve evidence even when a preceding command fails;
- hash the evidence set;
- upload the evidence directory with `if: always()`.

### Safety assessment

- Production writes: **none**.
- Worker Engine implementation: **none**.
- Baseline SQL: **none**.
- Production migration ledger: **untouched**.
- Purpose: telemetry/recovery process only.

### Why this change is valuable

The recovery loop can now distinguish a failed system from a failed instrument. That prevents a partial or absent artifact from being interpreted as database evidence.

### Next observation required

The next workflow run must be judged by G1–G4 before any schema interpretation:

1. Migra artifact validity;
2. recorded exit codes;
3. production/local inventory presence and known production counts;
4. exact rebuild failure position.

If any gate fails, the next loop remains **Instrument Integrity**, not schema repair.

---

## Evidence Classification State

| Item | Current state | Required evidence |
|---|---|---|
| Production link | Previously failed/uncertain | `LINK_EXIT` + link log |
| Local rebuild | Known historical failure at `20260521083057_report_schedules.sql` | fresh rebuild log + exit code |
| Local schema dump | Not yet trusted | dump exit code + file |
| Production schema dump | Not yet trusted | dump exit code + file |
| Migra diff | Not yet trusted | SQL file + exit code |
| Production inventory | Not yet trusted for this run | inventory + counts |
| Four-bucket classification | BLOCKED | trusted artifact |
| Outcome A/B | BLOCKED | post-foundation structural evidence |
| Worker Engine coding | BLOCKED | full L0 exit |

## Operating Rule

Every new run appends evidence to this loop. A successful command does not erase a previous failure; a new run supersedes old evidence only when its own trust gate passes.
