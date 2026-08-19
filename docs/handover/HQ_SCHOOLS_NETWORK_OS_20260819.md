# HQ Schools Network Operating System — 2026-08-19

Status: IMPLEMENTING / RECONCILE REQUIRED

Canonical parent domain: `/hq/schools`

Implemented on PR #318:
- founder-oriented Schools command center rather than identity queue;
- Kenya network scope with all 47 counties kept visible and functional;
- known → canonical → connected → active network funnel;
- canonical/directory school search;
- Founder attention using existing school-success evidence;
- identity reconciliation moved to `/hq/schools/data-quality`;
- canonical School 360 route at `/hq/schools/[schoolId]`;
- School 360 identity, location, linked learners/teachers/admins/parents, activity, support, entitlements and revenue attribution;
- revenue semantics distinguish school-attributed and linked-user revenue from proven institution-paid revenue;
- owner-authorized read models and narrow execution restoration for existing owner-gated identity RPCs;
- responsive Schools/School 360 layouts and truthful unavailable/unknown states.

Production remains unchanged. The new migration must not be applied until exact-current-main migration reconstruction and production commissioning are certified.

Known production facts at investigation time:
- 36 canonical schools;
- 28,832 pending school identity candidates;
- 0 pending teacher discovery requests;
- legacy School Identity owner-gated RPCs existed but lacked authenticated EXECUTE grants;
- PR #306 geography/intelligence RPCs were absent from production because their migration chain remained unapplied.

Parallel-development rule: Task 12 / PR #319 advanced `main` during this work. PR #318 is therefore RECONCILE REQUIRED before promotion.