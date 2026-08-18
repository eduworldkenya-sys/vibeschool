# Worker Engine R1.4 production-promotion handover — 2026-08-18

## Scope

Promote only the certified forward Worker Engine schema closure to production Supabase after PR #232 merged. This release does **not** activate heartbeat, Factory, runtime execution, Shadow, autonomous operation, capability authority, or any scheduler.

## Production state before promotion

Project: `yauqsxggtuxuykcbrtzf`.

Read-only migration-ledger inspection confirmed production contains the early R1.3X `20260815080000` and `20260815090000` migrations but not the later historical R1.3X sequence and not the new R1.4 forward closure.

The production engine remains fail-closed: heartbeat OFF, Factory OFF, runtime execution OFF, autonomy L0, maximum risk 0, Shadow OFF, Shadow scheduler OFF, global stop ON.

## Certified production set

Only these versions are authorized by this promotion:

- `20260818111900` — R1.3X partial-production reconciliation bridge
- `20260818112000` — R1.4.11 legacy authority closure
- `20260818112100` — R1.4.12 owner approval + plan binding
- `20260818112200` — R1.4.13 governed truth provenance
- `20260818112300` — R1.4.14 bound verifier assignment
- `20260818112400` — R1.4.15 resource version clock
- `20260818112500` — R1.4.16 durable breaker denial
- `20260818112600` — R1.4.17 owner runtime control
- `20260818112700` — R1.4.18 owner capability-authority lifecycle
- `20260818112800` — R1.4.19 control-plane table closure
- `20260818112900` — R1.4.20 credential/ontology closure
- `20260818113000` — R1.4.21 forensic readiness control

## Superseded repository-only history

The following historical R1.3X versions must **not** be pushed to production because the forward `20260818111900` bridge reconciles the observed partial-production state:

`20260815091000`, `20260815092000`, `20260815093000`, `20260815094000`, `20260815095000`, `20260815110000`, `20260815111000`, `20260815120000`, `20260815130000`, `20260815133000`.

The dedicated R1.4 staging wrapper forces these versions out of the ephemeral production stage even though they remain present in repository history.

## Promotion mechanism

`.github/workflows/worker-engine-we-r1-4-production-promotion.yml` is the only intended release path for this closure. It uses the protected `production-migration-repair` environment, pins Supabase CLI `2.114.0`, captures the live ledger, constructs a ledger-aligned ephemeral stage, asserts that the dry-run contains all and only the 12 certified versions, applies that exact stage, verifies the post-apply ledger, requires zero remaining R1.4 work, and uploads immutable evidence.

## Activation boundary

A successful schema promotion means production has the certified control schema. It does not authorize a canary or autonomous execution. Runtime/autonomy activation remains a separate owner-governed release decision after production read-only readiness verification.
