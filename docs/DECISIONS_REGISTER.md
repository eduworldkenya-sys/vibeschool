# VIBESCHOOL AUTONOMOUS ORGANISATION
## Decisions Register — Closure, Dependencies & Readiness

**Document ID:** VS-ENG-DR  
**Version:** 0.2-draft  
**Classification:** INTERNAL — CONTROLLED  
**Branch:** `spec/autonomous-engine-system-v1`  
**Authority:** Owner (`eduworldkenya-sys`)  
**Status:** SPECIFICATION — decision register only; confers no implementation authority.

---

## §0 Index

1. Purpose and governing principle
2. Decision classes and maturity states
3. Decision authority and closure rules
4. Architectural doctrine: deterministic computer first
5. AI governance doctrine: bounded 5% specialist use
6. Dependency and blocking model
7. Decision register
8. Priority closure sequence
9. Propagation and document synchronization
10. Readiness gates before implementation
11. Documentation engineering standard
12. Traceability and audit requirements
13. Change control
14. Open work items

---

## §1 Purpose and governing principle

### 1.1 [DEFINED]
This register is the authoritative worklist for unresolved architectural, authority, legal, economic, technical, data, and AI decisions required to mature the autonomous-organisation specification before implementation.

### 1.2 [DEFINED]
An unresolved decision MUST NOT be silently resolved in code, database policy, infrastructure configuration, worker prompt, or operational convention.

### 1.3 [DEFINED]
A decision is not considered closed merely because a recommendation exists. Closure requires an explicit authority decision recorded under §3.

### 1.4 [DERIVED]
The specification chain is:

**Strategic intent → Constitution → Operational reality → Contracts → Blueprints → Decisions → Enforcement specification → State/data models → Implementation → Verification.**

Where a decision affects an earlier document, the earlier document MUST be amended before dependent implementation begins.

### 1.5 [DEFINED]
This register does not itself grant authority to any engine, worker, contract, blueprint, AI model, or automation routine.

---

## §2 Decision classes and maturity states

### 2.1 Decision classes

Every decision MUST have at least one class:

- **AUTHORITY** — who may decide, approve, veto, delegate, revoke, or execute.
- **LEGAL** — statutory, regulatory, safeguarding, privacy, retention, or legal-hold obligations.
- **DATA** — data scope, classification, residency, retention, deletion, redaction, or information flow.
- **ECONOMIC** — budgets, quotas, unit economics, value thresholds, and resource ceilings.
- **TECHNICAL** — reliability, SLA, replay, state, recovery, or enforcement parameters.
- **AI** — where AI is permitted, prohibited, required, measured, or reclassified.
- **OPERATIONAL** — workflow, escalation, service-level, human-control, and lifecycle behaviour.

### 2.2 Maturity states

- **OPEN** — unresolved and potentially blocking.
- **PROPOSED** — a recommended position exists but has not been approved.
- **DECIDED** — authorised decision recorded with date and authority basis.
- **PROPAGATING** — decision is closed but dependent documents have not yet all been amended.
- **VERIFIED** — decision and all required propagation have passed conformance review.
- **SUPERSEDED** — replaced by a later decision; retained for historical traceability.

### 2.3 Blocking rule

An **OPEN** or **PROPOSED** decision MUST block any implementation work that depends materially upon it. A non-blocking decision MAY remain open only when its dependency analysis explicitly proves that implementation cannot be affected.

---

## §3 Decision authority and closure rules

### 3.1 Minimum closure record

A decision MAY be marked **DECIDED** only when the record contains:

1. Decision ID.
2. Final decision text.
3. Decision class.
4. Decision owner/authority.
5. Date of approval.
6. Authority basis — constitutional clause, policy, law, or approved strategic directive.
7. Affected documents and sections.
8. Effective version/date.
9. Whether the decision changes an existing grant, prohibition, contract, blueprint, or data boundary.
10. Required verification evidence.

### 3.2 Constitutional changes

Any decision that expands constitutional authority, expands a grant, weakens a prohibition, changes a trust boundary, or permits previously prohibited AI use MUST receive dual control: Owner + Governance.

### 3.3 Safety ratchet

Governance MAY move an AI classification or operational permission toward a safer/restricted state without Owner approval where the action does not expand authority. Such changes MUST be recorded and propagated.

### 3.4 Legal uncertainty

Where a decision has material legal uncertainty, the system specification MUST NOT invent a legal conclusion. The item remains blocked pending appropriate human/legal determination.

---

## §4 Architectural doctrine — deterministic computer first

### 4.1 [DEFINED]
Vibeschool is not designed as an LLM-operated company. It is designed as a **smart deterministic computer with bounded specialist intelligence**.

### 4.2 [DEFINED]
The default execution mechanism MUST be conventional software, rules, state machines, queues, databases, validators, schedulers, policy engines, cryptographic controls, and other deterministic mechanisms appropriate to the task.

### 4.3 [DEFINED]
AI is a capability class, not an authority class. An AI output MUST NOT acquire authority merely because a model generated it.

### 4.4 [DERIVED]
The preferred execution pattern is:

**Observe → classify → deterministic rule/lookup → execute → verify → record.**

AI is inserted only where the task genuinely benefits from probabilistic language or cognitive interpretation:

**Observe → deterministic boundary → bounded AI specialist → deterministic validation → execute/fallback → record.**

### 4.5 [DEFINED]
The system MUST NOT use an LLM for a task that can be performed reliably by a deterministic mechanism without material loss of required capability.

Examples include:

- arithmetic;
- ledger posting rules;
- permission checks;
- identity validation;
- quota enforcement;
- replay detection;
- state transitions;
- scheduling against explicit constraints;
- schema validation;
- cryptographic verification;
- threshold calculations;
- database lookups;
- contract routing;
- suspension and revocation enforcement.

### 4.6 [DERIVED]
This doctrine is intended to make the organisation resilient if every AI provider becomes unavailable. Core institutional operations MUST have deterministic continuation or explicit human escalation wherever practicable.

---

## §5 AI governance doctrine — bounded 5% specialist use

### 5.1 AI classes

#### AI-0 — Prohibited

AI MUST NOT influence the authoritative action.

Initial classes include:

- provisioning;
- grant issuance or expansion;
- revocation;
- authoritative certification;
- financial posting authority;
- movement of funds;
- containment decisions;
- constitutional interpretation;
- security-policy overrides.

AI may be used only for non-authoritative observation or summarisation if that use is separately permitted and cannot influence the protected decision.

#### AI-O — Optional and bounded

AI MAY assist with a defined sub-operation such as:

- summarisation;
- draft generation;
- language normalisation;
- inconsistency detection;
- classification of unstructured text.

The output MUST pass deterministic validation before it can influence an operational action.

#### AI-R — Required specialist

AI MAY be designated as the required mechanism for a narrowly defined operation where deterministic rules cannot adequately perform the task, such as interpretation of free-form natural-language communication.

AI-R MUST have:

- explicit input boundary;
- explicit output schema;
- deterministic validation;
- fallback behaviour;
- failure escalation;
- separate cost/latency telemetry;
- quality monitoring;
- prohibited-output handling.

### 5.2 The 5% principle

The strategic target is that **AI-influenced operational actions SHOULD remain at or below 5% of executed operational actions per calendar month**.

The 5% value is initially a **governance ceiling/target rather than a constitutional mathematical invariant**. The exact denominator, treatment of compound workflows, and measurement methodology remain subject to D-017.

A breach MUST trigger Governance review and explanation. It MUST NOT automatically cause system failure unless a later approved policy explicitly makes it a hard limit.

### 5.3 AI allowance is per identity and per task

Every blueprint that permits AI MUST state:

- AI class;
- permitted operation;
- maximum AI-influenced actions;
- applicable task types;
- model/provider independence requirements;
- deterministic validator;
- fallback;
- telemetry fields;
- escalation condition.

An identity MUST NOT receive a general-purpose "AI allowance" that can be spent arbitrarily.

### 5.4 AI failure principle

Loss of AI availability MUST degrade only the bounded specialist function. It MUST NOT silently convert AI failure into unrestricted human-like authority.

Where no deterministic fallback exists, the task MUST stop or escalate to the defined human authority.

### 5.5 Reclassification

Moving a task:

**AI-0 → AI-O** or **AI-0 → AI-R**

is grant-affecting and requires dual control.

Moving:

**AI-O/AI-R → AI-0**

is a safety restriction and MAY be enacted by Governance, with immediate register entry and propagation.

---

## §6 Dependency and blocking model

### 6.1 [DEFINED]
The organisation MUST NOT advance simply because a document exists. Advancement requires its dependencies to be **decided, propagated, and verified**.

### 6.2 Current dependency chain

| Layer | Artifact | Readiness condition |
|---|---|---|
| Strategy | Strategic Charter | Owner-approved |
| Constitution | `ENGINES.md` | Constitutional invariants defined |
| Behaviour | `OPERATIONAL_REALITY.md` | Authority-safe scenarios defined |
| Communication | `WORKROOM_CONTRACTS.md` | Initial contracts and schemas frozen |
| Identity | `BLUEPRINT_REGISTRY.md` | Contracts approved; grant boundaries resolved |
| Decisions | `DECISIONS_REGISTER.md` | Blocking decisions closed and propagated |
| Enforcement | Future enforcement specification | All dependent authority/data/economic rules closed |
| State | Future state/data model | Enforcement rules frozen |
| Implementation | Code | All prerequisite readiness gates verified |

### 6.3 Creation-engine readiness

The worker-creation engine MUST remain non-implementable until all decisions that affect:

- blueprint authority;
- headcount caps;
- budget caps;
- provisioning contracts;
- attestation;
- shadow gates;
- AI allowance;
- suspension;
- retirement;
- legal hold;
- credential destruction

are DECIDED and VERIFIED.

---

## §7 Decision register

| ID | Decision | Class | Blocks | Current recommendation | Authority | Status |
|---|---|---|---|---|---|---|
| D-001 | Fee-gating of report release | Legal / Authority | OR-01; report workflows | Statutory learner records MUST NOT be withheld solely for debt; any commercial gating requires separate legal/policy review | Owner + legal | OPEN |
| D-002 | Safeguarding escalation | Legal / Authority | WR-021; BP-003 | Worker detects/routes; worker MUST NOT determine safeguarding outcome; immediate human escalation | Owner + legal | OPEN |
| D-003 | Admissions criteria authority | Authority | WR-003; BP-001 | Criteria are versioned policy artifacts; Owner approves; engines execute only | Owner | OPEN |
| D-004 | Call-centre script authority | Authority | BP-003 | Scripts are versioned policy artifacts; deviation requires explicit escalation | Owner | OPEN |
| D-005 | Fee-waiver authority | Authority / Economic | BP-002; BP-003 | Pre-approved rule classes only; discretionary waiver requires dual control | Owner | OPEN |
| D-006 | Certification evidence policy | Authority / Technical | WR-014; WR-040; BP-007 | Fixed evidence bundle; raw learner streams prohibited; policy changes dual-control | Owner + Governance | OPEN |
| D-007 | DSAR redaction | Legal / Data | §19; Support workflows | Expose learner-specific state required by law; redact only protected categories defined by policy | Owner + legal | OPEN |
| D-008 | Legal hold vs deletion/shredding | Legal / Data | Erasure; retirement | Legal-hold registry; active hold suspends destructive deletion; release requires authorised human action | Owner + legal | OPEN |
| D-009 | Retention and DR objectives | Legal / Technical | DR; retirement | Retention schedules must be legally approved; RTO/RPO must be approved from actual service criticality | Owner + legal | OPEN |
| D-010 | Explainability depth | Legal / Technical | Decision ledger | Human-readable factors, inputs, policy/rules, and outcome; no chain-of-thought disclosure | Owner + legal | OPEN |
| D-011 | Headcount and budget caps | Economic | WR-001; creation engine | Conservative initial caps; tighten-only by Governance; expansion requires dual control | Owner | OPEN |
| D-012 | Contract quota values | Economic / Technical | Contract runtime | Derived from approved lane and blueprint caps | Owner + Governance | OPEN |
| D-013 | SLA values | Technical / Economic | Contract runtime | Tiered by contract criticality; no SLA may imply authority | Owner + Governance | OPEN |
| D-014 | Idempotency/replay windows | Technical | Contract runtime | Explicit per contract; security-sensitive contracts use shorter windows where practical | Governance | OPEN |
| D-015 | Contract/audit retention | Legal / Data | Audit storage | Retention classes by evidence type; learner-impacting records follow approved schedule | Owner + legal | OPEN |
| D-016 | Shadow sample and dwell | Technical | Promotion | Initial target ≥100 representative shadow tasks or 14 days, whichever is longer; final statistical criteria require approval | Owner + Governance | OPEN |
| D-017 | AI measurement denominator | AI | 5% governance | Executed operational actions/month; compound-action counting rules must be defined | Owner | OPEN |
| D-018 | AI reclassification | AI / Authority | Blueprint amendments | Toward AI-O/AI-R requires dual control; toward AI-0 may be Governance-only | Owner + Governance | OPEN |
| D-019 | WR-003 Admissions Triage | Operational / Technical | BP-001 | Draft after D-003 is closed | — | OPEN — WORK ITEM |
| D-020 | WR-004 Promotion Certification | Operational / Technical | BP-007; promotion | Draft after D-006 and D-016 are sufficiently closed | — | OPEN — WORK ITEM |
| D-021 | Deterministic-first architecture | Technical / Strategic | All blueprints | Deterministic mechanism is default; AI is bounded specialist capability | Owner | PROPOSED |
| D-022 | Per-identity AI allowance | AI / Authority | Blueprint registry | No generic AI permission; every AI use is task-scoped and measurable | Owner + Governance | PROPOSED |
| D-023 | AI-provider independence | Technical / AI | AI-O/AI-R blueprints | AI specialist interfaces MUST remain provider-agnostic; provider failure MUST have defined fallback | Owner + Governance | PROPOSED |
| D-024 | Documentation dependency discipline | Operational / Technical | All future specs | No implementation artifact may outrun its approved specification dependencies | Owner | PROPOSED |
| D-025 | Chapter/index/storyline rule | Operational / Content | Content specifications | Intent governs structure; structure governs execution; structural changes precede chapter acceptance | Owner + Academic | PROPOSED |

---

## §8 Priority closure sequence

The closure process MUST follow dependency risk rather than document convenience.

### Phase A — Human safety and irreversible consequences

1. **D-002 Safeguarding**
2. **D-008 Legal hold / deletion / shredding**
3. **D-007 DSAR/redaction**
4. **D-001 Report release and fee-gating**

These decisions establish the hard edges around children, personal data, and irreversible actions.

### Phase B — Authority and policy artifacts

5. **D-003 Admissions criteria**
6. **D-004 Communication scripts**
7. **D-005 Fee waivers**
8. **D-006 Certification evidence**

These determine what workers may execute versus merely recommend.

### Phase C — Economic and operational controls

9. **D-011 Headcount/budget caps**
10. **D-012 Contract quotas**
11. **D-013 SLAs**
12. **D-014 Replay windows**
13. **D-015 Retention**
14. **D-016 Shadow gate**
15. **D-009 DR objectives**

### Phase D — AI governance

16. **D-017 AI measurement**
17. **D-018 AI reclassification**
18. **D-021 Deterministic-first architecture**
19. **D-022 Per-identity AI allowance**
20. **D-023 Provider independence**

### Phase E — Documentation and content discipline

21. **D-024 Specification dependency discipline**
22. **D-025 Storyline → index → execution rule**

Only after the applicable phase gates are satisfied should dependent enforcement specifications be opened for implementation design.

---

## §9 Propagation and document synchronization

### 9.1 [DEFINED]
A decision is incomplete until every affected document is synchronized.

### 9.2 Propagation record

Each closed decision MUST identify:

- source decision;
- old rule;
- new rule;
- affected sections;
- documents amended;
- contract IDs affected;
- blueprint IDs affected;
- test/readiness gates affected;
- verification evidence.

### 9.3 No orphan decisions

A **DECIDED** entry whose propagation is incomplete MUST be marked **PROPAGATING**, not **VERIFIED**.

### 9.4 Conflict detection

If two controlled documents express different authority, data, AI, or economic rules, implementation MUST stop at that boundary until precedence is resolved.

---

## §10 Readiness gates before implementation

Implementation of any engine, worker, contract runtime, or enforcement mechanism MUST have a readiness record proving:

- [ ] Strategic authority identified.
- [ ] Constitutional authority identified.
- [ ] Operational behaviour specified.
- [ ] Required contract approved.
- [ ] Required blueprint approved.
- [ ] All blocking decisions DECIDED.
- [ ] All affected documents synchronized.
- [ ] Data classification and retention resolved.
- [ ] Human escalation authority resolved.
- [ ] Economic caps resolved.
- [ ] Failure and recovery behaviour resolved.
- [ ] AI classification resolved, where applicable.
- [ ] Shadow/promotion criteria resolved, where applicable.
- [ ] Evidence and audit requirements resolved.
- [ ] Governance conformance recorded.

### 10.1 Implementation moratorium

If any mandatory gate is unchecked, implementation MUST NOT proceed by assumption. The unresolved item returns to this register.

---

## §11 Documentation engineering standard

### 11.1 [DEFINED]
Future specification documents MUST be developed in the following conceptual order:

**Storyline → Index → Authority → Structure → Dependencies → Boundaries → Decisions → Detailed behaviour → Examples → Contracts/tests → Implementation specification.**

### 11.2 Storyline

The storyline answers: **Why does this system or subsystem exist, what outcome is it trying to produce, and what is the intended progression?**

For an engine, the storyline is its institutional purpose and operating arc.

For educational content, the storyline is the approved curriculum intent and learning progression.

### 11.3 Index

The index decomposes the storyline into ordered structural units. It is the structure contract.

An index MUST exist before its dependent chapters or executable units are accepted.

### 11.4 Execution units

Chapters, worker tasks, workflows, or implementation units execute against the approved structure.

They MUST NOT silently redefine the storyline or index.

### 11.5 Structural amendment rule

If execution discovers a structural defect, execution MUST pause at the affected boundary. The proposed structural change is recorded, approved, and propagated before the dependent execution unit is accepted.

### 11.6 Important distinction

The **structural index** is an architectural artifact. Pagination, visual numbering, layout, and other production details are finalised only at production time and MUST NOT be confused with the authoritative structure.

---

## §12 Traceability and audit requirements

Every decision MUST be traceable in both directions:

**Strategic principle → constitutional rule → decision → contract/blueprint → enforcement control → evidence.**

and:

**Observed control/evidence → enforcement control → contract/blueprint → decision → constitutional rule → strategic principle.**

A gap in either direction is an architectural traceability defect.

### 12.1 Decision evidence

Decision closure MUST be auditable independently of implementation code. The register is therefore part of the governance record, not merely a project-management list.

---

## §13 Change control

13.1 Grant-affecting decisions require dual control.  
13.2 Safety-tightening decisions MAY be made by Governance where constitutionally permitted.  
13.3 Legal decisions require appropriate human/legal authority.  
13.4 Superseded decisions remain immutable historical records.  
13.5 A decision MUST NOT be deleted merely because it was rejected; rejection itself is part of the design history.  
13.6 Any change to the 5% AI principle MUST identify whether it changes a strategic target, governance threshold, or constitutional invariant.

---

## §14 Open work items

The following are deliberately visible and MUST NOT be mistaken for approved policy:

- **D-019** — WR-003 Admissions Triage specification.
- **D-020** — WR-004 Promotion Certification specification.
- Legal review required for D-001, D-002, D-007, D-008, D-009, D-010, and D-015.
- Economic calibration required for D-011–D-013.
- AI measurement design required for D-017.
- Blueprint propagation required after AI classification decisions D-018, D-022, and D-023.
- Documentation standard propagation required after D-024/D-025 approval.

### 14.1 Next controlled activity

The next activity SHOULD NOT be coding.

The next activity is **decision closure**, beginning with **D-002 Safeguarding** and **D-008 Legal Hold**, because these define irreversible and child-safety boundaries. After those are resolved, proceed through authority, economic, technical, AI, and documentation decisions in the sequence of §8.

---

## §15 Closing principle

The organisation is not considered mature because it has many documents. It is mature when every important action can answer, before execution:

1. **Why does this action exist?**
2. **Who has authority to permit it?**
3. **What exact contract invokes it?**
4. **What exact identity/blueprint performs it?**
5. **What data may it see?**
6. **What deterministic controls constrain it?**
7. **Where, if anywhere, may AI assist?**
8. **What happens when it fails?**
9. **Who can stop it?**
10. **What evidence proves what happened?**

If any answer is unknown at an implementation boundary, that boundary remains **SPECIFICATION-INCOMPLETE**.
