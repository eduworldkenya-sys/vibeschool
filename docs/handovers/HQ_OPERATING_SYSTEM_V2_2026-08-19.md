# HQ Operating System v2 — handover

## Mission
Deepen HQ from a dashboard into an owner operating system without creating duplicate sources of truth.

## Completed
- Extended the existing owner-gated seven-day report with operational truth from existing production tables.
- Added support/SLA, notification delivery, commerce payment, security and Worker Engine authorization health.
- Promoted existing executive questions into a Founder Morning Brief.
- Added North-star command strip, live operations, intervention queue, customer voice, governance/control-plane and goals to `/hq/intelligence`.
- Preserved existing growth, retention, audience, learning/product, finance and metric-lineage views.
- Preserved owner assertion inside the SECURITY DEFINER RPC; PUBLIC/anon execute remains revoked and authenticated/service_role execution remains explicit.
- No Worker Engine authority, payment initiation, scheduler, heartbeat or Vercel deployment was enabled by this work.

## Truth sources
`hq_support_cases`, `hq_incidents`, `hq_notification_delivery_outbox`, `commerce_payment_attempts`, `hq_security_events`, `hq_workforce_runtime_authorization_events`, existing HQ executive/finance/product/goal RPCs.

## Production commissioning
Migration `hq_operating_system_v2` was applied to production before repository promotion. The repository migration mirrors the commissioned function contract.

## Verification
- Production migration application: PASS.
- Existing `hq_get_seven_day_owner_report` owner assertion retained.
- Function execute ACL restricted to authenticated + service_role; owner assertion remains the authorization gate.
- No new public tables, policies, Edge Functions or external services introduced.

## Follow-on lanes
The operating system can deepen further using the same pattern for acquisition attribution, onboarding step analytics, school adoption cohorts, teacher success, parent engagement, learning outcome mastery, device/connectivity reliability and experimentation. These should extend existing authoritative telemetry rather than form parallel dashboards.
