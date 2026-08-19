# Task 19 — M-Pesa Payments, Entitlements & Financial Integrity Handover

## Hold-gate status

Task 19 is implemented only on `agent/task19-mpesa-financial-integrity`. Production remains disconnected from this branch. Do not merge, apply this migration, deploy payment functions, enable M-Pesa initiation, repair payment records, issue credits/entitlements, run a live transaction, or intentionally trigger Vercel until every required shared foundation ahead of Task 19 has merged and the exact-current-main gate is rerun.

## Starting state

- Starting main: `77051a4011d7712a275f76af41efed382f017398`.
- Production payment initiation: OFF (`mpesa_runtime_control.initiation_enabled = false`).
- Production Learning Product commerce spine is present (`learning_product_orders`, `commerce_payment_attempts`, `commerce_payment_callback_events`, `learning_product_entitlements`).
- Read-only production inspection found zero Learning Product orders, payment attempts, callbacks and entitlements at Task 19 start.
- The older teacher-credit `mpesa_payment_attempts` hardening migration is not present in production. Task 19 therefore treats the Learning Product commerce spine as the canonical paid-content payment authority; teacher-credit commerce remains a separate legacy product flow and must not be used as a second authority for Learning Product payments.

## Canonical financial identity

One Learning Product payment is identified through the following durable chain:

1. `learning_product_orders.id` — authoritative commercial order and beneficiary/product/price snapshot.
2. `commerce_payment_attempts.id` — authoritative internal provider attempt for that order.
3. `commerce_payment_attempts.checkout_request_id` — authoritative provider request identifier used to correlate callbacks.
4. `merchant_request_id` — corroborating provider request identifier when present; a mismatch is reconciliation-required.
5. `commerce_payment_callback_events.id` — immutable durable provider evidence received by VibeSchool.
6. M-Pesa provider receipt — authoritative provider settlement reference after a valid success callback; globally unique for settlement.
7. `commerce_financial_ledger.id` — VibeSchool append-oriented evidence that reconciled money was accepted as settled revenue.
8. `commerce_payment_receipts.id` / `receipt_number` — user-facing VibeSchool receipt derived only from settled financial evidence.
9. `learning_product_entitlements.order_id` — exactly-once paid access effect linked to the commercial order.

Phone number is payer routing data, never payment identity.

## Canonical payment state machine

Payment attempt:

`created -> submitting -> awaiting_customer -> settled`

or a terminal provider outcome:

`created/submitting/awaiting_customer -> failed | cancelled | expired`

Any uncertain, contradictory or incomplete evidence moves to:

`reconciliation_required`

Examples include uncertain STK network outcome, amount mismatch, provider-reference mismatch, duplicate provider receipt, contradictory terminal callback after settlement, or durable success evidence that cannot be safely converted into the full local financial effect.

Order:

`pending_payment -> fulfilled`

or operationally:

`pending_payment -> cancelled | refunded | reconciliation_required`

A payment attempt being `submitting` or `awaiting_customer` is not revenue, not payment success and not entitlement authority.

## Findings

### P0 — direct paid-entitlement fulfillment bypass

The pre-Task-19 service-only `commerce_fulfill_learning_product_order(order, provider, receipt, amount)` accepted caller-supplied financial fields and could grant a paid entitlement without proving that one persisted provider callback event and payment attempt authorized that exact effect.

Task 19 closes the legacy signature fail-closed and introduces `commerce_settle_verified_mpesa_attempt(attempt,event)` as the only paid-entitlement settlement gateway.

### P1 — no append-oriented Learning Product settlement ledger

The commerce spine had order/payment/entitlement state but no dedicated append-oriented settlement evidence from which reconciled revenue could be derived independently of STK initiation counts.

Task 19 adds `commerce_financial_ledger` with provider receipt and attempt-level uniqueness.

### P1 — no canonical VibeSchool payment receipt artifact

Provider receipt existed on order/attempt state but there was no durable user-facing VibeSchool receipt object.

Task 19 adds `commerce_payment_receipts`, one per order/attempt, containing only the minimum financial fields required for useful receipt evidence.

### P1 — HQ billing did not expose M-Pesa operational truth

HQ billing showed subscription state and aggregate billing-event signals but not initiated/confirmed/pending/reconciliation M-Pesa states, paid entitlements, kill-switch state or ledger-derived reconciled revenue.

Task 19 adds owner-only `hq_payment_finance_overview()` and integrates it into HQ Billing.

### P2 — callback error logging could expose excessive payload data

Malformed Learning Product callbacks logged the entire callback payload. Task 19 changes callback logs to identifiers, boolean structure signals and error codes/reasons while keeping raw provider evidence only in the service-only callback evidence table.

## Financial-effect gateway

`commerce_settle_verified_mpesa_attempt()` performs the full success effect in one database transaction:

callback evidence validation -> attempt/order lock -> checkout/merchant/amount/payer validation -> duplicate receipt check -> entitlement exactly once -> ledger exactly once -> VibeSchool receipt exactly once -> order fulfilled -> attempt settled -> audit events.

A database/process failure before commit yields no partial entitlement/ledger/receipt success. Replaying the same callback converges through uniqueness and row locks rather than duplicating financial effects.

## Reconciliation

`commerce_reconcile_payment_attempt()` never guesses uncertain money state.

- Durable successful callback evidence is replayed through the same canonical callback processor.
- A settled attempt is checked for all required downstream evidence: fulfilled order, settlement ledger entry, receipt and entitlement.
- A stale unresolved attempt without authoritative success evidence becomes `reconciliation_required`, not `failed` or `paid`.
- Contradictory provider evidence remains visible for operator investigation and is not repaired by arbitrary balance/state edits.

A future provider-query reconciliation adapter may supplement this evidence when Daraja transaction-status capability is commissioned, but must feed this same state machine rather than bypass it.

## Security and privacy

- Product/price remains server-authoritative through active `learning_product_offers` and immutable order snapshots.
- Paid settlement/reconciliation functions are service-only.
- User payment status self-authorizes against both payer and order purchaser and omits stored phone/raw callback payload.
- Raw callbacks, ledger and receipt tables are not browser-readable.
- Financial evidence tables are append-only via update/delete rejection triggers.
- Payment initiation kill switch remains independent from callback/status/reconciliation processing.
- No payment secret is added to client code.

## Regression gates

Task 19 adds `scripts/sql/task19_payment_integrity_verify.sql` to certify:

- RLS and browser denial on raw financial evidence.
- settlement/reconciliation RPC execution boundaries.
- direct fulfillment bypass closure.
- exact callback/attempt/order evidence binding.
- idempotent ledger/receipt/entitlement contracts.
- reconciliation semantics.
- privacy of the user payment-status projection.
- HQ revenue derivation from ledger settlement rather than STK initiation.
- initiation remains OFF.

The Learning Product commerce workflow is extended to run the Task 19 SQL contract after a clean disposable-database rebuild and to type-check the payment Edge Functions and application.

## Failure matrix expected convergence

| Scenario | Required outcome |
|---|---|
| Daraja initiation unavailable with definitive rejection | attempt failed, no ledger/receipt/entitlement |
| STK customer cancellation | cancelled, no financial effect, safe new request path |
| callback delayed | pending then callback-driven convergence |
| duplicate callback 2x/5x | one callback evidence identity and one settlement effect |
| concurrent duplicate callback | row locks + uniqueness -> one ledger/receipt/entitlement |
| callback before STK response attach | durable pending event replayed after provider request is attached |
| frontend timeout/disconnect | backend callback remains authoritative; return session reads backend truth |
| network uncertainty during STK request | reconciliation_required; no blind retry |
| DB failure during atomic settlement | transaction rolls back; durable callback can be replayed |
| entitlement/receipt/ledger write failure | no partial committed settlement; replay after repair |
| response lost after successful settlement | replay is idempotent; no duplicate entitlement or revenue |
| amount/reference mismatch | reconciliation_required; no entitlement/revenue |
| terminal callback after already-settled success | reconciliation_required anomaly; original financial history preserved |

## Remaining commissioning gates

These are intentionally not executed while the shared-foundation hold gate is active:

1. Fetch exact current `main` after upstream foundations merge.
2. Reconcile Task 19 branch with auth/identity/HQ/incident/telemetry changes.
3. Reinspect production schema and currently deployed payment functions read-only.
4. Clean disposable DB rebuild from all migrations.
5. Run existing commerce contracts plus Task 19 financial-integrity contract.
6. Run payment failure/replay/concurrency matrix and RLS/security gates.
7. Run TypeScript, Deno checks and production build.
8. Apply the reviewed Task 19 migration only after hold release; initiation must remain OFF.
9. Deploy exact-candidate payment functions.
10. Verify Daraja credentials/configuration and production callback destination without exposing secrets.
11. Run one smallest legitimate controlled live transaction only with owner-sensitive live-money approval/credentials.
12. Verify STK -> callback -> ledger -> VibeSchool receipt -> entitlement -> HQ finance.
13. Reconcile all failure states and verify incident signals.
14. Only then consider explicit pilot payment activation.

## Current certification verdict

**Branch implementation in progress / production activation blocked by the shared-foundation hold gate.**

Production remains financially fail-closed. No production payment records were repaired or altered, no production migrations/functions were changed, no live transaction was run and payment initiation remains OFF.
