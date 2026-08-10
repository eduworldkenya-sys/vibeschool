# VIBESCHOOL AUTONOMOUS ORGANISATION
## Decisions Register — Closure, Dependencies, Architecture & Readiness

**Document ID:** VS-ENG-DR  
**Version:** 0.3-draft  
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
15. Closing principle
16. Canonical execution model
17. Controlled glossary

---

## §1 Purpose and governing principle

### 1.1 [DEFINED]
This register is the authoritative worklist for unresolved architectural, authority, legal, economic, technical, data, AI, and operational decisions required to mature the autonomous-organisation specification before implementation.

### 1.2 [DEFINED]
An unresolved decision MUST NOT be silently resolved in code, database policy, infrastructure configuration, worker prompt, model selection, or operational convention.

### 1.3 [DEFINED]
A decision is not considered closed merely because a recommendation exists. Closure requires an explicit authority decision recorded under §3.

### 1.4 [DERIVED]
The specification chain is:

**Strategic intent → Constitution → Operational reality → Contracts → Blueprints → Decisions → Enforcement specification → State/data models → Implementation → Verification.**

Where a decision affects an earlier document, the earlier document MUST be amended before dependent implementation begins.

### 1.5 [DEFINED]
This register does not itself grant authority to any engine, worker, contract, blueprint, AI model, or automation routine.

### 1.6 [DEFINED]
The governing architectural objective is a **smart deterministic computer with bounded specialist intelligence**, not an organisation whose core authority is delegated to LLMs.

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

### 2.4 [DEFINED] Execution cannot silently rewrite structure

Runtime execution, worker output, AI output, or operational telemetry MUST NOT silently change a constitution, policy, decision, contract, blueprint, lane definition, skill boundary, or structural index. A structural change MUST become an explicit decision/change artifact and pass the same propagation and verification lifecycle.

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

### 3.5 Decision lifecycle

The normal maturity lifecycle is:

**OPEN → PROPOSED → DECIDED → PROPAGATING → VERIFIED → SUPERSEDED.**

A transition MUST be evidenced. A decision MUST NOT jump directly from recommendation to implementation, and a **DECIDED** item MUST NOT be treated as fully effective until required propagation is complete.

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

Where probabilistic interpretation is genuinely required:

**Observe → deterministic boundary → bounded AI specialist → deterministic validation → execute/fallback → verify → record.**

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

AI may be used for non-authoritative observation or summarisation only where separately permitted and where that use cannot influence the protected decision.

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

### 5.3 AI allowance is per identity, skill, and task

Every blueprint or executable identity that permits AI MUST state:

- AI class;
- permitted skill/operation;
- maximum AI-influenced actions;
- applicable task types;
- model/provider independence requirements;
- deterministic validator;
- fallback;
- telemetry fields;
- escalation condition.

An identity MUST NOT receive a general-purpose AI permission that can be spent arbitrarily.

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

### 5.6 AI-provider independence

AI-capable skills MUST be designed behind a bounded interface. No blueprint may acquire authority that depends on a particular model vendor. Provider failure, rate limiting, model retirement, or degraded quality MUST have an explicit fallback or escalation path.

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

### 6.4 [DEFINED] Smallest closed loop first

When implementation eventually begins, the first production workstream MUST prove the smallest complete deterministic loop before broader autonomy is added:

**one task → one bounded input → one tool/operation → one state transition → one verification gate → one auditable outcome.**

Autonomy, fan-out, and worker multiplication are added only after the deterministic path is proven.

---

## §7 Decision register

| ID | Decision | Class | Blocks | Current recommendation | Authority | Status |
|---|---|---|---|---|---|---|
| D-001 | Fee-gating of report release | Legal / Authority | OR-01; report workflows | Statutory learner records MUST NOT be withheld solely for debt; any commercial gating requires separate legal/policy review | Owner + legal | OPEN |
| D-002 | Safeguarding escalation | Legal / Authority | WR-021; BP-003 | Deterministic safeguarding interrupt; immediate human escalation; worker MUST NOT determine safeguarding outcome | Owner + legal | OPEN |
| D-003 | Admissions criteria authority | Authority | WR-003; BP-001 | Criteria are versioned policy artifacts; Owner approves; engines execute only | Owner | OPEN |
| D-004 | Call-centre script authority | Authority | BP-003 | Scripts are versioned policy artifacts; deviation requires explicit escalation | Owner | OPEN |
| D-005 | Fee-waiver authority | Authority / Economic | BP-002; BP-003 | Pre-approved rule classes only; discretionary waiver requires dual control | Owner | OPEN |
| D-006 | Certification evidence policy | Authority / Technical | WR-014; WR-040; BP-007 | Fixed evidence bundle; raw learner streams prohibited; policy changes dual-control | Owner + Governance | OPEN |
| D-007 | DSAR redaction | Legal / Data | §19; Support workflows | Expose learner-specific state required by law; redact only protected categories defined by policy | Owner + legal | OPEN |
| D-008 | Legal hold vs deletion/shredding | Legal / Data | Erasure; retirement | Isolated append-only legal-hold registry; active hold blocks destructive action; hold release requires authorised human action | Owner + legal | OPEN |
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
| D-022 | Per-identity AI allowance | AI / Authority | Blueprint registry | No generic AI permission; every AI use is skill- and task-scoped and measurable | Owner + Governance | PROPOSED |
| D-023 | AI-provider independence | Technical / AI | AI-O/AI-R blueprints | AI specialist interfaces MUST be provider-agnostic; provider failure MUST have defined fallback | Owner + Governance | PROPOSED |
| D-024 | Documentation dependency discipline | Operational / Technical | All future specs | No implementation artifact may outrun its approved specification dependencies | Owner | PROPOSED |
| D-025 | Chapter/index/storyline rule | Operational / Content | Content specifications | Intent governs structure; structure governs execution; structural changes precede chapter acceptance | Owner + Academic | PROPOSED |
| D-026 | Canonical execution loop | Technical / Operational | Future enforcement; blueprints | Context → Lead → Lane → Skill → Memory → Verification → Escalation; each boundary is independently enforced | Owner + Governance | PROPOSED |
| D-027 | Worker is bounded skill bundle | Authority / Technical | Blueprint registry; creation engine | Worker identity is a fixed bundle of approved skills, not a general reasoner | Owner + Governance | PROPOSED |
| D-028 | Lane isolation | Technical / AI | Enforcement specification | Lane determines timeout/retry/escalation/verification and physically constrains reachable skill classes | Owner + Governance | PROPOSED |
| D-029 | Memory non-authority | Data / Authority | State model; worker runtime | Working memory is task-scoped; institutional memory is durable but advisory; memory cannot silently rewrite context or decisions | Owner + Governance | PROPOSED |
| D-030 | Execution vs outcome verification | Technical / Governance | Verification specification | Completion requires execution certification and, where applicable, independent outcome verification | Owner + Governance | PROPOSED |
| D-031 | Glossary as controlled vocabulary | Operational / Technical | All future specs | Canonical terms in §17 govern interpretation; glossary creates no authority and does not override constitutional precedence | Owner | PROPOSED |

---

## §8 Priority closure sequence

The closure process MUST follow dependency risk rather than document convenience.

### Phase A — Human safety and irreversible consequences

1. **D-002 Safeguarding**
2. **D-008 Legal hold / deletion / shredding**
3. **D-007 DSAR/redaction**
4. **D-001 Report release and fee-gating**

### Phase B — Authority and policy artifacts

5. **D-003 Admissions criteria**
6. **D-004 Communication scripts**
7. **D-005 Fee waivers**
8. **D-006 Certification evidence**

### Phase C — Economic and operational controls

9. **D-011 Headcount/budget caps**
10. **D-012 Contract quotas**
11. **D-013 SLAs**
12. **D-014 Replay windows**
13. **D-015 Retention**
14. **D-016 Shadow gate**
15. **D-009 DR objectives**

### Phase D — AI governance and execution architecture

16. **D-017 AI measurement**
17. **D-018 AI reclassification**
18. **D-021 Deterministic-first architecture**
19. **D-022 Per-identity AI allowance**
20. **D-023 Provider independence**
21. **D-026 Canonical execution loop**
22. **D-027 Worker/skill model**
23. **D-028 Lane isolation**
24. **D-029 Memory non-authority**
25. **D-030 Verification separation**

### Phase E — Documentation and controlled vocabulary

26. **D-024 Specification dependency discipline**
27. **D-025 Storyline → index → execution rule**
28. **D-031 Controlled glossary**

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
- state/data-model impacts;
- test/readiness gates affected;
- verification evidence.

### 9.3 No orphan decisions

A **DECIDED** entry whose propagation is incomplete MUST be marked **PROPAGATING**, not **VERIFIED**.

### 9.4 Conflict detection

If two controlled documents express different authority, data, AI, or economic rules, implementation MUST stop at that boundary until precedence is resolved.

### 9.5 Verification closure

A decision becomes **VERIFIED** only after Governance confirms that the recorded decision, all required propagated documents, enforcement controls, and verification evidence agree.

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
- [ ] Execution certification defined.
- [ ] Outcome verification defined, where applicable.
- [ ] Evidence and audit requirements resolved.
- [ ] Governance conformance recorded.

### 10.1 Implementation moratorium

If any mandatory gate is unchecked, implementation MUST NOT proceed by assumption. The unresolved item returns to this register.

### 10.2 Creation-engine gate

The worker-creation engine is the first intended implementation workstream after the platform recovery/P0 queue, but it MUST remain blocked until its full authority, provisioning, shadow, certification, economic, AI, suspension, retirement, legal-hold, and credential-destruction dependencies are VERIFIED.

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

### 11.7 AI is not a documentation authority

AI may draft, summarise, compare, or identify inconsistencies where the relevant blueprint permits it. It MUST NOT silently alter an approved storyline, index, specification, decision, or authority boundary.

---

## §12 Traceability and audit requirements

Every decision MUST be traceable in both directions:

**Strategic principle → constitutional rule → decision → contract/blueprint → enforcement control → evidence.**

and:

**Observed control/evidence → enforcement control → contract/blueprint → decision → constitutional rule → strategic principle.**

A gap in either direction is an architectural traceability defect.

### 12.1 Decision evidence

Decision closure MUST be auditable independently of implementation code. The register is therefore part of the governance record, not merely a project-management list.

### 12.2 Blocked attempts remain observable

A rejected request, prohibited tool call, invalid delegation, failed attestation, illegal cross-lane access, or other blocked attempt MUST remain observable in the audit system. Blocking an action does not erase the fact that the attempted action occurred.

### 12.3 Evidence does not become authority

Telemetry, precedent, memory, AI output, statistical confidence, or historical success MAY inform verification, but none of them independently grants authority.

---

## §13 Change control

13.1 Grant-affecting decisions require dual control.  
13.2 Safety-tightening decisions MAY be made by Governance where constitutionally permitted.  
13.3 Legal decisions require appropriate human/legal authority.  
13.4 Superseded decisions remain immutable historical records.  
13.5 A decision MUST NOT be deleted merely because it was rejected; rejection itself is part of the design history.  
13.6 Any change to the 5% AI principle MUST identify whether it changes a strategic target, governance threshold, or constitutional invariant.  
13.7 A glossary change that changes authority meaning, data meaning, AI classification, or enforcement semantics is NOT merely editorial; it becomes a controlled decision and must be propagated.

---

## §14 Open work items

The following are deliberately visible and MUST NOT be mistaken for approved policy:

- **D-019** — WR-003 Admissions Triage specification.
- **D-020** — WR-004 Promotion Certification specification.
- Legal review required for D-001, D-002, D-007, D-008, D-009, D-010, and D-015.
- Economic calibration required for D-011–D-013.
- AI measurement design required for D-017.
- Blueprint propagation required after AI classification decisions D-018, D-022, and D-023.
- Execution architecture decisions D-026–D-030 require propagation into the future enforcement specification and state model.
- Documentation standard propagation required after D-024/D-025 approval.

### 14.1 Next controlled activity

The next activity SHOULD NOT be broad coding.

The next activity is **decision closure**, beginning with **D-002 Safeguarding** and **D-008 Legal Hold**, because these define irreversible and child-safety boundaries. After those are resolved, proceed through authority, economic, technical, AI, and documentation decisions in the sequence of §8.

---

## §15 Closing principle

The organisation is not considered mature because it has many documents. It is mature when every important action can answer, before execution:

1. **Why does this action exist?**
2. **Who has authority to permit it?**
3. **What exact context may enter it?**
4. **Which Lead routes it?**
5. **Which Lane constrains it?**
6. **Which Skill performs it?**
7. **What data may it see or write?**
8. **Where, if anywhere, may AI assist?**
9. **What deterministic controls constrain it?**
10. **How is execution certified?**
11. **How is the outcome verified?**
12. **What happens when it fails?**
13. **Who can stop it?**
14. **What evidence proves what happened?**

If any answer is unknown at an implementation boundary, that boundary remains **SPECIFICATION-INCOMPLETE**.

---

## §16 Canonical execution model

### 16.1 [PROPOSED]
The canonical operational loop for future enforcement specifications is:

**Context → Lead → Lane → Skill → Memory → Verification → Escalation-if-needed.**

This is a structural model, not an implementation technology choice.

### 16.2 Context

**Context** is the bounded input package assembled deterministically before reasoning or execution. It is a filtered, permissioned slice containing only the current entity state, applicable policy, relevant verified decisions, and task-required evidence.

Raw database access MUST NOT be treated as context. If context assembly requires discretionary judgment, the defect belongs in the context layer and MUST NOT be delegated silently to the worker.

### 16.3 Lead

**Lead** is the dispatcher/orchestrator. It classifies incoming work and routes it to the appropriate worker and skill.

Deterministic routing rules are preferred. A model MAY assist only where classification is genuinely ambiguous and the applicable policy permits it. Lead owns routing authority only; it does not acquire execution authority merely by choosing a destination.

### 16.4 Lane

**Lane** is the fixed execution track applied after routing. It defines priority, timeout, retry policy, escalation path, resource ceiling, and required verification level.

Lane constraints MUST be enforceable independently of Lead. A task assigned to an AI-0 lane MUST NOT be able to reach an AI-R skill simply because a router selected it.

### 16.5 Skill

**Skill** is the smallest atomic, testable capability with an explicit input contract, output contract, AI classification, maturity state, permissions, and verification requirements.

A worker is a bounded bundle of approved skills, not a general-purpose reasoner.

### 16.6 Memory

**Memory** has two classes:

- **Working memory** — task-scoped context used during execution and discarded or minimised after verification according to policy.
- **Institutional memory** — durable records such as verified precedents, metrics, and historical evidence.

Memory MAY propose information for future context. It MUST NOT silently overwrite source-of-truth state, approved decisions, policy, contracts, or blueprints.

### 16.7 Verification

Verification is the gate before a task is considered complete.

Two distinct questions MUST be separated where applicable:

- **Execution certification:** Did the prescribed operation run according to its contract and controls?
- **Outcome verification:** Is the resulting state or result actually correct and acceptable?

A task can execute perfectly and still produce an incorrect outcome. Therefore execution certification MUST NOT automatically substitute for outcome verification.

### 16.8 Escalation

Escalation is an explicit state transition when Lane rules, Skill boundaries, verification gates, safety policies, or failure budgets are breached.

Escalation MUST route to a defined human or higher-authority path. Silent retry loops MUST NOT substitute for escalation.

---

## §17 Controlled glossary

The glossary is canonical vocabulary only. It creates no authority, does not override `ENGINES.md`, and MUST NOT be interpreted as an implementation grant.

### Execution & control flow

1. **Worker** — a bounded operational unit holding a fixed set of approved skills and executing within an assigned lane.
2. **Policy** — a governed rule constraining what workers and skills may do independently of task context.
3. **Decision** — a governed choice with a controlled maturity state; once VERIFIED it becomes binding context within its declared scope.
4. **Contract** — an explicit input/output and operational guarantee between bounded participants; breaking it is a control failure.
5. **Blueprint** — the structural specification against which an identity or workflow is instantiated; execution cannot silently diverge from it.
6. **Boundary** — the hard edge of authority, data, capability, or execution scope; crossing it requires escalation or an approved change.
7. **Trigger** — an event or condition that starts a task, such as a schedule, webhook, state change, or human request.
8. **Queue** — the controlled waiting area for tasks; ordering and priority belong to the queue/lane system rather than arbitrary worker logic.
9. **State machine** — the deterministic representation of a task's legal lifecycle states and transitions.
10. **Audit log** — an integrity-protected record of decisions, tool calls, state transitions, rejections, and relevant evidence.
11. **Execution certification** — evidence that a prescribed task ran according to its contract and controls.
12. **Outcome verification** — independent evidence that the resulting state or outcome is correct and valid.
13. **Rollback** — a defined and tested path for reversing a state-changing operation where reversal is technically and legally possible.
14. **Idempotency** — the property that a retried operation does not create unintended duplicate effects.
15. **Timeout** — the maximum permitted time before a task is automatically escalated or terminated according to lane policy.
16. **Retry policy** — defined attempt count, backoff, retryable conditions, and terminal escalation behaviour.
17. **Fallback** — the deterministic or human-controlled alternative used when the primary mechanism fails or is unavailable.
18. **Circuit breaker** — a control that halts or isolates a repeatedly failing operation to prevent cascading damage.
19. **Ownership** — the accountable human or governed role responsible for a table, skill, decision, policy, or artifact.
20. **Provenance** — the traceable origin and history of a data item, decision, or action.

### AI governance

21. **AI classification** — the governance tag AI-0, AI-O, or AI-R assigned to a skill or operation at design time.
22. **AI allowance** — a bounded, task-specific permission for AI influence; never a general-purpose worker capability.
23. **AI ceiling** — the governance target/threshold for aggregate AI influence; the initial strategic target is 5% pending D-017.
24. **Model router** — an optional bounded component selecting an approved model for an AI-permitted operation.
25. **Prompt contract** — the fixed structure and permitted inputs supplied to a model call.
26. **Grounding source** — an approved source of truth from which AI output must be traceable.
27. **Hallucination check** — a validation designed to detect unsupported or ungrounded AI output.
28. **Confidence threshold** — a defined acceptance threshold for probabilistic output; confidence alone never grants authority.
29. **Model fallback chain** — the approved degradation sequence from primary model to alternate mechanism or human escalation.
30. **Token budget** — an enforced resource ceiling for model usage within a task, skill, or lane.
31. **Prompt version** — an immutable version identifier for a governed prompt contract.
32. **Output parser** — deterministic code that validates and structures model output before downstream use.
33. **Bias check** — a defined verification for systematic skew or disparate outcomes in an AI-assisted operation.
34. **Provider independence** — the property that business authority and workflow semantics do not depend on one AI vendor.
35. **AI influence event** — a traceable event in which AI output materially affects an operational action or decision.

### Data & context

36. **Context** — the bounded, permissioned input package assembled for a task before execution or reasoning.
37. **Context window** — the deterministic rule set defining exactly which information enters task context.
38. **Context staleness** — a condition indicating that assembled context is too old or invalid for safe use.
39. **Snapshot** — an immutable representation of relevant state at a defined point in time.
40. **Source of truth** — the authoritative system or record for a specific fact.
41. **Derived data** — data computed from a source of truth and therefore not independently authoritative.
42. **Schema contract** — the enforced shape and type rules for data crossing a boundary.
43. **Data lineage** — the traceable path from source data through transformations to use or output.
44. **Cache layer** — a non-authoritative acceleration layer whose correctness depends on deterministic invalidation/revalidation rules.
45. **Normalization boundary** — the controlled point where external or messy data becomes canonical internal form.
46. **Ingestion gate** — validation and security controls applied before external data becomes trusted system input.
47. **Data minimisation** — the principle that a task receives only the data required for its declared purpose.
48. **Retention class** — the governed category defining how long a record may or must be retained.
49. **Legal hold** — an authoritative preservation state that blocks destructive deletion within its declared scope.
50. **Crypto-shredding** — destruction of applicable cryptographic keys so protected data becomes irrecoverable, subject to legal-hold and preservation rules.

### Governance & safety

51. **Guardrail** — a hard enforcement constraint that cannot be overridden by AI reasoning.
52. **Kill switch** — a scoped control capable of halting a worker, skill, lane, or system function.
53. **Blast radius** — the maximum intended impact a single failure can have.
54. **Least privilege** — granting only the access strictly required for the declared task.
55. **Segregation of duties** — separating proposal, execution, and approval responsibilities where required.
56. **Four-eyes rule** — a control requiring two independent approvals for specified actions.
57. **Anomaly threshold** — a rule or statistical boundary beyond which behaviour requires review or containment.
58. **Containment** — isolating a failed, compromised, or misbehaving component without unnecessarily stopping unrelated functions.
59. **Red-team task** — an adversarial test designed to probe a worker's boundaries before promotion.
60. **Compliance tag** — metadata linking a skill, decision, contract, or blueprint to an applicable policy or regulatory requirement.
61. **Safeguarding interrupt** — a deterministic state-machine transition that removes a qualifying child-safety case from normal automation and routes it to the defined human authority.
62. **Break-glass** — a rare, explicitly authorised human intervention outside normal automated pathways, fully logged and reviewed.
63. **Blocked attempt** — an observable action request rejected by a guardrail, contract, identity, lane, or policy control.
64. **Containment primitive** — a narrowly defined reversible or controlled action used to isolate a fault, such as suspension or quarantine.
65. **Trust boundary** — a formally defined edge across which identity, data, or authority cannot pass without explicit controls.

### Organisational / HQ layer

66. **Function** — a named organisational capability independent of which worker, engine, or human performs it.
67. **Work item** — the atomic unit of tracked operational work.
68. **Role** — a governed permission/authority bundle assigned to a human or worker identity.
69. **Mandate** — the explicit scope and purpose of authority granted to an identity.
70. **Charter** — the founding definition of a component's purpose, boundaries, owner, and obligations.
71. **Escalation tier** — the ordered authority path through which unresolved work rises.
72. **SLA** — the defined service-level bound for a lane, contract, or skill.
73. **Runbook** — a human-readable procedure for handling a known failure or operational condition.
74. **Postmortem** — a structured review after a major failure, including causes, controls, and required changes.
75. **Change log** — an append-only record of changes, rationale, authority, and effective versions.

### Lifecycle & maturity

76. **Draft** — an unapproved specification or skill definition.
77. **Review gate** — a controlled checkpoint requiring named review before promotion to the next maturity state.
78. **Pilot** — a restricted live deployment with deliberately limited scope, volume, and authority.
79. **General availability** — a formally approved operational state after pilot criteria are satisfied.
80. **Deprecation** — the controlled process of retiring a component while preserving required compatibility and evidence.
81. **Sunset date** — the scheduled point at which a deprecated component ceases normal operation.
82. **Version pin** — a control locking a workflow or dependency to a specific approved version.
83. **Breaking change** — a change that invalidates a prior contract, grant, schema, or behaviour guarantee.
84. **Migration plan** — the explicit controlled path from an old version to a new version.
85. **Backward compatibility window** — the approved period during which old and new versions may coexist.
86. **Shadow mode** — execution against representative tasks without live authority to affect production state.
87. **Promotion** — the controlled transition from shadow/pilot status to an approved active execution state.
88. **Retirement** — the controlled termination of an identity, skill, or workflow including credential destruction where applicable.

### Observability & verification

89. **Metric** — a quantified signal such as latency, error rate, cost, or AI influence tracked over time.
90. **Trace** — the complete observable path of a task across Context → Lead → Lane → Skill → Memory → Verification.
91. **Alert** — an automated notification generated when a defined metric or condition crosses its threshold.
92. **Dashboard** — a human-facing aggregation of metrics, traces, alerts, and health information.
93. **Health check** — a periodic probe verifying that a component is functioning within expected bounds.
94. **Latency budget** — the maximum acceptable time allocated to a pipeline stage or operation.
95. **Error budget** — the permitted failure envelope before a component requires review, degradation, or suspension.
96. **Sampling** — detailed review of a defined subset of tasks for quality and governance efficiency.
97. **Replay** — re-running a task against preserved inputs/state to reproduce, debug, or verify behaviour.
98. **Ground-truth set** — a curated human-verified dataset used to measure skill performance.
99. **Drift detection** — monitoring that identifies divergence between actual behaviour and the approved blueprint, policy, or baseline.
100. **Verification evidence** — the machine- and/or human-auditable proof required to establish that a gate has been satisfied.

### Closing architecture

101. **Steady state** — the intended operating condition in which service, economic, safety, and governance bounds remain within approved limits.
102. **Founder override** — the ultimate, rare, explicitly logged human escape mechanism, usable only within constitutional limits and subject to post-event review.

### 17.1 Glossary precedence

If a glossary definition conflicts with `ENGINES.md`, the Constitution wins. If it conflicts with an approved decision, the decision wins within its declared scope. If it conflicts with a contract or blueprint, the higher-level authority chain determines precedence.

### 17.2 Glossary maintenance

The glossary is controlled vocabulary. Adding a term is editorial only when it does not change authority or enforcement semantics. Changing a definition in a way that changes system behaviour MUST create or update a decision entry and propagate that change before implementation.
