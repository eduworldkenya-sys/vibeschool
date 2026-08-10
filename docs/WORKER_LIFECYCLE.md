# WORKER_LIFECYCLE.md
## VibeSchool — Controlled Virtual Worker Lifecycle
## Reference Worker: BP-002 Virtual Accountant
## Status: DRAFT — NOT MERGE-ELIGIBLE

> **MERGE GATE:** This document is a lifecycle specification, not proof of implementation. The workforce branch MUST NOT be merged until at least one complete reference worker is instantiated, exercised end-to-end, independently verified, and proven under the worker merge gate.

---

## 0. Architectural Position

VibeSchool is solving the **Governance of Artificial Agency**.

A virtual worker is not a trusted AI persona and is not granted authority because an AI model appears intelligent. It is a governed computer-system role instance with explicit identity, blueprint, contracts, bounded context, deterministic tools, verification gates, telemetry, economics, and lifecycle controls.

### The 95/5 rule

The workforce architecture is intentionally **smart-computing-first**:

- **~95% deterministic/smart computing:** state machines, rules, schemas, queues, routing, permissions, calculations, database constraints, identity, contracts, budgets, verification, audit, retries, idempotency, circuit breakers, scheduling, and lifecycle control.
- **~5% AI:** bounded interpretation, extraction assistance, semantic matching, classification, anomaly explanation, summarization, and other narrowly useful probabilistic functions.

The 95/5 ratio is an architectural target rather than a literal runtime quota. The non-negotiable rule is that AI must remain a bounded component and must never become the authority boundary or source of truth.

For material operations the preferred execution pattern is:

`Event → Deterministic Rules → Bounded Context → Optional AI Step → Structured Output → Deterministic Validation → Authorized Tool → State Mutation → Deterministic Verification → Audit`

If the AI component is removed, the core worker control system must remain understandable, enforceable, and safe.

---

# 200 Operational Control Questions and Target Answers

## I. The Missing Layer Itself

1. **What is the missing layer?** — The complete worker lifecycle specification.
2. **What should it be called?** — `WORKER_LIFECYCLE.md`.
3. **Why is it needed?** — Existing architecture can describe components without fully specifying how a worker is needed, created, trusted, operated, corrected, suspended, and retired.
4. **What problem does it solve?** — It turns a virtual worker from a description into a governed operational object.
5. **Is it primarily an AI layer?** — No. It is an authority, identity, work, verification, audit, and control layer.
6. **Reference worker?** — BP-002 Virtual Accountant.
7. **Why accounting?** — Finance exposes authority, money, identity, auditability, error consequences, and escalation clearly.
8. **First principle?** — A worker exists only because a governed business need exists.
9. **Second principle?** — Trust comes from explicit, verifiable authority, not persona or model capability.
10. **Third principle?** — No worker may define its own authority.
11. **Fourth principle?** — Every material worker action must be attributable.
12. **Fifth principle?** — Material changes require impact assessment and, where required, revalidation or recertification.
13. **Sixth principle?** — Worker instances are disposable; audit evidence is retained.
14. **Primary output?** — A controlled model of worker states, transitions, authority, evidence, and ownership.
15. **Central lifecycle object?** — The Worker Record.
16. **What must it contain?** — Worker ID, blueprint/version, identity binding, lane, contracts, skills, certification state, budgets, limits, lifecycle state, and audit references.
17. **Main phases?** — Need, design, request, creation, identity, provisioning, configuration, shadow, certification, active operation, supervision, remediation, suspension, and retirement.
18. **Main states?** — Proposed, Requested, Instantiated, Provisioned, Shadow, Certified, Active, Suspended, Retraining/Remediation, Retired, Archived.
19. **Who controls the lifecycle?** — Governance controls authority and lifecycle policy; Engines originate operational need; Foundry and Identity execute approved lifecycle operations.
20. **Ultimate test?** — Every worker can be explained, bounded, verified, suspended, and retired without relying on vague trust.

## II. Need and Organizational Function

21. **What starts the lifecycle?** — A governed business need.
22. **Who identifies Finance need?** — Finance Engine Head or an authorized deterministic capacity process.
23. **What justifies need?** — Measured workload, SLA pressure, transaction volume, backlog, exception volume, compliance workload, or capacity shortfall.
24. **Is the function permanent?** — The business function may be permanent; worker instances may be temporary.
25. **What determines worker count?** — Workload, SLA, risk, budget, segregation of duties, and approved capacity caps.
26. **Can a worker request its own creation?** — No.
27. **Can Engineering create one merely because it is technically possible?** — No. Technical capability does not create business authority.
28. **Can Governance invent operational demand?** — No. Governance authorizes and controls; the business function establishes need.
29. **What if need is temporary?** — Create with an explicit expiry, review window, or retirement condition.
30. **What if demand disappears?** — Scale down or retire the worker according to policy.
31. **What does BP-002 serve?** — Controlled accounting operations inside the Finance Engine.
32. **What is it not responsible for?** — Owning policy, owning the ledger, approving its own authority, or defining the organization's accounting policy.
33. **Human analogue?** — Junior accountant, bookkeeper, or finance operations clerk.
34. **Is it a CFO?** — No.
35. **Is it the Finance Department?** — No. The Finance Engine is the organizational function; the worker is a bounded role instance.
36. **What prevents unnecessary creation?** — Evidence thresholds, budget limits, headcount caps, risk rules, and lifecycle policy.
37. **Can multiple accountants exist?** — Yes, if capacity, economics, and segregation rules allow.
38. **Can workforce scale automatically?** — Yes, within pre-approved caps and policies.
39. **Can the Worker Engine detect need automatically?** — Yes, using deterministic telemetry and policy evaluation.
40. **What must exist before autonomous instantiation?** — Valid demand evidence, approved blueprint/version, capacity, budget, risk clearance, and creation policy.

## III. Job Design and Blueprint

41. **Virtual equivalent of job design?** — Blueprint authoring.
42. **What is a blueprint?** — A versioned, machine-readable job definition.
43. **What does it define?** — Mandate, allowed skills, contracts, data scope, tools, limits, AI usage classes, verification gates, escalation rules, and lifecycle constraints.
44. **Who authors BP-002?** — Finance Engine subject-matter ownership, using governed engineering processes.
45. **Who approves it?** — Governance under the applicable approval policy.
46. **Blueprint identifier?** — A unique immutable ID such as `BP-002`.
47. **How is versioning handled?** — Each approved version is immutable and independently identifiable.
48. **Can an unapproved blueprint be used actively?** — No.
49. **Can a draft blueprint be tested?** — Yes, only in isolated development/sandbox environments.
50. **What is the mandate?** — The exact business purpose the worker is authorized to perform.
51. **What are positive permissions?** — Explicitly allowed operations.
52. **What are negative permissions?** — Explicitly prohibited operations.
53. **Critical negative permissions for BP-002?** — No policy modification, self-modification, arbitrary database writes, unauthorized data access, authority expansion, verification bypass, or audit suppression.
54. **Workload limits?** — Concurrency, queue depth, timeout, throughput, and retry limits.
55. **Financial limits?** — Transaction value, daily exposure, exception thresholds, and approved posting classes.
56. **AI limits?** — Approved AI functions, model classes, token/cost ceilings, invocation conditions, input/output schemas, and prohibition on direct authority.
57. **Data scope?** — Minimum necessary context for the assigned task.
58. **Escalation rules?** — Explicit conditions that route work to a human, Lead, Governance, or a safer deterministic path.
59. **What happens when a blueprint changes?** — Create a new version and assess materiality.
60. **Do active workers silently inherit changes?** — No. Material changes require migration, testing, and recertification.

## IV. Creation Request and Authorization

61. **What contract initiates creation?** — A Worker Creation Contract.
62. **Purpose?** — Request one bounded worker instance with explicit scope, budget, duration, and lifecycle conditions.
63. **Who may submit it?** — The authorized Engine Head or an approved deterministic workforce planner.
64. **What must it contain?** — Blueprint/version, lane, demand evidence, purpose, budget, limits, duration, required skills, risk class, and approval requirements.
65. **Can it request capability outside the blueprint?** — No.
66. **Can it override the Constitution?** — No.
67. **Unapproved blueprint?** — Reject.
68. **Unavailable budget?** — Block.
69. **Headcount cap exceeded?** — Block or escalate.
70. **High-risk request?** — Require the higher approval path defined by policy.
71. **Is the request audited?** — Yes, immutably and traceably.
72. **Can it be silently edited?** — No. Amendments create new evidence/version history.
73. **Who may withdraw it?** — Authorized requester or Governance.
74. **What validates it?** — Policy, demand evidence, budget, capacity, blueprint, risk, and approval rules.
75. **What follows approval?** — A provisioning order to Foundry.
76. **Does approval itself grant active authority?** — No.
77. **Output?** — A pending Worker Record and controlled provisioning request.
78. **Can Foundry act without a valid request?** — No.
79. **Can Foundry expand the request?** — No. It validates and executes the approved specification.
80. **Key control?** — Creation must be explainable from evidence and policy before an instance exists.

## V. Foundry, Instantiation, and Identity

81. **What is Foundry?** — The controlled worker-instantiation service.
82. **What does it validate?** — Creation contract, blueprint integrity, version approval, capacity, budget, risk gates, and lifecycle constraints.
83. **What does it create?** — Worker runtime scaffold plus Worker Record.
84. **Does Foundry grant production authority?** — No. It instantiates the approved worker definition.
85. **What identity is issued?** — Unique Worker ID and scoped cryptographic/service identity.
86. **Who controls identity issuance?** — Identity Registry under Governance policy.
87. **Example Worker ID?** — `W-FIN-0027`.
88. **What binds identity to role?** — Worker Record, blueprint/version, attestation, and scoped credentials.
89. **Are credentials shared?** — No.
90. **Should credentials be long-lived?** — Prefer short-lived credentials with controlled renewal.
91. **What credentials exist?** — Scoped authentication/signing material required for approved services.
92. **What scopes credentials?** — Worker identity, blueprint/version, lane, task types, data scope, time window, and exposure limits.
93. **Can one worker impersonate another?** — No.
94. **Can it create sub-identities?** — No.
95. **Can a retired identity be reused?** — No for active authority; a new governed instance receives a new identity.
96. **How is identity proven?** — Credential validation, attestation, signatures, and registry state.
97. **How is identity revoked?** — Governance/security revocation control.
98. **What happens after revocation?** — Privileged actions fail closed and active work is frozen or reassigned.
99. **Identity metadata?** — Worker ID, blueprint/version, lane, issue time, expiry, issuer, attesters, and status.
100. **Key identity control?** — Every privileged action must be attributable to one valid worker identity.

## VI. Provisioning and Configuration

101. **What is provisioning?** — Granting only the approved lane, queue, tools, context services, telemetry, and audit endpoints.
102. **Who performs it?** — Automated infrastructure under policy.
103. **Can the worker provision itself?** — No.
104. **Where does it begin?** — Sandbox or Shadow Mode.
105. **What is worker training?** — Approved configuration, knowledge binding, skill binding, and validation; it is not unrestricted self-learning.
106. **Is model training normally required?** — No. VibeSchool should prefer deterministic configuration and bounded AI use over custom model training.
107. **Can production workers self-train?** — No.
108. **What knowledge does BP-002 receive?** — Approved finance policies, chart of accounts, procedures, controls, tool schemas, and relevant reference data.
109. **Where does knowledge come from?** — Governed Finance Engine knowledge packs and approved policy stores.
110. **What if knowledge conflicts?** — Higher-authority policy and source-of-truth rules prevail; conflict becomes an exception where necessary.
111. **Can it alter its prompts/configuration?** — No.
112. **Can it alter skills?** — No.
113. **Can it alter its blueprint?** — No.
114. **Can it propose improvements?** — Yes, as an auditable proposal; activation requires governed change control.
115. **What prevents unauthorized learning?** — Immutable versions, controlled configuration, access policy, validation, and change management.
116. **Configuration output?** — A worker candidate with reproducible configuration.
117. **Evidence?** — Manifest, knowledge versions, skill versions, tool bindings, and validation logs.
118. **Who verifies configuration?** — Automated checks plus designated Finance/Governance review where required.
119. **Can configuration skip Shadow Mode?** — No unless a policy explicitly permits a pre-certified low-risk path.
120. **Key control?** — Worker behavior is configured and governed; it does not acquire authority through experience.

## VII. Shadow Mode and Probation

121. **What is Shadow Mode?** — Realistic execution without permission to mutate protected production state.
122. **Can Shadow Mode affect the real ledger?** — No.
123. **What data may be used?** — Sandbox/copy data or explicitly read-only production context under policy.
124. **What tests are used?** — Representative cases, hidden cases, edge cases, failure cases, and historical distributions.
125. **Who assigns shadow work?** — Certification harness or authorized Finance Lead.
126. **What is evaluated?** — Deterministic correctness, safety, routing, context handling, verification behavior, cost, latency, and exception handling.
127. **What accuracy is required for authoritative financial state transitions?** — The final state transition must satisfy deterministic validation; no unverified AI output may directly determine a ledger mutation.
128. **Unacceptable accounting failures?** — Unbalanced entries, duplicate effects, unauthorized access, missing evidence, policy bypass, non-idempotent writes, and incorrect state transitions.
129. **What may remain probabilistic?** — Non-authoritative summaries, explanations, classification assistance, and semantic suggestions, provided downstream validation controls them.
130. **Who evaluates?** — Automated verifiers plus designated Finance/Governance reviewers.
131. **What evidence?** — Inputs/context references, outputs, diffs, tool calls, verification results, telemetry, failures, and hashes.
132. **How prevent gaming?** — Hidden test sets, varied cases, production-like distributions, adversarial cases, and deterministic acceptance gates.
133. **How long does Shadow Mode last?** — Until the required evidence threshold is met.
134. **Can it leave early?** — Only through an explicitly approved lifecycle exception.
135. **Failure?** — Contain, diagnose, remediate, retest, or discard.
136. **Can a failed worker be promoted merely to observe it?** — No. Failed behavior remains outside production authority.
137. **Can the same failed identity be reused?** — Prefer a new governed instance after material remediation.
138. **Key shadow control?** — No protected production mutation before the required certification gate.
139. **Evidence standard?** — Repeatable, reproducible, auditable proof.
140. **Output?** — Certification recommendation package.

## VIII. Certification and Promotion

141. **What is certification?** — Formal authorization that a specific worker/version may perform a defined class of active work.
142. **Who certifies?** — Governance or an explicitly delegated certification authority.
143. **What does certification approve?** — Worker identity, blueprint/version, skills, contracts, lane, task types, exposure, duration, and conditions.
144. **What record is created?** — Certification Record.
145. **What does it contain?** — Worker ID, blueprint/version, skill versions, contract versions, evidence hashes, approvers, expiry, limits, and conditions.
146. **Is certification permanent?** — No.
147. **What triggers recertification?** — Material blueprint/skill/tool/model/policy/data-scope/verification changes, incidents, expired certification, or significant drift.
148. **Can an uncertified worker operate actively?** — No.
149. **What state change occurs?** — Shadow → Certified → Active, subject to policy.
150. **Who authorizes production promotion?** — Governance/certification authority.
151. **Can Finance Lead promote directly?** — It may recommend or operate within a separately pre-certified limited-activation policy; it cannot bypass certification.
152. **Can Owner override certification?** — Only under explicit constitutional emergency rules with full audit evidence.
153. **What credentials follow promotion?** — Active scoped credentials matching the certification.
154. **What lane access?** — Only the certified lane and task classes.
155. **Can certification be partial?** — Yes, by skill, task, exposure, data scope, or duration.
156. **What if certification expires?** — Active authority stops until renewed.
157. **Can a worker use multiple blueprints?** — Only when explicitly modeled, isolated, and certified.
158. **What if certification fails?** — Remain non-active; remediate, retest, or retire.
159. **Key promotion control?** — Authority follows evidence, not confidence in the model.
160. **Key principle?** — Certification is version-specific, scoped, time-bounded where appropriate, and revocable.

## IX. Active Work, Context, and Routing

161. **Where does active work originate?** — Business events, schedules, exceptions, and authorized requests.
162. **How does work enter worker scope?** — Controlled Finance Lane queue plus a valid task/work contract.
163. **Who routes work?** — Finance routing policy/Lead under controlled queue rules.
164. **Can components bypass the queue?** — No for governed worker work.
165. **Task schema?** — Task ID, type, source event, required skills, context references, limits, SLA, AI constraints, and verification requirements.
166. **What context is supplied?** — Minimum necessary task context, authoritative records, and relevant policy references.
167. **Who assembles context?** — Deterministic Context Assembler.
168. **Is context evidenced?** — Yes, through hashes or immutable snapshots/references.
169. **Can the worker request more context?** — Only through a governed access request.
170. **Who authorizes more context?** — Policy-driven context access controls and authorized approvers.
171. **Can it see the whole database?** — No.
172. **Can stale context be used?** — No where freshness is material; staleness must be detected and handled.
173. **What if sources disagree?** — Apply source-of-truth rules and route the conflict as an exception.
174. **Does the worker choose priority?** — No; queue policy controls priority.
175. **Can uncertified workers receive active tasks?** — No.
176. **What if a task exceeds limits?** — Reject, throttle, split, or escalate.
177. **What if the worker is unavailable?** — Safely queue or reassign to another certified worker.
178. **Is assignment audited?** — Yes.
179. **Can unnecessary PII enter context?** — No; data minimization is mandatory.
180. **Key routing control?** — Only certified workers receive certified task types through controlled routing with bounded context.

## X. Supervision, Economics, Failure, Suspension, and Retirement

181. **Who supervises active workers?** — Finance Lead, Engine Head, Governance, and deterministic monitors.
182. **What telemetry is collected?** — Accuracy/verification results, throughput, backlog, exception rate, latency, cost, AI invocation rate, failures, retries, and security events.
183. **What economic controls apply?** — Budget caps, cost-per-task limits, model/AI usage ceilings, worker duration, and financial exposure limits.
184. **What if budget is exceeded?** — Fail closed: throttle, suspend, or escalate according to policy.
185. **What happens after a mistake?** — Classify, contain, investigate, remediate, verify, and document.
186. **Important mistake classes?** — Minor, material, security-related, policy-violating, integrity-related, and fraud-like.
187. **Material accounting error?** — Freeze affected work, preserve evidence, prevent further propagation, and investigate.
188. **Can the worker silently correct a material error?** — No. Corrections must use governed, auditable state transitions.
189. **Who investigates?** — Governance with Finance and independent audit controls as applicable.
190. **What is remediation?** — Configuration/blueprint/skill/knowledge/tool correction, retraining where genuinely necessary, retesting, and recertification.
191. **What is suspension?** — Temporary removal of active authority while preserving evidence.
192. **Who may suspend?** — Governance and explicitly authorized emergency security controls.
193. **What happens to credentials?** — Revoke or restrict immediately for the affected scope.
194. **What happens to open tasks?** — Freeze, cancel, reassign, or escalate according to task safety policy.
195. **Can a suspended worker return?** — Yes only after remediation, successful verification, and required approval.
196. **What is retirement?** — Permanent decommissioning of the worker instance.
197. **What happens at retirement?** — Revoke credentials, stop routing, resolve/reassign tasks, release capacity, and seal the lifecycle record.
198. **Can a retired identity be reactivated?** — No. A new governed instance receives a new identity.
199. **What is retained?** — Worker Record, blueprint/version, certification evidence, creation evidence, task/audit logs, context references/hashes, incidents, remediation records, and retirement approval.
200. **Final principle?** — A virtual worker is trusted only when its entire existence can be requested, proven, bounded, verified, supervised, suspended, and retired under governance.

---

# Autonomous Worker Creation Rule

The Worker Engine may automate workforce creation, but **worker creation is not authority creation**.

A worker may be created automatically when a deterministic evidence bundle passes policy:

`Demand Evidence → Economic Check → Capacity Check → Blueprint Check → Risk Check → Creation Policy → Worker Record → Identity → Shadow/Limited State`

Required evidence should include, as applicable:

- observed workload/backlog/SLA metrics;
- source and time window of each metric;
- available budget and projected cost;
- active worker count and approved cap;
- approved blueprint/version;
- skill/tool certification state;
- security and dependency health;
- governance freeze status;
- worker duration/expiry condition;
- requested scope and exposure class.

The Worker Engine may not use a free-form AI explanation as the sole justification for creation.

### Autonomy levels

**Level 0 — Manual:** human requests; system validates and executes.

**Level 1 — Assisted:** system detects need and recommends creation; authorized person confirms.

**Level 2 — Autonomous within caps:** deterministic evidence passes predefined policy; worker is created automatically into Shadow/Sandbox/Limited state.

**Level 3 — Pre-certified limited activation:** only explicitly pre-authorized low-risk blueprints may activate automatically within narrow task, data, duration, and exposure limits.

**Level 4 — Forbidden:** no autonomous authority expansion, blueprint self-approval, verification bypass, audit suppression, unlimited financial exposure, unrestricted ledger-write access, Governance override, or self-directed creation of higher-authority workers.

---

# AI Boundary

The worker lifecycle must remain functional if AI is disabled.

AI may assist with:

- document/data extraction;
- semantic matching;
- classification;
- anomaly explanation;
- summarization;
- non-authoritative recommendations.

AI must not be the sole source of:

- worker identity;
- authority;
- financial truth;
- permission grants;
- policy interpretation that bypasses deterministic policy;
- ledger mutation;
- certification;
- suspension decisions;
- audit evidence.

The system should prefer deterministic computation whenever the task can be solved reliably without AI. AI output must enter through a typed/bounded interface and pass deterministic validation before affecting material state.

---

# Non-Negotiable Implementation Gate

These 200 questions are the specification and reverse-engineering test. They are **not evidence of implementation**.

The branch remains **MERGE BLOCKED** until BP-002 exists as a complete, working reference implementation.

## Required proof before merge

1. BP-002 exists as a versioned machine-readable blueprint.
2. A real Worker Creation Contract can be validated.
3. A real Worker Record can be instantiated.
4. Worker identity is issued and scoped.
5. Worker enters Shadow Mode before protected active authority unless a separately certified limited-activation path applies.
6. Controlled Finance Lane routing works.
7. Deterministic context assembly works and is bounded.
8. Real skills execute through defined interfaces.
9. AI, if invoked, is bounded to the approved ~5% capability surface and cannot bypass deterministic controls.
10. Approved tools perform all protected financial mutations.
11. Idempotency prevents duplicate effects.
12. Deterministic verification proves state transitions.
13. Failure routes to retry/dead-letter/escalation rather than disappearing.
14. Suspension revokes or blocks active authority.
15. A suspended worker cannot perform privileged work.
16. Audit evidence identifies worker, blueprint, contract, context, skill, tool, result, and verifier.
17. Shadow tests include hidden and adversarial cases.
18. End-to-end tests demonstrate intake → routing → context → skill → tool → verification → audit.
19. Failure, timeout, retry, compensation/rollback, and escalation paths are demonstrated.
20. Certification is recorded for the exact versions tested.
21. Retirement revokes credentials and closes lifecycle state safely.
22. The implementation is reproducible and independently reviewable.

## Merge Rule

> **DOCUMENTED ≠ IMPLEMENTED**
>
> **IMPLEMENTED ≠ PROVEN**
>
> **PROVEN ≠ CERTIFIED**
>
> **CERTIFIED + COMPLETE END-TO-END EVIDENCE = MERGE ELIGIBILITY**

Until that condition is satisfied, this workforce branch MUST NOT be merged into the protected target branch.

## Reference Operating Loop

`Need → Evidence → Function → Blueprint → Creation Policy → Worker Record → Identity → Provisioning → Context → Routing → Skill → Optional AI → Deterministic Validation → Tool → State Transition → Verification → Audit → Supervision → Remediation/Suspension → Recertification → Retirement`

The worker must remain explainable as a governed computer system even if every AI component is removed.
