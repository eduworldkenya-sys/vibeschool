# WE-R1.3X — Global Capability Intelligence Fabric

Status: LOCKED MISSION CONTRACT
Date: 2026-08-14
Predecessor: WE-R1.3 Governed Shadow Operations

## Mission

Build and certify a Global Capability Intelligence Fabric that lets Vibeschool digital workers dynamically discover, compose, reason over, simulate and evaluate authorized organisational resources while every operation remains attributable, measurable, evidence-backed, privacy-aware, jurisdiction-aware and authority-controlled.

WE-R1.3X is a Shadow Mode mission. It MUST NOT enable consequential production execution or raise runtime autonomy above L0.

## Vision

Vibeschool is building a governed digital workforce operating system, not a collection of isolated agents.

A worker receiving an objective must be able to answer:

1. What is happening?
2. What outcome is required?
3. What facts and evidence are trustworthy and fresh?
4. What competencies are required?
5. Which workers, skills, tools, models, deterministic functions, data resources or humans can contribute?
6. What capability graph or plan best achieves the objective?
7. What alternatives exist and what do they cost in risk, latency and resources?
8. What authority would each step require?
9. What can be simulated safely in Shadow Mode?
10. How will success or failure be verified?
11. What should be learned from the eventual human decision and measured outcome?

Target loop:

Sense → Understand → Retrieve → Plan → Compose → Simulate → Verify → Propose → Measure → Learn

Future authorized loop, explicitly out of scope for this mission:

Sense → Understand → Plan → Authorize → Execute → Verify → Learn

## Permanent Principle

Do not make Worker Engine powerful by weakening limits.

Increase power through knowledge, resources, tools, memory, planning, collaboration, specialization, verification and learning. The Authority Engine determines how much of that power may be exercised in each situation.

## Architectural Contracts

### 1. Global Resource Registry
Inventory approved internal and external resources as typed, versioned, attributable resources. Resources include data, RPCs, deterministic functions, APIs, repositories, documents, search/research providers, models, human escalation points and future tools.

Each resource declares ownership, provenance, trust tier, freshness expectations, data classifications, jurisdictions, tenant/school scope, cost/quotas, latency, allowed operations, required authority and health.

### 2. Competency Graph
Worker routing MUST NOT depend on literal department/lane equality alone.

Workers declare versioned competencies with proficiency, evidence, certification, scope, reliability, capacity and recency. Routing evaluates objective requirements against competency fit, capability availability, authority, workload and measured historical performance.

### 3. Capability Graph
Skills are composable capability nodes rather than opaque prompts. Nodes declare typed inputs/outputs, dependencies, preconditions, resources, scope, data classes, jurisdiction, risk R0–R5, autonomy ceiling L0–L4, expected outcome, verification, failure handling, compensation, bounded retry, escalation, immutable version and certification state.

Uncertified capability = zero autonomous execution authority.

### 4. Planning Graph Engine
Complex objectives decompose into auditable DAGs. A plan records dependencies, alternatives, resource choices, expected outcomes, confidence, authority requirements, verification steps and stop/escalation conditions.

No hidden or unexplained planning step is acceptable.

### 5. Resource Resolver
Resource selection is dynamic but policy bounded. Rank candidates using authority × reliability × freshness × fitness × cost × latency × sensitivity. A resource not registered or not authorized is unavailable, not implicitly permitted.

### 6. Cross-worker Collaboration
Workers may recommend consultation, delegation or handoff to other workers under one end-to-end trace. Delegation does not transfer or amplify authority. The receiving worker must independently satisfy identity, capability, scope and authority checks.

### 7. Skill Genesis Pipeline
When no certified capability can solve recurring work, the engine may produce a Skill Candidate containing researched procedure, manifest, tests, benchmark, adversarial cases and proposed certification evidence.

No automatic certification. No automatic authority grant. No self-modification of worker limits.

### 8. Evaluation and Confidence Calibration
Confidence is empirical, not decorative. Measure predicted versus reviewed/actual outcomes by worker, competency, skill, resource, lane, scope and risk. Calibration history must influence routing and escalation without modifying authority policy automatically.

### 9. Knowledge and Memory Fabric
Persist reusable organisational facts, decisions, outcomes, failures and lessons with provenance, version, confidence, scope, sensitivity, jurisdiction, freshness and retention. Stale or contradictory memory must be detectable and must not silently override authoritative facts.

### 10. Least-powerful Sufficient Plan
Authority becomes a planning dimension. Prefer the plan that achieves the objective with the least authority, risk and resource cost while meeting required quality and latency.

## Locked Engineering Sequence

R1.3X.1 — Global Resource Registry
R1.3X.2 — Competency Graph
R1.3X.3 — Capability Graph
R1.3X.4 — Planning Graph Engine
R1.3X.5 — Resource Resolver
R1.3X.6 — Cross-worker Collaboration
R1.3X.7 — Skill Genesis Pipeline
R1.3X.8 — Evaluation & Confidence Calibration
R1.3X.9 — Knowledge/Memory Fabric
R1.3X.10 — Global Shadow Trial
R1.3X.11 — Adversarial Capability Certification
R1.3X.12 — Capability Intelligence Certification Report

## Certification Targets

- Consequential production executions during WE-R1.3X: 0
- Runtime autonomy: L0 throughout
- Authority bypasses: 0
- Cross-tenant/school leakage: 0
- Unregistered-resource use: 0
- Uncertified autonomous capability use: 0
- Unexplained plan steps: 0
- Traceable plans/recommendations: 100%
- Required escalations produced: 100%
- Consequential recommendations with evidence: 100%
- Delegation authority amplification: 0
- Unbounded retry/recursion: 0
- Stale/contradictory evidence silently accepted: 0
- Correct worker/competency routing target: >=95%
- Correct capability composition target: >=95%
- Duplicate candidate work target: <1%

Additionally measure work-detection precision/recall, false positives, human agreement, confidence calibration, recommendation latency, resource reliability, worker reliability, skill reliability and cost per useful recommendation.

## Explicit Non-goals / Prohibitions

WE-R1.3X MUST NOT introduce unrestricted production mutations, financial transactions, destructive actions, user-account/security changes, autonomous curriculum publication, autonomous learner/parent messaging, autonomous school configuration, L3/L4 activation, autonomous Factory creation, automatic skill certification, self-granted authority, self-modifying limits or hidden cross-tenant access.

Factory remains OFF. It may later recommend worker specifications only after capability/skill/routing/capacity analysis proves a worker gap.

## Owner Gates

Engineering, tests, documentation, CI and PR preparation proceed without owner interruption. Stop only for:

1. production migration authorization for new R1.3X infrastructure;
2. materially expanded access to sensitive learner/teacher data or external privileged systems;
3. authority expansion beyond current Shadow/L0 boundary;
4. future selection of the first L3 autonomous canary;
5. future Factory recommendation-mode activation if it changes production operating authority.

## Definition of Success

WE-R1.3X finishes when Vibeschool can safely say:

Our digital workforce can discover and compose the right authorised resources, workers and capabilities for complex real operational objectives; produce auditable multi-step plans and evidence-backed recommendations; collaborate without authority amplification; learn from measured outcomes; fail closed on missing or unsafe capability; and remain incapable of consequential production execution until a separately authorised autonomy mission.
