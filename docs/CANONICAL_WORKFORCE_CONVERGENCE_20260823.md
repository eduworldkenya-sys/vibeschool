# Canonical Workforce Convergence — VibeSchool

This document records how the valuable guarantees from the proposed "Canonical Workforce Convergence" package map onto VibeSchool's existing Worker Engine R1.4 and Cyborg architecture. It intentionally does **not** introduce a second admission gateway, a second certification ledger, or a parallel execution runtime.

## Canonical boundaries

1. **Worker execution authority** remains the existing Worker Engine authorization/consequential execution path, including current runtime/global-stop, capability, approval, budget, idempotency, circuit-breaker, and evidence controls.
2. **Model transport authority** remains the Cyborg admission/capability/model gateway. Workers must not hold or directly exercise provider authority outside approved Cyborg boundary modules.
3. **Evidence** remains the existing append-only/guarded workforce evidence and execution verification model. Consequential completion must not be treated as certified success without required durable evidence.
4. **Certification** remains the existing workforce certification, worker certification, assurance, qualification, lifecycle, and commissioning model. A worker may not self-certify or self-supply independent assurance.
5. **Contracts** remain the existing workforce contracts/clauses/capabilities/specialization model. Evolution must preserve compatibility and repository/database reconstruction truth rather than introducing a disconnected TypeScript-only contract version.
6. **Global Stop and runtime controls** remain authoritative. This convergence work does not activate runtime, scheduler, factory, shadow, publishing, payments, or consequential autonomy.

## Imported guarantees

The following guarantees are adopted from the proposal as canonical invariants:

- **No parallel gateway:** there must be exactly one canonical consequential Worker Engine authority path and one canonical Cyborg model-transport boundary.
- **No check-then-act admission token race:** any single-use capability/admission primitive must be consumed atomically before consequential provider/executor use, or the execution path must otherwise prove replay resistance before side effects.
- **Evidence-required completion:** any path that requires durable evidence must fail closed if mandatory evidence cannot be recorded. Logging an evidence write failure is not equivalent to evidence.
- **No direct provider bypass:** provider SDK/API access in governed worker runtimes is forbidden except inside explicitly approved Cyborg boundary modules.
- **Certification separation:** self-certification and self-independent-verification are forbidden; certification state changes must be evidence-backed and independently attributable where policy requires it.
- **Budget-before-use:** model/compute budget authorization or reservation happens before external model use; final usage is accounted afterward.
- **Exact mission/revision/lease binding:** model or consequential execution authority must bind to the exact mission/work/revision/lease identity required by the current canonical contract.
- **Replay/idempotency protection:** consequential work must not be duplicated by retries, concurrent admission, or stale capabilities.
- **CI anti-bypass proof:** CI must scan for known direct provider/runtime bypass patterns and fail if a governed worker introduces one.

## Deliberately rejected pieces from the proposal

The following proposal elements are **not** adopted because they would fork the canonical system or weaken existing controls:

- `hq_workforce_admission_tokens` as a new parallel execution-authority table.
- `executeCanonicalWorker()` as a second TypeScript runtime alongside the R1.4 database authority gateway.
- `hq_workforce_certification_ledger` as a replacement/parallel certification truth.
- "execute first, consume token later" semantics.
- "continue execution if evidence persistence fails" semantics where evidence is mandatory.
- a standalone `WORKER_CONTRACT_VERSION = 2` migration helper disconnected from database contract truth.

## Certification requirement

This convergence is considered certified only when repository tests prove the invariants above against current `main`, the production schema still exposes the canonical R1.4/Cyborg controls, and production runtime/global-stop posture remains unchanged unless separately owner-authorized.
