# VibeSchool Task 12 — Pilot Telemetry, Observability & Product Analytics Handover

## Starting state

VibeSchool already had substantial evidence infrastructure: `platform_events`, `hq_product_event_contract`, `hq_product_event_trace`, `hq_incidents`, `hq_security_events`, `security_audit_events`, `content_learning_events`, `student_learning_events`, assessment audit events, payment callback evidence, and extensive Worker Engine traces. The gap was not absence of logs; it was the lack of one normalized pilot contract spanning product funnels, failures, latency, correlation and HQ investigation.

## Canonical design

`public.platform_events` remains the canonical pilot event ledger. Task 12 extends it with normalized dimensions: journey, surface, outcome, failure class, stable error code, latency, correlation/session identifiers, source, authoritative flag, network class and application version.

`public.pilot_event_contract` is an allowlist, not a free-form analytics schema. Each event defines its journey, stage, success semantics, whether backend authority is required, allowed roles, allowed metadata keys and activation role. Arbitrary metadata is discarded by `pilot_sanitize_event_metadata`.

Client events enter only through `pilot_record_event`. It derives the actor from `auth.uid()`, derives role from the profile, rejects unknown events, rejects unauthorized role/event combinations and refuses events whose contract requires authoritative backend evidence.

Consequential success evidence enters through service-only `pilot_record_authoritative_event`. This prevents attempted UI actions from becoming activation or success metrics.

## Error taxonomy

Stable classes: authentication, authorization, identity, database, RPC, network, content, validation, application, external integration, unknown.

Stable outcome states: attempted, succeeded, failed, denied, cancelled.

## Privacy rules

Telemetry does not accept arbitrary payloads. The contract allowlists metadata keys and the sanitizer additionally blocks password, token, authorization, cookie, secret, answer, message, prompt, conversation, email, phone and name fields. Direct select access to `platform_events` remains HQ-only under existing RLS. The client ingress is authenticated-only; authoritative ingress is service-role-only.

## Activation definitions

Teacher: `teacher.useful_action_committed` — a real classroom/teaching operation committed by backend truth.

Student: `student.learning_activity_committed` — meaningful learning activity committed by backend truth.

Parent: `parent.child_insight_viewed` — useful information for a verified child successfully served.

School Admin: `admin.school_operation_committed` — a legitimate school operation committed by backend truth.

Login alone is never activation.

## HQ visibility

`hq_get_pilot_observability_scorecard(since)` provides login attempts/success rate, role activation counts, failure totals, content failures, auth/identity failures and p95 latency.

`hq_get_pilot_failure_drilldown(since, limit)` returns privacy-minimized operational evidence: time, journey, surface, role, school, event, outcome, failure class/code, correlation ID and latency. It excludes arbitrary metadata and student PII.

## Cost controls

The design reuses `platform_events` rather than adding a parallel event warehouse. Partial indexes target journey/time, outcome/time, correlation and failures. Metadata volume is bounded by an explicit allowlist. Retention is encoded per contract and can be enforced later by the existing scheduled maintenance architecture without changing event semantics.

## Implementation files

- `supabase/migrations/20260819074200_task12_pilot_observability_foundation.sql`
- `lib/telemetry/pilot.ts`
- `scripts/sql/certify_task12_observability.sql`

## Remaining certification work

This foundation must still be wired into the concrete auth/onboarding, teacher, student, parent, admin and VibeLearn surfaces and authoritative backend commit points before Task 12 can be called complete. The final branch must then be reconciled to exact current main, clean-rebuilt, security/privacy tested, TypeScript/build certified, merged, deployed once, and production-smoked with representative success and safe failure paths.

Do not mark Task 12 complete merely because this foundation migration is present.
