# WORKER_LIFECYCLE.md
## Controlled Document — Virtual Worker Lifecycle Specification
## Reference Implementation: BP-002 Virtual Accountant
## Status: DRAFT → pending Governance review

---

## PART I — EXISTENCE JUSTIFICATION

1. Business problem: manual fee reconciliation, invoice generation, and
   financial reporting do not scale past pilot-stage headcount; a human
   accountant is not affordable pre-revenue.
2. Need identified by: Owner (Dnjima), during pilot-stage operations review.
3. Need: permanent — Finance is a standing organizational function, not a
   project.
4. Belongs to: Finance Engine.
5. Organizational objective served: accurate, auditable, timely financial
   record-keeping for schools on the platform.
6. Without it: Owner or school admin performs reconciliation manually —
   error-prone, non-scalable, no audit trail.
7. Human equivalent: closest to a bookkeeper / junior accountant, not a
   full finance department.
8. Scope: single-role equivalent (bookkeeper), not a department. Anything
   requiring judgment calls (write-offs, disputes) escalates to human.
9. Belongs to Finance Engine (not the worker): policy definition, chart of
   accounts, approval thresholds, audit retention rules.
10. Belongs to the worker: execution of defined accounting skills within
    those policies.
11. Accountable for outputs: Finance Engine Head (role, currently Owner
    until delegated).
12. Function owner: Owner, until a Finance Lead role is formally delegated.
13. Policy owner: Governance (via hq_policy_registry), ratified by Owner.
14. Financial source of truth: `finance_ledger` table (single authoritative
    table, no shadow copies).
15. "Correct accounting" defined by: double-entry consistency +
    Kenyan basic bookkeeping standards, encoded as deterministic validation
    rules, not AI judgment.
16. Regulatory obligations: KRA record-keeping requirements (once entity is
    registered — see D-008 Legal Hold dependency), data retention for
    financial audit.
17. Processes requiring accounting: fee invoicing, M-Pesa STK reconciliation,
    expense logging, statement generation.
18. Events creating work: payment received, invoice due, reconciliation
    cycle trigger, month-end close.
19. Events NOT creating work: student enrollment, attendance, academic
    records — explicitly out of scope.
20. Measurable value: reconciliation time reduced, error rate vs. manual
    baseline, audit-readiness at any point in time.

---

## PART II — REAL-WORLD COMPANY MAPPING

21. Department: Finance.
22. Manager equivalent: Finance Lead (routing/orchestration role).
23. Supervisor equivalent: Governance (certification authority).
24. HR equivalent: Foundry (creation) + Governance (certification) jointly.
25–35. Interview/hiring/training/probation/review/misconduct/suspension/
    termination — all formalized below in Parts VI–IX; no single human
    performs these informally. Each is a logged, contract-driven step.
36. Employee number equivalent: Worker ID (e.g. `W-FIN-0001`), immutable,
    globally unique.
37. Employment contract equivalent: the Blueprint instantiation record
    (which blueprint version, which contracts, which lane).
38. Job description equivalent: the Blueprint itself (BP-002).
39. ID card equivalent: cryptographic worker identity + credential set.
40. Workstation equivalent: the worker's scoped context + tool access —
    nothing outside its lane is reachable.

---

## PART III — CREATION EVENT

41. Trigger: an approved WR-001 Creation Contract request.
42. Requestor: Finance Engine Head (role), never the worker itself.
43. Justification evidence: documented need (e.g. reconciliation volume
    exceeds manual capacity) attached to the request.
44. Multiple accountants: permitted, capped by headcount policy per lane.
45. Count determined by: workload metrics + budget ceiling, reviewed
    periodically, not ad hoc.
46. Automatic creation: NOT permitted at this stage — every creation is a
    human-approved event. Automation may be considered post-MVP with its
    own approval gate.
47. Deciding engine: Foundry, gated by Governance sign-off.
48. HR creates directly: no — HR (Governance) approves, Foundry executes.
49. Finance creates its own worker: no — requests only, cannot self-approve.
50. Governance creates directly: Governance approves; Foundry instantiates.
51. Engineering creates directly: no — Engineering builds the Foundry and
    blueprints, does not spawn workers ad hoc.
52. Owner creates directly: Owner can approve/override, but instantiation
    still runs through Foundry for audit consistency.
53. Initiating contract: WR-001.
54. Data sent to creation engine: blueprint ID + version, requested lane,
    justification reference, approver identity.
55–56. Foundry resolves blueprint + version via the Blueprint Registry
    (only VERIFIED-status blueprints are eligible).
57. Unapproved blueprint: request rejected, logged, escalated to Governance.
58. Headcount exceeded: request blocked, requires explicit cap override
    by Owner.
59. Budget unavailable: request blocked pending budget allocation.
60. Invalid capability requested: rejected at validation, before Foundry
    runs.

---

## PART IV — BLUEPRINT (BP-002)

61. The blueprint is a versioned, controlled specification document +
    machine-readable manifest defining the worker's full authority surface.
62. Unique identity: `BP-002`.
63. Instantiated version: pinned explicitly at creation time (no "latest").
64. Mandate: execute defined bookkeeping skills within Finance Lane only.
65. Can do: invoice generation, M-Pesa reconciliation, ledger posting
    (via deterministic tool, not direct write), statement generation,
    anomaly flagging (AI-O, non-binding).
66. Can never do: waive fees, alter chart of accounts, access student
    academic records, initiate refunds without human approval, modify
    its own blueprint.
67. Data access: `finance_ledger`, `invoices`, `payments`, school-scoped
    only — never cross-school.
68. Explicitly inaccessible: student PII beyond billing contact, academic
    records, safeguarding data, other schools' financial data.
69. Systems it can interact with: M-Pesa reconciliation service (read),
    ledger write tool (via contract), notification service (read-only
    trigger).
70. Systems it can never interact with: auth system, RLS policy tables,
    other engines' raw databases.
71–72. Invokable/invoking contracts: explicitly enumerated in the
    blueprint manifest — no implicit contract access.
73–77. Ceilings: max daily transaction volume, max single-transaction
    value before human approval required, max AI-O calls per task, max
    execution time per task — all set as explicit numeric limits in the
    manifest, not left open.
78. On reaching a ceiling: task pauses, escalates to human queue, does
    NOT silently retry past the limit.
79–80. Blueprint change: existing workers do NOT auto-inherit — a
    version bump requires re-certification (Part IX) before rollout.

---

## PART V — IDENTITY

81–95. Every worker receives a unique cryptographic identity issued by
    Foundry at instantiation, scoped credentials (not shared, not
    reusable across workers), and all ledger-write actions are signed
    with that identity so provenance is provable per-transaction.
    Impersonation is structurally prevented by credential scoping —
    a worker cannot authenticate as another worker because each
    credential is bound to one worker ID. Detection: any action
    attempted under a revoked or mismatched credential is rejected and
    logged as a security event, not silently dropped. Revocation
    authority: Governance or Owner; revocation is immediate; outstanding
    tasks under a revoked identity are frozen and routed to the dead
    letter queue for human reassignment, never auto-completed.

---

## PART VI — HIRING ANALOGY

96–110. "Recruitment" = the WR-001 request itself. "Application" =
    the justification + blueprint reference submitted. "Interview" =
    Shadow Mode evaluation (Part VIII). "Reference check" = blueprint's
    prior certification history, if a version has run before.
    No blueprint is instantiated into an Active lane without passing
    Shadow Mode — this is non-negotiable, not optional. A failing
    candidate (worker instance) is retained in a suspended state for
    postmortem analysis, not destroyed — but its identity is never
    reactivated into production; a fresh instance is created from a
    corrected blueprint version instead. "Hired" = Governance
    certification granted (Part IX), not merely "created."

---

## PART VII — TRAINING

111–125. "Training" here means deterministic configuration and policy
    loading, NOT model fine-tuning. The worker receives: chart of
    accounts, validation rules, applicable hq_policy_registry entries,
    and skill definitions — all authoritative, none AI-generated.
    Deterministic accounting rules (double-entry balance, tax
    calculation) are hard-coded logic. AI-O skills (e.g. anomaly
    flagging) may draw from institutional memory but cannot alter
    accounting rules. The worker CANNOT modify its own prompts, skills,
    blueprint, or institutional memory — any of those changes must go
    through the same Decision → Review → VERIFIED pipeline as any other
    structural change. This is the direct enforcement of "execution
    cannot silently rewrite structure."

---

## PART VIII — SHADOW MODE / PROBATION

126–140. Shadow Mode runs the worker against a sandboxed copy of real
    historical transactions (not live production data) — never
    synthetic-only, since real messiness matters. Volume threshold:
    minimum transaction count set per blueprint (to be defined
    numerically before first certification, e.g. N=500 historical
    transactions spanning at least one full reconciliation cycle).
    Passing bar: zero tolerance for ledger imbalance or double-posting;
    defined tolerance for AI-O anomaly-flagging false positive/negative
    rate (this can be probabilistic since it's advisory, not binding).
    Deterministic skills (posting, reconciliation math) must hit 100%
    accuracy — no tolerance. Evaluator: Governance role, using a
    ground-truth set the worker has no visibility into, specifically to
    prevent overfitting to the test.

---

## PART IX — PROMOTION

141–155. Promotion trigger: Governance sign-off after Shadow Mode passes
    all thresholds. Certification record: logged in hq_decisions,
    referencing exact blueprint version, skill versions, and contract
    versions certified together as one unit — never certified
    piecemeal. Certification expires on: any material policy change,
    any skill version change, any underlying model change (for AI-O
    components), or migration of the accounting system itself — any
    of these forces re-certification, no exceptions. Owner can override a
    Governance refusal, but the override itself is logged as a Founder
    Override event (see glossary #102) and subject to postmortem review.

---

## PART X — OPERATIONAL WORK

156–170. Tasks originate from triggers (payment webhook, invoice due
    date, scheduled reconciliation) and land in the Finance Lane queue.
    Work items follow the standard task schema (Context reference, Skill
    ID, Lane, priority). Context is assembled deterministically by the
    Context Engine before the worker sees the task — the worker never
    queries raw tables directly; all reads/writes go through defined
    tools with their own validation. Direct ledger writes are
    prohibited — a dedicated ledger-write tool performs the actual
    mutation and enforces idempotency (transaction reference dedup
    prevents double-posting on duplicate webhook delivery). Partial
    reconciliation is handled as an explicit intermediate state, not
    silently resolved.

---

## PART XI — SKILLS

171–180. The Virtual Accountant is a bundle of discrete skills, not one
    monolithic "accounting" capability: `invoice-generate`,
    `mpesa-reconcile`, `ledger-post`, `anomaly-flag`, `statement-generate`.
    Classification:
    - `ledger-post`, `mpesa-reconcile`, `invoice-generate`: **AI-0**
      (fully deterministic, no model involvement).
    - `statement-generate`: **AI-O** (language generation for
      human-readable summaries, output is descriptive only, never
      changes ledger state).
    - `anomaly-flag`: **AI-O** (advisory only — flags for human review,
      cannot itself freeze or reverse a transaction).
    - No accounting skill is **AI-R** at this stage — nothing in Finance
      currently requires AI as the sole viable executor.
    An AI-O skill can never directly mutate financial state; its output
    always passes through deterministic verification before anything
    is written. Failed verification routes to escalation, not retry.

---

## PART XII — CONTEXT

181–195. The worker receives only the minimum context required per
    task type (e.g. reconciliation task gets that school's unresolved
    payments + matching invoices — not the full ledger, not other
    schools' data). Minimum context is defined per skill in the
    blueprint, not decided at runtime by the worker. Additional context
    requests require explicit authorization logged against the task.
    Confidential learner information is never included in Finance
    context — billing contact only. Source-of-truth conflicts are
    resolved by a fixed precedence order defined in policy (e.g.
    `finance_ledger` always wins over cached/derived views). Context
    assembly is logged and replayable for audit. Institutional memory
    may *propose* context inclusion but cannot silently override the
    deterministic assembly rules.

---

## PART XIII — LEAD / ROUTING

196–200. Work is routed to the Virtual Accountant by the Finance Lead
    (a routing/classification role, not a reasoning authority). The
    Lead does not need deep accounting knowledge — it classifies task
    type and dispatches to the correct lane/worker via rules, not
    judgment. The Lead cannot reassign a task outside Finance Lane
    without an explicit escalation event. Structural enforcement against
    bypass: every action (Lead dispatch, worker execution, tool call) is
    validated against the blueprint and lane definition at the
    infrastructure level — not by convention. A worker whose action
    doesn't match its certified blueprint/contract is rejected by the
    execution layer itself, independent of what any Lead or model
    "decided." This is what makes the "delete the word AI and still
    explain it as a computer system" test pass: every gate above is a
    database constraint, a contract check, or a logged approval — not a
    prompt instruction.

---

## Governance Note

This document should be reviewed against D-002 (Safeguarding) and D-008
(Legal Hold) before BP-002 is submitted for its first Foundry creation
request — Part I §16 (regulatory obligations) has a direct dependency on
D-008 resolution (entity registration status affects what financial
record-keeping is legally required now vs. deferred).

Status: DRAFT — awaiting Governance review and numeric threshold
definitions (Parts III §58, VIII §126-140) before promotion to VERIFIED.
