# Worker Engine Production Readiness Program

Status: LOCKED PROGRAM / NON-ACTIVATING
Branch: `worker-engine/production-readiness-program-20260816`
Baseline: GitHub `main` after WE-R1.4.10 merge (`6a62101e455d956cd33026e2bf6dcb5c406a2ceb`)
Production target: Supabase project `yauqsxggtuxuykcbrtzf`

## Mission

Make the VibeSchool Worker Engine safe to operate as a consequential production system by proving, from real repository and production evidence, that every consequential action is authorized, bounded, observable, reconstructable, recoverable, economically controlled, operationally stoppable, and independently verifiable.

The program is not a request to add features quickly. It is a closure program for production trust.

## Vision

For every consequential execution, VibeSchool must be able to answer without inference:

1. Why did this execution exist?
2. Which objective and selected plan authorized its purpose?
3. Which exact worker, capability version, skill manifest, resource and tool participated?
4. Which authority grant, runtime policy and safety limits permitted or denied it?
5. What exact state existed before mutation?
6. What exact mutation was attempted and committed?
7. What independent verification occurred?
8. If verification failed, what recovery/compensation occurred and was it verified?
9. What deterministic outcome and escalation resulted?
10. What did the execution cost and which budgets/rate/concurrency ceilings applied?
11. Which circuit-breaker state existed before, during and after the execution?
12. Can an operator reconstruct all of the above from one canonical execution identity?

If any answer requires guessing, manual archaeology across unrelated generations of tables, or ephemeral infrastructure logs, consequential production activation is not ready.

## Constitutional invariants

- Production runtime stays fail-closed until explicit production activation criteria are independently satisfied.
- No authority grant means no consequential execution.
- Certification never implies activation.
- Scheduler/heartbeat may request work but never create execution authority.
- Control Room may observe, stop, acknowledge and perform narrowly governed recovery controls; it must not become an alternative mutation gateway.
- Missing telemetry for a consequential mutation is itself a safety failure.
- Evidence required for reconstruction is append-only or otherwise immutably preserved.
- Every execution must have one canonical correlation identity before authority evaluation.
- Global stop dominates capability and worker authority.
- Capability stop dominates worker assignment.
- Human/operator intervention must create evidence and cannot silently bypass the canonical execution model.
- Existing certified R1.3X/R1.4 invariants are preserved; this program must not rebuild or weaken already-certified architecture merely to simplify implementation.

## Reconciliation against completed work

The original senior-readiness list was compared against GitHub main and live Supabase before work was locked. The following capabilities already have substantial foundations and must be reused rather than rebuilt:

- capability/competency graph foundations;
- objective, plan and plan-step modeling;
- resource registry and resource-to-skill relationships;
- worker identity/certification/competency records;
- runtime policy and authorization-event foundations;
- Shadow traces/events/decisions/resource usage/anomalies;
- legacy run and outcome-verification ledgers;
- recovery-action and replay-result foundations;
- execution budgets;
- dead letters;
- worker performance projections;
- Control Room snapshot RPC for the older Shadow/legacy model;
- R1.4 repository contracts through WE-R1.4.10 for capability authority, consequential gateway, idempotency/preconditions, verification, compensation, outcome classification, budgets/rate/concurrency, circuit breakers and canary certification.

These are not considered complete merely because objects exist. Their remaining work is only what is necessary to satisfy the production-readiness mission.

## Verified production divergence

At program start, GitHub main contains WE-R1.4.1 through WE-R1.4.10 engineering contracts, while production Supabase migration history does not contain the R1.4 migration series and production does not contain the newer R1.4 `hq_workforce_capability_authority_grants` relation. Production is therefore behind repository engineering for consequential-execution evidence and authority.

This is a deployment/readiness fact, not permission to deploy. No production migration is authorized by this document.

## Workstream disposition

### P0 — must close before any consequential production canary

1. **Exact production reconciliation** — OPEN.
   Build an authoritative GitHub-main vs production schema/runtime matrix for every Worker Engine migration, table, function, trigger, policy, grant, cron and configuration surface. Reason: a certified repository cannot prove production behavior when production runs a different contract.

2. **Mutation-gateway inventory and bypass proof** — OPEN.
   Enumerate every consequential writer to Worker Engine-owned or canary-owned state, including SECURITY DEFINER functions, triggers, cron paths, service-role paths and legacy execution functions. Classify canonical/legacy/observer/operator paths. Reason: observability of one gateway is meaningless if another gateway can mutate the same state.

3. **Authority-graph proof** — PARTIAL.
   R1.4 authority contracts exist in GitHub, while production still has older capability grants/runtime authorization foundations. Prove the effective authority intersection and eliminate stale/wildcard/alternative authority paths before activation.

4. **Fail-closed dependency matrix** — PARTIAL.
   R1.4 adversarial tests cover many cases. Extend closure only for production-runtime dependencies and any gaps found by reconciliation. Do not duplicate already-certified tests.

5. **Concurrency/race proof** — PARTIAL.
   R1.4 contains adversarial concurrency/stop/idempotency work. Reconcile exact remaining race boundaries: revocation during execution, breaker/stop transition races, verifier/compensation collisions and production scheduler boundaries.

6. **Interrupted-execution/recovery state model** — PARTIAL.
   Recovery/compensation foundations exist. Formalize deterministic classification for crash/timeout/deployment/unavailable-verifier states and prove no committed mutation is left in an unowned ambiguous state.

7. **Control-plane security and operator authority** — PARTIAL.
   Existing owner-only Control Room read model exists. Upgrade the model without creating a second mutation gateway. Explicitly prove who can stop, reset, acknowledge, compensate or intervene and what evidence each control emits.

8. **Legacy retirement and single-engine proof** — PARTIAL.
   Prior R1.3X reconciliation retired some legacy entrypoints, but production still contains legacy run/runtime artifacts. Build a KEEP / BRIDGE / DISABLE / RETIRE-LATER inventory and prove no legacy path competes with the canonical consequential gateway.

9. **Canonical execution identity and forensic dossier** — OPEN.
   Establish one immutable correlation identity propagated across objective/plan/step/worker/capability/authority/policy/resource/mutation/verification/compensation/outcome/escalation/cost/breaker evidence. Provide one owner-only read model that returns a completeness verdict.

10. **Durable circuit-breaker event history** — OPEN.
    Current-state booleans are insufficient. Persist append-only breaker transitions, trip reason/threshold/current counters, scope, triggering execution, blocked executions and governed reset evidence.

11. **Telemetry completeness gate** — OPEN.
    A consequential execution cannot close successfully if mandatory evidence stages are absent. Add a deterministic completeness check suitable for CI/canary certification and operator display.

### P1 — required for controlled production operation

12. **State-machine formalization** — PARTIAL.
    Existing statuses and deterministic outcome work exist. Consolidate legal transitions and prevent illegal transitions at database boundaries where practical.

13. **Evidence integrity** — PARTIAL.
    Existing evidence tables and immutable concepts exist. Prove consequential evidence cannot be rewritten/deleted/reordered by the executing worker or ordinary product roles; add sequence/completeness integrity where missing.

14. **Scheduler and heartbeat safety** — PARTIAL.
    Heartbeat/scheduler architecture exists and is currently disabled. Prove scheduling is demand/orchestration only and cannot confer authority or bypass stops.

15. **Resource-governance proof** — PARTIAL.
    Resource registry and resolver architecture exist. Verify least-sufficient resource choice, freshness/quota/cost enforcement and fail-closed substitution behavior for consequential execution.

16. **Actual execution cost/accounting** — OPEN/PARTIAL.
    Estimated cost, resource usage and execution budgets exist but are fragmented. Define per-execution actual quantity/unit/cost and budget before/reserved/consumed/after evidence.

17. **SLO/SLA contract** — OPEN.
    Define measurable latency, verification, recovery, escalation, telemetry-completeness and breaker-response objectives. These are operational thresholds, not vanity dashboards.

18. **Alert contract** — OPEN.
    Monitoring-alert table exists but has no demonstrated Worker Engine alert flow. Define deterministic P0/P1/P2 triggers for unverified mutation, recovery failure, breaker trip, authority anomaly, telemetry incompleteness, sustained degradation and budget/rate violations.

19. **Operator runbooks** — OPEN.
    Document exact actions for breaker trip, stuck execution, failed verification, failed compensation, authority anomaly, unexpected cost and evidence divergence.

20. **Human-intervention governance** — OPEN/PARTIAL.
    Decision/escalation foundations exist. Every consequential operator action must be bounded, reasoned, attributable and evidentiary.

21. **Canary activation architecture** — PARTIAL.
    R1.4 canary contracts exist. Production activation remains a separate explicit gate: one capability, worker assignment, operation and target scope with tiny budget and global-stop inheritance.

22. **Kill-switch runtime certification** — PARTIAL.
    Stops/breakers exist in R1.4 engineering. Prove stop dominance under concurrency and record stop-to-block latency.

23. **Permanent adversarial regression suite** — PARTIAL.
    Strong R1.4 suites exist. Add only new failures uncovered by this readiness program and keep them as permanent exact-head gates.

### P2 — required before material scale

24. **Retention/archive policy for forensic evidence** — OPEN.
    Preserve sufficient immutable evidence for reconstruction after infrastructure logs expire.

25. **Capacity/performance envelope** — OPEN.
    Establish safe behavior as objectives/work items/executions increase without weakening locks, verification, rate, cost or breaker semantics.

26. **Control Room operator UX and worker-performance intelligence** — PARTIAL.
    Older Control Room and worker-performance views exist. Upgrade around execution reconstruction and operator action: what happened, why, what changed, was it authorized, is it safe now, what requires intervention.

27. **Machine-readable capability certification registry** — PARTIAL.
    Certification/lifecycle fields exist across capability/skill/worker models. Consolidate readiness semantics so `experimental`, `shadow-certified`, `canary-certified`, `production-certified`, `suspended`, and `retired` cannot be confused with activation.

28. **Authoritative production-readiness scorecard** — OPEN.
    A single read-only certification result must block a production-ready claim while any P0 is unresolved.

## Execution order

The work is intentionally dependency-ordered:

### Phase A — Know the real system

A1. Production reconciliation matrix.
A2. Mutation-writer/gateway inventory.
A3. Authority graph and legacy-path reconciliation.
A4. Canonical state-machine and execution-lineage map.

No schema design proceeds until Phase A identifies the actual existing contracts to preserve.

### Phase B — Make every consequential execution reconstructable

B1. Canonical execution correlation identity.
B2. Unified forensic event/dossier contract.
B3. Exact policy/authority/resource snapshot bindings.
B4. Actual cost/budget lineage.
B5. Durable breaker/blocked-execution transitions.
B6. Telemetry completeness certification.

### Phase C — Make failure deterministic and operable

C1. Interrupted execution/recovery matrix.
C2. Concurrency/stop/revocation race certification.
C3. Operator authority and intervention controls.
C4. Alerts and SLOs.
C5. Runbooks.

### Phase D — Production canary readiness, not activation

D1. Reconcile exact certified repository schema against production prerequisites.
D2. Read-only production prerequisite audit.
D3. Canary activation plan and rollback conditions.
D4. Production-readiness scorecard must be green.

Actual production deployment/activation is outside this branch unless separately authorized.

### Phase E — Observation and scale

E1. Extended observation metrics.
E2. Performance/capacity envelope.
E3. Evidence retention/archive.
E4. Control Room UX/worker performance intelligence.
E5. Autonomous Operations certification only after production evidence exists.

## Engineering loop

Every implementation gate follows:

`inspect real GitHub + production → identify invariant and root cause → reuse existing architecture → design smallest additive contract → isolated branch implementation → adversarial challenge → clean database rebuild → migration security → regression/acceptance → TypeScript → ESLint → production build → exact-head certification → read-only production reconciliation`

A failing test is evidence about the system, not an obstacle to silence. Gates are never weakened merely to obtain green CI.

## Definition of done

This program is complete only when:

- GitHub and production Worker Engine contracts are explicitly reconciled;
- exactly one canonical consequential mutation path is proven;
- every consequential execution is reconstructable from one execution identity;
- authority, policy, resource, mutation, verification, compensation, outcome, escalation, cost and breaker evidence are complete;
- stop/breaker behavior is durable and measurable;
- missing telemetry fails certification;
- operators have safe, bounded controls and actionable alerts/runbooks;
- legacy alternatives are retired or explicitly quarantined;
- production readiness has a machine-readable fail-closed scorecard;
- a real production canary and extended observation later prove the same invariants before broader autonomous operation.

Until those conditions are met, `production-ready` is false by definition.
