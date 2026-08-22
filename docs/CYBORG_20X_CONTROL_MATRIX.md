# Cyborg 20x control matrix

This matrix maps the identified Cyborg weaknesses to repository-enforced controls. `DONE` means an implementation and a verification path exist; final release certification additionally requires the exact PR head to pass CI.

| Weakness | Status | Enforced by | Proof |
|---|---|---|---|
| Canonical Cyborg identity | DONE | `lib/cyborg/*`, operating constitution | kernel contract |
| Durable mission object/state machine | DONE | `contracts.ts`, `hq_cyborg_missions` | migration + kernel contract |
| Prompt to autonomous convergence loop | DONE | `runtime.ts` | typecheck + kernel contract |
| Explicit stop/completion policy | DONE | `kernel.ts`, `runtime.ts` | behavioral proof |
| Loop budgets and stagnation | DONE | `kernel.ts` | behavioral proof |
| Progress fingerprinting | DONE | `kernel.ts` | behavioral proof |
| Hypothesis ledger | DONE | `contracts.ts`, `kernel.ts` | kernel contract |
| Contradiction detection | DONE | `kernel.ts` | behavioral proof |
| Evidence quality/freshness | DONE | `contracts.ts`, `kernel.ts` | behavioral proof |
| Exact-revision binding | DONE | mission/evidence/lease contracts | kernel contract + DB proof |
| Canonical truth reconciliation | DONE | `reconcileTruth()` | behavioral proof |
| Environment identity/drift | DONE | `reconcileTruth()` | behavioral proof |
| Scope/unplanned side-effect detection | DONE | side-effect ledger + reconciliation | behavioral proof |
| Blast-radius calculation | DONE | `blastRadius()` | behavioral proof |
| Rollback planning | DONE | completion critic | adversarial proof |
| Rollback execution | DONE | `executeRollback()` | behavioral proof |
| Regression mapping | DONE | blast-radius required checks + existing Worker Engine regressions | adversarial/kernel proof |
| Preflight/post-change truth rules | DONE | operating constitution + reconciliation | kernel contract |
| Side-effect ledger | DONE | `SideEffect` contract | kernel contract |
| Idempotent retry | DONE | idempotency keys + event unique index/RPC | DB smoke proof + adversarial proof |
| Distributed locking/leases | DONE | `hq_cyborg_mission_leases`, lease RPC | DB smoke proof |
| Stale-agent protection | DONE | revision-bound leases + `resumeMission()` | behavioral proof |
| Durable handoff/recovery | DONE | checkpoint + event journal + runtime persistence port | kernel/adversarial proof |
| Tool capability discovery/fallback | DONE | `chooseTool()` capability registry/fallbacks | kernel contract |
| Tool failure taxonomy | DONE | `classifyToolFailure()` | behavioral proof |
| Prompt-injection containment | DONE | external-content evidence-only policy | adversarial proof |
| Secret/privileged action policy | DONE | operating constitution + action policy | kernel contract |
| Owner gates | DONE | `CYBORG_OWNER_GATES` | behavioral proof |
| Negative authority | DONE | `CYBORG_FORBIDDEN` | behavioral proof |
| Skill version/dependency/conflict resolution | DONE | `resolveSkills()` | behavioral/adversarial proof |
| Required-skill evidence | DONE | completion gate | kernel contract |
| Skill regression/qualification policy | DONE | operating constitution + Worker Engine learning chain | kernel contract |
| Mission-specific independent assurance | DONE | independent-assurance completion requirement | behavioral proof |
| Adversarial completion review | DONE | `adversarialCompletionCritic()` | adversarial/kernel proof |
| Silent-failure/outcome verification | DONE | gates + truth reconciliation | behavioral proof |
| User-visible consequence requirement | DONE | operating constitution verification rule | kernel contract |
| Production/repository parity | DONE | exact revision + truth reconciliation | kernel contract |
| Architecture/invariant drift | DONE | CI kernel contract | exact-head CI |
| Failure learning/promotion | DONE | existing Worker Engine continuous-improvement chain + constitution binding | existing Worker Engine controls |
| Confidence/uncertainty thresholds | DONE | mission confidence + critic threshold + hypotheses | kernel contract |
| Requirement-to-evidence traceability | DONE | gates/evidence/side effects/events | DB + kernel contract |
| Mission replay | DONE | deterministic replay assertion | behavioral proof |
| Chaos/adversarial suite | DONE | 15-case adversarial suite + behavioral cases | Cyborg CI |
| Model replacement | DONE | model-independent contract + 4-model-family proof | adversarial proof |
| Reliability SLO telemetry | DONE | `hq_cyborg_slo_events`, runtime SLO recording | DB proof + kernel contract |
| Production persistence proof | DONE | production migration, RLS/grants/RPC smoke proof | Supabase verification |
| CI enforcement | DONE | `cyborg-mission-kernel-contract.yml` | exact-head CI |

## Safety invariant

`DONE` does not mean consequential runtime was activated. Runtime activation, schedulers, publishing, payments and authority grants remain owner-gated. Cyborg's mission kernel may coordinate governed work, but it cannot use this remediation as authorization to cross those boundaries.

## Release condition

The PR is certifiable only when its exact head passes the Cyborg contract, Supabase migration security, TypeScript/production build and applicable repository integration gates. A failed or pending exact-head check keeps release certification pending even if this matrix says the individual control is implemented.
