# Measurement Kernel + Founder Command — handover

## Mission
Move VibeSchool HQ from descriptive reporting to a governed decision system across acquisition → activation → retention → learning value → school health → revenue → experiments → anomaly/action signals.

## Current-main reconciliation
- Work was reconstructed on current `main` after HQ Operating System v2 landed, so the measurement package extends rather than overwrites the newer founder operating-system UI and production-operations truth.
- Production Supabase project: `yauqsxggtuxuykcbrtzf`.
- Existing `platform_events` remains the operational event ledger; the new kernel supplies certified acquisition, account-return and experimentation evidence that the operational ledger did not contain.
- Existing retention logic mixed account IDs with canonical `students.id` after Student=1 consolidation. Certified retention no longer relies on that mixed-identity historical activity.

## Implemented
### Certified product presence
`product_account_sessions` records one authenticated product-presence row per account/day. HQ/auth paths are excluded by the client. Dynamic path identifiers are reduced to route families.

### Acquisition attribution
`product_acquisition_attribution` records privacy-minimized first/last UTM source, medium, campaign, external referrer host and landing route family. Full referrer URLs, query strings, email addresses, prompts, messages and learning content are not stored.

### Cohort retention
`product_measurement_state.certified_from` is a hard evidence boundary. D1/D7/D30 retention uses exact calendar-day return for accounts created after commissioning. Historical retention is not retroactively fabricated from login timestamps.

### Experimentation
`product_experiments`, stable assignments and daily-deduplicated exposures provide an owner-governed experimentation contract. Assignment/exposure RPCs bind to `auth.uid()`.

### Founder Command
`hq_measurement_founder_command()` exposes acquisition coverage, session activation, certified D1/D7/D30, certified DAU/WAU/MAU, experiment health, role-value evidence, sample-size-gated anomalies and metric lineage. `/hq/intelligence` integrates this into HQ Operating System v2 while preserving the founder morning brief, live operations, incidents, customer voice, finance, control plane and goals.

### Student=1 analytics repair
`hq_founder_value_intelligence()` maps canonical learner evidence through `students.profile_id` before account-level counting instead of comparing canonical learner UUIDs directly with profile UUIDs.

## Security
- All six new tables have RLS enabled.
- Direct `public`, `anon` and `authenticated` table access is revoked.
- Migration includes the repository-required restricted-access and authorization-test declarations for every new table.
- Product write/exposure RPCs bind actions to `auth.uid()`; callers cannot submit another target account.
- Founder experiment mutation/reporting remains owner-gated.
- No payment, publication, school, learner or Worker Engine authority is added.

## Product principles
1. Authentication is not engagement.
2. Engagement is not learning.
3. Learning activity is not mastery.
4. Acquisition should be measured through activation and retention, not signups alone.
5. Retention must have an explicit cohort and return-event definition.
6. Executive metrics need source, grain, window, definition and certification boundary.
7. Education telemetry is privacy-minimized and subordinate to learner protection.

## Promotion discipline
- No direct Vercel action is part of this package.
- Production database commissioning occurs only after exact-head repository gates pass.
- The additive migration must be read-back verified before application promotion.
- Final merge is the application-promotion point.

## Status
RECONSTRUCTED ON CURRENT MAIN AND IMPLEMENTED — pending exact-head CI/security/build certification, production migration commissioning, post-commission read-back, final handover certification and merge.
