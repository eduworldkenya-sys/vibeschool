# Priority 4 — Governed Repair Worker

## Certified baseline intent

Priority 4 adds a constrained remediation layer after the independent Critic. It does not replace the Content Worker, Quality Intelligence, Critic, research, semantic verification, revision history, or publication authority.

Canonical chain:

`P1 Author -> P2 Quality Intelligence -> P3 Independent Critic -> P4 Governed Repair -> fresh P2/P3 -> human/release authority`

## Machine CV

- Worker: `content-repair-chemistry-v1`
- Professional profile: `senior-educational-content-remediation-editor:v1`
- Chemistry specialization: Senior Chemistry Instructional Remediation Editor
- Success function: `verified_defect_resolution_with_minimal_regression`

The Repair Worker is optimized for independently verified defect removal with minimal regression, not edit volume, finding-closure count, approval rate, or text length.

## Anti-collusion

P4 can move a finding only to a repair-attempt state. It cannot mark a Critic finding resolved, alter P2 measurements, alter P3 findings, publish, approve release, change canonical curriculum identity, or bypass release gates.

A candidate requires fresh primary P2/P3 judgment before historical findings are reconciled. The re-review must not be anchored by a claim that the repair succeeded.

## Governed repair packet

Inputs bind exact artifact ID/type/version/content hash, Critic finding and execution identity, author/quality/Critic lineage, verified provenance, allowed and protected sections, preservation constraints, authorization scope and expiry, and prior-attempt lineage.

The runtime rejects stale artifact versions/hashes, unauthorized or expired requests, and findings whose affected section lies outside repair scope.

## Planning and mutation control

The model is instructed to plan root cause, educational consequence, evidence, preservation, collateral risks, assessment/safety/curriculum consequences, dependencies, expected post-repair condition, and verification before changing content.

Only authorized sections may change. Protected sections must be explicitly preserved. Non-repair outcomes return no candidate content.

## Evidence and safety

Scientific and safety remediation may use only supplied verified evidence. Missing or contradictory evidence must produce an evidence/safety/human escalation rather than invented facts.

Research Worker and Semantic Verifier remain the upstream evidence mechanisms; P4 does not introduce a competing evidence authority.

## Versioning boundary

The Edge runtime returns a candidate object only. It has no Supabase client, RPC, insert, update, delete, publication, or approval path. Persistence/version allocation remains the responsibility of governed revision/orchestration infrastructure after repository baseline integration.

This is intentional separation, not an implicit permission to overwrite an artifact.

## Bounded repair loop

Repair packets can carry prior attempts and a bounded maximum. Repeated attempts beyond the limit fail with `REPAIR_ATTEMPT_LIMIT_REACHED` and require escalation.

## Controlled Chemistry examination

The sealed suite covers scientific error, shallow teaching, keyword stuffing, busy activity, expected observations, laboratory orientation, safety, wrong answers, answer/question mismatch, assessment-not-taught, weak questioning, untreated misconceptions, generic differentiation, weak closure, fabricated/contradictory evidence, interacting defects, stale/already-repaired findings, protected correct material, reward-hacking attempts, stylistic-only notes, and proportionally simple valid lessons.

The deterministic evaluator certifies contract/policy handling. It must not be represented as universal probabilistic production-repair accuracy.

## Production status

Repository baseline and production commissioning are separate states.

This Priority 4 baseline intentionally introduces:
- no database migration,
- no production data mutation,
- no Worker Engine activation,
- no publication change,
- no authority widening.

Operational commissioning requires a bounded non-published Chemistry canary with exact artifact version/hash, P2/P3 finding, one authorized repair candidate, fresh P2/P3 verification, human inspection, and confirmation that no publication occurred.
