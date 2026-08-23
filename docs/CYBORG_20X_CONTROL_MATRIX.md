# Cyborg 20x control matrix

This matrix maps identified Cyborg weaknesses to repository-enforced controls. `IMPLEMENTED` means executable code or a repository contract exists. `VERIFIED` means the stated bounded proof has been directly observed for the named revision/environment. `PROOF PENDING` means implementation exists but required exact-head, database, production, chaos, model-replacement, or independent evidence has not yet been demonstrated. `CERTIFIED` is reserved for controls whose required evidence has passed on the exact revision and scope named in the evidence. No row may infer full production/runtime proof from the existence of a migration, contract, historical certification, or bounded production parity check alone.

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
| Production/repository parity | VERIFIED — bounded `twin-chat` gate scope on 2026-08-23 | exact revision + truth reconciliation | active function contains Cyborg mission admission and student entitlement gate |
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
| Independent certification | CERTIFIED — PR #448 repository kernel/runtime-gate scope only | exact-head certification review + completion assurance requirement | historical exact head `e1a7148f4a859d2a838687a4ae6b90c029eb653a`; changed heads require fresh exact-head gates |
| Current-main reconciliation certification | PROOF PENDING | this matrix + exact-head CI + current production parity record | fresh exact-head checks on the reconciliation PR |
| CI enforcement | IMPLEMENTED | `cyborg-mission-kernel-contract.yml` | exact-head CI |

## Safety invariant

Implementation and certification do not authorize consequential runtime. Runtime activation, schedulers, publishing, payments and authority grants remain owner-gated. Cyborg's mission kernel may coordinate governed work, but this remediation cannot be used as authority to cross those boundaries.

## Scope boundary

The repository-kernel certification recorded on PR #448 remains historically valid for exact head `e1a7148f4a859d2a838687a4ae6b90c029eb653a`. It does **not** automatically certify later revisions or the unimplemented/unproven production persistence and runtime execution adapters.

On 2026-08-23, the active production Supabase `twin-chat` function was directly inspected. Version 28 is ACTIVE with JWT verification enabled and contains both required bounded parity controls introduced/reconciled by PR #452: Cyborg mission creation/resume before model/provider execution, and `student_consume_twin_session` before student model execution. This closes the specific production-parity evidence gap for those two gates only; it is not evidence that all production Cyborg persistence/execution work is complete.

## Release condition

A changed reconciliation head is certifiable only when its exact head passes the Cyborg contract, Agent Governance, TypeScript/production build and applicable repository integration/control-plane gates. Production persistence and runtime adapter rows remain separately proof-pending until their stated evidence exists. A failed, missing, stale or pending exact-head check keeps the changed reconciliation head uncertified.

## Reconciliation provenance

PR #446 established the persistent governed autonomous agent kernel and merged as `1ae83afddb28ae173c6150f6c4c6c2682b28f887`. PR #448 was reconciled on top of that kernel and certified at exact head `e1a7148f4a859d2a838687a4ae6b90c029eb653a`, then merged as `76be882e377c231cb4ebb5b3f25584f14703d1b0`. PR #447 was closed unmerged and is superseded by the stronger Cyborg kernel contract; it is not a canonical head. Current reconciliation work must branch from current `main`, not replay #447 or reopen #448.
