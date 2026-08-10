# VIBESCHOOL AUTONOMOUS ORGANISATION
## Workroom Contracts — Authority-Bounded Cross-Lane Communication

**Document ID:** VS-ENG-WC  
**Version:** 0.2-draft  
**Classification:** INTERNAL — CONTROLLED  
**Branch:** `spec/autonomous-engine-system-v1`  
**Authority:** Owner (`eduworldkenya-sys`)  
**Status:** SPECIFICATION — PRE-IMPLEMENTATION  
**Parent specification:** `docs/ENGINES.md`  
**Related model:** `docs/OPERATIONAL_REALITY.md`

> **Implementation moratorium:** This document defines communication contracts only. It MUST NOT be interpreted as permission to implement engines, workers, provisioning, database schemas, APIs, queues, AI agents, or production authority. All implementation remains blocked until the constitutional and pre-development gates are satisfied.

---

## §0 Notation, precedence, and content classes

### 0.1 Normative language

The terms **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **MAY**, and **OPTIONAL** are normative.

### 0.2 Content classes

Every contract statement belongs to one of the following classes:

- **[DEFINED]** — already established by an approved parent specification.
- **[DERIVED]** — logically required by the constitutional or operational model.
- **[PROPOSED]** — a design refinement presented for Owner approval; not yet implementation authority.
- **[ILLUSTRATIVE]** — an example showing intended behaviour; it grants no authority.
- **[PENDING]** — unresolved policy or engineering decision that blocks the affected implementation.
- **[FUTURE]** — reserved identifier or contract family not yet specified.

### 0.3 Precedence

The precedence order is:

1. Owner-approved `docs/ENGINES.md`;
2. approved amendments and waivers;
3. `docs/OPERATIONAL_REALITY.md`;
4. this document;
5. `docs/BLUEPRINT_REGISTRY.md` and other subordinate specifications;
6. implementation.

A lower-level document MUST NOT silently create authority that does not exist above it.

### 0.4 Contract is not authority

[DEFINED] A Workroom contract is a **typed request for work**, not a grant of authority.

A successful contract invocation:

- MUST NOT widen the requester's grant;
- MUST NOT widen the performer's grant;
- MUST NOT alter either party's blueprint;
- MUST NOT create a new identity;
- MUST NOT bypass Governance;
- MUST NOT bypass a prohibition;
- MUST NOT transform untrusted input into authority.

If a payload requests an action outside the performer's existing grant, the performer MUST reject it and MUST record the blocked attempt as an observable Governance event.

### 0.5 Document-first rule

No blueprint MAY be considered implementation-ready merely because a contract exists. The contract, blueprint, data classification, identity, budget, evidence, failure behaviour, and approval chain MUST all be defined before implementation authority is considered.

---

# §1 Purpose

1.1 [DEFINED] This document translates `ENGINES.md` §10 and `OPERATIONAL_REALITY.md` §8 into explicit cross-lane communication contracts.

1.2 [DEFINED] Contracts are the only permitted organisational boundary for lateral work between engines.

1.3 [DERIVED] The Workroom is therefore a **coordination boundary**, not a general-purpose internal API surface. Internal implementation details of an engine MUST remain invisible to other engines.

1.4 [PROPOSED] Contract design SHOULD favour deterministic, inspectable computer automation over AI-mediated coordination. AI MAY assist with bounded interpretation or classification where explicitly permitted by a contract, but AI MUST NOT become an implicit authority layer.

---

# §2 Machine-first operating principle

## 2.1 Deterministic substrate

[PROPOSED] VibeSchool SHALL be designed as a **smart computer system first and an AI-assisted system second**.

The default execution path SHOULD be:

```text
Rules / state machines / validated data / deterministic automation
                         ↓
                 Workroom contract
                         ↓
               bounded execution
                         ↓
                signed evidence
```

AI is an optional specialist component, not the organisational operating system.

## 2.2 AI assistance boundary

[PROPOSED] AI usage SHOULD be treated as an explicit, budgeted dependency rather than an assumed requirement of every worker or workflow.

The target operating model is approximately:

- **~95% deterministic or conventional computer automation** for repeatable institutional operations;
- **~5% AI-assisted activity** for tasks where probabilistic language, classification, synthesis, or other AI-specific capability provides material value.

[PENDING — AI-01] The denominator for the 5% target MUST be defined before implementation. Possible measures include execution events, task volume, compute cost, decision volume, or workflow time. One metric MUST be selected and documented rather than mixing measures.

## 2.3 AI cannot confer authority

An LLM, model output, prompt, generated text, embedding, classifier, or external AI provider MUST NOT be treated as an authority source.

AI output MUST enter the same validation, policy, identity, provenance, budget, and audit controls as any other untrusted external input.

## 2.4 AI failure behaviour

Where an AI-assisted step fails, times out, exceeds budget, produces invalid structured output, or falls below a defined confidence/evidence threshold, the contract MUST either:

1. use a deterministic fallback;
2. route to another approved non-AI mechanism; or
3. escalate to Governance or an authorised human.

A workflow MUST NOT fail open merely because its AI component is unavailable.

## 2.5 AI spending and dependency telemetry

AI-assisted contracts SHOULD separately record:

- model/provider identifier;
- input/output token usage where available;
- latency;
- cost;
- fallback rate;
- validation failures;
- human override rate;
- value or outcome measure.

This permits Finance and Governance to determine whether AI is actually earning its place in the ~5% allowance.

---

# §3 Contract anatomy

Every approved contract MUST specify the following before implementation:

| ID | Required element | Requirement |
|---|---|---|
| A-01 | Contract identity | Stable ID and immutable version |
| A-02 | Parties | Requester lane and performer lane |
| A-03 | Purpose | Exact business purpose and non-goals |
| A-04 | Authority basis | Parent specification sections and applicable blueprint references |
| A-05 | Request schema | Typed fields, data classes, learner-data flag |
| A-06 | Response schema | Typed outcomes and evidence references |
| A-07 | SLA | Target latency, availability, expiry semantics |
| A-08 | Quota | Request, compute, storage, AI and downstream limits where applicable |
| A-09 | Chargeback | Cost attribution rule |
| A-10 | Idempotency | Key format and duplicate handling |
| A-11 | Replay protection | Nonce, timestamp/window, and replay response |
| A-12 | Attestation | Identity, integrity, policy, and non-revocation checks |
| A-13 | Evidence | Required audit events and evidence references |
| A-14 | Data minimisation | Minimum data required and prohibited fields |
| A-15 | Retention | Record lifetime and deletion/hold behaviour |
| A-16 | Failure semantics | Retry, timeout, dead-letter, backpressure and escalation |
| A-17 | Security classification | Trust zone, data class, and egress rules |
| A-18 | AI dependency | None / optional / required, plus fallback and budget if applicable |
| A-19 | Human boundary | Actions that MUST escalate to a human |
| A-20 | Version policy | Compatibility, supersession and migration rules |

No implementation specification MAY omit a required element by assuming that another document will infer it.

---

# §4 Invocation lifecycle

Every contract invocation SHALL follow this logical sequence:

```text
request
  ↓
identity + attestation
  ↓
schema validation
  ↓
authority validation
  ↓
prohibition validation
  ↓
quota / budget validation
  ↓
replay / idempotency validation
  ↓
accept | reject
  ↓
execute
  ↓
validate result
  ↓
record evidence
  ↓
respond
  ↓
settle / chargeback
```

4.1 [DERIVED] Each material transition MUST produce signed audit evidence.

4.2 [DEFINED] A rejected request is still an observable event. Schema errors, authority violations, quota exhaustion, replay attempts, prohibited requests, and blocked cross-lane attempts MUST be recorded.

4.3 [DERIVED] A blocked attempt MUST NOT be treated as a successful execution and MUST NOT consume authority merely because it reached the Workroom boundary.

4.4 [DERIVED] Silent drops are prohibited. If work cannot be accepted, the requester MUST receive a typed failure or dead-letter outcome consistent with the contract.

---

# §5 Data-minimisation and learner-data rules

5.1 Learner-data-bearing contracts MUST use references rather than duplicating learner records wherever the task can be completed without duplication.

5.2 Learner data MUST be:

- purpose-bound;
- task-scoped;
- minimum-necessary;
- access-controlled;
- retention-bounded;
- auditable;
- protected against unintended cross-lane joining.

5.3 Contract payloads MUST explicitly identify whether they contain:

- no protected data;
- institutional data;
- personal data;
- learner/child data;
- sensitive/special-category data;
- financial data;
- security-sensitive data.

5.4 A contract MUST NOT request raw learner data merely because the performer has technical access to it.

5.5 DLP and policy validation MUST occur before protected data crosses the coordination boundary.

5.6 Legal preservation MAY override ordinary retention/deletion behaviour only through an approved legal-hold process. A retention hold MUST NOT become an uncontrolled permanent copy of learner data.

5.7 Crypto-shredding MUST NOT be described as an unconditional deletion mechanism where applicable law requires preservation. The system MUST distinguish ordinary deletion, crypto-shredding, legal hold, and evidence preservation.

---

# §6 Initial approved-for-design contract set

The following contracts form the initial design set. Their presence in this document reserves their identity and defines intended boundaries; implementation remains blocked until the readiness conditions in §12 are satisfied.

## WR-001 — Staffing Request

**Version:** 0.2-draft  
**Requester:** Engine-head requiring additional approved capacity  
**Performer:** HR / Workforce  
**Structural hand-off:** HR → Foundry via [FUTURE WR-002]

### Purpose

Request additional worker capacity within an already-approved blueprint and within existing authority, headcount, budget, and policy limits.

### Request

Minimum fields:

- requesting engine code;
- lane code;
- role/blueprint code;
- requested count;
- requested duration;
- reason and evidence references;
- current queue/health metrics;
- hysteresis state;
- current budget state;
- AI-dependency flag if the proposed role uses AI.

### Hard constraints

The request MUST be rejected when:

- the blueprint is not approved;
- the requested role does not exist in the registry;
- the count exceeds remaining headcount capacity;
- the request would expand constitutional authority;
- the budget would exceed the approved ceiling;
- the request bypasses the required shadow gate;
- required evidence is absent.

### Outcomes

`approved-for-provisioning` | `queued-capacity` | `rejected(reason)` | `escalated-human`

### Important boundary

WR-001 does not provision workers. It requests capacity. Provisioning remains a separate authority and MUST use the approved factory path.

---

## WR-014 — Assessment Certification

**Version:** 0.2-draft  
**Requester:** Academic Authority  
**Performer:** Governance

### Purpose

Certify that an assessment or grading output satisfies the currently approved academic and certification policy.

### Request

The evidence bundle MAY contain:

- artifact/evidence references;
- grade-distribution statistics;
- deviation statistics;
- rubric/version references;
- prohibition-violation count;
- validation results;
- provenance references;
- certification-policy version.

Raw learner streams SHOULD NOT cross the contract boundary unless specifically required by an approved certification policy.

### Outcomes

`certified` | `re-shadow(reason)` | `changes-required(reason)` | `rejected(reason)` | `escalated-human`

### Hard boundary

Governance certifies evidence against policy. It MUST NOT invent academic standards or silently alter a grade to make a distribution look acceptable.

---

## WR-021 — Learner-Support Escalation

**Version:** 0.2-draft  
**Requester:** Support & Communication  
**Performer:** Academic | Operations | Owner for reserved safeguarding matters

### Purpose

Move a learner-support case to the smallest authorised domain capable of resolving it.

### Request

- case identifier;
- case class;
- task-scoped learner reference;
- minimal factual summary;
- requested action class;
- urgency/severity;
- provenance/evidence references.

### Outcomes

`acknowledged` | `actioned(evidence-ref)` | `escalated-human` | `rejected(scope-reason)`

### Safeguarding boundary

A safeguarding-class case MUST follow the Owner-reserved safeguarding policy. Automated handling MUST NOT silently convert a safeguarding concern into an ordinary support ticket.

---

## WR-030 — Financial Reconciliation

**Version:** 0.2-draft  
**Requester:** Operations, Growth, or Finance self-trigger  
**Performer:** Finance

### Purpose

Reconcile payment, invoice, fee, or chargeback events and identify anomalies.

### Hard boundary

WR-030 MUST NOT authorise movement of funds, change bank-account details, approve a new payee, or waive an amount unless a separate Owner-approved authority exists.

Financial computation and reconciliation MAY be automated. Final movement of institutional funds remains subject to the human/dual-control boundary defined by the constitutional specification.

### Outcomes

`reconciled(statement-ref)` | `anomaly(incident-ref)` | `insufficient-evidence` | `escalated-human`

---

## WR-040 — Publication Certification

**Version:** 0.2-draft  
**Requester:** Content Production  
**Performers:** Academic Authority → Governance

### Purpose

Certify that a content artifact has passed the required academic and governance checks before publication.

### Composition

The contract is a sequential certification chain:

1. Academic validates curriculum/assessment conformance.
2. Governance validates required policy, safety, provenance, and evidence controls.
3. Publication MAY proceed only after all required certifications succeed.

### Outcomes

`certified` | `changes-required` | `rejected` | `escalated-human`

### AI boundary

AI MAY assist drafting, editing, classification, or QA where a blueprint explicitly allows it. AI-generated content MUST NOT become authoritative merely because an AI model produced it.

---

## WR-050 — Incident Containment

**Version:** 0.2-draft  
**Requester:** Any authorised identity or Governance automation  
**Performer:** Governance; Engineering for platform incidents

### Purpose

Contain security, policy, reliability, authority, privacy, or operational incidents within the smallest possible blast radius.

### Request

- incident ID;
- severity;
- affected identity/lane;
- evidence references;
- detected policy/invariant;
- proposed containment;
- current system state;
- whether break-glass is required.

### Outcomes

`contained(evidence-ref)` | `suspended(identity-ref)` | `isolated(lane-ref)` | `break-glass-required` | `escalated-human`

### S1 rule

S1 incidents MUST notify the Owner immediately and MUST NOT wait for ordinary queue processing.

---

# §7 Reserved contract families

The following identifiers are intentionally reserved because the organisation will eventually require them. They MUST be specified before any blueprint depending on them becomes implementation-ready.

| ID | Contract family | Purpose | Status |
|---|---|---|---|
| WR-002 | Provisioning Handoff | HR-approved capacity request to Foundry factory | [FUTURE] |
| WR-010 | Worker Promotion | Shadow evidence submission to Governance | [FUTURE] |
| WR-011 | Worker Suspension | Policy/performance suspension request | [FUTURE] |
| WR-012 | Worker Retirement | Retirement and credential-destruction workflow | [FUTURE] |
| WR-022 | Academic Evidence Request | Minimal academic evidence exchange | [FUTURE] |
| WR-031 | Budget Signal | Cost/budget state exchange | [FUTURE] |
| WR-032 | Payment Event | Normalised payment event to Finance | [FUTURE] |
| WR-051 | Incident Evidence | Structured evidence handoff during incidents | [FUTURE] |
| WR-060 | DR Reconciliation | Recovered-state verification | [FUTURE] |
| WR-070 | DSAR | Data-subject access request workflow | [FUTURE] |
| WR-071 | Erasure / Legal Hold | Deletion, crypto-shredding, and preservation workflow | [FUTURE] |
| WR-080 | Principal Approval | Owner approval/veto ceremony | [FUTURE] |
| WR-081 | Break-Glass | Time-boxed emergency authority | [FUTURE] |

Reserved identifiers MUST NOT be reused for unrelated purposes.

---

# §8 Failure, retry, and backpressure semantics

## 8.1 Failure classes

Each contract MUST distinguish at minimum:

1. **Validation failure** — request is malformed or incomplete.
2. **Authority failure** — request exceeds grant or violates policy.
3. **Capacity failure** — performer cannot safely accept work now.
4. **Dependency failure** — required dependency is unavailable.
5. **Execution failure** — accepted work failed during execution.
6. **Evidence failure** — execution occurred but required evidence could not be produced or verified.
7. **Security failure** — integrity, attestation, replay, DLP, or other security control failed.

## 8.2 Retry rules

Retries MUST be bounded and MUST NOT be used to defeat authority, quota, rate limits, or safety controls.

Authority, prohibition, schema, replay, and policy failures SHOULD NOT be retried automatically unless the contract explicitly defines a safe correction path.

## 8.3 Dead-letter

Unrecoverable work MUST be dead-lettered with:

- contract ID/version;
- request ID;
- failure class;
- reason code;
- evidence references;
- retry count;
- next escalation owner.

## 8.4 Backpressure

A performer MAY reject or defer work when capacity or policy limits are reached. The requester MUST honour the resulting state and MUST NOT create a lateral bypass.

## 8.5 Circuit breaking

Repeated dependency or execution failures MUST be capable of triggering circuit-breaking or lane degradation before a failure cascades into other lanes.

---

# §9 Evidence, provenance, and audit requirements

Every contract invocation MUST be attributable to:

```text
Owner authority lineage
      ↓
Foundry
      ↓
Engine-head
      ↓
Worker (if applicable)
      ↓
Contract invocation
      ↓
Action / result
```

The minimum event vocabulary is:

`request` → `validate` → `accept|reject` → `execute` → `result` → `respond` → `settle`

Additional events SHOULD include:

`retry`, `dead-letter`, `backpressure`, `policy-denial`, `authority-denial`, `replay-denial`, `DLP-denial`, `AI-fallback`, `human-override`, `suspension`, `recovery`.

Every event MUST be linked to the relevant trace/provenance context and MUST be protected against unauthorised alteration.

Blocked attempts are evidence too. A blocked Finance-to-Support query, for example, MUST remain visible to Governance as an attempted behaviour even though no protected data was returned.

---

# §10 Versioning and compatibility

10.1 Contract versions MUST be immutable after approval.

10.2 A change to any of the following requires a new contract version:

- authority basis;
- permitted data classes;
- request or response semantics;
- SLA guarantees;
- quota ceilings;
- retention behaviour;
- AI dependency or fallback behaviour;
- failure semantics;
- human approval boundary.

10.3 Additive, backwards-compatible fields MAY be introduced under the document's change policy, but they MUST NOT silently change the meaning of an existing field.

10.4 Superseded contract versions MUST remain auditable and MUST identify their successor.

10.5 A contract MUST define its effective date and migration/deprecation window before implementation.

---

# §11 Economic and AI accounting

11.1 Every contract SHOULD support chargeback to the originating lane and engine.

11.2 Resource accounting SHOULD distinguish:

- compute;
- storage;
- network/API calls;
- external service calls;
- human intervention;
- AI usage where applicable.

11.3 [PROPOSED] AI-assisted contract usage SHOULD be separately visible to Finance and Governance so that the organisation can enforce the strategic target that AI remains a small specialist component rather than becoming the hidden dependency of ordinary operations.

11.4 An AI-assisted path MUST NOT conceal deterministic work behind an AI label merely to classify it as AI usage. The measurement system MUST use a consistent operational definition.

11.5 Cost telemetry MUST be associated with outcome telemetry so that the system can distinguish useful automation from expensive activity.

---

# §12 Readiness gates before BLUEPRINT_REGISTRY.md

The Blueprint Registry MUST NOT be treated as implementation-ready until the following are satisfied:

### G-01 Contract authority gate
Every initial contract has an explicit authority basis and does not create authority through communication.

### G-02 Schema gate
Request and response schemas are frozen for the first implementation cohort.

### G-03 Data gate
Every field has a data classification, purpose, minimisation rule, retention rule, and cross-lane boundary.

### G-04 Failure gate
Retry, timeout, dead-letter, backpressure, circuit-breaker, and escalation behaviour are defined.

### G-05 Evidence gate
Required audit events, provenance requirements, and verification evidence are defined.

### G-06 Economic gate
Quota and chargeback semantics are defined for every implementation-relevant contract.

### G-07 Human-boundary gate
All Owner-reserved and non-automatable actions are explicitly identified.

### G-08 AI-boundary gate
For every AI-assisted contract, the document specifies why AI is necessary, its allowed role, deterministic fallback, budget, telemetry, and human escalation. AI is not permitted merely because it is convenient.

### G-09 Security gate
Attestation, replay protection, authentication, authorisation, DLP, and blocked-attempt observability are specified.

### G-10 Legal gate
DSAR, erasure, legal hold, safeguarding, and other legally sensitive workflows have approved policy boundaries before dependent blueprints proceed.

### G-11 Traceability gate
Every blueprint must map to its required contracts; every contract must map upward to an operational behaviour and constitutional authority.

### G-12 Document maturity gate
No unresolved [PENDING] item that materially changes authority, protected-data handling, human accountability, budget, or failure behaviour may be hidden inside implementation.

---

# §13 Pending decisions

The following decisions remain deliberately open and block the affected implementation until resolved:

- **W-01:** SLA values per contract.
- **W-02:** Quota and rate limits per contract.
- **W-03:** Assessment certification evidence policy.
- **W-04:** Idempotency and replay windows.
- **W-05:** Contract-event retention periods.
- **W-06:** DSAR redaction and payload rules.
- **W-07:** Legal-hold procedure.
- **W-08:** Exact definition and denominator for the ~5% AI usage target.
- **W-09:** AI cost ceiling and per-lane AI budgets.
- **W-10:** AI fallback standards and acceptable failure rates.
- **W-11:** Safeguarding escalation policy.
- **W-12:** Principal approval/notification thresholds.
- **W-13:** DR reconciliation contract semantics.
- **W-14:** Exact data-classification taxonomy.
- **W-15:** Contract compatibility and deprecation windows.

Open decisions MUST remain visible. They MUST NOT be silently resolved in code.

---

# §14 Traceability matrix

| Contract | Constitutional basis | Operational behaviour | Primary engines | Blueprint dependency |
|---|---|---|---|---|
| WR-001 Staffing Request | ENGINES §6, §8, §11, §12, §13 | OR-02; autonomic staffing loop | HR + requesting engine | Admissions/triage roles and others |
| WR-014 Assessment Certification | ENGINES §6, §9, §11 | OR-01; OR-05 | Academic + Governance | Academic/Content/QA roles |
| WR-021 Learner-Support Escalation | ENGINES §6, §9, §19 | OR-03 | Support + Academic + Operations + Owner | Support roles |
| WR-030 Financial Reconciliation | ENGINES §6, §13, §15 | OR-04 | Finance + Operations + Growth | Finance roles |
| WR-040 Publication Certification | ENGINES §6, §8, §11, §19 | OR-05 | Content + Academic + Governance | Author/Editor/QA roles |
| WR-050 Incident Containment | ENGINES §6, §14, §15, §18 | OR-06 | Governance + Engineering | Responder roles |

Reserved contracts in §7 MUST be added to this matrix when promoted from [FUTURE] to [DEFINED].

---

# §15 Change control

15.1 Changes to authority, protected-data scope, human boundaries, AI dependency, or failure semantics require Owner approval and Governance conformance review.

15.2 Contract amendments MUST create a new version rather than mutating historical meaning.

15.3 No contract change MAY be implemented merely because an implementation team needs it. The specification MUST be updated first.

15.4 The changelog MUST record the reason for each material contract change and identify affected blueprints and workflows.

---

# §16 Changelog

### v0.2-draft

Refined the Workroom specification before implementation. Added:

- explicit machine-first / deterministic-automation principle;
- bounded ~5% AI-assistance target with unresolved measurement definition;
- explicit rule that AI cannot confer authority;
- deterministic fallback requirements for AI-assisted work;
- AI cost, latency, validation, fallback, and value telemetry;
- stronger contract anatomy and security requirements;
- explicit data-classification and legal-hold handling;
- distinction between ordinary deletion, crypto-shredding, and legal preservation;
- expanded failure taxonomy and circuit-breaking rules;
- blocked-attempt observability as a first-class requirement;
- reserved lifecycle, DSAR, erasure, DR, and Principal contracts;
- expanded pre-blueprint readiness gates;
- explicit prohibition on silently resolving pending decisions in code.

### v0.1-draft

Initial Workroom contract specification.

---

## Final maturity rule

This document is intentionally **not yet implementation-complete**. That is a feature, not a defect.

Before development begins, the organisation must be able to answer, for every contract:

> **Who may request it? What exactly may be requested? What data crosses the boundary? What authority already exists? What does the computer do deterministically? Where, if anywhere, may AI assist? What happens when it fails? What does it cost? What evidence proves what happened? Who can stop it? What happens during recovery? What must remain human?**

If any answer is missing, the correct engineering action is to mature the specification — not to invent the answer in code.
