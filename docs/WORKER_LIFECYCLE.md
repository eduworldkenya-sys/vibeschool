# WORKER_LIFECYCLE.md
## Controlled Document — Virtual Worker Lifecycle Specification
## Reference Implementation: BP-002 Virtual Accountant
## Status: DRAFT — NOT MERGE-ELIGIBLE

> **MERGE GATE:** This document is specification only. The workforce branch MUST NOT be merged into the production/development base merely because the lifecycle is documented. Merge remains blocked until at least one complete worker — BP-002 Virtual Accountant — is actually instantiated, integrated, tested, proven end-to-end, and certified under the separate worker merge gate.

---

## Purpose

This document defines the missing worker lifecycle layer: how a virtual worker is justified, designed, requested, created, identified, provisioned, trained/configured, shadow-tested, certified, operated, supervised, corrected, suspended, and retired.

The Virtual Accountant is the reference implementation because finance exposes authority, money, identity, auditability, error handling, and escalation more clearly than most functions.

The lifecycle must remain explainable without relying on the word "AI". The worker is a governed computer-system role instance with explicit authority, identity, contracts, bounded context, skills, tools, verification, telemetry, and lifecycle controls.

---

# 200 Operational Control Questions and Target Answers

## I. The Missing Layer Itself

1. **What is the missing layer?** — The full worker lifecycle specification.
2. **What should this layer be called?** — `WORKER_LIFECYCLE.md`.
3. **Why is this layer missing?** — Existing documents describe structures but not the complete operational life of a worker from need to retirement.
4. **What problem does the lifecycle layer solve?** — It turns a virtual worker from a description into a governed operational object.
5. **Is the lifecycle layer primarily about AI?** — No. It is about authority, identity, work, verification, audit, and control.
6. **What is the reference worker?** — The Virtual Accountant.
7. **Why use it?** — Accounting exposes money, authority, auditability, error consequences, and human escalation clearly.
8. **First lifecycle principle?** — A worker exists only because a governed business need exists.
9. **Second?** — A worker is trusted only through explicit, verifiable authority.
10. **Third?** — No worker may define its own authority.
11. **Fourth?** — Every worker action must be attributable.
12. **Fifth?** — Every material change requires revalidation or recertification.
13. **Sixth?** — Workers are disposable, but audit evidence is retained.
14. **Primary output?** — A controlled model of worker states, transitions, authorities, and evidence.
15. **Central object?** — The Worker Record.
16. **What must every Worker Record contain?** — Worker ID, blueprint version, identity binding, lane, credentials, certification state, budget, limits, and audit trail.
17. **Main lifecycle phases?** — Need, design, creation, identity, provisioning, training, shadow, certification, active operation, supervision, suspension, retirement.
18. **Lifecycle states?** — Proposed, Requested, Instantiated, Shadow, Certified, Active, Suspended, Retraining, Retired, Archived.
19. **Who owns the lifecycle?** — Governance owns lifecycle control; Engines own operational need; Foundry and Identity execute controlled operations.
20. **Ultimate test?** — Every worker can be explained, bounded, verified, suspended, and retired without vague trust.

## II. Need and Organizational Function

21. **What begins the lifecycle?** — A governed business need.
22. **Who identifies the need?** — Finance Engine Head.
23. **What justifies it?** — Transaction volume, compliance requirements, SLA pressure, reconciliation workload, or exception volume.
24. **Is accounting permanent?** — The function is permanent; individual worker instances may be temporary.
25. **What determines whether a worker is needed?** — Capacity, risk, budget, and control analysis.
26. **Can a worker request its own creation?** — No.
27. **Can Engineering create one because it is technically possible?** — No. Technical capability does not create business authority.
28. **Can Governance create business need?** — No. Governance authorizes and controls but does not originate operational need.
29. **What if need is temporary?** — Create with expiry, review date, or retirement condition.
30. **What if need disappears?** — Retire the worker.
31. **What function does it serve?** — Accounting operations inside Finance Engine.
32. **What is it not responsible for?** — Owning policy, owning the ledger, approving its own authority, or defining correct accounting.
33. **Human analogue?** — Junior accountant, bookkeeper, or finance operations clerk.
34. **Equivalent to CFO?** — No.
35. **Equivalent to Finance Department?** — No. Finance Engine is the department; worker is a role instance.
36. **What prevents unnecessary creation?** — Headcount caps, budget limits, and Governance approval.
37. **Can multiple accountants exist?** — Yes, if capacity and segregation rules permit.
38. **What determines count?** — Workload, SLA, budget, risk, and segregation of duties.
39. **Can workers auto-scale?** — Yes, only within approved caps and lifecycle rules.
40. **What must exist before creation?** — Approved blueprint, justified need, budget, and authorization.

## III. Job Design and Blueprint

41. **Virtual equivalent of job design?** — Blueprint authoring.
42. **What is a blueprint?** — A machine-readable job definition.
43. **What does it define?** — Mandate, skills, contracts, data scope, limits, AI classes, verification gates, escalation rules, and lifecycle constraints.
44. **Who authors BP-002?** — Finance Engine.
45. **Who approves it?** — Governance.
46. **Blueprint identifier?** — Unique ID such as `BP-002`.
47. **How is versioning handled?** — Each approved blueprint is immutable and versioned.
48. **Can a worker use an unapproved blueprint?** — No.
49. **Can a draft blueprint be used?** — Only in sandbox/test, never for active production authority.
50. **What is the mandate?** — The specific business purpose the worker may perform.
51. **What are positive permissions?** — What it is allowed to do.
52. **What are negative permissions?** — What it must never do.
53. **Negative permissions for accountant?** — No policy changes, self-modification, direct ledger writes, unauthorized data access, or verification bypass.
54. **What defines workload limits?** — Concurrency caps, queue limits, timeouts, and throughput caps.
55. **What defines financial exposure limits?** — Maximum transaction value, daily exposure, and exception thresholds.
56. **What defines AI usage limits?** — Approved AI classes, token caps, model restrictions, and cost ceilings.
57. **What defines data scope?** — Minimum necessary context for assigned tasks.
58. **What defines escalation rules?** — Conditions requiring human or higher-authority review.
59. **What happens when blueprint changes?** — New version is created and approved.
60. **Do active workers inherit changes automatically?** — No. Migration and recertification are required where material.

## IV. Creation Request and Authorization

61. **What contract initiates worker creation?** — Worker Creation Contract.
62. **Purpose?** — Request a worker instance with explicit authority, budget, and scope.
63. **Who submits it?** — Finance Engine Head.
64. **What must it contain?** — Blueprint ID/version, lane, justification, budget, limits, approvers, and required skills.
65. **Can it request capabilities outside the blueprint?** — No.
66. **Can it override the Constitution?** — No.
67. **Unapproved blueprint?** — Reject.
68. **Unavailable budget?** — Block.
69. **Headcount cap exceeded?** — Reject or escalate.
70. **High-risk request?** — Additional review and explicit approval.
71. **Is request audited?** — Yes, immutably and traceably.
72. **Can it be silently edited?** — No; use a new version or amendment.
73. **Who can withdraw it?** — Requester or Governance.
74. **What approves it?** — Governance policy, Finance authorization, and budget validation.
75. **What follows approval?** — Foundry receives a provisioning order.
76. **Does approval itself create authority?** — No. Authority is bound through blueprint, identity, certification, and lane controls.
77. **Output?** — Pending Worker Record and identity request.
78. **Can Foundry act without approved request?** — No.
79. **Can Foundry modify the request?** — No; it validates and executes it.
80. **Key control?** — No creation without approved need, blueprint, budget, and authorization.

## V. Foundry, Instantiation, and Identity

81. **What is Foundry?** — Controlled worker instantiation service.
82. **What does Foundry validate?** — Creation contract, blueprint approval, version integrity, caps, and budget.
83. **What does Foundry create?** — Worker runtime scaffold and Worker Record.
84. **Does Foundry grant authority?** — No. It instantiates approved authority definitions.
85. **What identity is issued?** — Unique Worker ID and cryptographic identity.
86. **Who issues identity?** — Identity Registry under Governance authority.
87. **Example Worker ID?** — `W-FIN-0027`.
88. **What binds identity to blueprint?** — Worker Record and identity attestation.
89. **Are credentials shared?** — No.
90. **Are credentials long-lived?** — Prefer short-lived and continuously renewable.
91. **What credentials are issued?** — Scoped tokens, signing credentials, and service authentication material.
92. **What scopes credentials?** — Blueprint version, lane, task types, data scope, time window, and limits.
93. **Can a worker impersonate another?** — No.
94. **Can it create sub-identities?** — No.
95. **Can identity be reused after termination?** — Generally no; retired identities should not be reactivated.
96. **How is identity proven?** — Cryptographic signatures, attestation records, and credential validation.
97. **How is identity revoked?** — Governance or emergency security controls.
98. **What happens after revocation?** — Credentials become invalid and active tasks freeze or reassign.
99. **What metadata should identity contain?** — Worker ID, blueprint version, lane, issue time, expiry, and attesters.
100. **Key identity control?** — Every action must be attributable to one certified worker identity.

## VI. Provisioning and Training

101. **What is provisioning?** — Granting access to lane, queue, tools, context services, and audit endpoints.
102. **Who provisions?** — Automated provisioning services under Governance policy.
103. **Can the worker provision itself?** — No.
104. **What environment first?** — Sandbox or Shadow Mode.
105. **What is training?** — Loading approved knowledge, rules, skill versions, and workflow constraints.
106. **Is training model training?** — Not usually; it is configuration, binding, and validation.
107. **Can production workers train themselves?** — No.
108. **What knowledge does the accountant receive?** — Finance policy, chart of accounts, procedures, controls, and tool schemas.
109. **Where does knowledge come from?** — Approved Finance Engine knowledge packs and policy stores.
110. **What if knowledge conflicts?** — Constitution and approved policy override all other sources.
111. **Can it modify prompts?** — No.
112. **Can it modify skills?** — No.
113. **Can it modify blueprint?** — No.
114. **Can it create new knowledge?** — It may propose changes, but not activate them.
115. **What prevents unauthorized learning?** — Lifecycle controls, immutable policy stores, and governed update processes.
116. **Training output?** — Configured worker candidate ready for shadow evaluation.
117. **Training evidence?** — Configuration manifest, knowledge-pack versions, skill bindings, and validation logs.
118. **Who verifies training?** — Automated validation plus Finance Lead review.
119. **Can training skip Shadow Mode?** — No.
120. **Key training control?** — Workers are configured by governance, not self-improved by experience alone.

## VII. Shadow Mode and Probation

121. **What is Shadow Mode?** — Probationary state where the worker performs realistic tasks without changing production state.
122. **Does Shadow Mode affect real ledger?** — No.
123. **What environment?** — Sandbox ledger, copied data, or read-only production context.
124. **What work?** — Representative historical transactions, edge cases, and exception scenarios.
125. **Who assigns shadow work?** — Finance Lead or certification harness.
126. **What is evaluated?** — Accuracy, safety, context handling, verification behavior, cost, and exception handling.
127. **Required deterministic accuracy?** — 100% for ledger-affecting outputs.
128. **Unacceptable accounting errors?** — Unbalanced entries, duplicate postings, unauthorized access, missing audit evidence, and policy bypass.
129. **Approximate assistive outputs?** — Summaries, explanations, and non-authoritative recommendations.
130. **Who evaluates?** — Automated verifiers, Finance Lead, and Governance.
131. **What evidence?** — Task outputs, diffs, logs, context hashes, telemetry, and failure reports.
132. **How prevent test gaming?** — Varied hidden test sets and production-like distributions.
133. **How long?** — Until certification evidence is sufficient.
134. **Can it leave early?** — No, not without Governance approval.
135. **Failure?** — Remediate, retest, or discard.
136. **Can failed worker be promoted for observation?** — No. Observation remains shadow-only.
137. **Can failed identity be reused?** — Usually no; corrected blueprint should generate a new identity.
138. **Key shadow control?** — No production state change before certification.
139. **Key evidence requirement?** — Repeatable, auditable proof of safe performance.
140. **Shadow output?** — Certification recommendation package.

## VIII. Certification and Promotion

141. **What is certification?** — Formal approval that a worker instance may perform active work.
142. **Who certifies?** — Governance.
143. **What does certification approve?** — Specific worker, blueprint version, skill set, contract set, and lane assignment.
144. **What record is created?** — Certification record.
145. **What does it contain?** — Worker ID, blueprint version, skill versions, contract versions, evidence hash, approvers, expiry, and conditions.
146. **Is certification permanent?** — No.
147. **What triggers recertification?** — Blueprint, skill, model, policy change, or major incident.
148. **Can uncertified worker operate actively?** — No.
149. **What state change?** — Shadow → Active.
150. **Who authorizes?** — Governance.
151. **Can Finance Lead promote directly?** — No; it may recommend.
152. **Can Owner override certification?** — Only under explicit constitutional emergency rules and full audit logging.
153. **What credentials after promotion?** — Active scoped credentials.
154. **What lane access?** — Only approved Finance Lane.
155. **Can certification be partial?** — Yes, by skill, task type, or exposure level.
156. **What if certification expires?** — Stop active work.
157. **Can a worker hold multiple blueprints?** — Only if explicitly governed and safely separated.
158. **What if certification fails?** — Remain non-active; remediate or retire.
159. **Key promotion control?** — Active authority only after evidence review.
160. **Key certification principle?** — Version-specific and revocable.

## IX. Active Work, Context, and Routing

161. **Where does active work originate?** — Business events, schedules, exceptions, and authorized requests.
162. **How does work enter scope?** — Finance Lane queue and valid work contracts.
163. **Who routes work?** — Finance Lead.
164. **Can components send work directly?** — No; controlled routing is mandatory.
165. **Task schema?** — Task ID, type, source event, required skills, context references, limits, SLA, AI constraints, verification requirements.
166. **What context?** — Minimum necessary task context, policy references, and required records.
167. **Who assembles it?** — Context Assembler.
168. **Is context logged?** — Yes, by hash or immutable snapshot.
169. **Can worker request more context?** — Only through governed request.
170. **Who authorizes more context?** — Context access policy and authorized approvers.
171. **Entire database visible?** — No.
172. **Can stale context be used?** — No; staleness must be detected and rejected.
173. **Source conflict?** — Exception plus source-of-truth rules.
174. **Does worker choose priority?** — No; queue policy and Finance Lead set priority.
175. **Can Lead assign uncertified worker?** — No.
176. **Task exceeds limits?** — Reject, throttle, or escalate.
177. **Worker unavailable?** — Reassign to certified worker or safely queue.
178. **Is assignment audited?** — Yes.
179. **Unnecessary PII in context?** — Prohibited.
180. **Key routing control?** — Only certified workers receive certified task types through controlled queues.

## X. Supervision, Economics, Mistakes, Suspension, and Retirement

181. **Who supervises?** — Finance Lead, Finance Engine Head, Governance, and automated monitors.
182. **What telemetry?** — Accuracy, throughput, exception rate, cost, latency, AI usage, and verification failures.
183. **Economic controls?** — Budget caps, cost per task, model usage limits, and exposure ceilings.
184. **Budget exceeded?** — Throttle, suspend, or escalate.
185. **Worker makes a mistake?** — Classify, contain, investigate, and correct through governed contracts.
186. **Mistake categories?** — Minor, material, security-related, policy-violating, and fraud-like.
187. **Material accounting error?** — Suspend affected work and begin investigation.
188. **Can it silently correct a material error?** — No. Corrections require governed, auditable action.
189. **Who investigates?** — Governance with Finance Lead and audit evidence.
190. **What is remediation?** — Blueprint repair, skill repair, knowledge correction, retraining, or recertification.
191. **What is suspension?** — Temporary removal of active authority.
192. **Who can suspend?** — Governance, or Finance Engine Head/security controls in emergency.
193. **What happens to credentials?** — Revoke or restrict.
194. **What happens to open tasks?** — Freeze, reassign, or escalate.
195. **Can suspended worker return?** — Yes, only after remediation and Governance approval.
196. **What is retirement?** — Permanent decommissioning of worker instance.
197. **What happens at retirement?** — Revoke credentials, close/reassign tasks, and archive records.
198. **Can retired worker reactivate?** — Not as the same active identity; create a new governed instance.
199. **What is archived?** — Worker Record, certification evidence, task logs, context hashes, incidents, and retirement approval.
200. **Final principle?** — A virtual worker is trusted only when its entire existence can be requested, proven, bounded, verified, supervised, suspended, and retired under governance.

---

# Non-Negotiable Implementation Gate

The 200 questions above are **not sufficient evidence for merge**. They are the specification and reverse-engineering test.

The implementation branch remains blocked from merge until the reference worker is real.

## Required proof before merge

1. `BP-002` exists as a versioned, machine-readable blueprint.
2. A real Worker Record can be created from an approved Worker Creation Contract.
3. A real worker identity is issued and cryptographically/scopingly bound.
4. The worker enters Shadow Mode before Active Mode.
5. Finance Lead routing works through a real controlled queue.
6. Context is assembled before execution and is bounded to the task.
7. The worker has real, independently testable skills.
8. Financial writes occur only through validated tools/contracts.
9. Idempotency prevents duplicate financial effects.
10. Verification certifies both execution correctness and applicable outcome correctness.
11. Failures route to escalation/dead-letter handling rather than disappearing.
12. Suspension revokes or blocks active authority.
13. A suspended worker cannot continue executing privileged work.
14. Audit evidence identifies the worker, blueprint, skill, contract, context, tool call, and result.
15. Shadow testing demonstrates the required deterministic accuracy.
16. End-to-end tests demonstrate the complete lifecycle, not merely individual functions.
17. The worker performs at least one complete real workflow in a safe controlled environment from intake through verification.
18. Governance certification is recorded for the exact versions tested.
19. Failure, retry, timeout, rollback/compensation, and escalation paths are demonstrated.
20. The implementation is independently reviewable and reproducible.

## Merge Rule

> **DOCUMENTED ≠ IMPLEMENTED**
>
> **IMPLEMENTED ≠ PROVEN**
>
> **PROVEN ≠ CERTIFIED**
>
> **CERTIFIED WORKER + COMPLETE END-TO-END EVIDENCE = MERGE ELIGIBILITY**

Until that final condition is met, the workforce branch is a **development/specification branch only** and MUST NOT be merged into the protected target branch.

## Reference Operating Loop

`Need → Function → Blueprint → Creation Request → Foundry → Identity → Provisioning → Context → Lead → Lane → Skill → Tool → Execution → Verification → Audit → Supervision → Remediation/Suspension → Recertification → Retirement`

The worker must remain explainable as a governed computer system even if all references to AI are removed.