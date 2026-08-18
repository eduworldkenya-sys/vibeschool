# HQ Signal Center R3 — Founder Operations Handover

Date: 2026-08-18
Branch: `agent/hq-signal-center-r3-20260818`
Scope: Founder Daily Brief, opportunity detection, SLA/ownership, Workroom escalation, signal-quality learning, and external-delivery outbox contract.

## Why R3 exists

R2 made HQ notifications high-signal and deduplicated. R3 makes those signals operational: every consequential signal gets an owner, a response deadline, an escalation path, a durable Workroom record, and founder context. Positive growth opportunities are surfaced alongside failures.

Research basis: mature SRE/incident practice favors actionable user-relevant alerts, explicit ownership and escalation, tiered urgency, rich context/runbooks, deduplication, and continuous alert-quality review to prevent alert fatigue.

## Production prerequisite repaired

Before R3 implementation, production was audited and found to have the R2 application code merged while the final R2 database contract was not fully promoted. A controlled idempotent production convergence migration was applied before R3 work continued.

Verified production R2 state:
- `hq_acknowledge_notification(uuid)` returns boolean and is authenticated/owner-gated.
- `hq_generate_notification_signals()` is service-role only.
- `hq_list_notifications(integer)` exposes the R2 owner projection.
- exactly one `hq-notification-signals-r2` cron runs every 15 minutes.
- existing production notification rows were preserved.

## R3 notification contract

`hq_notifications` gains:
- `owner_department`
- `due_at`
- `escalation_level` (0..3)
- `escalated_at`
- `work_item_id`
- `feedback` (`useful` / `noise`)
- `feedback_at`

Default SLA policy:
- Critical: 15 minutes
- Action Required: 4 hours
- Important: 24 hours
- Digest: no response SLA

Department routing is deterministic and uses active HQ departments, for example Security → `security_identity`, Finance → `finance`, Content → `content`, Growth → `growth`, Schools → `partnerships`, and Worker Engine → `engineering`.

## Workroom escalation

`hq_process_notification_escalations()` runs server-side every 5 minutes.

When a Critical or Action Required signal becomes overdue:
1. it receives escalation level 1;
2. a durable `hq_work_items` response item is created if none exists;
3. the work item records source fingerprint/class/evidence;
4. an initial system update documents automatic creation;
5. the Signal Center links directly to `/hq/workroom/{id}`.

If a Critical signal remains unacknowledged for another 15 minutes, it reaches escalation level 2 and a service-only external-delivery request is queued.

## External delivery boundary

`hq_notification_delivery_outbox` is service-only with RLS and client grants revoked.

Supported channel labels are `push`, `email`, `sms`, and `whatsapp`. R3 currently queues requests only; it does **not** claim a push/SMS/email/WhatsApp was delivered. A future adapter must consume the outbox and explicitly record `sent` or `failed` evidence. This avoids fake delivery status and keeps provider secrets out of the client/database API.

## Founder opportunities

`hq_detect_founder_opportunities()` runs hourly and currently detects two evidence-backed opportunities:
- signup momentum: today is at least 10 signups and at least 2× the recent daily baseline;
- school momentum: a canonical school receives at least 5 new profiles in seven days.

Opportunities are Important signals, not Critical interruptions.

## Founder brief

`hq_get_founder_brief()` is owner-gated and returns:
- new users today vs yesterday;
- active Critical and Action Required counts;
- overdue signal count;
- opportunity count;
- open incidents;
- payment failures in 24 hours;
- top founder priorities;
- recent growth opportunities.

The `/hq/notifications` workspace renders this as the Founder Brief above the live signal queue.

## Alert-quality learning

The owner can mark non-critical signals `Useful` or `Noise`.

R3 never automatically downgrades Critical or Action Required signals. For an Important signal with the same deterministic fingerprint, recent `Noise` feedback may demote a future recurrence to Digest for 30 days. This gives HQ a conservative learning loop without allowing feedback to mute consequential incidents.

## Legacy signup cleanup

R2 correctly stopped future raw-event behavior, but production still contained older individual `New signup` notification rows. R3 compacts multiple legacy signup notifications for the same day into one daily digest and resolves the individual legacy rows as retained history.

## Security model

- All founder read/write RPCs call the existing owner gate directly or are invoked through an owner-gated facade.
- Internal escalation/opportunity helpers are revoked from `public`, `anon`, and `authenticated` and granted only to `service_role`.
- The delivery outbox is service-only and RLS-enabled.
- No payment phone/provider payload or security raw evidence is copied into notification bodies.
- Critical/Action Required signals cannot be automatically suppressed by feedback.

## Certification

Dedicated contract: `supabase/tests/hq_signal_center_r3_founder_ops_contract.sql`.

It verifies founder columns, outbox isolation, RPC privilege boundaries, SLA/ownership routing, and cron uniqueness. The repository's full migration-security, clean-rebuild, TypeScript/build, auth/onboarding, Worker Engine and identity gates must also pass on one exact head before production promotion and merge.

## Deployment rule

1. Exact-head CI green.
2. Apply R3 migration to production Supabase.
3. Verify columns, RPC grants, outbox isolation, cron uniqueness, founder brief, legacy compaction, escalation behavior and opportunity generation.
4. Merge only the exact certified head.
5. No manual Vercel invocation before the branch is fully complete.
