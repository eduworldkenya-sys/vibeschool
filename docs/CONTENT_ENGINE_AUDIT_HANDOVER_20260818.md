# Content Engine Audit Handover — 2026-08-18

## Scope

Audit-first review of VibeSchool Content Engine / Content Factory using GitHub and production Supabase. This handover records findings, the operating-model decision, current production boundary and recommended next work.

No Vercel deployment was triggered. No production Supabase DDL, data mutation or Edge Function deployment was performed during this documentation step.

## Repository

Repository: `eduworldkenya-sys/vibeschool`

Documentation branch: `agent/content-engine-operating-constitution-20260818`

Branch base: `c249f195745a3ecea4bbb36fa97cb1fb1039f15e` (`main` at audit start)

Primary architecture document: `docs/CONTENT_ENGINE_OPERATING_CONSTITUTION.md`

## Existing Content Factory state reviewed

The existing Content Factory R1 handover already defines a publishing-factory objective: detect release blockers, perform safe deterministic preparation/repair, send genuine editorial/release decisions to humans, recertify and repeat.

The R2.1 Research Worker handover establishes the architectural boundary that Worker Engine owns execution governance while Content Factory owns curriculum research, evidence semantics, provenance and editorial outcome.

R2.1 deliberately uses a deterministic/no-model queued research executor and refuses to treat unverified search snippets as certified evidence.

## Production read-only findings

Production project: `yauqsxggtuxuykcbrtzf`

Project status observed: `ACTIVE_HEALTHY`.

Content Engine orchestration status observed:

- blocked: 688
- completed: 16
- total observed: 704
- completion ratio: approximately 2.27%

Interpretation: release/quality detection is substantially stronger than remediation throughput. The correct response is to close remediation paths, not weaken quality gates.

## Production migration-boundary finding

The production migration ledger observed during this audit includes curriculum authority migrations through `20260818133000_curriculum_authority_operator_intake_v1`, but the later Worker Engine recovery / Content Factory throughput / R2.1 migrations described by repository handovers are not represented in the observed production ledger.

Therefore autonomous Content Engine production activation remains blocked until dependency-ordered promotion and verification are completed.

## Architecture decision

The Content Engine is now defined as the governed educational-content operating system, not an AI generator and not a second worker platform.

Permanent boundary:

- Worker Engine = who can execute, under what authority, capability, budget, lease, retry and circuit-breaker rules.
- Content Engine = what educational-content work should exist, why it matters, what evidence/curriculum/pedagogy governs it, how quality is certified, when it publishes, how it is measured and when it is repaired or retired.

AI is optional and bounded. Deterministic execution is the default.

## Mission

Produce, verify, publish, measure, maintain, improve and retire curriculum-aligned learning experiences at scale without sacrificing educational accuracy, safety, provenance, rights, learner welfare or human authority.

## Vision

Move the owner from individual content operations to strategic governance. High-level approved objectives should be decomposed into governed work automatically, while human attention is reserved for genuine judgment and authority decisions.

## Target lifecycle

Curriculum -> Research -> Evidence -> Learning Design -> Authoring -> Verification -> Testing -> Approval -> Publishing -> Observation -> Diagnosis -> Improvement -> Recertification -> Retirement

## Required operating-state contract

Primary lifecycle:

DORMANT -> OBSERVE -> DIAGNOSE -> PLAN -> QUEUE -> EXECUTE -> VERIFY -> REVIEW -> RELEASE -> MEASURE -> MAINTAIN

Control / terminal states:

WAITING, BLOCKED, PAUSED, QUARANTINED, FAILED, RETIRED, CANCELLED

The runtime must eventually machine-enforce start, rest, stop, cancel and retirement rules.

## Main missing capabilities

1. Semantic Evidence Verifier certification boundary.
2. Source-grounded Content Authoring Worker that consumes verified evidence and cannot perform hidden research.
3. Deterministic Content Governor / prioritization layer.
4. Machine-enforced start/rest/stop/cancel/retire lifecycle rules.
5. Domain remediation capabilities that close the major release-blocker classes.
6. Learning-effectiveness observation and diagnosis.
7. Controlled learning-content experimentation, promotion and rollback.
8. Content-specific operator observability, SLA, cost and decision-load telemetry.
9. Value/cost prioritization that prevents busy-work.
10. Dependency-ordered production promotion parity.

## Recommended next sequence

P0 — Certify repository -> production dependency/migration parity before activation.

P1 — Complete semantic verification.

P2 — Build the governed source-grounded authoring worker.

P3 — Implement deterministic Content Governor and lifecycle policy contracts.

P4 — Close release remediation lanes.

P5 — Add learning-effectiveness feedback and controlled revision loop.

P6 — Add operator/control-room observability and economic metrics.

P7 — Introduce AI selectively only where deterministic execution is insufficient and expected value justifies cost/risk.

## Production safety rule

This documentation does not authorize production autonomy.

Do not silently enable Worker Engine runtime, autonomous capability grants, paid AI, unrestricted research, publication authority or Vercel deployment.

Production activation must fail closed until migration order, authority, budgets, breakers, verification, telemetry and rollback are proven.

## Handover status

Documentation: complete.

Runtime implementation against this constitution: not started in this branch.

Production changes: none.

Vercel actions: none.
