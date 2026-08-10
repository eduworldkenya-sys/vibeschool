# VIBESCHOOL AUTONOMOUS ORGANISATION
## Master Specification — Strategic Charter, Constitution & Operational Infrastructure

**Document ID:** VS-ENG-SPEC  
**Version:** 1.1-draft  
**Classification:** INTERNAL — CONTROLLED  
**Authority:** Owner (`eduworldkenya-sys`)  
**Status:** SPECIFICATION — PRE-IMPLEMENTATION  
**Repository location:** `docs/ENGINES.md`

> **Implementation moratorium:** This document is intentionally being matured before development. No engine, worker, authority substrate, provisioning routine, governance automation, or HQ control surface SHALL be implemented as production authority merely because it is described here. Implementation begins only after the Owner approves the specification and the required design gates are satisfied.

---

## §0 Notation, precedence, and conformance

### 0.1 Normative language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **MAY**, and **OPTIONAL** are to be interpreted as normative requirements in the sense of RFC 2119/8174.

Clauses containing normative keywords are binding. Sections explicitly labelled **Context**, **Rationale**, or **Example** are informative and do not independently create authority.

### 0.2 Precedence

The precedence order is:

1. Owner-approved constitutional specification;
2. approved amendments and waivers to this specification;
3. `AGENTS.md` and repository governance rules;
4. implementation and configuration;
5. operational assumptions.

No implementation MAY silently override this specification. A conflict MUST be surfaced and reconciled through §21.

### 0.3 Conformance

An actor is conformant only if:

- its authority is traceable to an approved grant;
- its action is within that grant;
- required policy checks succeeded;
- the action carries the required provenance and audit evidence; and
- no applicable prohibition was violated.

### 0.4 Read-before-action rule

Any human, AI agent, automation, developer, or service interacting with engines, workers, departments, authority registries, or HQ provisioning MUST read this document first and MUST cite the sections relied upon when proposing a material change.

### 0.5 Specification maturity

This document is a living specification. It SHALL be expanded until the Owner can approve implementation without relying on undocumented assumptions. Missing detail is not permission to invent behaviour.

---

# §1 Strategic Charter

## 1.1 Vision

VibeSchool SHALL pursue a self-sustaining and operationally scalable educational ecosystem in which operational, administrative, and academic execution are orchestrated by bounded autonomous cognitive engines, liberating human principals and educators to focus on strategic mentorship, pedagogical innovation, and learner success.

**Context:** “Infinitely scalable” is treated as a strategic aspiration rather than a technical guarantee. Economic, regulatory, infrastructure, and human constraints always remain real system boundaries.

## 1.2 Mission

VibeSchool SHALL design, deploy, and govern a zero-trust, multi-agent autonomous organisation capable of executing institutional operations — including curriculum intelligence, content production, school operations, finance, support, and growth — through least-privilege delegation, cryptographically accountable identity, continuous oversight, and legally compliant data handling.

## 1.3 Strategic pillars

### P-A — Operational Sovereignty

The organisation SHOULD operate its routine operational loops autonomously: detect need, define work, provision approved roles, monitor performance, suspend, restructure, and retire. Human intervention remains mandatory for constitutional authority, legal accountability, strategic pivots, and Owner-reserved decisions.

### P-B — Pedagogical Fidelity

Academic automation MUST preserve educational rigour and MUST enforce applicable curriculum and assessment requirements rather than optimising merely for content volume or engagement.

### P-C — Cryptographic Accountability

Trust MUST be evidenced rather than assumed. Material authority and privileged actions MUST have verifiable provenance and auditable evidence.

### P-D — Economic Sustainability

Autonomous activity MUST be measured against resource consumption and institutional value. Cost runaway, low-value execution, and persistent under-performance MUST have defined containment or retirement paths.

### P-E — Human Dignity and Learner Protection

Automation MUST NOT become an excuse to remove meaningful human accountability from learner-affecting decisions, privacy rights, safety, or legally protected interests.

## 1.4 Strategic interpretation rule

All interpretation of this specification MUST be consistent with §1. Where two technically valid designs conflict with a strategic pillar, the design that violates the pillar MUST NOT be adopted without an explicit Owner-approved amendment.

## 1.5 Bounded autonomy

The organisation has **operational sovereignty but not constitutional sovereignty**.

Engines MAY autonomously execute approved operational loops. No engine, worker, automation, or external provider MAY redefine its own mandate, grant, constitutional rules, Owner authority, or oversight structure.

---

# §2 Scope and purpose

## 2.1 Scope

This specification governs:

- autonomous identity and authority;
- engine and worker lifecycles;
- provisioning and revocation;
- capability grants and prohibitions;
- departments and execution lanes;
- cross-lane coordination;
- governance and assurance;
- telemetry and observability;
- economics and resource controls;
- continuity and disaster recovery;
- privacy and legal automation;
- the Principal interface;
- evidence, auditability, and change control.

## 2.2 Non-goals

This specification does not itself define:

- individual product features;
- curriculum lesson content;
- commercial pricing strategy;
- marketing copy;
- a specific cloud provider;
- a specific LLM provider;
- a particular programming language or framework.

Such details MAY be specified in subordinate technical designs provided they conform to this document.

## 2.3 Implementation boundary

No implementation SHALL be considered production-authoritative until the design has passed the pre-development gates in §23.

---

# §3 Regulatory and institutional context

## 3.1 Legal floor

VibeSchool SHALL comply with applicable Kenyan data-protection, education, consumer, employment, intellectual-property, and other relevant legal requirements. Where another jurisdiction applies, its mandatory requirements SHALL be incorporated where relevant.

The controls in this document are a minimum engineering floor and MUST NOT be interpreted as legal advice or as a complete statement of applicable law.

## 3.2 Learner and child data

Learner and child data SHALL receive enhanced protection appropriate to its sensitivity, purpose, lawful basis, retention period, and applicable law.

Access MUST be purpose-bound, least-privilege, auditable, and retention-bounded.

## 3.3 Academic authority

The Academic engine SHALL maintain alignment with applicable KICD curriculum designs and KNEC assessment requirements where those requirements govern the relevant activity. The Owner retains the institutional relationship and accountability for external regulatory bodies.

## 3.4 Legal uncertainty

Where an autonomous legal workflow cannot confidently determine the applicable legal rule, identity of the requester, scope of the request, lawful basis, exemption, retention obligation, or required response, it MUST fail closed and escalate to an authorised human or Governance workflow rather than inventing a legal conclusion.

---

# §4 Trust zones

The organisation SHALL use logical trust zones even where the eventual infrastructure uses different physical services.

| Zone | Name | Principal responsibility |
|---|---|---|
| TZ0 | Principal | Owner root authority and ceremonies |
| TZ1 | Control Plane | Foundry, Governance, HR, registries |
| TZ2 | Coordination | Workroom contracts and controlled exchange |
| TZ3 | Execution | Engines, workers, lane-scoped execution |
| TZ4 | External | External providers and untrusted content |

### 4.1 Flow rules

- Downward authority MUST be represented as signed, bounded delegation.
- Upward information MUST be limited to the minimum evidence required by the receiving authority.
- TZ4 content MUST NOT itself confer authority.
- External egress carrying protected data MUST pass through approved policy and data-loss controls.

### 4.2 Trust is not transitive

A trusted identity in one lane MUST NOT automatically become trusted in another lane. Cross-lane trust MUST be explicitly granted through policy and Workroom contracts.

---

# §5 Identity and cryptographic authority

## 5.1 Hierarchy

The intended authority chain is:

```text
Owner root key
    ↓
Foundry authority
    ↓
Engine-head authority
    ↓
Task-scoped worker identity
```

## 5.2 Delegation

Every child grant MUST be a strict subset of the delegating parent's grant, subject to the prohibitions and policy constraints attached to the child role.

## 5.3 Short-lived execution credentials

Execution credentials SHOULD be short-lived and task-scoped. Long-lived execution secrets MUST NOT be used where an equivalent bounded credential mechanism exists.

## 5.4 Attestation

Privileged credentials MUST be issued only after the required identity, integrity, policy, and non-revocation checks succeed.

## 5.5 Rotation

Keys and credentials MUST have documented rotation, expiry, revocation, recovery, and compromise procedures appropriate to their tier.

## 5.6 Revocation independence

Provisioning and revocation MUST remain separate authorities. The actor that creates an identity MUST NOT be the sole authority capable of revoking it.

## 5.7 Root key custody

The Owner root authority SHALL be protected outside ordinary application execution. Root ceremonies MUST use dual control where §7 requires it and MUST produce durable evidence.

---

# §6 Constitutional invariants

A CRITICAL invariant violation MUST trigger containment and incident handling under §15.

| ID | Normative invariant | Required enforcement | Evidence | Class |
|---|---|---|---|---|
| I-01 | `grant(child) ⊂ grant(parent)` | issuance policy | signed issuance record | CRITICAL |
| I-02 | Creation only from approved blueprints | factory/registry gate | blueprint + approval evidence | CRITICAL |
| I-03 | Least privilege is frozen at hire | immutable grant | hire record | HIGH |
| I-04 | Provisioning and revocation are separated | role separation | authority records | CRITICAL |
| I-05 | No self-modification of grant, blueprint, or overseer | protected paths | change ledger | CRITICAL |
| I-06 | Unverifiable authority fails closed | default-deny policy | denial evidence | HIGH |
| I-07 | Material actions are signed and audited | audit writer | provenance chain | HIGH |
| I-08 | Live authority requires shadow certification | promotion gate | shadow report + certificate | HIGH |
| I-09 | Autonomous existence is budgeted | quota controller | cost/value record | MEDIUM |
| I-10 | Failure degrades toward Owner control | incident/break-glass path | ceremony evidence | CRITICAL |
| I-11 | Learner data is purpose-, scope-, and retention-bounded | DLP/access controls | access/retention evidence | CRITICAL |
| I-12 | Lanes are isolated at data, compute, and identity levels | policy + infrastructure gates | isolation audit | HIGH |
| I-13 | External content cannot create authority | ingestion boundary | sanitisation/provenance evidence | HIGH |
| I-14 | Governance cannot become an unreviewed operational actor | separation of duties | role audit | CRITICAL |
| I-15 | Owner fallback cannot be removed by automation | protected constitutional path | control-plane audit | CRITICAL |

---

# §7 Roles and separation of duties

| Role | MAY | MUST NOT |
|---|---|---|
| Owner / Principal | approve, veto, revoke, amend constitution | delegate away final accountability |
| Foundry | instantiate approved engines; execute approved structural changes | operate business lanes; revoke its own creations; alter its authority |
| Governance | verify, certify, veto, suspend, audit | provision engines; operate business lanes |
| HR / Workforce | workforce standards, lifecycle policy, capacity analysis | create autonomous engines outside Foundry |
| Engine-head | provision/manage approved workers within its lane | cross lane; widen grant; alter constitutional authority |
| Worker | execute approved tasks; produce evidence | provision; widen grant; bypass policy; self-certify |

## 7.1 Dual control

Two independent approvals, one of which MUST be the Owner, are REQUIRED for:

- root ceremonies;
- creation of a new engine blueprint;
- expansion of an engine's authority;
- constitutional break-glass invocation;
- bulk revocation;
- restoration of authority after a root compromise;
- any action explicitly designated dual-control by Governance.

## 7.2 No authority loops

No actor MAY hold a combination of permissions that permits it to create, approve, certify, operate, and revoke the same authority without an independent control boundary.

---

# §8 Engine model and registry

## 8.1 Engine definition

An **Engine** is a bounded autonomous subsystem with:

- a single primary mandate;
- an approved blueprint;
- an engine-head identity;
- a defined lane;
- explicit capabilities and prohibitions;
- headcount and budget limits;
- measurable outputs;
- lifecycle states;
- oversight requirements;
- recovery behaviour.

## 8.2 Foundational engines

The initial organisation SHALL define nine business engines:

1. HR / Workforce
2. Engineering & Release
3. Governance, Security & Audit
4. Academic Authority
5. Content Production
6. School Operations
7. Finance
8. Support & Communication
9. Growth & Marketing

The exact engine count MAY change only through an approved blueprint amendment.

## 8.3 Blueprint minimum schema

Every blueprint MUST specify at minimum:

- engine code and name;
- mandate and non-goals;
- owner-approved capabilities;
- explicit prohibitions;
- context/data classification;
- lane assignment;
- headcount cap;
- budget/resource cap;
- allowed external dependencies;
- required telemetry;
- lifecycle policy;
- shadow gate;
- suspension conditions;
- retirement conditions;
- recovery requirements;
- version;
- approvals;
- effective date;
- deprecation/supersession policy.

## 8.4 Registry immutability

Approved registry versions MUST be immutable. A change creates a new version; historical versions remain available for audit.

---

# §9 Context and information-flow control

## 9.1 Context classes

| Actor | Maximum routine context |
|---|---|
| Worker | current task and explicitly granted context |
| Engine-head | own lane plus own operational telemetry |
| HR | structural and performance evidence; not raw lane content by default |
| Foundry | registries and provisioning state; no routine business data |
| Governance | policy-relevant events, telemetry, and audit evidence |
| Owner | governed summaries, decisions, approvals, vetoes, and permitted evidence |

## 9.2 Minimum necessary context

An actor MUST receive the minimum context required to perform the authorised task. Convenience MUST NOT be used as a justification for broad access.

## 9.3 Upward aggregation

Operational data moving upward in the hierarchy SHOULD be aggregated unless raw evidence is necessary for investigation, legal compliance, or audit.

## 9.4 Learner data boundaries

Learner data MUST NOT be joined across lanes merely for convenience. Any cross-lane use MUST have a documented purpose, policy basis, schema, access control, retention rule, and audit trail.

---

# §10 Lanes and Workroom contracts

## 10.1 Lane definition

A lane is a bounded execution domain containing explicit data scope, compute/resource quota, budget, queue, health metrics, and identity boundary.

## 10.2 Isolation

Isolation MUST exist at the logical data, execution, and identity layers. RLS or an equivalent single control MUST NOT be treated as the sole isolation mechanism for high-impact boundaries.

## 10.3 No lateral calls

Engines MUST NOT directly invoke another engine's internal interfaces. Cross-lane work MUST use a typed Workroom contract.

## 10.4 Contract properties

A Workroom contract MUST be:

- schema validated;
- authenticated;
- authorisation checked;
- idempotency-aware;
- replay protected where required;
- SLA-bound where applicable;
- quota-aware;
- observable;
- auditable;
- dead-lettered on unrecoverable failure.

## 10.5 Backpressure

A receiving lane MUST be able to reject, delay, or throttle work when its capacity or policy limits are reached. Upstream automation MUST NOT interpret backpressure as permission to bypass the contract.

---

# §11 Lifecycle state machines

## 11.1 Worker lifecycle

```text
need
  → defined
  → approved
  → provisioned
  → onboarding / shadow
  → active
  ⇄ suspended
  → retired
```

Every transition MUST have a guard and signed audit evidence.

## 11.2 Worker promotion

A worker MUST NOT become live merely because it completed a number of tasks. The promotion gate MUST evaluate a composite evidence set including, as applicable:

- minimum shadow task count;
- performance against baseline;
- zero critical prohibition violations;
- safety and privacy checks;
- adversarial evaluation;
- cost profile;
- minimum dwell time;
- drift indicators;
- Governance certification.

Exact thresholds SHALL be defined in role templates before implementation of autonomous promotion.

## 11.3 Engine lifecycle

```text
approved blueprint
  → root / provisioning ceremony
  → provisioned
  → shadow
  → certified
  → active
  ⇄ suspended
  → retired
```

## 11.4 Retirement

Retirement MUST include credential invalidation, workload termination, queued-work disposition, data-retention handling, audit closure, and documented reason.

---

# §12 Control-loop stability

## 12.1 Hysteresis

Autonomous staffing and retirement rules MUST use distinct engagement and disengagement thresholds where oscillation is possible.

## 12.2 Minimum dwell

A new worker or engine SHOULD remain in an evaluation state for a defined minimum period unless an urgent safety or security condition requires earlier suspension.

## 12.3 Rate limiting

HR and provisioning loops MUST be rate-limited by lane and time window.

## 12.4 Anti-Goodhart controls

No single metric SHALL be sufficient to promote, retire, or expand authority. Composite evidence and periodic adversarial review are REQUIRED.

## 12.5 Drift

A previously certified worker or engine MAY be returned to shadow evaluation when behavioural, economic, security, model, dependency, or data-distribution drift exceeds an approved threshold.

---

# §13 Economic governance

## 13.1 Cost attribution

Material autonomous activity SHOULD be attributable to an identity, lane, engine, and business objective.

## 13.2 Budget controls

Budget caps MUST be enforced independently of the worker's own decision-making process.

## 13.3 Value measurement

Value MUST be measured using multiple signals appropriate to the engine. Examples include SLA completion, quality, error reduction, learner outcomes, revenue contribution, risk reduction, or verified operational hours saved.

## 13.4 Insolvency

A lane or identity that exceeds a hard budget boundary MUST enter a defined containment state. Continued operation requires an authorised exception or revised approved budget.

---

# §14 Threat model

| ID | Threat | Required control direction |
|---|---|---|
| T-01 | Prompt injection / hostile external content | content never confers authority; bounded tools; sanitised ingestion |
| T-02 | Cross-lane collusion | information-flow limits; contract-only exchange; anomaly analytics |
| T-03 | Credential theft | short-lived credentials; attestation; revocation; anomaly detection |
| T-04 | Ledger poisoning | append-only/hash-linked evidence plus independent checkpoints |
| T-05 | Shadow gaming | hidden/randomised evaluation; post-promotion drift monitoring |
| T-06 | Runaway provisioning | rate limits; caps; circuit breakers; independent Governance |
| T-07 | Contract exfiltration | schema constraints; DLP; egress policy; destination allowlists |
| T-08 | Root authority compromise | offline custody; dual control; recovery ceremony |
| T-09 | LLM/provider failure | graceful fallback for non-privileged work; fail closed for privileged work |
| T-10 | Insider/operator abuse | separation of duties; immutable evidence; anomaly detection |
| T-11 | Supply-chain compromise | dependency provenance; release controls; isolated build authority |
| T-12 | Data poisoning | source provenance; validation; anomaly detection; controlled publishing |
| T-13 | Model behaviour drift | evaluation baselines; re-certification; automatic containment thresholds |
| T-14 | Owner interface compromise | strong authentication; least privilege; independent audit; emergency revocation |

Each threat MUST map to at least one concrete enforcement control and evidence source before the relevant capability is declared production-ready.

---

# §15 Oversight, assurance, incidents, and break-glass

## 15.1 Continuous conformance

Governance MUST continuously or periodically verify constitutional invariants against authoritative evidence. Monitoring alone is insufficient; violations MUST have defined responses.

## 15.2 Red-team function

A designated adversarial capability SHOULD periodically test prompt injection, privilege escalation, cross-lane leakage, provisioning abuse, audit integrity, recovery, and Principal-interface failure.

## 15.3 Incident classes

- **S1 — Existential:** root authority, widespread compromise, material learner-data exposure, or systemic constitutional failure.
- **S2 — Lane containment:** serious breach or anomalous behaviour contained to a lane.
- **S3 — Identity:** single worker/engine suspension or material local failure.
- **S4 — Watch:** non-critical deviation requiring observation or planned remediation.

## 15.4 Break-glass

Break-glass MUST be:

- explicitly invoked;
- dual-controlled where required;
- time-boxed;
- minimally scoped;
- independently logged;
- automatically expired;
- reviewed after use.

Break-glass MUST NOT become a permanent alternative authorization path.

## 15.5 Owner fallback

When autonomous controls fail, the system MUST degrade toward human control rather than silently expanding authority or continuing under unverifiable assumptions.

---

# §16 Developer and agent directives

16.1 Agents MUST cite the governing section before proposing or executing a material authority change.

16.2 Agents MUST distinguish specification, design proposal, implementation, and verification evidence.

16.3 Agents MUST NOT “fix” an invariant by weakening the invariant. They MUST propose an amendment under §21.

16.4 Agents MUST stop and escalate when required evidence is unavailable or contradictory.

16.5 Production schema, deployment, identity, or provisioning changes are outside this specification-only phase and SHALL NOT be introduced through this document branch.

16.6 Any future implementation SHALL pass repository-specific build, migration, security, release, and recovery gates applicable at the time of implementation.

---

# §17 Observability and telemetry architecture

## 17.1 Provenance-bound tracing

Every governed external call, model inference, tool invocation, and data-plane operation MUST carry a trace context that can be cryptographically or otherwise verifiably linked to:

- the actor identity;
- worker identity where applicable;
- engine-head;
- engine and lane;
- parent action;
- policy decision;
- timestamp;
- outcome.

## 17.2 Trace integrity

Trace identifiers MUST NOT be treated as security evidence merely because they are unique. Material trace records MUST be integrity-protected and linked to authoritative audit evidence.

## 17.3 Cognitive telemetry

The organisation SHOULD measure operationally useful AI telemetry, including:

- token or equivalent inference consumption;
- latency;
- retries;
- fallback frequency;
- tool-call count;
- failure rate;
- policy-denial rate;
- human-escalation rate;
- quality/effectiveness measures.

Telemetry MUST be used to measure system behaviour, not to create hidden surveillance of protected individuals.

## 17.4 Execution value

Cost telemetry MUST be compared with execution value at the engine/lane level. No raw token count alone SHALL determine worker promotion or retirement.

## 17.5 Behavioural baselines

Governance MUST maintain expected behavioural profiles for engines and lanes. Significant deviation MAY trigger an incident before a constitutional prohibition is technically violated.

## 17.6 Observability failure

Loss or corruption of security-critical telemetry MUST be treated as a control failure. Privileged autonomous actions SHOULD fail closed when required evidence cannot be produced.

---

# §18 Business continuity and disaster recovery

## 18.1 Recovery objectives

Each critical control-plane component MUST have an approved Recovery Point Objective (RPO) and Recovery Time Objective (RTO) before production authority is granted.

## 18.2 Independent replication

The authoritative audit ledger, identity registry, blueprint registry, revocation state, and minimum recovery metadata MUST be replicated to an isolated recovery location or medium with independently protected access.

## 18.3 Recovery independence

The recovery process MUST NOT depend solely on the availability or credentials of the failed primary environment.

## 18.4 Cold-start ceremony

A deterministic recovery procedure MUST define how the Owner and authorised recovery operators:

1. establish trust from the protected root authority;
2. recover authoritative registries and audit evidence;
3. reconstruct Foundry and Governance control state;
4. verify integrity and revocation state;
5. reconcile engine state;
6. enter recovery shadow mode;
7. certify safe return to active execution.

## 18.5 Reconciliation shadow mode

After catastrophic recovery, engines MUST NOT immediately resume autonomous authority. They MUST first reconcile local state against authoritative recovery evidence.

## 18.6 Recovery drills

Critical recovery procedures MUST be exercised at least quarterly once production authority exists. Results, failures, RTO/RPO measurements, and remediation SHALL be recorded.

---

# §19 Legal automation and privacy engineering

## 19.1 Privacy-by-design

Privacy requirements MUST be considered at blueprint, role, lane, contract, data-model, retention, and interface levels rather than added after implementation.

## 19.2 Data-subject requests

The Governance function SHOULD support authenticated, auditable workflows for applicable data-subject requests, including access, correction, objection, portability, restriction, or other legally recognised rights.

A request workflow MUST verify requester identity and legal scope before releasing protected information.

## 19.3 Access packages

Where an access request is legally valid, the system SHOULD compile relevant learner-specific records across authorised lanes while:

- excluding unrelated individuals;
- protecting third-party information;
- excluding protected secrets and internal security material;
- handling legally recognised exemptions;
- preserving audit evidence.

## 19.4 Erasure and crypto-shredding

Where deletion is legally required and cryptographic erasure is an approved technical mechanism, learner-scoped encryption-key destruction MAY be used as part of the erasure procedure.

Crypto-shredding MUST NOT be described as automatically satisfying every legal erasure obligation. The workflow MUST account for lawful retention requirements, backups, immutable audit evidence, legal holds, regulatory records, and other applicable exceptions.

## 19.5 Retention

Every protected data class MUST have an approved retention rule, disposal mechanism, legal basis, and evidence of enforcement.

## 19.6 Decision ledger

Learner-affecting Academic and Support decisions SHOULD have a human-readable decision record containing, as appropriate:

- decision identifier;
- decision type;
- relevant inputs or evidence categories;
- governing policy/rule;
- outcome;
- confidence or uncertainty where meaningful;
- human override, if any;
- timestamp and responsible identity.

The decision ledger MUST NOT expose hidden chain-of-thought or proprietary internal reasoning. Explainability SHALL be based on auditable decision factors and evidence, not disclosure of private model reasoning.

## 19.7 Human escalation

High-impact learner decisions MUST have a defined human-review path where required by law, policy, safety, or institutional governance.

---

# §20 Principal interface — Executive Cockpit

## 20.1 Purpose

The Executive Cockpit is the Owner's command, approval, veto, and strategic oversight surface. It MUST present decisions and system state without requiring routine direct database administration.

## 20.2 Required views

The mature design SHALL provide, at minimum:

- systemic health;
- engine/lane status;
- resource utilisation;
- burn versus value;
- incident severity;
- pending approvals;
- veto opportunities;
- active break-glass events;
- workforce lifecycle events;
- compliance exceptions;
- recovery readiness;
- major adversarial findings.

## 20.3 Approval queue

The Owner SHOULD see a prioritised queue containing only decisions requiring Owner authority, with sufficient evidence to make the decision without inspecting raw operational tables.

## 20.4 Adversarial briefings

Governance SHOULD provide periodic summaries such as:

> “Finance exceeded its approved external-call budget because of a provider rate-limit change. The affected worker was suspended, no learner data crossed the lane boundary, and an Engineering change proposal is awaiting Owner approval.”

Such summaries MUST distinguish facts, inferences, unresolved uncertainty, and recommended actions.

## 20.5 Veto semantics

Owner veto MUST be an authoritative control-plane action, not merely a user-interface preference. A veto MUST produce durable evidence and MUST prevent the vetoed action from proceeding unless the Owner later changes the decision through an authorised process.

## 20.6 Cockpit failure

Loss of the Executive Cockpit MUST NOT remove the Owner's constitutional authority. A separate emergency control path MUST exist for critical actions.

## 20.7 No false certainty

The cockpit MUST NOT represent inferred health as confirmed health. Missing, stale, contradictory, or degraded telemetry MUST be visibly distinguished from healthy state.

---

# §21 Change management and document governance

## 21.1 Amendment authority

Constitutional or strategic amendments require Owner approval and Governance conformance review.

## 21.2 Versioning

Every approved amendment MUST increment the document version and append a changelog entry describing:

- what changed;
- why it changed;
- affected sections;
- compatibility impact;
- security/privacy impact;
- migration implications, if any;
- Owner approval evidence.

## 21.3 Waivers

Waivers MUST be:

- explicit;
- scoped;
- dual-approved where required;
- time-boxed to no more than 30 days unless the Owner explicitly approves a constitutional amendment;
- recorded;
- automatically expired.

## 21.4 No silent divergence

If implementation conflicts with this document, the conflict MUST be recorded and resolved. Code MUST NOT become the de facto constitutional authority merely because it was deployed first.

## 21.5 Quarterly review

The specification SHOULD undergo formal review at least quarterly once autonomous authority exists, and sooner after material incidents, legal changes, or architectural changes.

---

# §22 Evidence, audit, and assurance model

## 22.1 Evidence classes

The implementation design SHALL distinguish at least:

- **Identity evidence** — who acted;
- **Authority evidence** — why they were allowed;
- **Input evidence** — what governed the action;
- **Decision evidence** — which policy/rule was applied;
- **Execution evidence** — what happened;
- **Outcome evidence** — what resulted;
- **Integrity evidence** — whether the record was altered;
- **Human-control evidence** — where Owner/Governance approval was required.

## 22.2 Audit completeness

A privileged action is not considered fully evidenced merely because an application log exists. Evidence MUST be sufficient to reconstruct the relevant authority decision and execution chain.

## 22.3 Independent verification

Critical evidence SHOULD be independently verifiable by Governance without relying exclusively on the actor that produced the evidence.

## 22.4 Audit retention

Audit retention MUST follow an approved retention policy and applicable law. Security integrity records SHALL be protected from ordinary operational deletion.

---

# §23 Pre-development maturity and acceptance gates

**This section is mandatory before implementation.**

The autonomous engine system SHALL NOT move from specification to production implementation until the following gates are explicitly satisfied.

### Gate G-01 — Strategic completeness

Vision, Mission, Pillars, scope, non-goals, and bounded-autonomy doctrine are approved.

### Gate G-02 — Constitutional completeness

Roles, grants, prohibitions, invariants, revocation, lifecycle, and separation of duties are fully specified.

### Gate G-03 — Blueprint completeness

Each initial engine has a draft blueprint with mandate, non-goals, lane, data scope, capabilities, prohibitions, budget, headcount, telemetry, lifecycle, recovery, and approval requirements.

### Gate G-04 — Worker role completeness

Every intended initial worker class has an approved role template before autonomous provisioning is enabled.

### Gate G-05 — Information-flow completeness

Every cross-lane data flow has an identified purpose, contract, classification, authorisation rule, retention rule, and audit requirement.

### Gate G-06 — Enforcement mapping

Every CRITICAL and HIGH invariant maps to an enforcement point, evidence source, test strategy, and incident response.

### Gate G-07 — Threat-control mapping

Every threat in §14 maps to concrete controls and evidence.

### Gate G-08 — Recovery readiness

RPO/RTO targets, recovery authorities, offline/root procedures, replicated state, reconciliation process, and recovery drills are specified.

### Gate G-09 — Privacy/legal readiness

Data inventory, classification, lawful-purpose mapping, retention, rights workflows, legal holds, escalation, and audit requirements are specified.

### Gate G-10 — Principal control readiness

The Owner's approval, veto, suspension, incident, and emergency-control semantics are specified before autonomous authority is enabled.

### Gate G-11 — Economic readiness

Budgets, cost attribution, value measures, circuit breakers, and retirement criteria are defined.

### Gate G-12 — Operational readiness

Telemetry, health definitions, anomaly baselines, incident thresholds, and observability failure behaviour are specified.

### Gate G-13 — Documentation integrity

`docs/ENGINES.md` and its mandatory repository entry-point reference are committed, reviewed, versioned, and traceable to Owner approval.

### Gate G-14 — Implementation freeze boundary

Until G-01 through G-13 pass, implementation MAY proceed only as non-authoritative prototypes or design artefacts explicitly marked as such. No prototype may silently acquire production authority.

---

# §24 Appendices

## Appendix A — Initial blueprint registry schema

Each engine blueprint SHALL record:

```text
engine_code
engine_name
mandate
non_goals
capability_grants
prohibitions
context_class
lane
headcount_cap
budget_cap
external_dependencies
telemetry_requirements
worker_role_templates
shadow_gate
promotion_policy
suspension_policy
retirement_policy
recovery_policy
blueprint_version
status
owner_approval
approval_timestamp
deprecation_policy
```

The schema is descriptive at specification stage; implementation representation remains an engineering decision subject to this specification.

## Appendix B — Control-to-enforcement matrix

Before implementation, the project SHALL maintain a matrix with at least:

| Requirement | Enforcement point | Evidence | Test/gate | Incident response |
|---|---|---|---|---|
| I-01 | authority issuance | grant record | negative/positive tests | S1 |
| I-02 | blueprint registry/factory | approval signature | provisioning gate | S1 |
| I-06 | authorization boundary | denial record | fail-closed test | S2/S1 |
| I-07 | audit writer | provenance chain | integrity test | S1/S2 |
| I-08 | promotion gate | shadow certificate | adversarial evaluation | S2 |
| I-11 | data boundary | access/retention evidence | privacy tests | S1/S2 |
| I-12 | lane boundary | isolation evidence | isolation tests | S1/S2 |

The complete matrix SHALL be populated before implementation is declared constitution-enforcing.

## Appendix C — Glossary

- **Owner / Principal:** the human authority holding ultimate constitutional authority and accountability.
- **Foundry:** the root provisioning subsystem that instantiates approved engines.
- **Governance:** the independent oversight subsystem responsible for verification, veto, suspension, certification, and audit.
- **Engine:** a bounded autonomous subsystem with one primary mandate.
- **Engine-head:** the authority identity through which an engine acts and manages workers.
- **Worker:** a leaf identity executing approved tasks under a frozen grant.
- **Department:** the organisational unit represented by an engine.
- **Blueprint:** an Owner-approved specification governing an engine.
- **Role template:** an Owner-approved specification governing a worker class.
- **Capability:** an explicitly permitted operation.
- **Prohibition:** an explicitly forbidden operation.
- **Lane:** a bounded data, compute, identity, budget, and workload domain.
- **Provenance chain:** verifiable lineage from Owner authority through Foundry, engine, and worker to an action.
- **Shadow mode:** controlled simulation/evaluation before live authority.
- **Workroom:** the typed coordination boundary for cross-lane work.
- **Audit ledger:** append-only, integrity-protected evidence of material actions.
- **Executive Cockpit:** the Owner's command, approval, veto, and oversight interface.
- **Break-glass:** a controlled emergency authority path with explicit scope, time limits, evidence, and review.

## Appendix D — Document lifecycle

```text
Draft
  ↓
Owner review
  ↓
Governance conformance review
  ↓
Owner approval
  ↓
Versioned constitutional release
  ↓
Implementation design
  ↓
Enforcement implementation
  ↓
Verification
  ↓
Production authority
```

No step may be silently skipped.

## Appendix E — Changelog

### v1.1-draft

- Reframed the document explicitly as a pre-development specification.
- Added strategic pillar for human dignity and learner protection.
- Added explicit bounded-autonomy doctrine.
- Expanded engine and blueprint requirements.
- Expanded evidence and audit model.
- Added implementation maturity gates.
- Added RPO/RTO and recovery-readiness requirements.
- Strengthened legal-workflow uncertainty and human-escalation handling.
- Refined crypto-shredding so it is not treated as a universal legal substitute for deletion obligations.
- Refined explainability to require decision factors and evidence rather than disclosure of private chain-of-thought.
- Added cockpit integrity, uncertainty, and failure semantics.
- Added threat/control evidence requirements.
- Added explicit prohibition against production authority during the specification phase.

### v1.0

Strategic Charter + Constitution + Operational Infrastructure master specification supplied for Owner review.

---

## Final authority statement

This document defines the intended constitutional and operational architecture of the VibeSchool Autonomous Organisation. It does **not** grant authority merely by describing it. Authority becomes real only when the corresponding blueprint is approved, the enforcement mechanism exists, the required evidence can be independently verified, and the Owner has authorised the relevant lifecycle transition.

**Specification before implementation. Authority before autonomy. Evidence before trust. Human control before irreversible action.**
