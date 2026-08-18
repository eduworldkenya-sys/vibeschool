# Worker Engine Gate 2 canary recovery — 2026-08-18

## Incident found during commissioning

A previous Content Factory R2 Gate 2 canary expired while still in `prepared` state. Its runtime authority had already been forced fail-closed, but lifecycle residue remained: the canary worker was still `active`, one ephemeral worker identity remained `active`, and two execution budgets remained `active` after their period ended.

A second schema/contract defect was discovered while clearing that residue: `hq_content_factory_r2_operator_finalize_canary()` closes execution budgets with `status='closed'`, while `hq_workforce_execution_budgets_status_check` did not allow `closed`. This meant successful governed finalization could fail at the budget-closure step.

## Remediation

- preserved global Worker Engine fail-closed runtime posture;
- marked the expired canary session failed with recovery evidence;
- disabled/revoked stale Gate 2 runtime policies;
- transitioned the canary worker through suspended -> remediation -> certification_pending -> certified using the existing valid creation contract and active 3/3 shadow certification;
- revoked the expired ephemeral worker identity;
- closed expired execution budgets after repairing the status constraint;
- added `closed` to the execution-budget lifecycle status vocabulary so the existing governed finalizer and schema agree;
- prepared a new bounded Gate 2 canary only after the worker returned to `certified` with zero live canary identity/budget residue.

## Safety boundaries preserved

- runtime ceiling remains L1/R1 only for the one-shot canary;
- heartbeat OFF;
- Worker Factory OFF;
- shadow global stop remains ON during runtime canary;
- one canary worker only;
- publication authority remains false;
- target content is protected by SHA verification;
- canary finalizer revokes temporary authority and returns runtime fail-closed;
- Vercel was not intentionally invoked during remediation.

## Remaining commissioning action

The fresh canary session is prepared. The research -> semantic verification -> source-grounded authoring invocations must complete through the deployed `content-factory-r2-canary-invoker` / dispatcher path, followed by `hq_content_factory_r2_operator_finalize_canary(session_id)` and a final readiness/fail-closed verification.
