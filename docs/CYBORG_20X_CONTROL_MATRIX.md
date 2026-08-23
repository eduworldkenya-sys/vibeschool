# Cyborg 20x control matrix

This matrix maps identified Cyborg weaknesses to repository-enforced controls and revision-bound proof. `IMPLEMENTED` means executable code or a repository contract exists. `PROOF PENDING` means implementation exists but required exact-head, database, production, chaos, model-replacement, integration, or independent evidence has not yet been demonstrated. `CERTIFIED@<revision>` means the stated scope passed on that exact revision only; certification never floats forward to later commits. `PARTIAL PROOF` means a narrower stated claim has direct evidence but a broader parity/runtime claim remains open. No row may infer production proof from the existence of a migration, contract, historical CI run, or mission identifier alone.

Current reconciliation baseline: `main` at `0b36e472613dbbb00e36fc00e2f03cb424808ebc` (merge of PR #452).
Historical repository-kernel certification: PR #448 head `e1a7148f4a859d2a838687a4ae6b90c029eb653a` — valid for that exact bounded scope, not current `main`.
Current reconciliation evidence: `docs/CYBORG_CURRENT_MAIN_CERTIFICATION_RECONCILIATION_20260823.md`.

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
| Production/repository parity | PARTIAL PROOF | exact revision + truth reconciliation + live `twin-chat` inspection | PR #452 security-gate parity observed in production; full source parity remains pending |
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
| Repository-kernel independent certification | CERTIFIED@`e1a7148f4a859d2a838687a4ae6b90c029eb653a`; CURRENT PROOF PENDING | PR #448 exact-head independent review + completion assurance requirement | fresh independent exact-head certification on reconciliation PR |
| Universal provider gateway contract | IMPLEMENTED | `lib/cyborg/gateway.ts`, `cyborg-universal-llm-gateway.yml` | exact-head CI + complete server/Edge Function enforcement proof |
| Server/Edge Function provider bypass prevention | PROOF PENDING | universal-gateway validator + chat-session validator | expand proof to every provider surface; current universal validator does not cover `supabase/functions/**` or Groq |
| Per-call signed Cyborg capability enforcement | PROOF PENDING | target architecture only | admission issuer + expiry/nonce/scope validation at the sole provider gateway + adversarial bypass proof |
| Worker Engine -> Cyborg model-call enforcement | PROOF PENDING | Worker Engine governed runtime + Cyborg gateway contracts | explicit integration proof with no direct worker/provider bypass |
| Worker Engine R1.4 production consequential chain | PROOF PENDING | R1.4 capability/authority/execution/verifier contracts | production reconciliation of legacy `hq_workforce_tool_gateway_execute` and exact-chain proof |
| CI enforcement | IMPLEMENTED | Cyborg mission, universal gateway, chat-session and governance workflows | exact-head CI |

## Current production `twin-chat` evidence

On 2026-08-23, production Supabase project `yauqsxggtuxuykcbrtzf` exposed active `twin-chat` version `28` with JWT verification enabled. The deployed function contains both controls explicitly required by PR #452: Cyborg mission admission before provider execution and `student_consume_twin_session` enforcement for student requests.

That is **security-gate parity proof**, not full source parity. The active production source differs from current repository `twin-chat` in non-gate Twin behavior/prompt text, so full production/repository parity remains open.

## Universal-gateway limitation

Current `scripts/validate-cyborg-llm-gateway.mjs` scans `app/api`, `lib`, `components`, and `scripts`, but not `supabase/functions`. Its forbidden URL set also omits Groq. A separate chat-session validator covers chat entrypoints and requires mission identity before provider calls, but `twin-chat` still performs direct Groq HTTP execution rather than routing through the canonical `CyborgUniversalGateway`.

Therefore mission-tagged chat admission must not be represented as the stronger invariant "no signed Cyborg capability = no LLM." That stronger capability-enforced provider boundary remains a separate proof/implementation programme.

## Worker Engine boundary

Worker Engine governed adversarial proof and Cyborg repository proof are complementary but not interchangeable. Current Worker Engine topology still identifies production `hq_workforce_tool_gateway_execute(task_id)` as a legacy consequential gateway and P0 reconciliation target. Until that path is bridged/retired and every consequential mutation is proven to traverse the R1.4 capability -> authority -> canonical execution -> independent verification chain, full Worker Engine production-runtime certification remains pending.

## Safety invariant

Implementation or repository certification does not authorize consequential runtime. Runtime activation, schedulers, publishing, payments and authority grants remain owner-gated. Cyborg's mission kernel may coordinate governed work, but this remediation cannot be used as authority to cross those boundaries.

## Repository-scope release condition

A reconciliation PR may be certified for **repository/kernel/chat-security scope** when its final exact head passes the Cyborg Mission Kernel, Universal LLM Gateway, Chat Session Gateway, applicable Worker Engine/governance, TypeScript/build, integration, reliability, authorization and other triggered repository gates, and receives independent exact-head review. Historical #448 evidence is provenance only.

Rows that explicitly require production adapters, restart/recovery, full source parity, cryptographic per-call capabilities, or the Worker Engine R1.4 production mutation chain do **not** need to be falsely marked complete to certify this narrower repository scope; they remain visible as `PROOF PENDING`.

## Full production/runtime release condition

Full autonomous production certification is a higher-level programme and remains blocked until every applicable production/runtime row has fresh evidence, including persistence and execution adapters, restart/recovery, bounded real missions, applied-production database proof, provider-bypass prevention, Worker Engine R1.4 consequential-chain proof, independent assurance, and production/repository parity appropriate to that release.

## Reconciliation provenance

PR #448 was reconciled after certified PR #446 and then independently certified at exact head `e1a7148f4a859d2a838687a4ae6b90c029eb653a`; merge commit `76be882e377c231cb4ebb5b3f25584f14703d1b0` preserves that historical bounded certification. Current `main` later advanced through Worker Engine and Cyborg gateway/chat work to `0b36e472613dbbb00e36fc00e2f03cb424808ebc`. The 2026-08-23 reconciliation starts from that current-main baseline and requires fresh exact-head CI/review before any new certification claim.