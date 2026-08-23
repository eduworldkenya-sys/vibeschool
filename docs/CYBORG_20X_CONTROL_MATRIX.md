# Cyborg 20x control matrix

This matrix maps identified Cyborg weaknesses to repository-enforced controls. `IMPLEMENTED` means executable code or a repository contract exists. `VERIFIED` means the stated bounded proof has been directly observed for the named revision/environment. `PROOF PENDING` means implementation exists but required exact-head, database, production, chaos, model-replacement, or independent evidence has not yet been demonstrated. `CERTIFIED@<revision>` means an explicit certification record exists for the exact named revision and bounded scope; certification never floats forward. No row may infer production or independent proof from the existence of a migration, contract, historical CI run, same-owner certification statement, or bounded parity check alone.

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
| Mission-specific independent assurance | IMPLEMENTED | independent-assurance completion requirement | distinct independent evaluator proof |
| Adversarial completion review | IMPLEMENTED | `adversarialCompletionCritic()` | adversarial/kernel proof |
| Silent-failure/outcome verification | IMPLEMENTED | gates + truth reconciliation | behavioral proof |
| User-visible consequence requirement | IMPLEMENTED | operating constitution verification rule | journey/outcome proof |
| Production/repository parity | VERIFIED — bounded `twin-chat` security-gate scope on 2026-08-23 | exact revision + live function inspection | full source parity remains separate proof |
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
| Repository-kernel exact-head certification record | CERTIFIED@`e1a7148f4a859d2a838687a4ae6b90c029eb653a` — PR #448 bounded repository kernel/runtime-gate scope | exact-head owner certification record + passing gates | changed revisions require fresh exact-head gates |
| Independent certification | PROOF PENDING | distinct evaluator/reviewer required | evidence from an evaluator identity/process independent of implementation/certifying owner |
| Current-main reconciliation record | CERTIFIED@`c1922c8d492ad3e4e094903a76815656f413a104` — PR #455 governance/evidence scope only | exact-head owner certification + passing gates | does not certify hard provider enforcement or autonomous runtime |
| Universal provider gateway contract | IMPLEMENTED | `lib/cyborg/gateway.ts`, universal-gateway workflow | complete server/Edge enforcement proof |
| Server/Edge Function provider bypass prevention | IMPLEMENTED — release proof pending | `scripts/validate-cyborg-llm-gateway.mjs` scans server + Edge provider URLs and credentials | exact-head CI on release PR |
| Per-call signed Cyborg capability enforcement | IMPLEMENTED — release proof pending | hard-enforcement programme + request-bound signed capability + one-time consumption | exact-head capability/adversarial proof |
| Worker Engine deterministic-first model authorization | VERIFIED — bounded authoring path | `hq_workforce_authorize_model_call`, durable model-invocation/budget ledger | retain regression proof |
| Worker Engine shadow-stage model authorization | IMPLEMENTED — release proof pending | Chemistry stage claim + exact stage lease as Cyborg source authority | exact-head stage-binding/replay proof |
| Worker Engine -> Cyborg model-call enforcement | IMPLEMENTED — release proof pending | Worker authorization/source authority -> Cyborg admission -> sole provider gateway -> lineage | exact-head CI + migration contract proof |
| Worker Engine R1.4 work-item consequential bridge | VERIFIED — bounded production topology on 2026-08-23 | `hq_workforce_tool_gateway_execute` -> canonical R1.4 gateway + legacy authority closure | retain regression proof; broader resource/runtime proof separate |
| CI enforcement | IMPLEMENTED | Cyborg mission, universal gateway, chat and governance workflows | exact-head CI |

## Certification identity correction

PR #448 contains an explicit exact-head certification record at `e1a7148f4a859d2a838687a4ae6b90c029eb653a`, but GitHub records the certifying review as `COMMENTED` by the repository owner account `eduworldkenya-sys`. That supports a bounded owner-issued exact-head certification record. It does **not** prove certification by a distinct independent reviewer/evaluator. Independent certification therefore remains `PROOF PENDING` unless separate evidence exists.

PR #455 later received an owner-issued exact-head reconciliation certification at `c1922c8d492ad3e4e094903a76815656f413a104` and merged as `4cff2080be2f40cbcd761eaee9628784ae1b2ab9`. Its bounded governance/evidence certification remains valid; this correction only removes the unsupported independence label. PR #456 merged as `d97ea98bd1a889b739a1784f845e562ca3dcffcb`, preserving that correction on current `main` before the hard-enforcement release.

## Production `twin-chat` boundary

Production inspection on 2026-08-23 verified active `twin-chat` v28 with JWT verification, Cyborg mission admission before model execution, and `student_consume_twin_session` before student model execution. This is the bounded security-gate parity required by PR #452/#455.

The active deployed source is not text-identical to the repository copy in non-gate Twin behavior, so this evidence must not be expanded into full source/byte parity.

## Worker Engine boundary

Fresh production inspection on 2026-08-23 supersedes the older claim that `hq_workforce_tool_gateway_execute(task_id)` is still an independent legacy consequential mutator. It now delegates into `hq_workforce_consequential_execution_gateway(task_id)` and the R1.4 approval-bound chain. Legacy external authority is closed; runtime/heartbeat/Factory/Shadow are off, autonomy/risk are zero, Global Stop is on, and active capability-authority grants are zero.

The hard-enforcement branch now implements the remaining repository-side model boundary: governed Worker model invocations and certified Chemistry stage leases are converted into one-time source authority, admission mints a request-bound signed capability, the sole provider gateway consumes it once, and durable invocation/receipt lineage is returned to callers. Critic/Repair cannot downgrade to generic service authority. Direct model-provider endpoints and provider credentials under server/Edge runtime surfaces are CI-forbidden outside the canonical gateway.

This statement is implementation status only until the release exact head passes all applicable gates. It is not a claim that the migration is applied to production or that autonomous runtime is activated.

## Safety invariant

Implementation and certification do not authorize consequential runtime. Runtime activation, schedulers, publishing, payments and authority grants remain owner-gated. This remediation cannot be used as authority to cross those boundaries.

## Full production/runtime release condition

Full autonomous production certification remains a higher-level programme. It requires fresh proof for production persistence/execution adapters, restart/recovery, bounded real missions, broader consequential-resource proof, independent assurance, applied-production migration/runtime evidence, and appropriate production/repository parity.
