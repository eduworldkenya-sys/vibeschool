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

## Operational readiness assessment — 2026-08-18

The Content Engine is substantially more mature as an architecture than as a live autonomous production system. The following percentages are engineering readiness estimates, not automated test scores, and must be revised as certification evidence changes.

| Dimension | Estimated readiness | Interpretation |
| --- | ---: | --- |
| Architecture and operating design | 70–80% | Core lifecycle, governance boundary, evidence philosophy and operating constitution are substantially defined. |
| Repository implementation | 55–65% | Significant machinery exists, but the complete governed content-production chain is not yet closed. |
| Production operational readiness | 30–40% | Production parity, remediation throughput and activation controls remain material blockers. |
| Safe autonomous operation | 20–30% | The system is not yet authorized to independently run the full content lifecycle without bounded human/operator control. |

These estimates must not be interpreted as permission to activate production autonomy.

### Why architecture readiness is ahead of runtime readiness

The system already has important foundations: Worker Engine governance, Content Factory release/certification concepts, curriculum authority work, provenance/evidence contracts, deterministic-first research and explicit separation between execution authority and educational-content decisions.

However, a fully operational Content Engine requires the entire production line to be connected and certifiable. Detection of quality problems alone is insufficient. The production observation of 688 blocked orchestration runs versus 16 completed runs demonstrates that blocker detection currently exceeds remediation throughput by a large margin.

The engine should therefore be understood as having much of the factory building and machinery, while still lacking a fully connected production line and factory governor.

## Definition of fully operational

The Content Engine is fully operational only when an authorized strategic objective such as:

> Complete and maintain Grade 9 Mathematics.

can be accepted and decomposed into governed work without the owner manually operating individual lessons, research tasks or publishing steps.

The system must then be able to:

1. determine authoritative curriculum scope and dependencies;
2. identify missing, stale, weak or conflicting content;
3. prioritize work by educational value, urgency, dependency, risk and cost;
4. commission governed workers through the Worker Engine;
5. research from approved sources and preserve provenance;
6. semantically verify evidence before it becomes an authoring input;
7. create source-grounded learning experiences and assessments;
8. verify curriculum alignment, factual quality, pedagogy, rights and safety;
9. route genuine judgment or authority decisions to humans rather than guessing;
10. publish only after explicit release gates pass;
11. observe learner and teacher outcomes after release;
12. diagnose weak experiences and create controlled revision work automatically;
13. promote successful revisions or roll back harmful/regressive ones;
14. respect budgets, retries, leases, circuit breakers and authority boundaries;
15. know when to start, wait, rest, stop, cancel, quarantine or retire work;
16. produce a reconstructable execution/evidence trail for operators;
17. continue maintaining the objective as curriculum, evidence and learner needs change.

At that point the owner manages objectives, policies, budgets and exceptional decisions rather than individual content-production operations.

## Remaining path to full operation

### Gate 1 — Production dependency and migration parity

Promote and verify the required Worker Engine and Content Factory dependencies in canonical order. Autonomous activation remains fail-closed until repository and production state agree.

### Gate 2 — Complete the governed worker chain

Close the production path:

Research -> Semantic Verification -> Learning Design / Authoring -> Assessment / Experience Construction -> Quality Verification -> Release.

Each stage must consume certified inputs and emit machine-verifiable outputs rather than bypassing upstream authority.

### Gate 3 — Content Governor

Implement the deterministic supervisory layer responsible for deciding what work should exist, priority, dependency ordering, required capability, whether deterministic execution is sufficient, whether AI is justified, when human judgment is mandatory, and whether work should retry, wait, stop or retire.

This governor must not duplicate Worker Engine execution authority.

### Gate 4 — Automatic triggers

Create bounded event and scheduled triggers for curriculum changes, missing coverage, failed release gates, stale/invalid sources, broken resources, teacher feedback, learner-performance signals, rights expiry and scheduled maintenance.

Manual strategic objectives remain supported, but routine factory work should not depend on the owner repeatedly triggering individual tasks.

### Gate 5 — Remediation throughput

Build and certify remediation capabilities for the blocker classes that currently dominate the queue. Do not improve completion statistics by weakening release or evidence gates.

### Gate 6 — Learning-effectiveness closed loop

Connect published experiences to outcome evidence so that meaningful weakness can become governed diagnosis and revision work. The loop must support controlled experiments, promotion, rollback and recertification.

### Gate 7 — Bounded autonomy and operational controls

Prove capability-specific authority, budgets, cost ceilings, retry ceilings, dead-letter behavior, circuit breakers, quarantine, emergency stop, human-decision boundaries, telemetry and reconstruction of consequential execution.

### Gate 8 — Bounded production certification

Certify one deliberately constrained curriculum scope end-to-end before broad autonomy. A suitable proof target is one grade/subject or similarly bounded learning programme. Exercise success paths and deliberately test failure, stale evidence, authority denial, retry exhaustion, rollback and operator intervention.

Only after this proof should autonomous scope widen progressively.

## Recommended next sequence

P0 — Certify repository -> production dependency/migration parity before activation.

P1 — Complete semantic verification.

P2 — Build the governed source-grounded authoring worker.

P3 — Implement deterministic Content Governor and lifecycle policy contracts.

P4 — Close release remediation lanes.

P5 — Add learning-effectiveness feedback and controlled revision loop.

P6 — Add operator/control-room observability and economic metrics.

P7 — Certify a bounded end-to-end production programme and widen autonomy only from evidence.

P8 — Introduce AI selectively only where deterministic execution is insufficient and expected value justifies cost/risk.

## Production safety rule

This documentation does not authorize production autonomy.

Do not silently enable Worker Engine runtime, autonomous capability grants, paid AI, unrestricted research, publication authority or Vercel deployment.

Production activation must fail closed until migration order, authority, budgets, breakers, verification, telemetry and rollback are proven.

## Handover status

Documentation: complete, including operational-readiness definition and full-operation gates.

Runtime implementation against this constitution: not started in this branch.

Production changes: none.

Vercel actions: none.
