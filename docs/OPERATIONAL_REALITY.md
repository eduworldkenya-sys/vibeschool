# VIBESCHOOL AUTONOMOUS ORGANISATION
## Operational Reality — How the Organisation Behaves

**Document ID:** VS-ENG-OR  
**Version:** 0.1-draft  
**Classification:** INTERNAL — CONTROLLED  
**Branch:** `spec/autonomous-engine-system-v1`  
**Authority:** Owner (`eduworldkenya-sys`)  
**Status:** SPECIFICATION — no implementation authority is conferred by this document.

> **Document relationship:** `ENGINES.md` is the constitutional authority. This document is the behavioural model derived from that constitution. It describes operational reality but does not grant authority. Downstream contracts and blueprints must make each behaviour implementable before development begins.

## §0 Content classes and governing rules

0.1 Every statement in this document carries one class:

- **[DEFINED]** — structural fact fixed by `ENGINES.md`.
- **[DERIVED]** — behaviour that necessarily follows from the constitution.
- **[ILLUSTRATIVE]** — worked example demonstrating behaviour; confers no authority.
- **[PENDING]** — decision reserved for future policy or blueprint approval.
- **[FUTURE]** — placeholder identifier for a downstream contract or blueprint not yet specified.

0.2 Describing authority does not grant authority. A scenario becomes implementable only after its authority, contract, identity, data scope, budget, evidence requirements, and failure behaviour are specified in `WORKROOM_CONTRACTS.md` and `BLUEPRINT_REGISTRY.md`.

0.3 Precedence is `ENGINES.md` > this document > downstream specifications. Conflicts resolve upward and never silently.

0.4 Dependency chain:

`Strategic Charter → Constitution → Operational Reality → Workroom Contracts → Blueprint Registry → Implementation`

## §1 Purpose and relationship to ENGINES.md

1.1 [DEFINED] `ENGINES.md` is the constitutional authority; this document is the behavioural model of the organisation operating under that authority.

1.2 [DEFINED] Every behaviour described here MUST trace backward to a constitutional section and forward to a future contract and blueprint where implementation is intended.

1.3 [DEFINED] **Implementation moratorium:** no code, migration, provisioning logic, live worker, or production authority MAY be created solely because this document describes a behaviour.

1.4 [DERIVED] Operational descriptions MUST preserve bounded autonomy: engines may execute within granted authority but MUST NOT acquire constitutional sovereignty.

## §2 Institutional anatomy

2.1 [DEFINED] The autonomous organisation is a digital operational model of a fully staffed school headquarters. Nine engines provide the principal business and control functions.

| Engine | Owns | Inputs | Outputs | Explicitly does NOT own |
|---|---|---|---|---|
| HR/Workforce | Workforce standards, cross-department lifecycle, capacity planning | Lane health, performance evidence | Standards, lifecycle decisions, staffing requests | Engine provisioning, lane execution, unrestricted revocation |
| Engineering & Release | Build/test/migrations/deploy/monitoring/repair and protected release boundary | Repository state, gates, incidents | Releases, fixes, engineering evidence | Business policy, workforce provisioning, curriculum authority |
| Governance, Security & Audit | Conformance verification, promotion certification, veto/suspension, audit integrity, privacy workflows | Auditable evidence under approved policy | Certifications, vetoes, suspensions, assurance summaries | Provisioning, lane execution, unrestricted operational streams |
| Academic Authority | CBC/KICD/KNEC mapping, assessment design, grading standards, outcome certification | Curriculum sources, learner evidence | Rubrics, standards, certified outcomes | Content mechanics, scheduling, fee policy |
| Content Production | Authoring, editing and publishing pipelines | Academic rubrics and standards | Draft and published content artifacts | Curriculum authority, certification authority, distribution policy |
| School Operations | Timetabling, attendance, records and term-calendar operations | Enrolment, attendance feeds, institutional calendar | Schedules, records, operational triggers | Academic standards, fee policy, content authority |
| Finance | Bookkeeping, invoicing, reconciliation and autonomous-workforce chargeback accounting | Payment feeds, lane burn data | Reconciliations, invoices, budget signals | Fee-policy setting, fund movement, academic gating unless separately granted by approved policy |
| Support & Communication | Parent/learner communication, call-centre operations, escalation handling | Enquiries, certified outputs | Responses, escalations, communication records | Grading, fee waivers, unredacted cross-lane learner data |
| Growth & Marketing | Campaigns and admissions funnel operations | Market and capacity signals | Campaigns, applications, funnel telemetry | Admissions criteria authority, final enrolment authority, learner data beyond approved funnel scope |

2.2 [DEFINED] The Owner and Foundry sit above the lane anatomy. Governance and HR are control-plane functions with authority defined exclusively by `ENGINES.md`.

2.3 [DEFINED] Engine ownership is not equivalent to unrestricted data ownership. Each engine receives only the context required by its grant and lane.

## §3 Organisational control loop

3.1 [DERIVED] An autonomic operational loop follows the sequence below. Each privileged transition MUST produce signed evidence.

| Step | Primary actor | Gate / evidence |
|---|---|---|
| Observe | Lane / worker telemetry | Trace-linked records |
| Detect | Responsible engine; HR/Governance where required | Hysteresis, dwell and anomaly policy |
| Decide | Engine-head within grant; otherwise escalation | Signed decision record |
| Request | Responsible engine through Workroom | [FUTURE WR-001 Staffing Request] or applicable contract |
| Provision | Foundry / approved factory routine | Blueprint version, approval and issuance evidence |
| Shadow | Provisioned worker or engine | Controlled evaluation report |
| Certify | Governance | Promotion/certification record |
| Execute | Worker within frozen allowlist | Action evidence and provenance |
| Measure | Engine + Governance telemetry | Quality, SLA and burn/value evidence |
| Retire | Approved lifecycle authority | Credential destruction and retirement evidence |

3.2 [DERIVED] No step may silently bypass an earlier mandatory gate.

3.3 [DERIVED] A failed gate produces containment or escalation rather than an implicit waiver.

## §4 Operational choreography

All sequences in this section are **[ILLUSTRATIVE]**. They demonstrate possible institutional behaviour and confer no authority. Any implementation requires corresponding policy, contract and blueprint approval.

### OR-01 — End-of-Term Assessment

[ILLUSTRATIVE] School Operations detects the term-end milestone and issues an approved Workroom request. Academic Authority defines the assessment rubric and standards. Content Production compiles approved assessment instruments. Approved workers administer or process assessments within their grants. Governance evaluates auditable grading evidence against an approved certification policy. Certified outputs proceed to report preparation and Support dispatches them through approved communication channels.

**Boundary:** Governance evaluates evidence; it does not receive unrestricted execution-stream authority merely because this scenario exists.

**Pending policy:** withholding report release because of fee status is a business-policy question, not an implied Finance authority. If adopted, it MUST be separately approved, legally reviewed, and represented in the relevant policy, contract and blueprint.

### OR-02 — Admissions Surge

[ILLUSTRATIVE] Growth produces a sudden increase in applications. Operations telemetry detects queue/SLA pressure. HR determines whether the evidence satisfies the staffing policy. A staffing request is submitted through Workroom. Foundry provisions only from an approved blueprint. New workers perform shadow evaluation, Governance certifies them, and active workers process the bounded queue. When demand falls below the retirement threshold, lifecycle policy evaluates retirement.

### OR-03 — Learner-Support Escalation

[ILLUSTRATIVE] Support triages an enquiry. If another lane is required, the request crosses the boundary only through an approved Workroom contract. Safeguarding indicators follow the approved safeguarding escalation policy and may require immediate human control.

### OR-04 — Financial Reconciliation

[ILLUSTRATIVE] Finance consumes approved payment feeds, reconciles records, produces exception evidence and raises material anomalies to Governance. Fund movement remains outside ordinary autonomous authority unless separately approved under dual-control policy.

### OR-05 — Curriculum and Content Production

[ILLUSTRATIVE] Academic Authority maps curriculum requirements and creates approved content requirements. Content Production authors artifacts. QA workers evaluate against approved criteria. Governance certifies the evidence required by publication policy. Publication occurs only after all applicable gates pass.

### OR-06 — Incident Response

[ILLUSTRATIVE] Telemetry or a policy control detects anomalous behaviour. The incident is classified S1–S4. Containment occurs within the affected lane where possible. Break-glass is used only under its constitutional ceremony. Recovery and post-hoc review produce evidence for Governance and the Owner.

## §5 Autonomic reflexes

5.1 [DERIVED] **Scaling:** scaling decisions use hysteresis, minimum dwell, per-window caps and budget ceilings.

5.2 [DERIVED] **Degradation:** non-critical services MAY reduce capability under stress; privileged operations MUST fail closed when authorization or evidence cannot be established.

5.3 [DERIVED] **Suspension:** anomaly, insolvency, credential risk or constitutional violation MAY trigger automatic containment according to policy. Governance retains certification and oversight authority.

5.4 [DERIVED] **Recovery:** disaster recovery follows the cold-start and reconciliation-shadow process defined in `ENGINES.md` §18.

5.5 [DERIVED] **Retirement:** retirement is evidence-based and includes credential destruction plus retention-bounded archival treatment.

5.6 [DERIVED] Autonomic reflexes MUST NOT modify constitutional grants, blueprints or policy merely to satisfy operational pressure.

## §6 Human intervention boundaries

6.1 [DEFINED] The following remain human-controlled and MUST NOT become ordinary autonomous actions: root ceremonies; blueprint approval; grant expansion; break-glass invocation; bulk revocation; movement of funds; safeguarding decisions where policy requires human judgment; regulatory submissions where legally reserved; constitutional amendments; and strategic veto.

6.2 [DERIVED] Legal or policy uncertainty follows the sequence: **fail closed → preserve evidence → escalate to the appropriate human authority**.

6.3 [DEFINED] Human control is not an exception to the system. It is the terminal safety state required by bounded autonomy.

## §7 Data movement

7.1 [DEFINED] Downward information or authority flow is signed delegation only; upward flow is aggregated evidence except where a specifically approved legal/privacy workflow requires bounded subject-data retrieval.

7.2 [DEFINED] Cross-lane learner-data movement occurs only through typed contracts and applicable DLP controls at TZ2.

7.3 [DEFINED] Learner data is task-scoped, retention-bounded and handled according to the applicable privacy policy and legal basis.

7.4 [DEFINED] TZ4 egress passes through allowlisted gateways and applicable DLP inspection.

7.5 [DERIVED] A successful technical block does not make an attempted prohibited access irrelevant. Repeated or materially anomalous blocked access can itself become Governance telemetry and an incident signal.

## §8 Workroom dependency model

8.1 [DEFINED] Engines declare cross-lane dependencies exclusively as Workroom contracts. Direct lateral calls are prohibited.

8.2 [DEFINED] A contract MUST eventually specify, at minimum: purpose, producer, consumer, request schema, response schema, identity requirements, data classification, authorization conditions, SLA, timeout, retry semantics, idempotency, replay protection, quota charging, DLP requirements, dead-letter behaviour, evidence requirements and failure escalation.

8.3 [FUTURE] Contract identifiers use `WR-xxx` and are allocated only in `WORKROOM_CONTRACTS.md`.

8.4 [DERIVED] A scenario naming a contract placeholder does not imply that the contract exists.

## §9 Identity and provenance movement

9.1 [DEFINED] Identity issuance flows downward through the approved authority chain and requires attestation and non-revocation checks.

9.2 [DEFINED] Revocation authority is separate from ordinary provisioning authority.

9.3 [DEFINED] Every privileged action carries a provenance chain linking the actor to its engine-head and Foundry lineage.

9.4 [DERIVED] Retirement destroys or invalidates execution credentials according to the approved credential-destruction procedure and preserves the necessary audit evidence.

## §10 Economic movement

10.1 [DERIVED] Resource consumption is attributable from worker to lane to engine and ultimately to the organisation's economic governance model.

10.2 [DERIVED] Budgets and quotas flow downward as constraints; burn/value evidence flows upward for governance.

10.3 [DEFINED] Finance accounts for autonomous-workforce economics but does not thereby acquire authority to change operational policy.

10.4 [DERIVED] Cost pressure MAY trigger suspension or retirement only through approved lifecycle rules; economic optimization cannot override safety, privacy or constitutional requirements.

## §11 Telemetry movement

11.1 [DERIVED] Raw operational telemetry remains lane-local unless a policy explicitly permits controlled transfer.

11.2 [DEFINED] Aggregated evidence flows to HR and Governance according to their context boundaries.

11.3 [DEFINED] The Executive Cockpit receives synthesized governance summaries and decision-relevant evidence rather than requiring the Owner to inspect raw database tables or unrestricted telemetry.

11.4 [DERIVED] Telemetry must be sufficient to reconstruct material privileged actions without becoming an unrestricted surveillance channel across lanes.

## §12 Failure propagation and containment

12.1 [DERIVED] Lane isolation bounds the blast radius of an engine or worker failure.

12.2 [DERIVED] Contract failures are retried only according to the contract's retry policy and otherwise dead-lettered with evidence.

12.3 [DERIVED] Backpressure, quotas and circuit breakers prevent local demand from becoming uncontrolled cross-lane amplification.

12.4 [DERIVED] Incidents are classified S1–S4 and handled according to the incident policy in `ENGINES.md` §15.

12.5 [DERIVED] The terminal fallback for an unresolved privileged failure is human control.

## §13 Example end-to-end scenarios

These scenarios are [ILLUSTRATIVE] and confer no authority.

### S-A — Admissions surge

5,000 applications in 24 hours → queue/SLA deviation → HR evaluates capacity → approved staffing request → Foundry provisions from an approved Admissions Clerk blueprint → shadow evaluation → Governance certification → bounded execution → retirement when the approved economic/lifecycle thresholds are met.

### S-B — Assessment anomaly

Assessment processing produces a grading distribution outside its approved baseline → Governance receives the required evidence → certification is withheld or re-shadowing is triggered → no silent release occurs.

### S-C — Blocked cross-lane access attempt

A Finance worker attempts an unauthorized Support-lane query → the data control blocks access → the attempt is preserved as telemetry → Governance evaluates whether the deviation meets incident criteria → containment or investigation follows.

## §14 Constitutional perimeter

14.1 [DEFINED] **Pedagogical edge:** engines may operate against approved curriculum authorities and standards but MUST NOT autonomously redefine constitutional curriculum authority or authoritative external standards.

14.2 [DEFINED] **Financial edge:** autonomous accounting and reconciliation do not imply autonomous authority to move funds or alter bank-account control data. Such actions require separately approved human-controlled procedures.

14.3 [DEFINED] **Privacy edge:** DSAR and erasure workflows may be automated only within approved legal/privacy policies. Crypto-shredding is a proposed technical control that requires a verified implementation design and must not be assumed to satisfy every legal retention or preservation obligation.

14.4 [DEFINED] **Constitutional edge:** no engine, worker, contract or automated workflow may amend the constitution.

14.5 [DERIVED] Operational success never expands constitutional authority.

## §15 Operational invariants

- **OR-I-01:** Every cross-lane action MUST occur through an approved contract.
- **OR-I-02:** Every privileged control-loop transition MUST produce signed audit evidence.
- **OR-I-03:** No scenario or example confers authority.
- **OR-I-04:** Required certification MUST precede production execution.
- **OR-I-05:** Upward operational context MUST remain aggregated except for explicitly approved legal/privacy workflows.
- **OR-I-06:** Autonomic scaling and retirement MUST use hysteresis, dwell and caps.
- **OR-I-07:** Human safety boundaries MUST remain explicit and enforceable.
- **OR-I-08:** Retirement MUST include credential invalidation/destruction and retention-bounded evidence handling.
- **OR-I-09:** Operational pressure MUST NOT justify grant widening, policy mutation or constitutional bypass.
- **OR-I-10:** A blocked action that materially indicates anomalous behaviour MUST remain observable to the appropriate oversight function.

## §16 Unresolved decisions requiring future approval

The following are intentionally unresolved and MUST be settled before the relevant behaviour becomes implementable:

- **P-01:** Fee-gating of report release; legal and policy review required.
- **P-02:** Safeguarding escalation policy and human response obligations.
- **P-03:** Admissions criteria authority and final enrolment authority.
- **P-04:** Grading certification evidence policy and Governance data visibility.
- **P-05:** Retention schedules, recovery objectives and legal preservation requirements.
- **P-06:** Headcount, compute and budget caps per lane.
- **P-07:** DSAR scope, identity verification and redaction rules.
- **P-08:** Explainability depth and the boundary between decision evidence and private model reasoning.
- **P-09:** Communication-script authority and escalation thresholds.
- **P-10:** Fee-waiver authority and human approval requirements.
- **P-11:** Exact definitions of lane health, value, anomaly and insolvency thresholds.
- **P-12:** Human escalation coverage, response SLAs and emergency contact/ceremony procedures.

## §17 Traceability matrix

| Behaviour | Constitutional basis | Future contract | Future blueprints |
|---|---|---|---|
| OR-01 Assessment | `ENGINES.md` §§10, 11, 17 | [FUTURE WR-014 Assessment Certification] | [FUTURE BP-Academic Worker], [FUTURE BP-Content Worker], [FUTURE BP-Governance Certifier] |
| OR-02 Admissions surge | `ENGINES.md` §§6, 11, 12 | [FUTURE WR-001 Staffing Request] | [FUTURE BP-Admissions Clerk] |
| OR-03 Support escalation | `ENGINES.md` §§6, 9, 15 | [FUTURE WR-021 Escalation] | [FUTURE BP-Support Agent] |
| OR-04 Financial reconciliation | `ENGINES.md` §§7, 13, 15 | [FUTURE WR-030 Reconciliation] | [FUTURE BP-Virtual Accountant] |
| OR-05 Content production | `ENGINES.md` §§8, 11, 14 | [FUTURE WR-040 Publication Certification] | [FUTURE BP-Author], [FUTURE BP-Editor], [FUTURE BP-QA Reviewer] |
| OR-06 Incident response | `ENGINES.md` §§14, 15 | [FUTURE WR-050 Incident Containment] | [FUTURE BP-Responder] |

## §18 Readiness boundary before downstream design

18.1 [DEFINED] `WORKROOM_CONTRACTS.md` MUST NOT be treated as an implementation specification until each contract has a corresponding operational scenario, constitutional authority, data classification, identity requirements, evidence model and failure policy.

18.2 [DEFINED] `BLUEPRINT_REGISTRY.md` MUST NOT be treated as a worker provisioning specification until each role has an approved mandate, capability allowlist, prohibition set, context class, budget/headcount limits, lifecycle policy, evidence requirements and approval record.

18.3 [DERIVED] Any unresolved decision in §16 that materially affects a contract or blueprint MUST block implementation of that dependent capability until resolved or formally waived under `ENGINES.md` §21.

18.4 [DERIVED] The objective of this document is decomposition, not premature implementation. Future development SHOULD translate stable specifications rather than invent operational semantics inside code.

## §19 Change history

| Version | Status | Change |
|---|---|---|
| 0.1-draft | Specification | Initial operational reality model: institutional anatomy, control loop, choreography, autonomic reflexes, human boundaries, data/telemetry/economic movement, failure containment, scenarios, invariants and traceability. |
