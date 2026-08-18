# HQ Notifications R2 — Signal Center Handover

Date: 2026-08-18
Scope: VibeSchool HQ notification architecture, production signal coverage, deduplication, prioritization, action workflow and owner-only UX.

## Problem closed

HQ Notifications V1 was a valid owner-only event drawer, but it treated routine events as notifications and covered only a narrow operational slice. Production already had stronger truth sources for security, Worker Engine, governance, payments, content health, incidents and school identity, yet HQ Notifications did not aggregate them.

R2 turns the notification layer into an executive signal center rather than another event log.

## Design principles

1. Keep `platform_events` as the raw event stream.
2. Notify only when an event is significant, actionable or strategically useful.
3. Aggregate repeated conditions under deterministic fingerprints.
4. Keep normal activity in digest/important classes; reserve interruption for action-required and critical conditions.
5. Do not copy sensitive payment/customer PII into HQ notification bodies.
6. Keep all listing and mutation RPCs owner-gated through `hq_assert_owner()`.
7. Keep autonomous signal generation server-side. Client roles cannot execute the generator or internal upsert helper.

## Notification classes

- `critical` — immediate owner attention: security exceptions, payment-processing failures, critical incidents, Worker Engine breaker/critical alerts.
- `action_required` — a decision or remediation is needed: policy failures, approvals, failed content runs, high content-health signals, school identity review.
- `important` — significant non-emergency change/opportunity: school registrations, published content, non-failed Content Factory blockers, ordinary content-health signals.
- `digest` — routine awareness: aggregated daily signup activity.

## Truth sources connected in R2

- `hq_incidents`
- `hq_security_events`
- `hq_workforce_monitoring_alerts`
- `hq_workforce_execution_breaker_events`
- `hq_policy_failures`
- `hq_artifact_approvals`
- `commerce_payment_attempts`
- `content_engine_orchestration_runs`
- `curriculum_content_health_signals`
- `school_identity_review_queue`
- canonical `platform_events` for signup/school/content publication events

## Noise controls

- Routine lesson-plan, homework and draft-publication events remain in `platform_events` but no longer page HQ.
- Signups aggregate into one daily notification fingerprint.
- Content Factory blockers aggregate into one active signal.
- Repeated active signals increment `occurrence_count` and refresh `last_seen_at` instead of creating unbounded duplicate rows.
- Owner acknowledgement is distinct from resolution.
- Resolved signals may recur later as a fresh active notification if the underlying condition returns.

## Autonomous operation

`hq_generate_notification_signals()` runs every 15 minutes through one deterministic `pg_cron` job named `hq-notification-signals-r2`.

The generator and `hq_upsert_notification()` are revoked from `public`, `anon` and `authenticated`; only `service_role` can invoke them directly. Database triggers/cron execute in trusted server-side contexts.

## UI changes

`HQNotificationCenter` becomes `HQ Signal Center` and adds:

- Critical / Action / Important / Digest filtering
- action-required count
- explicit acknowledgement
- deduplicated occurrence count
- category + class labels
- automatic one-minute refresh while HQ is mounted
- error state instead of silently failing
- action labels that route to the relevant HQ surface

## Production preflight evidence

A rollback-only production SQL test compiled the core R2 schema/functions and executed the signal generator without persistence. It returned two aggregate signal groups against current production truth: Content Factory blockers and content-health signals.

At audit time, production had:
- 0 exceptional HQ security events in the last 24h
- 0 active Worker Engine monitoring alerts
- 0 recent breaker events
- 0 recent policy failures
- 0 pending artifact approvals
- 0 open HQ incidents
- 0 recent failed/error payment attempts
- 54 blocked/failed Content Engine orchestration runs in the last 24h
- 2 open curriculum content-health signals
- 0 unresolved school identity review items

The counts above are evidence from the audit window, not permanent expected values.

## Security contract

All exposed notification reads/mutations continue to require `hq_assert_owner()`.
Direct table access remains revoked from `anon` and `authenticated`.
R2 does not expose raw security-event metadata or payment phone/provider payloads through the notification body.

## Merge / deployment rule

The migration is repository-tracked and should be applied to production only after exact-head checks pass. Vercel should not be intentionally triggered before the branch is complete. After merge, verify production migration presence, cron uniqueness, RPC grants, owner read/ack/resolve, and active-signal counts.

## Research basis

The design follows established SRE alerting guidance: alert on meaningful/user-impacting symptoms, make alerts actionable, and optimize signal-to-noise to avoid alert fatigue. Routine telemetry belongs in dashboards/digests rather than interruptive alerts.
