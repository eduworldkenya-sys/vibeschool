# WORKER_REVERSE_ENGINEERING_QUESTIONS.md
## Controlled Review — 200 Questions Before Worker Implementation
## Reference Implementation: BP-002 Virtual Accountant
## Status: QUESTIONS ONLY — ANSWERS ARE MAINTAINED IN `docs/WORKER_LIFECYCLE.md`

> These questions are intentionally preserved as questions first. They are the reverse-engineering interview that must be answered before the Virtual Accountant is treated as a production-grade organizational worker.

---

## PART I — WHY DOES THE ACCOUNTANT EXIST?

1. What business problem caused VibeSchool to need a Virtual Accountant?
2. Who originally identified the need?
3. Is the need permanent or temporary?
4. What function does the accountant belong to?
5. What organizational objective does Finance serve?
6. What would happen if there were no accountant?
7. Which human job does the Virtual Accountant correspond to?
8. Is it equivalent to a junior accountant, bookkeeper, finance clerk, or an entire finance department?
9. What responsibilities belong to the Finance Engine rather than the worker?
10. What responsibilities belong specifically to the worker?
11. Who is accountable for the worker's outputs?
12. Who owns the accounting function?
13. Who owns the accounting policies?
14. Who owns the financial source of truth?
15. Who decides what “correct accounting” means?
16. What regulatory obligations apply to the accounting function?
17. What business processes require accounting?
18. What events create accounting work?
19. What events do not create accounting work?
20. What measurable value does the worker produce?

---

## PART II — REAL-WORLD COMPANY COMPARISON

21. If VibeSchool were a physical company, what department would the worker sit in?
22. Who would be the worker's manager?
23. Who would be the worker's supervisor?
24. Who would be the equivalent of HR?
25. Who would interview the worker?
26. Who would approve its hiring?
27. Who would write its job description?
28. Who would define its salary or operating budget?
29. Who would train it?
30. Who would supervise its probation?
31. Who would approve it for independent work?
32. Who would review its performance?
33. Who would investigate misconduct?
34. Who would suspend it?
35. Who would terminate it?
36. What is the virtual equivalent of an employee number?
37. What is the virtual equivalent of an employment contract?
38. What is the virtual equivalent of a job description?
39. What is the virtual equivalent of a company ID card?
40. What is the virtual equivalent of an employee's workstation?

---

## PART III — HOW WAS THE WORKER BORN?

41. What event causes the Virtual Accountant to be created?
42. Who requests its creation?
43. What evidence justifies the request?
44. Is one accountant created permanently or can multiple accountants exist?
45. What determines the number of accountants?
46. Can the system create an accountant automatically?
47. Which engine makes that decision?
48. Can HR create the worker directly?
49. Can Finance create its own worker?
50. Can Governance create it?
51. Can Engineering create it?
52. Can the Owner create it directly?
53. What contract initiates creation?
54. What data is sent to the creation engine?
55. How does the Foundry know which blueprint to use?
56. How does it know which version of the blueprint is approved?
57. What happens if the blueprint is not approved?
58. What happens if the requested headcount exceeds the cap?
59. What happens if the requested budget is unavailable?
60. What happens if the request contains an invalid capability?

---

## PART IV — THE BLUEPRINT

61. What exactly is the Virtual Accountant blueprint?
62. What is its unique identity?
63. Which version of the blueprint is instantiated?
64. What is its mandate?
65. What can it do?
66. What can it never do?
67. What data can it access?
68. What data is explicitly inaccessible?
69. What systems can it interact with?
70. What systems can it never interact with?
71. Which contracts can it invoke?
72. Which contracts can invoke it?
73. What is its maximum workload?
74. What is its maximum financial exposure?
75. What is its maximum transaction volume?
76. What is its maximum AI usage?
77. What is its maximum execution time?
78. What happens when it reaches a ceiling?
79. What happens when the blueprint changes?
80. Does an existing worker automatically inherit the new blueprint?

---

## PART V — IDENTITY

81. When the accountant is created, what identity is issued?
82. Does it have a unique worker ID?
83. Does it have a cryptographic identity?
84. Who issues that identity?
85. Who attests the identity?
86. What credentials does it receive?
87. How are credentials scoped?
88. Can it authenticate as another worker?
89. Can two workers share credentials?
90. How does the system prove which worker performed an accounting action?
91. Can the identity be impersonated?
92. How is impersonation detected?
93. Who can revoke the identity?
94. How quickly can credentials be revoked?
95. What happens to outstanding tasks when identity is revoked?

---

## PART VI — RECRUITMENT / HIRING ANALOGY

96. What is the virtual equivalent of recruitment?
97. What is the virtual equivalent of an application?
98. What is the virtual equivalent of an interview?
99. What is the virtual equivalent of reference checking?
100. What evidence must exist before hiring?
101. What is the equivalent of a criminal/background check where legally relevant?
102. What is the equivalent of professional qualification verification?
103. Can a blueprint be instantiated without a test?
104. Who decides that the candidate is suitable?
105. What happens if the candidate fails?
106. Is a failed worker destroyed or retained for analysis?
107. Can the same failed identity be retrained?
108. Can a new identity be created from the same blueprint?
109. How do we prevent a failed candidate from reaching production?
110. What constitutes “hired”?

---

## PART VII — TRAINING

111. What does it mean to train a Virtual Accountant?
112. Is training model training, configuration, rule loading, workflow learning, or something else?
113. What knowledge does the accountant receive?
114. Where does that knowledge come from?
115. Which policies are authoritative?
116. Which accounting rules are deterministic?
117. Which procedures are configurable?
118. Which knowledge is allowed to come from AI?
119. Can the worker learn from previous transactions?
120. Can it modify its own accounting rules?
121. Can it modify its own prompts?
122. Can it modify its own skills?
123. Can it modify its own blueprint?
124. Can it create new skills?
125. Can it change institutional memory?

---

## PART VIII — SHADOW MODE / PROBATION

126. What exactly does Shadow Mode mean for the accountant?
127. Does it receive real transactions?
128. Does it receive copies of real transactions?
129. Does it execute against a sandbox ledger?
130. What historical transactions are used?
131. How many transactions must it process?
132. What constitutes a passing result?
133. What accounting errors are acceptable?
134. What accounting errors are absolutely unacceptable?
135. Must it achieve 100% deterministic accuracy?
136. Which tasks can tolerate approximation?
137. Who evaluates its results?
138. What evidence does Governance receive?
139. Can the accountant see the evaluator?
140. How do we prevent it from optimizing specifically for the test?

---

## PART IX — PROMOTION

141. What exactly causes promotion from Shadow to Active?
142. Who authorizes promotion?
143. What certification record is created?
144. Which blueprint version is certified?
145. Which skill versions are certified?
146. Which contract versions are certified?
147. Is certification permanent?
148. When does certification expire?
149. Does a material policy change invalidate certification?
150. Does a skill change require re-certification?
151. Does a model change require re-certification?
152. Does an accounting-system migration require re-certification?
153. Can Governance refuse promotion?
154. Can the Owner override Governance?
155. What happens when certification fails?

---

## PART X — THE ACCOUNTANT'S ACTUAL WORK

156. Where does an accounting task originate?
157. Does it arrive through a queue?
158. Who creates the work item?
159. What is the task schema?
160. What context is assembled before execution?
161. Who assembles that context?
162. What source is authoritative for each financial fact?
163. Can the accountant query raw database tables?
164. Can it write directly to the ledger?
165. If not, what tool performs the write?
166. What validation occurs before posting?
167. What validation occurs after posting?
168. What makes a transaction idempotent?
169. What happens if the same payment arrives twice?
170. What happens if a payment is partially reconciled?

---

## PART XI — SKILLS

171. What individual skills make up the Virtual Accountant?
172. Is “accounting” one skill or many?
173. Could the worker contain separate skills for invoice creation, reconciliation, ledger posting, anomaly detection, reporting, and statement generation?
174. Which skills are AI-0?
175. Which skills are AI-O?
176. Is any accounting skill AI-R?
177. Can an AI-O skill directly change financial state?
178. What deterministic verification follows an AI-O output?
179. What happens if verification fails?
180. Can the worker select its own skills?

---

## PART XII — CONTEXT

181. What does the accountant actually see before doing a task?
182. Does it receive the entire financial database?
183. What is the minimum context required for reconciliation?
184. Who determines that minimum?
185. Can the worker request additional context?
186. Who authorizes additional context?
187. Can context include confidential learner information?
188. Can context include unrelated financial records?
189. How is stale financial context detected?
190. What happens when two sources disagree?
191. Which source wins?
192. Does the accountant know why a source is authoritative?
193. Is the assembled context logged?
194. Can the context be replayed later?
195. Can institutional memory modify the context automatically?

---

## PART XIII — LEAD / ROUTING

196. Who sends work to the Virtual Accountant?
197. Is there a Lead?
198. Does the Lead understand accounting?
199. Can the Lead assign an accounting task to another worker?
200. What prevents the Lead, worker, AI model, or any other component from bypassing the Accountant's blueprint, lane, contract, verification gates, and constitutional authority?

---

## REVIEW RULE

These 200 questions are the reverse-engineering gate. They are not a substitute for the lifecycle specification. The questions establish what must be explainable; `WORKER_LIFECYCLE.md` records the current target operating answer.

Before BP-002 is promoted to VERIFIED, every question must have an explicit answer, an owning authority, and—where applicable—a machine-enforceable implementation point.
