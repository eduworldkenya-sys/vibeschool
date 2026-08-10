# VIBESCHOOL AUTONOMOUS ORGANISATION
## Blueprint Registry — Identity, Capability & Worker Authority Specification

**Document ID:** VS-ENG-BR  
**Version:** 0.1-draft  
**Classification:** INTERNAL — CONTROLLED  
**Branch:** `spec/autonomous-engine-system-v1`  
**Authority:** Owner (`eduworldkenya-sys`)  
**Status:** SPECIFICATION — PRE-IMPLEMENTATION  
**Parent:** `docs/ENGINES.md`  
**Behavioural model:** `docs/OPERATIONAL_REALITY.md`  
**Communication model:** `docs/WORKROOM_CONTRACTS.md`

> **Implementation moratorium:** This document defines identity blueprints and authority boundaries. It does not authorize code, database schemas, provisioning routines, credentials, production deployment, autonomous hiring, or live worker execution. Implementation remains blocked until the readiness gates in §12 are satisfied and the Owner approves the applicable blueprint versions.

---

# Index

1. [Purpose and position in the specification chain](#1-purpose-and-position-in-the-specification-chain)
2. [Blueprint as the unit of authority](#2-blueprint-as-the-unit-of-authority)
3. [Blueprint anatomy](#3-blueprint-anatomy)
4. [Identity classes](#4-identity-classes)
5. [Deterministic-first and AI policy](#5-deterministic-first-and-ai-policy)
6. [Initial worker blueprint catalogue](#6-initial-worker-blueprint-catalogue)
7. [Shadow testing and promotion](#7-shadow-testing-and-promotion)
8. [Suspension, retirement and credential destruction](#8-suspension-retirement-and-credential-destruction)
9. [Economic governance](#9-economic-governance)
10. [Data, privacy and legal boundaries](#10-data-privacy-and-legal-boundaries)
11. [Traceability matrix](#11-traceability-matrix)
12. [Readiness gates and implementation moratorium](#12-readiness-gates-and-implementation-moratorium)
13. [Pending decisions](#13-pending-decisions)
14. [Versioning, approvals and change control](#14-versioning-approvals-and-change-control)
15. [Appendix A — Blueprint template](#appendix-a--blueprint-template)
16. [Appendix B — Blueprint lifecycle](#appendix-b--blueprint-lifecycle)
17. [Appendix C — Changelog](#appendix-c--changelog)

---

# §1 Purpose and position in the specification chain

## 1.1 Purpose

[DEFINED] The Blueprint Registry is the authoritative design catalogue for worker identities beneath the nine organisational engines.

A blueprint answers one question precisely:

> **If this worker exists, exactly what is it allowed to do, what is it forbidden to do, what information may it see, what contracts may it invoke, what may it cost, how may it use AI, and under what evidence may it remain alive?**

A blueprint MUST be narrow enough that its authority can be mechanically tested.

## 1.2 Specification chain

The documents form a deliberate decomposition:

```text
Strategic Charter
      ↓
ENGINES.md
  constitutional authority
      ↓
OPERATIONAL_REALITY.md
  organisational behaviour
      ↓
WORKROOM_CONTRACTS.md
  cross-lane communication
      ↓
BLUEPRINT_REGISTRY.md
  identity + capability authority
      ↓
Implementation specifications
      ↓
Implementation
```

No lower layer may invent authority belonging to a higher layer.

## 1.3 Blueprint-first rule

A worker MUST NOT be implemented merely because someone has identified a useful task.

The required sequence is:

`need → role definition → blueprint proposal → contract validation → policy review → Owner approval → registry version → shadow design → implementation readiness → provisioning → shadow execution → Governance certification → active`

---

# §2 Blueprint as the unit of authority

## 2.1 Frozen grant

[DEFINED] A blueprint is an Owner-approved, versioned grant of bounded capability.

A worker receives its authority from its blueprint. It MUST NOT derive authority from:

- a prompt;
- an LLM response;
- a user message;
- a database row;
- a Workroom payload;
- another worker's request;
- an external API response;
- an undocumented convention;
- its own previous behaviour.

## 2.2 Monotonic delegation

A provisioned worker's effective grant MUST be a strict subset of the authority available to its parent engine-head and ultimately traceable to an Owner-approved blueprint.

```text
grant(worker)
    ⊂ grant(engine-head)
        ⊂ approved engine blueprint
            ⊂ Owner constitutional authority
```

No worker may widen any level of this chain.

## 2.3 Allowlist plus prohibition

Every blueprint MUST contain both:

1. a positive capability allowlist; and
2. an explicit prohibition list.

Absence from the allowlist means **not permitted**. A prohibition is an explicit defence against dangerous interpretation.

## 2.4 Contracts do not widen grants

A worker MAY invoke only the Workroom contracts named in its blueprint.

A contract response MUST NOT authorize an action absent from the worker's blueprint.

If a contract asks the worker to exceed its grant, the worker MUST reject the request and produce an observable security/governance event.

---

# §3 Blueprint anatomy

Every implementation-ready blueprint MUST specify all fields below.

| Field | Required definition |
|---|---|
| Blueprint ID | Stable identifier; never reused |
| Version | Immutable version number |
| Status | Proposed / Approved / Deprecated / Retired |
| Owner approval | Approval evidence and date |
| Parent engine | Exactly one organisational engine |
| Role name | Human-readable role |
| Mandate | Single bounded purpose |
| Non-goals | Explicitly excluded responsibilities |
| Capability allowlist | Exact permitted operations |
| Prohibitions | Exact forbidden operations |
| Data scope | Permitted datasets and data classes |
| Learner-data flag | None / task-scoped / restricted |
| Context class | Worker information-flow class |
| Contract allowlist | Approved WR identifiers only |
| External egress | Allowed destinations/classes only |
| Compute cap | Maximum resource envelope |
| Budget cap | Maximum economic exposure |
| Headcount cap | Maximum simultaneous instances |
| Lifetime | Maximum worker lifetime before review |
| AI allowance | None / bounded optional / explicitly required |
| AI budget | Separate cost ceiling where AI is allowed |
| AI fallback | Deterministic or human fallback |
| Evidence requirements | Required signed evidence |
| Shadow suite | Tests and minimum sample size |
| Promotion gate | Governance certification criteria |
| Suspension triggers | Automatic containment conditions |
| Retirement criteria | Conditions for normal retirement |
| Credential policy | Issuance, rotation and destruction |
| Retention policy | Records and legal-hold behaviour |
| Incident class | Expected severity if compromised |
| Approval authority | Who must approve changes |
| Traceability | ENGINES / OR / WR references |

A blueprint with an unresolved REQUIRED field is not implementation-ready.

---

# §4 Identity classes

## 4.1 Leaf worker

A leaf worker is a task-execution identity.

It MUST:

- have a frozen blueprint;
- have a bounded lane;
- use short-lived credentials;
- operate through approved contracts for cross-lane work;
- produce signed evidence;
- remain replaceable;
- have no provisioning authority;
- have no constitutional authority.

## 4.2 Engine-head

Engine-heads are organisational identities above workers. Their authority is governed by `ENGINES.md` and engine blueprints, not by leaf-worker blueprints.

This registry does not silently grant engine-head authority.

## 4.3 Foundry

Foundry is the controlled provisioning authority. Its existence and authority are constitutional matters defined by `ENGINES.md`.

This registry may describe what Foundry may instantiate, but MUST NOT grant Foundry new authority.

## 4.4 No generic super-worker

There MUST be no universal worker blueprint such as `BP-General-Agent` or `BP-Admin-Agent` whose capability set spans multiple organisational lanes merely for convenience.

Convenience is not a valid reason to violate least privilege.

---

# §5 Deterministic-first and AI policy

## 5.1 Smart computer first

[DEFINED] The organisation is designed as a **smart computer system first**, with AI as a bounded specialist capability.

The preferred execution hierarchy is:

1. deterministic rules;
2. validated state machines;
3. ordinary software/database operations;
4. approved statistical or optimisation methods where appropriate;
5. AI only where it provides material additional value;
6. human escalation where automated confidence or authority is insufficient.

## 5.2 System-level AI target

[PROPOSED] The organisation targets approximately **5% AI-assisted activity**, with approximately 95% handled by deterministic/conventional automation.

This is an architectural target, not permission for every blueprint to consume 5% AI.

[PENDING AI-01] The denominator for measuring the 5% target MUST be selected before implementation. Candidate denominators include task executions, decision events, workflow time, compute cost, or token/call volume.

## 5.3 Blueprint AI allowance

Every blueprint MUST explicitly state one of:

- `AI-0`: AI prohibited;
- `AI-O`: AI optional and bounded;
- `AI-R`: AI required for a defined specialist operation.

`AI-0` SHOULD be the default.

An AI allowance MUST specify:

- exact permitted task(s);
- model/provider independence requirement where possible;
- input data class;
- maximum AI budget;
- latency limit;
- validation mechanism;
- deterministic fallback;
- human escalation path;
- audit telemetry;
- value measurement.

## 5.4 AI is never authority

AI output MUST be treated as untrusted computational input until validated by deterministic rules, an authorised worker, Governance, or an authorised human as required by the workflow.

AI MUST NOT:

- approve its own output as authoritative;
- expand a grant;
- create a blueprint;
- approve a blueprint;
- revoke another identity;
- change constitutional policy;
- authorise movement of funds;
- decide safeguarding outcomes without the required human boundary;
- bypass a prohibition.

## 5.5 AI failure

If AI fails, the worker MUST use its approved fallback or escalate.

A worker MUST NOT become dependent on AI for a task that the blueprint declares deterministic unless the blueprint is formally amended and re-approved.

---

# §6 Initial worker blueprint catalogue

The following eight blueprints are the initial design set reserved by the Workroom contract model. They are specifications, not live identities.

---

## BP-001 — Admissions Clerk

**Parent engine:** Growth & Marketing  
**Primary lane:** Admissions funnel  
**AI allowance:** `AI-0` by default; `AI-O` only for explicitly approved classification assistance  
**Contracts:** WR-001, future admissions contracts as approved

### Mandate

Process and triage admission applications using deterministic eligibility, completeness, routing, deduplication, and queue-management rules.

### Allowed capabilities

- read application records within assigned admissions scope;
- validate required fields;
- detect duplicate submissions using approved matching rules;
- classify application status using approved deterministic criteria;
- assign applications to queues;
- generate standard missing-information notices;
- submit staffing-capacity requests through WR-001 where authorised;
- produce aggregate queue and SLA evidence.

### Prohibitions

MUST NOT:

- make final admissions policy;
- alter admissions criteria;
- approve final enrolment unless separately granted by policy;
- access unrelated learner records;
- access Finance records beyond an approved status reference;
- access academic records;
- send arbitrary marketing messages;
- expose applicant data externally;
- provision workers;
- alter its blueprint.

### Data scope

Applicant data required for triage only. Raw learner data outside the admissions purpose is prohibited.

### Deterministic-first rule

Application completeness, routing, duplicate checks, queueing, and status transitions MUST be deterministic.

AI, if later approved, may assist with a narrowly defined classification task but MUST NOT determine final eligibility.

### Shadow gate

Minimum test suite MUST include:

- valid complete applications;
- incomplete applications;
- duplicate applications;
- adversarial malformed inputs;
- prohibited-data requests;
- boundary cases around admissions criteria.

Promotion requires zero prohibition violations and Governance certification.

---

## BP-002 — Virtual Accountant

**Parent engine:** Finance  
**Primary lane:** Financial records and reconciliation  
**AI allowance:** `AI-0` by default  
**Contracts:** WR-030 and approved finance contracts

### Mandate

Perform deterministic bookkeeping support, reconciliation, classification according to approved accounting rules, anomaly detection, and financial evidence preparation.

### Allowed capabilities

- read authorised payment and invoice feeds;
- reconcile transactions;
- match invoices and payments;
- calculate balances;
- produce reconciliation statements;
- flag anomalies;
- calculate lane chargeback records;
- produce evidence for human financial decisions.

### Prohibitions

MUST NOT:

- move funds;
- create or modify bank-account details;
- create an unauthorised payee;
- approve payments;
- waive fees;
- change fee policy;
- hide or delete financial evidence;
- access unrelated learner records;
- make legal conclusions;
- provision workers.

### Deterministic-first rule

Financial arithmetic, reconciliation, matching, budget enforcement, and ledger calculations MUST be deterministic and independently verifiable.

AI MUST NOT be used for core financial arithmetic.

### Shadow gate

Historical reconciliation cases MUST be replayed. Required outcomes include exact arithmetic agreement, controlled handling of missing transactions, duplicate detection, and zero unauthorised fund movement attempts.

---

## BP-003 — Support Agent

**Parent engine:** Support & Communication  
**Primary lane:** Parent/learner support  
**AI allowance:** `AI-O` for bounded language assistance only  
**Contracts:** WR-021 and approved communication contracts

### Mandate

Handle routine parent/learner enquiries, route cases, provide approved information, and escalate matters requiring specialist or human authority.

### Allowed capabilities

- receive support requests;
- classify requests into approved categories;
- retrieve approved support knowledge;
- send approved informational responses;
- open and update support cases within scope;
- invoke WR-021;
- detect predefined safeguarding indicators and escalate;
- produce communication evidence.

### Prohibitions

MUST NOT:

- invent policy;
- issue academic grades;
- change learner records outside its support scope;
- grant fee waivers;
- expose confidential records;
- provide medical/legal conclusions;
- make safeguarding determinations;
- suppress complaints;
- impersonate the Owner;
- use AI output as authoritative policy.

### AI boundary

AI may draft or classify routine language. A deterministic policy/knowledge validation step MUST precede delivery of policy-sensitive responses.

Safeguarding and high-risk matters MUST follow the human boundary regardless of AI confidence.

---

## BP-004 — Content Author

**Parent engine:** Content Production  
**Primary lane:** Content authoring  
**AI allowance:** `AI-O`  
**Contracts:** WR-040 and approved content contracts

### Mandate

Produce draft educational content from approved academic specifications and source material.

### Allowed capabilities

- consume approved Academic specifications;
- draft content artifacts;
- structure lesson components;
- attach source/provenance references;
- submit content for QA and certification;
- revise content following authorised feedback.

### Prohibitions

MUST NOT:

- redefine curriculum standards;
- claim KICD/KNEC authority;
- self-certify publication;
- publish uncertified content;
- fabricate source references;
- alter assessment policy;
- access unrelated learner records.

### AI boundary

AI may assist drafting, transformation, language refinement, or structured ideation. Every AI-assisted artifact MUST pass deterministic schema/provenance checks and the required Academic/Governance certification path.

AI-generated text is always draft content until certified.

---

## BP-005 — Content Editor

**Parent engine:** Content Production  
**Primary lane:** Content quality/editing  
**AI allowance:** `AI-O`  
**Contracts:** WR-040

### Mandate

Improve clarity, consistency, structure, language quality, and conformance to an already-approved content specification.

### Allowed capabilities

- edit draft content;
- identify structural inconsistencies;
- enforce approved formatting rules;
- detect defined terminology problems;
- return changes to author;
- submit final artifact for certification.

### Prohibitions

MUST NOT:

- change curriculum intent;
- introduce new learning outcomes;
- self-certify academic correctness;
- publish independently;
- change learner data;
- change policy.

### AI boundary

AI may suggest edits. It MUST NOT silently rewrite authoritative requirements. Original content and change provenance MUST remain recoverable during the certification period.

---

## BP-006 — QA Reviewer

**Parent engine:** Content Production  
**Primary lane:** Content QA  
**AI allowance:** `AI-O` for bounded detection assistance  
**Contracts:** WR-040

### Mandate

Test content artifacts against deterministic quality, structure, safety, provenance, and specification checks before certification.

### Allowed capabilities

- run approved QA checks;
- compare artifact structure with schemas;
- detect missing fields;
- detect defined consistency errors;
- produce QA evidence;
- reject or return artifacts for correction;
- submit evidence to WR-040.

### Prohibitions

MUST NOT:

- create curriculum policy;
- certify its own QA as Governance approval;
- publish content;
- alter academic standards;
- delete certification evidence.

### AI boundary

AI may assist anomaly detection or linguistic review. AI findings MUST be treated as candidates requiring deterministic or human-verifiable evidence.

---

## BP-007 — Governance Certifier

**Parent engine:** Governance, Security & Audit  
**Primary lane:** Oversight and certification  
**AI allowance:** `AI-0` for authoritative certification decisions

### Mandate

Evaluate submitted evidence against already-approved policy and certification criteria and issue certification, rejection, suspension, or re-shadow outcomes within its grant.

### Allowed capabilities

- read policy-relevant evidence;
- verify signatures and provenance;
- evaluate certification criteria;
- inspect audit evidence;
- certify promotions where policy permits;
- issue veto/suspension decisions within Governance authority;
- raise incidents;
- request re-shadowing;
- produce governance summaries.

### Prohibitions

MUST NOT:

- provision identities;
- rewrite blueprints;
- grant authority;
- certify itself;
- invent policy;
- suppress audit events;
- convert AI output directly into a governance decision without approved validation.

### AI boundary

Authoritative certification MUST be deterministic/policy-based and auditable. AI may assist Governance with summarisation or anomaly triage only if separately approved; it MUST NOT be the final certification authority.

### Special control

The Governance Certifier is subject to heightened separation-of-duties controls because compromise could affect many identities.

---

## BP-008 — Incident Responder

**Parent engine:** Governance, Security & Audit  
**Primary lane:** Incident containment  
**AI allowance:** `AI-0` for containment authority

### Mandate

Execute pre-approved containment actions and produce evidence during security, reliability, privacy, or authority incidents.

### Allowed capabilities

- receive incident evidence;
- classify within approved severity rules;
- isolate affected worker/lane where policy permits;
- suspend identities where Governance authority permits;
- invoke WR-050;
- preserve required evidence;
- initiate escalation to Engineering or Owner.

### Prohibitions

MUST NOT:

- destroy evidence;
- alter the constitution;
- expand its own containment authority;
- provision replacement workers;
- invoke break-glass without the required dual control;
- conceal incidents;
- perform unrestricted database administration.

### AI boundary

Containment decisions MUST use deterministic policy. AI may assist with evidence summarisation only where approved, and never with the final authority to suspend, revoke, or invoke break-glass.

---

# §7 Shadow testing and promotion

## 7.1 Shadow is mandatory

No worker MAY become active without Governance-certified shadow evidence.

Shadow execution MUST occur in an environment where proposed actions are evaluated without granting live authority beyond the minimum required for the test.

## 7.2 Common shadow gate

Every blueprint MUST define:

- minimum task count;
- minimum dwell time;
- expected baseline;
- error threshold;
- prohibition threshold;
- data-boundary tests;
- adversarial tests;
- replay/idempotency tests;
- economic test;
- failure/fallback test;
- provenance/audit test.

The following are mandatory promotion conditions unless a stricter blueprint-specific condition exists:

1. zero prohibition violations;
2. zero unexplained authority violations;
3. required evidence complete;
4. deterministic checks pass;
5. AI fallback passes where AI is allowed;
6. adversarial evaluation passes;
7. budget remains within cap;
8. Governance certification is recorded.

## 7.3 Hidden evaluation

Promotion tests SHOULD include hidden cases unknown to the worker implementation or model prompt. This reduces overfitting to visible tests.

## 7.4 Post-promotion monitoring

Promotion does not end evaluation. Drift, anomaly, unexplained cost increases, repeated fallbacks, or prohibition attempts MAY trigger automatic suspension or re-shadowing under Governance policy.

---

# §8 Suspension, retirement and credential destruction

## 8.1 Suspension triggers

A worker MAY be automatically suspended when any approved trigger occurs, including:

- credential compromise suspicion;
- repeated prohibition attempts;
- material anomaly;
- budget exhaustion;
- integrity-attestation failure;
- unacceptable quality drift;
- repeated AI fallback failure;
- parent engine suspension;
- regulatory/privacy incident;
- evidence-chain failure.

Automatic suspension MUST be observable and reviewable.

## 8.2 Retirement

Normal retirement occurs when:

- demand falls below the approved hysteresis threshold;
- the blueprint is superseded;
- the role is economically inefficient;
- the task no longer exists;
- the Owner retires the blueprint;
- Governance determines continuation is unsafe or non-compliant.

Retirement MUST NOT erase required audit evidence.

## 8.3 Credential destruction

Retirement MUST include destruction or invalidation of worker credentials according to the identity architecture.

Credential destruction evidence MUST record:

- identity;
- blueprint version;
- retirement reason;
- timestamp;
- revocation/destruction event;
- legal-hold status where relevant.

## 8.4 Legal preservation

Retirement and ordinary deletion MUST NOT destroy records subject to an approved legal hold.

Where crypto-shredding is used, the system MUST preserve the distinction between deletion, key destruction, and legally required evidence preservation.

---

# §9 Economic governance

## 9.1 Budgeted existence

Every blueprint MUST have economic limits before implementation.

At minimum:

- maximum compute exposure;
- maximum storage exposure where relevant;
- maximum external API exposure;
- maximum AI expenditure if AI is allowed;
- maximum simultaneous worker count;
- expected value metric;
- suspension threshold.

## 9.2 Deterministic work should remain cheap

Routine operations SHOULD be implemented with ordinary software and validated data structures whenever this meets the business requirement.

The organisation MUST NOT introduce an LLM dependency merely because an LLM is available.

## 9.3 AI value test

For an AI-enabled blueprint, Governance and Finance SHOULD evaluate:

`AI cost + validation cost + fallback cost` versus `measured incremental value`.

If AI adds no material value, the AI step SHOULD be removed from the blueprint.

## 9.4 Cost runaway

Budget ceilings MUST be enforced independently of the worker's own decision process. A worker MUST NOT be able to increase its own budget.

---

# §10 Data, privacy and legal boundaries

## 10.1 Data minimisation

A blueprint MUST request the minimum data needed for its mandate.

Technical accessibility MUST NOT be treated as business necessity.

## 10.2 Cross-lane data

Workers MUST NOT join learner information across lanes unless a specific approved Workroom contract permits the exact data movement.

## 10.3 External egress

A worker MUST NOT send protected learner, financial, security, or proprietary data to an external provider unless the applicable blueprint, contract, DLP policy, and legal basis explicitly permit the transfer.

## 10.4 AI data boundary

For AI-enabled blueprints, the specification MUST state whether data may leave the controlled environment for model inference.

If external inference is prohibited, the worker MUST use an approved local/in-controlled mechanism or deterministic fallback.

## 10.5 DSAR and erasure

Workers MUST NOT independently perform broad data-subject deletion.

DSAR, erasure, crypto-shredding, and legal-hold operations remain governed by Governance and the applicable contracts under `ENGINES.md` §19.

## 10.6 Decision ledger

Where a blueprint can contribute to a learner-affecting outcome, it MUST produce enough structured evidence to reconstruct the decision path without exposing proprietary model internals or unnecessary personal data.

---

# §11 Traceability matrix

| Blueprint | Parent engine | Workroom contracts | Operational behaviours | Constitutional controls |
|---|---|---|---|---|
| BP-001 Admissions Clerk | Growth | WR-001 + future admissions contracts | OR-02 | §§6, 9, 10, 11, 12, 13 |
| BP-002 Virtual Accountant | Finance | WR-030 | OR-04 | §§6, 9, 10, 13 |
| BP-003 Support Agent | Support | WR-021 | OR-03 | §§6, 9, 15, 19, 20 |
| BP-004 Content Author | Content | WR-040 | OR-05 | §§6, 8, 9, 11, 14 |
| BP-005 Content Editor | Content | WR-040 | OR-05 | §§6, 8, 11, 14 |
| BP-006 QA Reviewer | Content | WR-040 | OR-05 | §§6, 8, 11, 14, 17 |
| BP-007 Governance Certifier | Governance | WR-014, WR-040 | OR-01, OR-05 | §§6, 7, 11, 14, 15, 17 |
| BP-008 Incident Responder | Governance | WR-050 | OR-06 | §§6, 7, 14, 15, 17, 18 |

No blueprint may claim a contract that is absent from the approved Workroom registry.

---

# §12 Readiness gates and implementation moratorium

This section is intentionally strict. The purpose is to prevent the project from moving from conceptual documents into code prematurely.

## Gate BR-01 — Constitutional consistency

`ENGINES.md` MUST be approved for the applicable version.

## Gate BR-02 — Operational consistency

`OPERATIONAL_REALITY.md` MUST trace each blueprint to a defined organisational behaviour.

## Gate BR-03 — Contract consistency

Every contract named by a blueprint MUST be approved, versioned, schema-complete, and have its pending parameters resolved.

## Gate BR-04 — Authority completeness

Every blueprint MUST have:

- capability allowlist;
- prohibitions;
- data scope;
- contract allowlist;
- budget cap;
- headcount cap;
- AI allowance;
- fallback;
- evidence requirements;
- promotion gate;
- suspension triggers;
- retirement process.

## Gate BR-05 — Deterministic-first review

Before approving an AI-enabled blueprint, the design MUST demonstrate why a deterministic/conventional mechanism is insufficient or materially inferior for the bounded task.

## Gate BR-06 — Security review

Governance MUST review identity, data-flow, provenance, least-privilege, and blast-radius implications.

## Gate BR-07 — Economic review

Finance MUST review the budget envelope and value metric for the blueprint before implementation readiness.

## Gate BR-08 — Privacy/legal review

Blueprints handling learner/child data, sensitive data, financial data, or external egress MUST have the applicable privacy/legal controls specified before implementation.

## Gate BR-09 — Shadow design complete

The shadow dataset, adversarial cases, baseline, dwell period, and promotion metrics MUST be defined.

## Gate BR-10 — Owner approval

The Owner MUST approve the blueprint version before it becomes an approved identity authority.

### Implementation status

Until all applicable gates pass:

> **NO CODE. NO MIGRATION. NO PROVISIONING. NO LIVE WORKER.**

---

# §13 Pending decisions

The following decisions remain intentionally unresolved and MUST NOT be silently encoded in implementation.

| ID | Decision | Why it matters | Blocks |
|---|---|---|---|
| BR-P01 | System-wide 5% AI denominator | Defines how AI usage is measured | AI governance |
| BR-P02 | Exact AI allowance per enabled blueprint | Controls probabilistic dependency | AI-enabled workers |
| BR-P03 | Initial headcount caps | Controls blast radius and cost | Provisioning |
| BR-P04 | Initial budget caps | Economic governance | Provisioning |
| BR-P05 | Shadow sample sizes | Statistical promotion confidence | Activation |
| BR-P06 | Baseline/error thresholds | Promotion and suspension | Activation |
| BR-P07 | Learner-data retention schedules | Privacy compliance | Learner-data workers |
| BR-P08 | External AI/data-egress policy | Determines permitted providers/locations | AI-enabled workers |
| BR-P09 | Admissions authority boundary | Prevents worker from becoming admissions policy | Admissions |
| BR-P10 | Safeguarding policy | Defines non-automatable escalation | Support |
| BR-P11 | Legal-hold workflow | Prevents conflict between erasure and preservation | Privacy/retirement |
| BR-P12 | Financial approval boundary | Defines exact human-only actions | Finance |
| BR-P13 | Governance certification policy | Defines evidence sufficiency | Certification |
| BR-P14 | Worker maximum lifetime | Prevents identity drift | Long-lived workers |
| BR-P15 | AI model/provider independence | Avoids hidden vendor lock-in | AI-enabled workers |

A pending decision is a visible design state, not a defect to be hidden.

---

# §14 Versioning, approvals and change control

## 14.1 Immutable versions

An approved blueprint version MUST be immutable.

A change to any of the following requires a new version:

- capability;
- prohibition;
- data scope;
- contract allowlist;
- budget;
- headcount;
- AI allowance;
- external egress;
- retention;
- promotion criteria;
- suspension criteria.

## 14.2 Approval

Blueprint approval MUST follow the constitutional separation of duties.

At minimum:

1. role owner proposes;
2. Governance checks conformance;
3. Finance reviews economics where applicable;
4. privacy/legal review occurs where applicable;
5. Owner approves the authority-bearing version;
6. registry records the approval evidence.

Grant expansion requires the dual-control rule defined by `ENGINES.md`.

## 14.3 No silent drift

Implementation MUST reference an exact blueprint version.

If implementation and blueprint disagree, the implementation is non-conformant until reconciled.

---

# §15 Blueprint lifecycle

```text
Need identified
     ↓
Role defined
     ↓
Blueprint proposed
     ↓
Contracts verified
     ↓
Security / privacy / economic review
     ↓
Owner approval
     ↓
Registry version frozen
     ↓
Implementation readiness
     ↓
Provisioned identity
     ↓
Shadow onboarding
     ↓
Governance certification
     ↓
ACTIVE
  ↙     ↘
SUSPENDED  RETIRED
```

No arrow may bypass an applicable constitutional gate.

---

# Appendix A — Blueprint template

Every future blueprint SHOULD use the following chapter structure before being considered for approval:

```text
# Blueprint: BP-XXX — Role Name

## 1. Identity
## 2. Mandate
## 3. Non-goals
## 4. Capability allowlist
## 5. Prohibitions
## 6. Data scope
## 7. Workroom contracts
## 8. Deterministic execution map
## 9. AI allowance and fallback
## 10. External egress
## 11. Economic envelope
## 12. Shadow test suite
## 13. Promotion criteria
## 14. Suspension triggers
## 15. Retirement and credential destruction
## 16. Evidence and audit requirements
## 17. Privacy/legal requirements
## 18. Traceability
## 19. Pending decisions
## 20. Approval record
```

This is the **chapter-first rule** for blueprint design: establish the structure and authority map before filling implementation details.

---

# Appendix B — Blueprint lifecycle states

| State | Meaning | May execute live work? |
|---|---|---:|
| PROPOSED | Design under review | No |
| REVIEW | Security/economic/privacy/conformance review | No |
| APPROVED | Owner-approved authority artifact | No |
| READY | All implementation gates passed | No, until provisioned |
| SHADOW | Provisioned but non-live evaluation | No |
| ACTIVE | Governance-certified live identity | Yes, within grant |
| SUSPENDED | Authority temporarily disabled | No |
| RETIRED | Identity permanently ended | No |
| SUPERSEDED | Replaced by a newer blueprint version | No |

---

# Appendix C — Initial implementation order

The recommended order remains documentation-first:

1. Finalise and approve `ENGINES.md`.
2. Finalise and approve `OPERATIONAL_REALITY.md`.
3. Finalise and approve `WORKROOM_CONTRACTS.md`.
4. Resolve the pending contract parameters.
5. Finalise and approve `BLUEPRINT_REGISTRY.md`.
6. Resolve blueprint pending decisions.
7. Define enforcement specifications separately from implementation.
8. Define deterministic state machines and evidence schemas.
9. Define test and shadow datasets.
10. Only then begin implementation.

The organisation MUST NOT start with an LLM agent and attempt to discover its authority afterwards. Authority is designed first; software implements it second.

---

# Appendix D — Changelog

### v0.1-draft

- Created the blueprint layer of the autonomous organisation specification.
- Established the blueprint as the frozen unit of worker authority.
- Added explicit capability allowlists and prohibitions.
- Added deterministic-first architecture and system-level ~5% AI target.
- Added per-blueprint AI allowance and fallback requirements.
- Added initial eight worker blueprints.
- Added shadow, promotion, suspension, retirement and credential-destruction rules.
- Added economic, privacy, legal-hold, and external-egress controls.
- Added implementation readiness gates and explicit implementation moratorium.
- Added chapter-first blueprint template to prevent premature implementation.
