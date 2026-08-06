# Vibeschool Student VibeTwin — Canonical Architecture

Status: adopted architecture doctrine

## Product target

VibeTwin is an autonomous instructional system for bounded academic learning. It is designed to replace routine one-to-one tutoring where the system has sufficient curriculum evidence, while escalating safeguarding, specialist-support, high-stakes, and low-confidence situations to appropriate humans.

The system is not a chatbot. Its durable product is the evidence-backed learner model and the deterministic decision loop that decides what the learner should do next.

## Canonical separation

### Student Twin
A durable computational model of the learner: identity, curriculum position, obligations, mastery, evidence, recurring mistakes, revision need, engagement and validated learning priorities.

### Twin Engine
The deterministic/statistical decision layer. It consumes authoritative learner state and produces explainable next-best actions. It must function when all generative-AI providers are unavailable.

### Autonomous Tutor
The instructional surface. It teaches, explains, demonstrates, asks questions and supports practice. Generative AI may be used here behind a bounded, cached, validated and vendor-independent interface.

The Tutor may evolve without corrupting Student Twin state.

## Authority doctrine

1. Teacher-assigned work is never silently overridden by optional Twin gap practice.
2. Local learner evidence is the verdict. Population patterns may inform priors but may not override local evidence.
3. Missing or insufficient evidence causes abstention, not invention.
4. Autonomy is determined by task type, evidence quality, deterministic validation, measured historical accuracy and risk level — never by an LLM self-reporting confidence.
5. High-risk or specialist cases retain a human escalation path.

## North-star learning loop

Evidence -> Learner State -> Diagnosis -> Next-Best Action -> Instruction/Practice -> Assessment -> Feedback -> New Evidence -> Learner State

Primary product metric:

recommended -> started -> completed -> evidence produced -> learner state changed

## Evidence is the moat

Frontier AI models are interchangeable suppliers. Vibeschool's defensible asset is structured, longitudinal, curriculum-aligned learning evidence created by the workflow itself.

Every future Twin milestone must preserve provenance, replayability, versioning, idempotency and vendor independence.

## Ledger-first target architecture

The long-term system of record is an append-only evidence ledger rather than mutable learner-state truth.

Learner state must be expressible as:

`LearnerState = project(evidence_ledger, model_version)`

Existing production tables remain authoritative for current workflows until ledger adoption milestones explicitly dual-write and validate parity. Do not introduce parallel production authority casually.

Irreversible architectural requirements for the future ledger:

- immutable learning events;
- client-generated idempotency keys for offline-safe sync;
- true event time and ingestion time;
- curriculum/outcome provenance;
- model and graph versioning;
- deterministic replay;
- time-travel reconstruction;
- model-version-aware projections;
- full operation with AI disabled.

## Four tiers of Twin memory

### 1. Episodic
What happened: immutable learning evidence.

### 2. Semantic
What is currently known: learner-state projections such as mastery, obligations and revision queue.

### 3. Pattern
What Twin has noticed: versioned, expiring, evidence-cited regularities such as recurring error types, forgetting rate, fatigue or intervention response.

### 4. Predictive
What Twin expected and how accurate it was: forecasts with horizons, eventual observations and calibration results.

Conversation history is not the primary memory system. Educational state and evidence are.

## Prediction doctrine

Predictions must be deterministic/statistical where practical, versioned, resolvable and calibrated. Unresolved forecasts are tracked as model debt.

Target prediction classes:

- forgetting/recall;
- assessment readiness;
- learning-risk early warning;
- intervention or next-action utility.

Model promotion must eventually be gated by measured calibration and shadow evaluation rather than intuition.

## AI boundary

AI is used by responsibility, not by a hard percentage target.

Deterministic/statistical by default:

- assignments and deadlines;
- curriculum position;
- mastery calculation;
- weak-outcome detection;
- revision scheduling;
- next-action selection;
- structured mistake tracking;
- progress and accountability;
- prerequisite sequencing;
- objective grading.

Generative AI may support:

- alternative explanations;
- worked examples;
- bounded Socratic dialogue;
- free-text misconception analysis where rules are insufficient;
- additional examples or practice drafts;
- natural-language narration of already-computed evidence.

AI output is untrusted until it passes the applicable schema, curriculum, safety and autonomy gates.

## Federated learning doctrine

Federation is designed for now but shipped only after the local learner engine has been validated.

Principle:

**What is learned from many informs; what is proven from one decides; identity never travels.**

Population learning should use aggregate sufficient statistics rather than sharing individual learner records. Candidate aggregate artifacts include forgetting priors, misconception transition counts, intervention-effect estimates and difficulty estimates.

Future federation requirements:

- no learner identity or individual free-text payloads in federation schemas;
- aggregation thresholds before emission;
- consent and transparency surfaces;
- versioned global artifacts;
- idempotent offline/online catch-up;
- local learner evidence always overrides global priors;
- deletion/refit policy documented honestly;
- Kenya data-protection requirements treated as architecture, not copywriting.

Federation is a later milestone and must not be used to justify premature schema expansion during the foundational learner-state work.

## Autonomy tiers

### Tier A — autonomous
Examples: objective marking, revision scheduling, prerequisite sequencing, selection of approved resources.

### Tier B — autonomous with audit
Examples: short structured responses or equivalent-practice generation with strong deterministic validation.

### Tier C — gated
Examples: essays, open reasoning, unusual misconception diagnosis and consequential progress judgments.

### Tier D — human escalation
Examples: safeguarding, specialist learning support, welfare, high-stakes certification or decisions outside system competence.

## Canonical milestone sequence

1. ST-000 — Student Twin Workspace
2. TWIN-STATE-001 — Authoritative Learner Model
3. TWIN-EVIDENCE-002 — Universal normalized learning evidence
4. TWIN-MASTERY-003 — Mastery, Pattern Memory & Prediction Engine
5. TWIN-DECISION-004 — Explainable Next-Best-Action Engine
6. TWIN-SESSION-005 — Autonomous Learning Session Loop
7. TWIN-TUTOR-006 — AI Instruction Layer
8. TWIN-AUTONOMY-007 — Autonomy & Escalation Gates
9. TWIN-VALIDATION-008 — Replacement-Readiness Validation
10. TWIN-FEDERATE-009 — Privacy-Preserving Population Learning

## ST-000 scope boundary

ST-000 establishes the permanent student operating surface only. It may read existing authoritative student task, personalized-path, progress and goal systems, but it must not invent new mastery, memory, federation or ledger authorities.

The permanent Twin workspace should expose:

- Today's Mission;
- Twin Thinking / Why this;
- Do Next;
- Progress;
- Upcoming;
- Goals;
- Ask Twin;
- Start/resume actions from authoritative task URLs.

Later milestones fill these surfaces with richer state; they should not require redesigning the workspace shell.
