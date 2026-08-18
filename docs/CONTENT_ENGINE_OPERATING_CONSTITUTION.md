# VibeSchool Content Engine Operating Constitution

Date: 2026-08-18
Status: Architecture contract / implementation authority
Scope: VibeSchool Content Engine, Content Factory and its use of the Worker Engine

## 1. Purpose

The VibeSchool Content Engine exists to turn curriculum authority, verified evidence, pedagogy, learner outcomes and product requirements into continuously improving learning experiences.

It is not an AI content generator, not a CMS, and not a second Worker Engine.

The Content Engine owns the educational-content lifecycle. The Worker Engine owns governed execution.

## 2. Mission

Produce, verify, publish, measure, maintain, improve and retire curriculum-aligned learning experiences at scale without sacrificing educational accuracy, safety, provenance, rights, learner welfare or human authority.

## 3. Vision

VibeSchool should reach a state where the owner does not manually manage individual lessons or production steps.

The owner governs priorities, constitutions, budgets, risk boundaries and genuine human decisions. The Content Engine decomposes approved objectives into governed work and uses the Worker Engine to execute that work.

The target lifecycle is:

Curriculum -> Research -> Evidence -> Learning Design -> Authoring -> Verification -> Testing -> Approval -> Publishing -> Observation -> Diagnosis -> Improvement -> Recertification -> Retirement

Publishing is never the end of the lifecycle.

## 4. Architectural boundary

### Worker Engine owns

- execution identity;
- objective and plan authority;
- worker identity;
- certified capabilities and skills;
- scoped permissions;
- budgets and reservations;
- leases and concurrency;
- retries and retry exhaustion;
- dead letters;
- circuit breakers;
- operator stops;
- execution telemetry;
- consequential-mutation authorization.

### Content Engine owns

- curriculum authority and hierarchy;
- content objectives and educational value;
- research questions;
- evidence semantics and provenance;
- source authority and freshness;
- pedagogy and learning design;
- lesson and activity structure;
- assessment semantics;
- editorial state;
- publication state;
- release quality gates;
- learning-effectiveness signals;
- content maintenance and retirement.

### Permanent rule

The Content Engine must not create a competing worker platform, queue, authority system, retry system or budget system when the Worker Engine already provides that responsibility.

The Content Engine requests governed work. The Worker Engine decides whether and how that work is authorized for execution.

## 5. AI constitution

AI is an optional capability available to the Content Engine. AI is not the Content Engine's brain, authority source or source of truth.

The default must be deterministic-first.

### Deterministic responsibilities

Prefer deterministic logic for:

- curriculum hierarchy and mappings;
- completeness and coverage checks;
- provenance requirements;
- source authority rules;
- rights and licence state;
- duplicate and structural checks;
- prerequisite relationships;
- schema validation;
- release gates;
- workflow transitions;
- versioning and snapshots;
- budget enforcement;
- retries and dead letters;
- publishing and rollback;
- telemetry and audit reconstruction;
- stale-content detection where rules are sufficient.

### Appropriate AI-assisted responsibilities

AI may assist with bounded tasks such as:

- semantic comparison;
- alternative explanations;
- misconception analysis;
- draft learning narratives;
- question variation;
- pedagogical critique;
- diagram or media planning;
- transformation of verified evidence into candidate learning experiences;
- synthesis where provenance is retained and claims remain verifiable.

### Non-negotiable rule

AI proposes. Evidence supports. Quality gates certify. Authorized humans or governed release authority publish.

Source discovery must never certify its own search snippets as proof.

AI output must never silently create factual authority, curriculum authority, rights authority or release authority.

## 6. Operating state machine

Every Content Engine objective or work item must have an explicit lifecycle state.

Primary lifecycle:

DORMANT -> OBSERVE -> DIAGNOSE -> PLAN -> QUEUE -> EXECUTE -> VERIFY -> REVIEW -> RELEASE -> MEASURE -> MAINTAIN

Control and terminal states:

WAITING, BLOCKED, PAUSED, QUARANTINED, FAILED, RETIRED, CANCELLED

### DORMANT

No valid work trigger exists. This is a healthy state.

### OBSERVE

Read-only collection of curriculum changes, evidence freshness, quality signals, learner outcomes, teacher feedback, release health and operational telemetry.

### DIAGNOSE

Determine whether an observed signal represents a real educational or operational problem and identify root cause rather than automatically generating work.

### PLAN

Define objective, acceptance criteria, dependencies, required capabilities, evidence requirements, authority level, expected value, risk and budget.

### QUEUE

Submit authorized work to the Worker Engine or another explicitly governed execution path.

### EXECUTE

Perform only the bounded task approved by the plan and authority contract.

### VERIFY

Test structural, semantic, curriculum, pedagogical, rights, safety and release requirements appropriate to the work.

### REVIEW

Escalate only decisions requiring editorial, factual, rights, pedagogical, policy or release judgment that cannot safely be delegated.

### RELEASE

Publish only certified content through the canonical publication path.

### MEASURE

Observe whether the learning experience is effective in actual use.

### MAINTAIN

Recheck freshness, curriculum validity, source validity, quality, broken dependencies, product compatibility and performance over time.

## 7. Start policy

The Content Engine may start work only from a valid trigger.

Valid triggers include:

- an authoritative curriculum change;
- missing curriculum coverage;
- an approved strategic content objective;
- failed release or quality certification;
- stale or invalidated evidence;
- broken or unavailable learning resources;
- rights expiry or licence change;
- poor learner mastery or abnormal misconception signals;
- teacher or learner feedback that crosses an evidence threshold;
- assessment-quality failure;
- scheduled maintenance or recertification;
- dependency breakage;
- an authorized human request;
- an authorized downstream product need.

No trigger may bypass authority, evidence or budget controls.

## 8. Rest policy

The engine must rest when no legitimate work requires execution.

Rest is healthy when:

- queues are within target service levels;
- no critical curriculum or evidence change exists;
- quality and release gates are healthy;
- no learning-effectiveness signal crosses intervention thresholds;
- scheduled maintenance is not due;
- budgets or risk policy intentionally require waiting;
- work is awaiting human authority.

The system must not manufacture work merely to remain active.

## 9. Stop and completion policy

A job completes only when its explicit acceptance criteria and required verification are satisfied.

The engine must stop execution when:

- the objective is achieved;
- the next action requires unavailable authority;
- required evidence is missing;
- budget is exhausted;
- a circuit breaker is open;
- repeated failure reaches retry limits;
- a dependency is invalid;
- a safety, rights, policy or curriculum violation is detected;
- a higher-priority governance stop applies.

## 10. Quit, cancel and retire policy

The engine must be capable of deciding that work should no longer continue.

Cancel or retire work when:

- the objective is obsolete;
- curriculum has been superseded;
- evidence disproves the premise;
- the educational value no longer justifies cost or risk;
- rights cannot be established;
- required evidence cannot be obtained to the required confidence;
- a human authority rejects the work;
- another canonical artifact supersedes it;
- repeated attempts have exhausted allowed remediation;
- the learning experience is persistently ineffective and replacement is preferable to repair.

Historical state and evidence must remain auditable after retirement.

## 11. Trigger model and human operation

The owner should govern strategy, not operate individual factory steps.

The Content Engine uses three trigger levels.

### Level 1: Event-driven

Automatic work creation from meaningful changes or failures, subject to authority and risk policy.

### Level 2: Scheduled

Periodic curriculum, freshness, source, quality, rights, performance and maintenance sweeps.

### Level 3: Strategic human objective

A human may issue a high-level objective such as "complete and certify Grade 9 Mathematics". The Content Engine must decompose that objective into dependencies and governed tasks instead of requiring the human to direct each production step.

Human involvement remains mandatory where the constitution or authority policy explicitly requires judgment.

## 12. Required capability system

The mature Content Engine should expose separate bounded capabilities rather than one unconstrained content agent.

Core capability families:

1. Curriculum Watcher
2. Research Worker
3. Semantic Evidence Verifier
4. Learning Architect
5. Content Author
6. Assessment Builder and Moderator
7. Experience / Interactivity Builder
8. Quality and Red-Team Verifier
9. Publisher / Release Controller
10. Learning Observer and Effectiveness Analyst
11. Content Governor

The Content Governor is supervisory, not an unrestricted executor.

It decides or recommends:

- whether a signal deserves work;
- work priority;
- dependency order;
- required capability;
- deterministic versus AI-assisted execution;
- mandatory human review;
- retry versus escalation;
- continue versus stop;
- repair versus replacement;
- maintain versus retire.

All consequential execution still passes through Worker Engine authority.

## 13. Closed-loop learning improvement

The engine must treat learner and teacher usage as evidence about content effectiveness, never as automatic truth.

Target loop:

Usage signal -> diagnosis -> evidence packet -> improvement hypothesis -> governed revision -> verification -> controlled release -> measurement -> promote / revise / rollback

Examples of useful signals include:

- repeated misconception patterns;
- unexpectedly difficult or easy assessment items;
- high abandonment at a learning step;
- teacher interventions repeatedly required at the same point;
- low mastery after adequate exposure;
- content-resource failures;
- accessibility failures;
- mismatch between intended and observed prerequisite mastery.

The engine must not optimize solely for engagement. Educational mastery, curriculum correctness, safety, accessibility, reliability and teacher usefulness remain primary.

## 14. Quality and release doctrine

Release gates are authoritative and must not be weakened merely to improve throughput statistics.

A high blocked-run rate is a remediation-throughput problem unless evidence proves the gate itself is invalid.

Content cannot reach official publication merely because generation succeeded.

Release certification should cover, where applicable:

- curriculum authority;
- source provenance;
- semantic factual support;
- pedagogy;
- prerequisite coherence;
- assessment quality;
- teacher guidance;
- learning depth;
- accessibility;
- interactivity functionality;
- rights and licences;
- safety;
- canonical-resource consistency;
- product/runtime compatibility.

## 15. Metrics

The Content Engine must not optimize for number of generated lessons, worker utilization or raw job completion alone.

Primary success dimensions should include:

- authoritative curriculum coverage;
- certified content quality;
- learner mastery improvement;
- misconception reduction;
- teacher usefulness;
- freshness and evidence health;
- accessibility;
- publication reliability;
- remediation time;
- rollback rate;
- production cost;
- human-decision load;
- safety and rights incidents.

A useful strategic framing is:

Educational Value = coverage x certified quality x learning effectiveness x freshness x reliability, constrained by safety, authority, rights and sustainable production cost.

## 16. Risk register

Major risks include:

- hallucinated or unsupported factual claims;
- curriculum drift;
- weak pedagogy at scale;
- duplicated or contradictory content;
- assessment leakage or invalid assessment design;
- copyright, licence and provenance failures;
- AI or external-research cost explosion;
- infinite remediation loops;
- over-automation of genuine human judgment;
- optimizing engagement instead of learning;
- contaminated or misleading learner telemetry;
- unsafe experiments on learners;
- silent quality regression;
- stale content remaining published;
- competing queues or authority systems drifting from Worker Engine governance;
- a busy factory that creates work without educational value.

Controls must include bounded capabilities, evidence requirements, budgets, circuit breakers, human authority gates, deterministic verification, idempotency, observability, rollback and explicit retirement.

## 17. Audit baseline — 2026-08-18

Production read-only inspection observed 704 Content Engine orchestration runs: 688 blocked and 16 completed.

This means the system detected release failures much more effectively than it closed them at the audit baseline. Quality gates should remain strict. The primary architectural deficit was remediation throughput and the missing closed chain from diagnosis to verified repair.

Current strengths at the baseline included:

- clear separation between Content Factory and Worker Engine;
- release gates identifying genuine content defects;
- deterministic-first research architecture;
- explicit source provenance and evidence semantics;
- human authority retained for consequential editorial and release decisions.

The implementation roadmap and readiness estimates are recorded in `docs/CONTENT_ENGINE_AUDIT_HANDOVER_20260818.md` and must be updated from new production evidence rather than treated as permanent percentages.

## 18. Production activation boundary

This constitution does not authorize autonomous production activation.

Repository certification, migration promotion, runtime authority activation, worker/capability certification and production verification remain separate governed operations.

No Content Engine migration or worker should silently enable Worker Engine runtime, autonomous authority or paid AI.

Production activation must fail closed until dependency order, migration ledger, authority grants, budgets, circuit breakers, telemetry and rollback paths are verified.

## 19. Implementation priorities

Recommended implementation sequence:

P0. Restore repository -> production migration parity and certify dependency order.

P1. Complete semantic evidence verification as a certified capability.

P2. Add a source-grounded Content Authoring Worker that consumes verified evidence and cannot perform hidden research.

P3. Add deterministic Content Governor prioritization and lifecycle-state contracts.

P4. Implement start/rest/stop/cancel/retire policies as machine-enforced runtime rules.

P5. Close the main release blocker classes through bounded remediation capabilities.

P6. Add learning-effectiveness observation, diagnosis and evidence thresholds.

P7. Add controlled content experimentation, promotion and rollback.

P8. Add full Content Engine operator observability, SLA, cost and decision-load dashboards.

P9. Introduce bounded AI capabilities only where deterministic methods are insufficient and expected value justifies cost/risk.

## 20. Constitutional invariants

1. Content is the product, but generated volume is not success.
2. Curriculum authority outranks convenience.
3. Verified evidence outranks model confidence.
4. Worker Engine owns execution governance.
5. Content Engine owns educational-content semantics and lifecycle.
6. AI is optional and bounded.
7. Source discovery cannot certify itself.
8. Release gates cannot be weakened to manufacture throughput.
9. Publishing is followed by measurement and maintenance.
10. The engine may rest; it must not invent work.
11. The engine must know when to stop, cancel and retire.
12. Human authority is reserved for genuine human decisions, not routine deterministic preparation.
13. Every consequential content mutation must be reconstructable from objective through evidence, authority, execution, verification and outcome.
14. Production autonomy is fail-closed.
15. Educational value, learner welfare and trustworthy learning outcomes outrank worker utilization or AI novelty.
