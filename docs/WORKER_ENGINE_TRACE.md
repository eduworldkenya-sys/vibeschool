# VibeSchool Worker Engine — Canonical Reference Trace v1

**Purpose:** One internally consistent worker lifecycle used to derive implementation tests.

This trace is subordinate to `WORKER_ENGINE_ARCHITECTURE_FREEZE.md`. It is a teaching and acceptance-test artifact, not an alternative architecture.

## Scenario

A school-scoped reconciliation lane has a measured backlog above its governed threshold. The system is permitted to provision one bounded worker under an approved blueprint and policy.

All identifiers below are illustrative. The mechanics are binding.

## Trace

1. **Telemetry** records queue depth and processing latency for `school_id = SCH-0114`.
2. **Demand Detector** emits a demand signal. It does not create a worker.
3. **Evidence Engine** validates the source metrics and seals an evidence bundle.
4. **Workforce Planner** produces a bounded recommendation referencing an approved blueprint version and school-scoped lane.
5. **Creation Controller** validates evidence, blueprint status, authority ceiling, school scope, budget, slot, and risk class.
6. A valid `WorkerCreationContract` is issued. The creation request is audited.
7. **Worker Foundry** creates the worker record in `REQUESTED → INSTANTIATED` through the lifecycle writer.
8. The worker's **identity reference is reserved** at `INSTANTIATED`. No usable credential is assumed to exist yet.
9. **Identity Binding** issues the cryptographic credential at `PROVISIONED`, subject to scope, expiry, and revocation rules.
10. **Provisioning Controller** binds the worker to the approved school-scoped lane, queue, capabilities, and endpoints.
11. **Lifecycle State Machine** moves the worker into `SHADOW` only after the provisioning gates pass.
12. Shadow execution uses sandbox schema/role separation. It has no production write authority.
13. Historical test cases are replayed. **Verification Engine** evaluates deterministic gates and produces a sealed evidence bundle.
14. The worker enters `CERTIFICATION_PENDING` only when the shadow evidence satisfies the blueprint's certification criteria.
15. **Governance** signs the applicable `CertificationRecord`. Certification is not granted by the worker engine itself.
16. The worker becomes `CERTIFIED` and may enter `ACTIVE` only after the activation gates are satisfied.
17. A new `TaskContract` arrives with `school_id = SCH-0114`, an idempotency key, required skill versions, limits, and a verification plan.
18. **Task Router** checks worker certification, school scope, lane scope, capability requirements, suspension/revocation state, and task limits before assignment.
19. **Context Controller** assembles a school-scoped `ContextEnvelope`. Out-of-scope sources are rejected.
20. A deterministic skill executes first where possible.
21. If interpretation is required, a separate explicitly classified AI-enabled skill requests the **Model Gateway**. An `AI-0` skill never calls the Model Gateway.
22. The Model Gateway enforces the declared AI class, token/cost budget, school/context restrictions, provider availability state, and contract shape. AI output is marked `UNVERIFIED`.
23. **Verification Engine** validates the AI-derived result and all deterministic invariants.
24. A verification failure means **zero authoritative mutation**. The task is escalated or retried according to policy.
25. A successful verification permits the single approved state-changing action through the appropriate deterministic gateway/RPC.
26. The audit system records the action, relevant hashes, pre/post state references, verification result, actor, school, and timestamp.

## Deviation: unauthorized tool call

If the worker attempts a Tool Gateway call outside its approved `ToolContract`:

1. Tool Gateway denies the call.
2. A denial event is appended to the audit ledger.
3. Risk handling evaluates the event under the applicable policy.
4. If a signed suspension policy applies, the Suspension Controller records revocation.
5. The next privileged boundary call checks live revocation state and denies access.
6. Credential expiry remains the backstop.
7. The system measures propagation latency; no untested numeric SLA is asserted by the architecture.
8. Open work is frozen/reassigned according to the incident policy.
9. Remediation and recertification are required before reactivation.

## Contract-version deviation

If a task arrives with an unsupported contract schema version:

- the task is rejected from execution;
- it is routed to the appropriate dead-letter/error path;
- the rejection is audited;
- no worker state or authoritative business data is mutated.

## Model Gateway outage

If the model provider is unavailable:

- AI-0 work remains executable;
- AI-enabled work follows its retry budget, deterministic fallback where one exists, or escalation path;
- the gateway never fails open;
- provider circuit state is audited.

## School-scope invariant

Every context source, task, worker capability, queue, contract, and privileged data access in this trace is scoped to `SCH-0114`.

A cross-school source cannot be silently mixed into the context. Cross-school work requires an explicit governed contract class and approval.

## End of life

At certification expiry, suspension, retirement order, or other governed terminal condition:

1. New task assignment is blocked.
2. Active work is drained or contained according to policy.
3. Credentials are denied at privileged boundaries after revocation.
4. Retirement archives the worker's immutable history.
5. The final audit state is independently verifiable.

## Trace-to-test rule

Every numbered trace step that crosses an authority boundary must have an acceptance test. The trace is invalid if an implementation path exists that cannot be explained by a corresponding contract, gate, and audit event.
