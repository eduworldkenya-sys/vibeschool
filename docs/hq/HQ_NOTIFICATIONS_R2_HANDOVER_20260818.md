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
- Repeated active signals only advance `occurrence_count` and `last_seen_at` when aggregate evidence changes.
- An unchanged periodic scan cannot re-open an acknowledged urgent signal.
- Owner acknowledgement is distinct from resolution.
- Resolved signals may recur later as a fresh active notification if the underlying condition returns.

## Autonomous operation

`hq_generate_notification_signals()` runs every 15 minutes through one deterministic `pg_cron` job named `hq-notification-signals-r2`.

The generator and `hq_upsert_notification()` are revoked from `public`, `anon` and `authenticated`; only `service_role` can invoke them directly. Database triggers/cron execute in trusted server-side contexts.

## Founder surfaces — where notifications appear

R2 has two complementary owner surfaces rather than hiding the system behind a database or a single page:

1. **Persistent HQ alert control** — `HQNotificationCenter` is mounted in the sticky `HQNavigation`, so the owner sees the unread/urgent state from every protected HQ page. Opening it reveals the fast triage drawer without leaving the current workflow.
2. **Full Signal Center workspace** — `/hq/notifications` is the durable executive inbox for Active, Act now, Action required, Important, Digest, Resolved and All views. It includes search, summary metrics, acknowledgement, resolution, source context, recurrence counts and routed actions.

This is intentionally a two-speed experience: the navigation control answers “does anything need me now?”, while the dedicated workspace answers “what happened, what still needs action, and what was already resolved?”.

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
- persistent mounting in the protected HQ top navigation
- a dedicated `/hq/notifications` executive workspace with search and resolved history

## Content Engine repository-parity closure

Exact clean-rebuild certification exposed a pre-existing production/repository drift: `run_connected_content_engine()` and production both depended on `public.content_engine_orchestration_runs`, but GitHub did not contain the historical `CREATE TABLE` lineage needed to reconstruct it on a blank database.

R2 closes that disaster-recovery gap with `20260818214490_content_engine_orchestration_runs_repository_parity.sql`. The migration reproduces the production contract idempotently:

- canonical UUID run identity
- publication foreign key with cascade delete
- governed trigger types: scheduled/manual/post_release/recovery
- governed run states: running/completed/blocked/failed
- JSON stage/blocker evidence
- start/completion timestamps
- RLS enabled
- raw client access revoked
- service-role infrastructure access retained

The migration declares the repository security contract explicitly as service-only and includes an authorization-test marker. No parallel orchestration database was introduced.

A dedicated `supabase/tests/hq_notification_signal_center_r2_contract.sql` verifies the notification schema, orchestration-ledger presence, client-role isolation and governed notification RPC boundary.

## Production preflight and promotion evidence

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

Controlled production promotion then surfaced a second historical RPC-lineage mismatch that a clean database cannot reproduce: production's legacy `hq_acknowledge_notification(uuid)` returned `void`, while R2 intentionally returns `boolean` so the client can distinguish a successful acknowledgement from a missing/resolved signal. PostgreSQL correctly rejected a return-type change through `CREATE OR REPLACE`; the R2 transaction rolled back without partial activation.

That production truth is now permanently represented by `20260818214495_hq_notification_acknowledge_contract_boundary.sql`, which drops only the legacy acknowledgement signature immediately before R2 recreates the owner-gated boolean RPC. This follows the same ordered compatibility pattern used for `hq_list_notifications(integer)` and removes reliance on undocumented production history.

Production migrations successfully recorded before the transactional R2 retry boundary were:
- `hq_notification_signal_center_r2_reader_contract_boundary`
- `hq_security_events_signal_compatibility`
- `hq_notification_optional_source_compatibility`
- `content_engine_orchestration_runs_repository_parity`

The R2 activation migration itself remained unapplied after the return-type rejection and must only be retried after exact-head certification includes the new acknowledgement boundary.

## Certification defects caught before promotion

The certification/promotion loop prevented several issues from reaching an uncontrolled release:

- unchanged periodic scans could originally inflate occurrence counts or re-open acknowledged urgent signals; corrected so evidence changes drive recurrence
- PostgreSQL cannot replace a table-shaped RPC when its return contract changes; an ordered list-reader drop/recreate boundary was added
- production's legacy acknowledgement RPC returned `void`; a second explicit drop/recreate return-contract boundary was added before boolean R2 acknowledgement
- resolved critical history could crowd active lower-severity signals out of the RPC result window; active signals now rank before history
- production-only source names were reconciled to canonical repository truth or compatibility projections
- `content_engine_orchestration_runs` missing repository lineage was recovered instead of bypassing clean-rebuild certification
- the new service-only table was made explicit to the migration-security contract
- the existing Curriculum Authority navigation compatibility contract was preserved while mounting the founder signal surface
- a concurrent `/login` production-build regression entered `main` while the PR was being certified; it was identified as base-branch drift rather than misattributed to HQ R2, and current main subsequently repaired it before final merge certification

## Security contract

All exposed notification reads/mutations continue to require `hq_assert_owner()`.
Direct table access remains revoked from `anon` and `authenticated`.
R2 does not expose raw security-event metadata or payment phone/provider payloads through the notification body.

## Merge / deployment rule

Apply the tracked migrations to production only after every required exact-head check passes against current main. Vercel must not be intentionally triggered before the branch is complete. Before merge, verify production migration presence, cron uniqueness, RPC grants, owner read/ack/resolve, deduplication behavior and active-signal counts. Merge only the exact certified head/base combination.

## Research basis

The design follows established SRE and notification-design guidance: alert on meaningful/user-impacting symptoms, make alerts actionable, optimize signal-to-noise to avoid alert fatigue, make high-value information glanceable, deduplicate repeated events, and reserve interruption for conditions whose urgency justifies it. Routine telemetry belongs in dashboards/digests rather than interruptive alerts.
