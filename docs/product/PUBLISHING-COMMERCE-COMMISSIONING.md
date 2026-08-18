# Publishing Commerce Commissioning

## Objective

Close the commercial loop without creating a second payment or entitlement system:

`publisher/content → catalogue → sample → purchase → M-Pesa → entitlement → reader → revenue → analytics`

## Existing certified foundation

- Learning Product economic wrapper around learning resources.
- Rights clearance required before product activation.
- One-time KES offers and immutable order snapshots.
- Idempotent M-Pesa attempts with duplicate-charge guards.
- Callback-driven settlement; STK acknowledgement is never treated as payment proof.
- Reconciliation-required state for uncertain provider outcomes.
- Durable profile/student/school entitlement ledger.
- Entitlement-aware textbook reader and freemium chapter gating.
- Purchase page and reader unlock bar.

## This completion lane

- Safe public catalogue projection for rights-cleared, active, one-time textbook offers.
- Catalogue sample claims are derived from the canonical publication pricing rules used by the reader.
- VibeGlobal Learning Product store.
- Owner-scoped publisher revenue analytics derived from fulfilled orders and durable entitlements.
- Service-only platform revenue rollup.
- Commerce regression contract extended to catalogue and analytics.

## Production boundary

The repository package remains non-activating. No migration in this lane creates an active product, active offer, commerce order, entitlement, or payment attempt. Existing published content is not silently converted from free to paid.

Production saleability requires all of the following, independently:

1. Commerce migrations promoted to production.
2. Learning Product and offer explicitly created for a publication-backed learning resource.
3. `rights_status = 'cleared'`.
4. Product and offer explicitly activated.
5. Publication pricing configured consistently with intended preview behavior.
6. Learning Product M-Pesa Edge Functions deployed with server-only credentials and callback secret.
7. `mpesa_runtime_control.initiation_enabled = true` only after credentials/callback verification.

This separation prevents a schema deployment or catalogue UI release from charging anyone by accident.
