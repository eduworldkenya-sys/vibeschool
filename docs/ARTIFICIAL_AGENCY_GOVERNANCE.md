# ARTIFICIAL_AGENCY_GOVERNANCE.md
## VibeSchool — Governance of Artificial Agency
## Refined Architectural Position
## Status: GOVERNING DESIGN — IMPLEMENTATION MUST CONFORM

> **Core thesis:** VibeSchool is not building an AI employee. It is building a deterministic enterprise operating system that may use AI as a small, bounded component inside a much larger governed system.

---

## 1. What VibeSchool Is Solving

At the highest level, VibeSchool is solving the **Governance of Artificial Agency**.

The architectural problem is not simply how to make an AI perform useful tasks. The problem is how to permit non-deterministic intelligence to participate in deterministic business operations without allowing intelligence to become unbounded authority.

An AI model has no implicit corporate conscience, employment relationship, legal responsibility, or reliable understanding of business context. Therefore the system must never treat a model as a trusted persona merely because it has been assigned a job title.

The worker is a **governed system component**. Its authority comes from infrastructure, contracts, policies, identity, verification, and certification — never from its prompt, persona, model capability, or apparent intelligence.

---

## 2. The 95/5 Architectural Principle

VibeSchool should target approximately:

- **95% deterministic/smart computing:** rules, workflows, schemas, state machines, queues, routing, permissions, calculations, validation, verification, transactions, audit, budgets, identity, lifecycle controls, and database constraints.
- **5% AI:** bounded interpretation, classification, extraction assistance, summarization, anomaly explanation, semantic matching, and other functions where probabilistic reasoning provides value without becoming the source of truth.

The 95/5 ratio is an architectural target, not a claim that every feature must literally contain exactly 5% model execution.

The governing rule is stronger than the ratio:

> **AI should be used only where probabilistic intelligence creates material value that deterministic computing cannot efficiently provide, and AI must not become the authority boundary.**

---

## 3. The Deterministic Cage

The system must place intelligence inside a deterministic cage.

The model may propose, classify, explain, or interpret. The surrounding system decides whether the proposal is admissible.

For material operations, the execution pattern is:

`Event → Deterministic Rules → Bounded Context → Optional AI Interpretation → Structured Output → Deterministic Validation → Authorized Tool → State Mutation → Deterministic Verification → Audit`

The model is therefore a component in a controlled pipeline, not the controller of the pipeline.

If the model disappears, the core business control system must remain understandable and structurally safe.

---

## 4. The Authority Rule

The Worker Engine may autonomously create a worker instance when creation is supported by valid structured evidence and approved policy.

However:

> **Worker creation is not authority creation.**

A worker may be instantiated automatically while remaining in Sandbox, Shadow, or Limited state.

Production authority must be derived from an approved blueprint, scoped identity, valid contracts, certification state, lane controls, budget limits, and verification gates.

The Worker Engine must never invent authority, expand authority, or grant itself authority.

---

## 5. Separation of Concerns

The architecture should maintain separation between four functions:

1. **Need detection** — determines whether operational evidence indicates additional capacity is justified.
2. **Worker creation** — instantiates a bounded worker record and runtime.
3. **Authority granting** — determines what the worker may actually do.
4. **Audit and verification** — independently proves what happened and whether it was valid.

A single component must not become the sole source of need, creation, authority, and audit.

The Worker Engine is therefore a workforce planner/factory, not a sovereign authority.

---

## 6. Evidence-Backed Autonomous Creation

A Worker Engine may autonomously create a worker only when a structured evidence bundle satisfies policy.

### Required evidence classes

**Demand evidence**
- queue depth;
- backlog age;
- SLA risk;
- transaction volume;
- exception volume;
- measured capacity shortfall.

**Economic evidence**
- available budget;
- projected operating cost;
- cost-per-task ceiling;
- exposure ceiling.

**Capacity evidence**
- active worker count;
- approved headcount cap;
- available capacity slots;
- concurrency limits.

**Blueprint evidence**
- approved blueprint ID/version;
- certified skills;
- approved tools;
- current security posture;
- lifecycle constraints.

**Risk evidence**
- current risk score;
- security incident status;
- governance freeze status;
- dependency health;
- data sensitivity;
- financial exposure class.

The resulting creation decision must be reproducible from these records. A free-form explanation alone is not evidence.

---

## 7. Autonomous Creation Levels

### Level 0 — Manual Creation

A human requests creation. The Worker Engine executes only after policy validation.

### Level 1 — Assisted Creation

The Worker Engine detects demand and recommends a worker. A designated authority confirms.

### Level 2 — Autonomous Creation Within Caps

The Worker Engine creates a worker automatically when every predefined policy condition passes.

The new worker begins in Shadow, Sandbox, or another explicitly permitted non-production state.

### Level 3 — Autonomous Limited Activation

A pre-certified, low-risk blueprint may permit automatic activation for narrowly defined tasks, exposure, duration, and data scope.

This is not general production authority. It is pre-authorized limited authority.

### Level 4 — Forbidden Autonomy

The Worker Engine must never autonomously:

- create or approve a new authority model;
- expand a blueprint's permissions;
- increase financial exposure beyond policy;
- grant unrestricted ledger-write access;
- bypass verification;
- override Governance;
- promote a failed worker;
- suppress audit evidence;
- create an unbounded or permanent super-worker;
- create workers for the purpose of expanding the Worker Engine's own authority.

---

## 8. What a Super-Automated Worker Means

A super-automated worker is **not** a worker with unlimited authority.

It is a worker with:

- high automation;
- high deterministic control;
- narrow authority;
- automatic supervision;
- bounded context;
- bounded tools;
- measurable economics;
- continuous verification;
- immediate suspension capability;
- explicit retirement conditions.

The objective is minimal human intervention with maximal system control.

---

## 9. Virtual Accountant Reference

BP-002 Virtual Accountant remains the reference worker because finance makes authority, money, audit, identity, error handling, and escalation explicit.

For financial operations:

- ledger state is deterministic;
- accounting calculations are deterministic;
- posting is performed only by approved tools;
- idempotency is mandatory;
- verification is mandatory;
- AI cannot directly mutate the ledger;
- AI-generated suggestions are untrusted until validated;
- material exceptions escalate;
- every material action is attributable and auditable.

AI may assist with reconciliation interpretation, anomaly explanation, document extraction, or semantic matching, but the financial source of truth remains controlled by deterministic computation and approved state-transition tools.

---

## 10. Lifecycle Integration

Artificial-agency governance is integrated with the Worker Lifecycle:

`Need → Evidence → Blueprint → Creation Policy → Worker Record → Identity → Provisioning → Shadow → Verification → Certification → Limited/Active Operation → Supervision → Suspension/Remediation → Retirement`

No stage implies the next stage automatically.

In particular:

- created ≠ certified;
- certified ≠ active;
- active ≠ permanently trusted;
- AI model update ≠ harmless implementation detail;
- documentation ≠ proof;
- tests ≠ production certification unless the required end-to-end evidence exists.

---

## 11. Material Change Rule

A material change must trigger impact assessment and, where required, shadow testing and recertification.

Material changes include:

- blueprint changes;
- skill changes;
- tool changes;
- authority changes;
- policy changes;
- data-scope changes;
- model changes that affect AI-assisted behavior;
- context-assembly changes;
- verification changes;
- infrastructure changes that alter execution guarantees.

A model upgrade must therefore be treated as a potentially material system change, not simply as a prompt replacement.

---

## 12. Failure Containment

The system must assume that probabilistic components can fail.

The architecture therefore requires:

- bounded transaction scope;
- strict budgets;
- timeouts;
- retries with limits;
- idempotency;
- circuit breakers;
- dead-letter queues;
- verification gates;
- credential revocation;
- task freezing;
- human escalation;
- immutable audit evidence.

The desired failure mode is **contained, observable, reversible, and attributable**.

---

## 13. Auditability Standard

An auditor must not receive an explanation equivalent to:

> "The AI decided this was correct."

The system must instead be capable of explaining:

- which worker identity acted;
- which blueprint and version governed it;
- which contract authorized the task;
- which context was supplied;
- which deterministic rules were evaluated;
- whether AI was invoked and for what bounded purpose;
- which tool executed the state change;
- what verification gate passed or failed;
- what evidence was retained;
- who or what authorized the worker's scope.

AI output is evidence of a computational step, not authority in itself.

---

## 14. Model Agnosticism

Business authority must not be coupled to a particular model vendor or model version.

The model should be replaceable without rewriting:

- business rules;
- financial state machines;
- permissions;
- worker identity;
- audit architecture;
- verification gates;
- contracts;
- lifecycle controls.

A better model can improve a bounded intelligence function without becoming the owner of the business process.

---

## 15. Regulatory and Enterprise Position

The architecture is designed for a future in which AI-assisted enterprise operations require stronger evidence of:

- accountability;
- access control;
- explainability of material decisions;
- data minimization;
- change control;
- incident response;
- auditability;
- human oversight where required.

VibeSchool should therefore design for governed operation from the beginning rather than attempting to retrofit governance after deploying autonomous agents.

This document does **not** claim regulatory immunity. It establishes an architecture intended to make compliance, audit, and controlled operation materially easier.

---

## 16. Constitutional Rule

> **Artificial intelligence may participate in VibeSchool operations, but it may never become the implicit source of authority.**

Authority must be explicit, scoped, versioned, attributable, verifiable, revocable, and independently auditable.

---

## 17. Engineering Acceptance Rule

No implementation may claim compliance with this architecture merely because documentation exists.

The reference worker must be executable and proven.

For BP-002, proof must include:

1. real worker instantiation;
2. identity binding;
3. bounded provisioning;
4. real task routing;
5. deterministic context assembly;
6. skill execution;
7. approved tool invocation;
8. deterministic financial state mutation;
9. post-state verification;
10. audit evidence;
11. failure-mode containment;
12. suspension and credential revocation;
13. shadow-to-certified transition;
14. reproducible end-to-end tests.

Until this evidence exists, the worker branch remains **MERGE BLOCKED**.

---

## 18. Final Strategic Statement

VibeSchool is not primarily engineering a smarter AI.

It is engineering a safer enterprise architecture capable of harnessing non-deterministic intelligence for deterministic work.

The strategic progression is:

`AI as novelty → AI as bounded capability → governed artificial agency → regulated enterprise asset`

The competitive advantage is not giving an AI more freedom.

The competitive advantage is building a system in which increasingly capable intelligence can be used at scale without granting it uncontrolled authority.

**Smart computing is the foundation. AI is a bounded component. Governance is the control plane.**
