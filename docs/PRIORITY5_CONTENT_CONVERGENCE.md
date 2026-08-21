# Priority 5 — Closed-loop Content Convergence

## Baseline discovered

Priority 1 provides the professional Content Author. Priority 2 provides independent Quality Intelligence. Priority 3 provides the independent senior Critic. Priority 4 provides a separately governed Repair Worker that may produce a candidate repair but may not persist, self-verify, approve, or publish. Existing VibeSchool publication release checks, human approval records, HQ publication review and Worker Engine authority/recovery primitives remain authoritative and are not replaced.

## P5 boundary

P5 adds the missing governed convergence persistence/control plane. It does not create another author, evaluator, Critic, Repair Worker, publication system, or Worker Engine.

Canonical flow:

`P1 -> P2 -> P3 -> (PASS | P4) -> immutable new version -> fresh P2 -> fresh P3 -> convergence decision -> release gate -> existing human publication authority`

## Canonical states

`DRAFT, AUTHORED, MEASURING, MEASURED, CRITIC_REVIEW, REPAIR_REQUIRED, REPAIRING, REPAIRED, REVERIFYING, CONVERGED, ESCALATED, RELEASE_CANDIDATE, RELEASE_APPROVED, PUBLISHED, REJECTED, SUPERSEDED`

Transitions are enforced by `content_convergence_transition`. Expected state, version ID and content hash are all optimistic-concurrency preconditions. Illegal or stale transitions fail closed.

## Immutable lineage

`content_convergence_versions` stores the exact publication, parent version, optional publication revision, monotonically increasing version number, content hash, snapshot, worker/execution identity, repair reasons, addressed/preserved findings, provenance, curriculum identity and evaluation lineage. A repair cannot mutate curriculum identity, reuse the parent content hash, or overwrite an inspected version.

## Finding lifecycle

`OPEN -> REPAIR_REQUESTED -> REPAIR_ATTEMPTED -> REVERIFYING -> VERIFIED_RESOLVED | STILL_PRESENT | REGRESSED | SUPERSEDED | ESCALATED`

P4 has no function that can assign `VERIFIED_RESOLVED`. Resolution requires fresh independent evaluation bound to the exact new version/hash.

## Convergence policy

Global default maximum repair attempts: **3**.

1. Attempt 1: targeted minimal repair.
2. Attempt 2: root-cause repair using the prior failed verification.
3. Attempt 3: final bounded repair attempt.
4. Further attempts: fail closed and escalate.

Escalation is required for no measurable improvement, repeated regression, unresolved critical findings, contradictory/inadequate provenance, evidence uncertainty, worker/runtime failure after bounded recovery, or curriculum uncertainty.

Zero-tolerance regression dimensions are scientific correctness, learner safety, curriculum identity, assessment correctness, fabricated evidence, provenance integrity and authorization boundaries.

## Quality delta

`content_convergence_deltas` records resolved, remaining and new defects; regressions; improved, worsened and unchanged dimensions; measurable improvement; and severe-regression status. A rising scalar score cannot override a severe regression.

## Release Gate

`content_convergence_release_gate` is separate from P1–P4. It emits only:

- `NOT_READY`
- `HUMAN_REVIEW_REQUIRED`
- `RELEASE_CANDIDATE`

The gate requires the exact current immutable version, fresh P2 and P3 PASS results bound to its hash, no unresolved critical findings, no severe regression, and passing safety/assessment status. Provenance uncertainty escalates to human review.

A release-candidate decision explicitly records that human publication approval remains required. P5 has no `UPDATE vibe_publications ... published` path.

## Concurrency and recovery

Run idempotency keys are unique. Version numbers and publication/hash pairs are unique. State transitions lock the run row and require exact expected state/version/hash. Repair version creation locks the run and enforces bounded attempts. Leases are explicit; expired consequential states become `ESCALATED` with a recovery instruction rather than remaining indefinitely `REPAIRING`, `REVERIFYING` or `MEASURING`.

## Security

All P5 persistence tables use RLS and revoke `PUBLIC`, `anon` and `authenticated` access. P5 mutation functions are `SECURITY DEFINER` with an empty search path and are executable only by `service_role`. No P5 function widens human or worker publication authority.

## Worker Engine integration

P5 remains subordinate to the existing Worker Engine. Production commissioning does not enable runtime, increase autonomy/risk, clear Global Stop, widen capability grants, alter breaker semantics, or create a second scheduler. Consequential P4/P5 work may only be dispatched through existing Worker Engine authority envelopes when that runtime is commissioned separately.

## Commissioning

Stage 0: repository/schema/adversarial certification.

Stage 1: shadow chain against a real Grade 10 Chemistry draft; P5 evidence rows only, no mutation to canonical publication content.

Stage 2: draft-canary repair versions only.

Stage 3: bounded Chemistry batch through fresh P2/P3 and human inspection.

Stage 4: converged versions may produce release candidates for the existing human workflow.

Stage 5: broader commissioning only after measured repair success, low regression, lineage/recovery integrity and safety evidence.

## Certification suite

`python scripts/content_convergence_certify.py` covers legal/illegal transitions, stale state/hash, clean first pass, immutable repair, repair regression, stale repair, bounded failure, safety-critical failure, conflicting provenance, worker failure escalation, duplicate idempotency, reward hacking, publication bypass, human history preservation, curriculum drift, P4 self-verification prohibition, exact-version re-verification, assessment integrity and critical-finding release blocking.

## Production rule

Priority 5 commissioning must not publish merely to prove the system. A real Chemistry draft chain may be used only for shadow/draft evidence, with exact IDs/hashes retained in the certification report and the existing human publication authority left unchanged.
