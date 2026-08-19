# Task 21 — Pilot Analytics Certification Handover

## Starting state
- Base main: `77051a4011d7712a275f76af41efed382f017398`.
- Isolated branch: `task/21-pilot-analytics-certification-20260819`.
- Shared-Foundation Hold Gate: ACTIVE. No merge, production mutation, migration application, production RLS/grant changes, analytics backfill, Edge deployment, or intentional Vercel deployment.

## Read-only production inventory
Production contains an existing event kernel (`platform_events`) plus domain event/evidence tables including student/content learning events. Existing platform events include signup, school, VibeLearn progress/reading/completion, homework, lesson plan and attendance event types. Existing naming is mixed dot notation and domain-specific semantics, so legacy events are inventory/evidence rather than automatically canonical Task 21 events.

Production also contains `hq_product_event_contract` / `hq_product_event_trace`, but these belong to the HQ operating/work-verification event contract and are not by themselves a pilot behavioral analytics schema.

## Existing HQ analytics finding
Current main has `hq_founder_value_intelligence()` with useful backend-derived north-star/activation/learning/teaching/mastery/school measures. It explicitly reports cohort retention, acquisition attribution and experiment registry as not instrumented. Several values are backend-fact based, but Task 21 requires stronger funnel semantics, canonical identity checks, reconciliation and cohort definitions before certification.

## First integrity findings
1. P1 — No complete canonical pilot funnel/retention contract exists on current main.
2. P1 — Legacy `platform_events` naming/role values are heterogeneous and cannot be blindly combined into canonical funnels.
3. P1 — Acquisition attribution and cohort retention are explicitly absent from current HQ value intelligence.
4. P1 — Existing teacher activation in HQ value intelligence means teacher has a class, which is setup progress, not Task 21 meaningful activation.
5. P1 — Existing school activity unions platform events with teaching facts; Task 21 requires a stricter meaningful-activity definition.
6. P1 — No certified baseline can be emitted until event identity and backend reconciliation gates pass.

## Changes completed on branch
- Added canonical measurement contract with event envelope, privacy restrictions, role funnels, VibeLearn funnel, school lifecycle, retention, TTFV, duplicate policy, error-aware semantics, reconciliation rules and baseline gate.
- Preserved analytics as non-blocking for core journeys.

## Next branch work
- Inventory exact producers of `platform_events`, learning events and public telemetry.
- Add versioned canonical event registry and validation/data-quality SQL as migration-only repository artifacts (do not apply to production).
- Instrument missing server-authoritative stages in application/RPC paths without blocking product success.
- Add derived funnel/cohort/retention query contract and HQ pilot analytics surface.
- Add disposable/regression tests for identity, duplicates, privacy, stage derivation, reconciliation and analytics-failure behavior.
- Run TypeScript/build and applicable security/telemetry/identity gates.

## Final gate still required
After upstream shared foundations merge: fetch current main, reconcile this branch, re-inventory telemetry/identity/school contracts, reinspect production read-only, rerun data-quality/backend reconciliation/funnel/privacy/build gates, then certify the exact candidate. Production representative-journey verification remains prohibited until the hold gate is lifted.
