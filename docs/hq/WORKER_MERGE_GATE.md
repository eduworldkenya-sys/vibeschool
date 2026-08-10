# WORKER_MERGE_GATE.md
## Controlled Engineering Rule — Virtual Worker Branch Promotion
## Reference Worker: BP-002 Virtual Accountant
## Status: DRAFT / IMPLEMENTATION REQUIRED

---

## 1. Non-Negotiable Promotion Rule

The virtual-worker branch MUST NOT be merged into `main` merely because the architecture, documentation, migrations, schemas, or worker lifecycle specifications are complete.

The branch remains unmerged until at least one complete virtual worker has been implemented and proven to function end-to-end in the actual VibeSchool operating environment.

The reference implementation is **BP-002 Virtual Accountant**.

> Documentation describes the worker. Tests prove the worker. Production-safe certification proves the system.

---

## 2. Definition of "Complete Working Worker"

BP-002 is considered complete only when all of the following are demonstrably implemented and passing:

1. Worker creation from an approved blueprint.
2. Unique worker identity and scoped credentials.
3. Lane assignment and enforcement.
4. Lead-to-worker routing.
5. Deterministic context assembly.
6. Contract-bound skill invocation.
7. Tool-bound data access.
8. Deterministic financial state mutation through approved tools only.
9. Verification before task completion.
10. Audit evidence for every material state transition.
11. Idempotent execution.
12. Timeout and retry controls.
13. Dead-letter and human escalation.
14. Credential revocation and task freezing.
15. Shadow-mode execution.
16. Certification and promotion from Shadow to Active.
17. Re-certification on material blueprint, skill, policy, model, or infrastructure changes.
18. Safe suspension and retirement.

A worker that exists only as database rows, prompts, APIs, migrations, or UI is **not** considered complete.

---

## 3. Required Accounting Skills

The reference worker must demonstrate working implementations of the certified Finance skills:

- `invoice-generate`
- `mpesa-reconcile`
- `ledger-post`
- `statement-generate`
- `anomaly-flag`

Deterministic accounting operations must be AI-0 and must achieve zero-tolerance correctness for ledger integrity.

AI-O functions may assist with summaries or anomaly explanations but may never directly mutate financial state.

---

## 4. End-to-End Proof

The following scenario must work as a complete executable loop:

`Business Event → Work Item → Context Assembly → Finance Lead → Finance Lane → BP-002 → Skill → Approved Tool → State Mutation → Verification → Audit Evidence → VERIFIED`

Example:

`M-Pesa payment received → reconciliation task created → bounded school context assembled → Finance Lead routes task → BP-002 matches payment to invoice → deterministic ledger-post tool records exactly once → post-state verification succeeds → audit record created → task becomes VERIFIED.`

The proof must be executable, repeatable, and independently verifiable.

---

## 5. Mandatory Failure Tests

The worker must also prove safe behavior for at least these cases:

- duplicate payment/webhook
- missing invoice
- ambiguous payment
- invalid transaction
- ledger imbalance
- unauthorized data request
- cross-school access attempt
- direct-write attempt outside the ledger tool
- expired/revoked credential
- stale context
- context/source-of-truth conflict
- tool failure
- timeout
- retry exhaustion
- verification failure
- lane violation
- skill not present in certified blueprint
- blueprint version mismatch
- worker suspension during an active task

Expected behavior is controlled rejection, containment, retry within policy, or escalation — never silent improvisation.

---

## 6. Reverse-Engineering Acceptance Standard

The 200-question Virtual Accountant reverse-engineering exercise is an acceptance-test source, not merely a glossary or design discussion.

For every major question, the implementation must eventually provide one of three forms of evidence:

- **Code/configuration evidence** — the behavior is implemented.
- **Database/contract evidence** — the authority boundary is structurally enforced.
- **Test evidence** — the behavior has been exercised and passed.

An answer in documentation without corresponding implementation evidence does not count as proof.

---

## 7. Real-World Company Test

The worker must remain understandable if the word `AI` is removed from the documentation.

The resulting explanation must still describe:

- why the Finance job exists;
- who owns it;
- who created it;
- what authority it possesses;
- what work enters its queue;
- what data it can see;
- what tools it can use;
- what actions it cannot perform;
- who verifies its work;
- who can suspend it;
- who can retire it; and
- how every material action is audited.

If the implementation relies on "the model will know not to do that" rather than infrastructure, contract, policy, or verification enforcement, the relevant gate is considered failed.

---

## 8. Shadow-to-Active Gate

BP-002 MUST first operate in Shadow Mode against representative historical or controlled transaction data.

Shadow Mode must demonstrate:

- deterministic accounting accuracy;
- no duplicate postings;
- no unauthorized writes;
- no cross-tenant access;
- correct escalation;
- complete audit evidence;
- correct timeout/retry behavior; and
- acceptable AI-O advisory performance where applicable.

Governance certification is required before Active execution authority is granted.

---

## 9. Merge Blocker

Until the complete worker has passed the required implementation and verification gates:

- do not merge the worker branch into `main`;
- do not treat documentation completion as certification;
- do not treat migrations as proof of runtime correctness;
- do not treat unit tests alone as proof of end-to-end operation;
- do not grant production financial execution authority;
- do not silently convert the branch from experimental to production architecture.

The branch may continue to receive implementation commits, tests, fixes, migrations, documentation, and verification evidence.

---

## 10. Required Final Evidence Before Merge

The merge proposal must contain a final evidence package containing at minimum:

1. Exact worker ID and blueprint version.
2. Exact skill and contract versions.
3. Creation/instantiation evidence.
4. Identity and credential evidence.
5. Successful end-to-end execution trace.
6. Shadow-mode test report.
7. Failure-mode test report.
8. Verification/certification record.
9. Audit-log evidence.
10. Security/authority-boundary test results.
11. Performance and cost measurements.
12. Reproducible test instructions.
13. Governance approval.

Only then may the branch be considered **MERGE-ELIGIBLE**.

---

## 11. Lifecycle Principle

The lifecycle is:

`Need → Function → Job Design → Blueprint → Creation Request → Foundry → Identity → Provisioning → Context → Lead → Lane → Skill → Tool → Execution → Verification → Certification → Active Operation → Supervision → Suspension/Remediation → Retirement`

No lifecycle stage may be implied solely by the existence of another stage.

A created worker is not necessarily a certified worker.
A certified worker is not necessarily an active worker.
An active worker is not necessarily a proven worker.

**Proven means the complete operational loop has executed successfully and its boundaries have been tested under failure conditions.**

---

## 12. Final Rule

> **No complete working BP-002 Virtual Accountant, no merge.**
>
> The branch exists to build and prove the worker — not merely to describe one.

Status: **MERGE BLOCKED — IMPLEMENTATION AND PROOF REQUIRED**
