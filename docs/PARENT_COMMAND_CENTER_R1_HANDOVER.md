# Parent Command Center R1 — Audit and Handover

Date: 2026-08-18
Branch: `feature/parent-command-center-r1-20260818`
Base: `main@2a0fa302b23acd550205f528745462c6626a7b16`

## Product objective

The Parent experience must become the trusted family command center: one place where an authorized parent can understand what happened to each child, what needs attention, what the school/teacher communicated, what money is due/paid, and what the parent should do next.

The parent should not have to hunt through modules. Important child events should flow to the parent automatically, subject to authorization, publication/approval state, alert preferences, and school policy.

## Audit findings

### Existing strengths

- Parent identity and child linking already exist through `parent_student_links`.
- Parent dashboard already resolves linked children, school/class identity and attendance.
- Child detail, assessment progress, report cards and teacher-message entry points already exist.
- VibeConnect infrastructure exists (`vc_threads`, `vc_participants`, `vc_messages`, `vc_circulars`, recipients and acknowledgement).
- Parent learning summaries and source provenance exist.
- Parent finance data exists (`finance_fee_structures`, `finance_fee_payments`) and the link contract already includes `can_view_finance`.
- RLS is enabled on the audited parent communication, summary and finance tables in production.

### P0 gaps

1. **Dashboard is a directory, not a command center.** It mostly shows child cards and links. It does not prioritize urgent actions, unread communication, today's attendance, homework due, recent results, teacher feedback, notices, fee position or upcoming school events.
2. **Marks card is non-functional.** `recentMarks` is currently initialized to `null` on the home dashboard.
3. **Communication route mismatch.** The dashboard links to `/parent/messages`, while the top bar links to `/parent/connect`. Parent communication should have one canonical entry point.
4. **No child-scoped communication contract.** VibeConnect direct threads are profile-to-profile and `context_tag` based; they do not structurally bind a conversation to `students.id`. A parent with multiple children can therefore lose context.
5. **Fee visibility is buried.** A finance page exists under the child hub, but the home dashboard does not surface current fee structure, paid amount, balance, receipt/payment activity or due alerts.
6. **Fee ledger semantics are weak.** `finance_fee_payments` currently allows parent-side insertion in the UI. School-accounted fees must distinguish school-confirmed ledger entries from parent-submitted evidence/claims. A parent must never be able to create authoritative school payment truth directly.
7. **No unified parent notification/event inbox.** Academic, attendance, homework, report, fee and school notice events are spread across source tables.
8. **Autonomous delivery is incomplete.** Data exists for parent summaries/messages/circulars, but there is no single governed event-to-parent delivery contract proving that eligible child events are automatically routed to every authorized linked parent.
9. **Alert preference exists but is not the full policy.** `receives_alerts` is present on parent links, but delivery also needs category preferences, quiet-hours/non-urgent batching, urgent override policy, deduplication, delivery state and read state.
10. **No explicit parent-safe publication gate across every source.** Draft teacher notes, provisional marks or internal safeguarding/admin records must never leak merely because they exist in a source table.

## Answers to the two immediate questions

### Can a parent receive a message from a teacher?

**Infrastructure: yes. Product certification: not yet complete.** The repository has a working parent VibeConnect page and production has thread/participant/message tables. R1 must canonicalize the route, bind teacher-parent conversations to a child where relevant, enforce teacher/class/parent authorization, and certify unread/read delivery.

### Can a parent receive a school-fees notification?

**The data foundation exists, but the autonomous notification journey is not yet complete.** Production has fee structures, fee payments, parent-child finance permission, circular delivery, and parent messaging. R1 must add a governed fee-position projection/event and surface it on Home + Inbox without allowing parents to manufacture authoritative school payment records.

## Target Parent Home information architecture

### 1. Header
- Parent greeting
- selected child / all children switcher
- unread inbox count
- profile/settings

### 2. Needs Attention (highest priority)
Only actionable exceptions, ordered by urgency:
- absent/late today
- teacher message awaiting response
- homework due/overdue
- assessment/report newly published
- fee balance/due notice
- school notice requiring acknowledgement
- permission/consent request

### 3. Today for my child
- attendance state
- today's lessons / school day summary where available
- homework due
- teacher note / learning highlight
- upcoming event

### 4. Learning Pulse
- latest published result
- attendance trend
- strengths
- focus areas
- current learning/revision recommendation
- report card shortcut

### 5. Money & School
- fee structure for current term
- school-confirmed paid amount
- balance
- latest receipt/payment
- next due item when supported

### 6. Inbox
One stream for:
- teacher conversations
- school circulars
- learning summaries
- academic publication alerts
- attendance alerts
- homework reminders
- finance notices

### 7. Child hub
Profile, learning, assessments, reports, attendance, finance, health/permissions where authorized, memories and pathways remain available as drill-downs rather than competing with Home.

## Autonomous parent delivery contract

Canonical flow:

`source event -> eligibility/publication gate -> canonical students.id -> authorized parent_student_links -> preference/policy gate -> parent event -> in-app inbox -> optional external channel -> read/ack/delivery evidence`

Required guarantees:

1. `students.id` is the child identity authority.
2. Every child-scoped event carries `student_id`, `school_id`, category, source type/id, occurred_at, visibility state and dedupe key.
3. Parent recipients are resolved only through authorized `parent_student_links`.
4. Finance events additionally require `can_view_finance = true`.
5. Draft/provisional/internal source records fail closed.
6. One source event cannot spam duplicate parent events.
7. Delivery is auditable: queued/delivered/read/acknowledged/failed.
8. Urgent and non-urgent categories are separate; non-urgent updates may be batched into a daily/weekly digest.
9. Teacher-generated communication is attributable to the teacher/school and child context.
10. External SMS/WhatsApp/email is an adapter, never the system of record; the in-app event remains canonical.

## R1 implementation order

1. Parent authorization + source visibility certification.
2. Canonical child-scoped parent event/inbox model.
3. Teacher -> parent child-scoped messaging convergence on VibeConnect.
4. Finance truth hardening and fee-position read model.
5. Parent Home command-center read model/RPC.
6. Home UI redesign around Needs Attention / Today / Learning / Money / Inbox.
7. Event producers for attendance, homework, published assessment/report, teacher message, school circular and fees.
8. Deduplication, read/ack state, preferences and digest policy.
9. Exact Student=1 + parent authorization tests and production parity checks.
10. Only after exact-head certification: ready PR for merge. Vercel remains intentionally untouched during branch work.

## Acceptance gates

- Parent A cannot read Parent B's child/event/message/finance data.
- Parent with multiple children never receives ambiguous child-scoped communication.
- Teacher can message only a parent/guardian authorized for a learner the teacher is authorized to teach/manage.
- Parent cannot turn a self-entered fee record into authoritative school-paid truth.
- Fee notice derives from school fee truth and linked-parent finance permission.
- Draft assessment/report/teacher-only note never appears in Parent Home or Inbox.
- Attendance/homework/result/report/fee/message events are idempotent and auditable.
- Home loads a coherent summary without N+1 client-side scans across sensitive tables.
- Existing parent links, report cards, learning summaries and VibeConnect remain backward-compatible or have an explicit migration path.

## Deployment discipline

No Vercel/preview trigger during R1 branch development. Repository + database contracts are certified first. Production DDL is not applied speculatively; migration and application code must converge and pass exact-head checks before promotion.
