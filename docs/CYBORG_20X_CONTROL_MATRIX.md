# Cyborg 20x control matrix

This matrix maps identified Cyborg weaknesses to repository-enforced controls. `IMPLEMENTED` means executable code or a repository contract exists. `PROOF PENDING` means implementation exists but required exact-head, database, production, chaos, model-replacement, or independent evidence has not yet been demonstrated. `CERTIFIED` is reserved for controls whose required evidence has passed on the exact revision. No row may infer production proof from the existence of a migration or contract alone.

| Weakness | Status | Enforced by | Required proof |
|---|---|---|---|
| Canonical Cyborg identity | IMPLEMENTED | `lib/cyborg/*`, operating constitution | kernel contract |
| Durable mission object/state machine | IMPLEMENTED | `contracts.ts`, `hq_cyborg_missions` | migration + kernel contract |
| Prompt to autonomous convergence loop | IMPLEMENTED | `runtime.ts` | typecheck + behavioral runtime proof |
| Explicit stop/completion policy | IMPLEMENTED | `kernel.ts`, `runtime.ts` | behavioral proof |
| Loop budgets and stagnation | IMPLEMENTED | `kernel.ts` | behavioral proof |
| Progress fingerprinting | IMPLEMENTED | `kernel.ts` | behavioral proof |
| Hypothesis ledger | IMPLEMENTED | `contracts.ts`, `kernel.ts` | kernel contract |
| Contradiction detection | IMPLEMENTED | `kernel.ts` | behavioral proof |
| Evidence quality/freshness | IMPLEMENTED | `contracts.ts`, `kernel.ts` | behavioral proof |
| Exact-revision binding | IMPLEMENTED | mission/evidence/lease contracts | kernel contract + DB proof |
| Canonical truth reconciliation | IMPLEMENTED | `reconcileTruth()` | behavioral proof |
| Environment identity/drift | IMPLEMENTED | `reconcileTruth()` | behavioral proof |
| Scope/unplanned side-effect detection | IMPLEMENTED | side-effect ledger + reconciliation | behavioral proof |
| Blast-radius calculation | IMPLEMENTED | `blastRadius()` | behavioral proof |
| Rollback planning | IMPLEMENTED | completion critic | adversarial proof |
| Rollback execution | IMPLEMENTED | `executeRollback()` | behavioral proof |
| Regression mapping | IMPLEMENTED | blast-radius required checks + existing Worker Engine regressions | adversarial/kernel proof |
| Preflight/post-change truth rules | IMPLEMENTED | operating constitution + reconciliation | runtime integration proof |
| Side-effect ledger | IMPLEMENTED | `SideEffect` contract | kernel contract |
| Idempotent retry | IMPLEMENTED | idempotency keys + event unique index/RPC | DB smoke proof + adversarial proof |
| Distributed locking/leases | IMPLEMENTED | revision-bound fenced lease contract, lease RPC, runtime renewal | concurrent DB/runtime proof |
| Stale-agent protection | IMPLEMENTED | revision-bound fenced leases + `resumeMission()` | concurrent stale-agent proof |
| Durable handoff/recovery | IMPLEMENTED | checkpoint + event journal + runtime persistence port | persistence adapter + restart proof |
| Tool capability discovery/fallback | IMPLEMENTED | `chooseTool()` capability registry/fallbacks | integration fallback proof |
| Tool failure taxonomy | IMPLEMENTED | `classifyToolFailure()` | behavioral proof |
| Prompt-injection containment | IMPLEMENTED | external-content evidence-only policy | adversarial proof |
| Secret/privileged action policy | IMPLEMENTED | operating constitution + action policy | adversarial privilege proof |
| Owner gates | IMPLEMENTED | `CYBORG_OWNER_GATES` | behavioral proof |
| Negative authority | IMPLEMENTED | `CYBORG_FORBIDDEN` | behavioral proof |
| Skill version/dependency/conflict resolution | IMPLEMENTED | `resolveSkills()` | behavioral/adversarial proof |
| Required-skill evidence | IMPLEMENTED | completion gate | kernel contract |
| Skill regression/qualification policy | IMPLEMENTED | operating constitution + Worker Engine learning chain | integration proof |
| Mission-specific independent assurance | IMPLEMENTED | independent-assurance completion requirement | independent evaluator proof |
| Adversarial completion review | IMPLEMENTED | `adversarialCompletionCritic()` | adversarial/kernel proof |
| Silent-failure/outcome verification | IMPLEMENTED | gates + truth reconciliation | behavioral proof |
| User-visible consequence requirement | IMPLEMENTED | operating constitution verification rule | journey/outcome proof |
| Production/repository parity | IMPLEMENTED | exact revision + truth reconciliation | production parity proof |
| Architecture/invariant drift | IMPLEMENTED | CI kernel contract | exact-head CI |
| Failure learning/promotion | IMPLEMENTED | existing Worker Engine continuous-improvement chain + constitution binding | Worker Engine integration proof |
| Confidence/uncertainty thresholds | IMPLEMENTED | mission confidence + critic threshold + hypotheses | kernel contract |
| Requirement-to-evidence traceability | IMPLEMENTED | gates/evidence/side effects/events | DB + kernel contract |
| Mission replay | IMPLEMENTED | deterministic replay assertion | replay benchmark |
| Chaos/adversarial suite | IMPLEMENTED | adversarial + behavioral cases | exact-head chaos execution |
| Model replacement | IMPLEMENTED | model-independent contract | multi-model replacement benchmark |
| Reliability SLO telemetry | IMPLEMENTED | `hq_cyborg_slo_events`, runtime SLO recording | persisted SLO query/proof |
| Production persistence proof | PROOF PENDING | mission/event/lease/SLO migration | applied production migration + RLS/grant/RPC smoke proof |
| Runtime persistence adapter | PROOF PENDING | `CyborgPersistencePort` contract | concrete adapter + restart/recovery proof |
| Runtime execution adapter | PROOF PENDING | `CyborgExecutionPort` contract | concrete executor integration + bounded mission proof |
| Independent certification | PROOF PENDING | completion assurance requirement | independent exact-head certification |
| CI enforcement | IMPLEMENTED | `cyborg-mission-kernel-contract.yml` | exact-head CI |

## Safety invariant

Implementation does not authorize consequential runtime. Runtime activation, schedulers, publishing, payments and authority grants remain owner-gated. Cyborg's mission kernel may coordinate governed work, but this remediation cannot be used as authority to cross those boundaries.

## Release condition

The PR is certifiable only when its exact head passes the Cyborg contract, Supabase migration security, TypeScript/production build and applicable repository integration gates, and when the rows marked `PROOF PENDING` have their stated evidence. A failed, missing, stale or pending exact-head check keeps release certification pending.

## Reconciliation provenance

PR #448 was reconciled after certified PR #446 by preserving #448's exact mission-kernel delta on top of main merge commit `1ae83afddb28ae173c6150f6c4c6c2682b28f887`. The reconciliation commit was `6dafc71536713b04858bbddd0115b88b2e255013`; this record does not itself constitute certification, and the resulting exact head must pass fresh CI before merge.
