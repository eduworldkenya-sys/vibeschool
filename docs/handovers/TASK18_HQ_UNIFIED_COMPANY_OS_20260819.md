# VibeSchool Task 18 — HQ Unified Company Operating System

Date: 2026-08-19
Status: IN PROGRESS / SHARED-FOUNDATION HOLD
Branch: `agent/task18-hq-unified-company-os`
Starting main: `77051a4011d7712a275f76af41efed382f017398`

## Safety boundary

Task 18 remains production-disconnected while shared foundations are unresolved.

During the hold:
- do not merge;
- do not mutate production Supabase data;
- do not apply production migrations;
- do not modify production RLS or grants;
- do not deploy Edge Functions;
- do not repair production data;
- do not activate Worker Engine autonomy;
- do not enable payment initiation;
- do not change consequential production controls;
- do not intentionally trigger Vercel.

Production investigation performed for Task 18 is SELECT/catalog/read-only only.

## Starting architecture

### Existing HQ surface inventory

Main already contains meaningful owner surfaces:
- `/hq` — founder command center / seven-day owner report;
- `/hq/intelligence` — operating intelligence and live operations;
- `/hq/analytics` — analytics/product/learning intelligence;
- `/hq/notifications` — owner alerts/insights;
- `/hq/schools` — school operations;
- `/hq/users` — user intelligence;
- `/hq/marketing` — growth/marketing;
- `/hq/billing` — billing status;
- `/hq/workforce` — Worker Engine Control Room;
- `/hq/decisions` — owner decisions;
- `/hq/security` — security/control-plane state;
- `/hq/content` — publishing/content operations;
- `/hq/curriculum-authority` — curriculum authority;
- `/hq/curriculum-intelligence` — content/curriculum intelligence;
- `/hq/studio` — content studio;
- `/hq/support` and `/hq/workroom` — operational support/work execution.

### Existing authoritative backends retained

Task 18 reuses rather than duplicates:
- `hq_get_seven_day_owner_report()`;
- `hq_get_product_controls()`;
- `hq_get_control_health_v2()`;
- `hq_workforce_list_decisions(...)`;
- `hq_workforce_get_control_room_snapshot(...)`;
- `hq_run_operating_cycle()`;
- existing HQ Twin;
- existing incident/finding/work/support evidence;
- existing Worker Engine Control Room and safety kernel.

Production read-only catalog inspection confirmed `hq_check_owner_access(text)` is `SECURITY DEFINER` and checks `is_platform_owner()`. `hq_assert_owner()` rejects non-owner authenticated callers with SQLSTATE `42501`. The seven-day report and Control Room contracts remain owner-gated inside PostgreSQL; route hiding is not treated as the authority boundary.

## Information architecture reconciliation

### Problem in starting navigation

The old navigation presented the same destinations multiple times under different labels:
- `/hq/workforce` appeared as both Teachers and Worker Engine;
- `/hq/analytics` appeared as both Analytics and Learning Intelligence;
- `/hq/security` appeared as Platform Health and Settings.

This made HQ resemble a collection of pages rather than one owner operating system.

### Canonical Task 18 navigation

**Operate**
- Today
- Operations
- Decisions
- Alerts

**Company**
- Schools
- People
- Product & Learning
- Growth
- Finance

**Platform**
- Workforce
- Content
- Curriculum
- Security & Controls

**Build**
- Content Studio
- Content Intelligence

Mobile primary navigation is intentionally narrower:
- Today
- Operate
- Decide
- Workforce
- Alerts

Existing routes remain available; strong systems are relocated/consolidated rather than rewritten.

## Findings

### T18-P0-01 — Command Center partial-failure collapse
Severity: P0 for owner operation

Starting `/hq` loaded the report, controls, health and decisions with one `Promise.all` and threw if any single result failed. One unavailable source could therefore destroy the owner’s primary operating surface.

Repair:
- Today now loads five evidence domains with `Promise.allSettled`;
- report, controls, control health, decisions and Workforce snapshot have independent source states;
- successful panels stay usable when another source fails;
- last-known cache remains explicitly marked cached;
- source failure is never converted into zero.

### T18-P0-02 — Fabricated dashboard fallbacks
Severity: P0 data-trust defect

Starting `/hq` synthesized operational-looking values when evidence was absent, including regional learner percentages, school-health distribution percentages and hard-coded subject mastery scores.

Repair:
- all such fallbacks were removed from Today;
- missing evidence renders `Unknown`;
- Healthy is only possible from positive evidence;
- learning sessions are labeled activity, not learning effectiveness.

### T18-P1-01 — Fragmented primary navigation
Severity: P1 owner-efficiency defect

Repair:
- one canonical destination per owner job in primary navigation;
- Worker Engine is integrated under Workforce instead of duplicated;
- analytics and security duplicates removed;
- `/hq` renamed conceptually to Today.

### T18-P1-02 — Attention scattered across systems
Severity: P1 owner-operations defect

Repair:
Today aggregates one Needs Attention queue from existing authoritative objects:
- incidents;
- findings;
- support cases;
- actionable decisions;
- Worker Engine anomalies.

The queue prioritizes severe items and routes to existing investigation surfaces rather than building a second incident/decision system.

### T18-P1-03 — Health could imply certainty without evidence
Severity: P1 trust defect

Repair:
Canonical statuses are:
- Healthy;
- Degraded;
- Critical;
- Unknown.

Overall Healthy is only allowed if every represented system is positively Healthy. Telemetry-dependent role/journey systems remain Unknown until Task 12’s authoritative telemetry contract is merged and reconciled.

## Changes on Task 18 branch

### UI / IA
- `components/hq/HQShell.tsx`
  - canonical company-OS navigation;
  - mobile owner navigation;
  - removes duplicate primary links.

### Today
- `app/hq/page.tsx`
  - evidence-first landing surface;
  - isolated source loading;
  - Needs Attention;
  - system health;
  - pilot overview;
  - Worker Engine safety summary;
  - payment truth summary;
  - explicit Unknown/cached/unavailable semantics;
  - links into existing investigation systems;
  - retains governed operating cycle and HQ Twin.

### Regression protection
- `scripts/task18-hq-company-os-contract.mjs`
  - permanent IA and truthfulness assertions;
  - partial-failure assertion;
  - Unknown-vs-zero assertion;
  - no fabricated legacy fallbacks;
  - owner-gated report/Control Room contracts;
  - HQ auth isolation;
  - mobile navigation;
  - Workforce/Decision/Twin integration.
- `.github/workflows/task18-hq-company-os.yml`
  - Task 18 contract;
  - TypeScript;
  - production build.

## Privacy

Today is aggregate-first. It does not place student names, emails, admission numbers or other learner PII on the company-wide landing surface.

Billing detail remains a deeper owner-only surface. Task 18 does not promote account-level billing identities onto Today.

## Finance semantics

Today separates payment attempts, settled payments, failures and revenue. It explicitly states that STK initiation is not revenue.

Production read-only inspection found no active HQ product-config row that can currently serve as a definitive payment-commissioning flag. Therefore Task 18 must not invent an Enabled/Disabled label from an empty config query. Final payment commissioning state must reconcile with the canonical M-Pesa/payment control introduced by the payment foundation before final certification.

## Observability dependency

Task 12 telemetry/observability is still open on its own branch. Task 18 intentionally does not create a parallel HQ telemetry ledger.

After Task 12 merges, Task 18 must wire/verify:
- HQ load failures;
- stale evidence conditions;
- investigation failures;
- Decision action failures;
- Control Room failures;
- role-journey health inputs for Auth, Teacher, Student, Parent, Admin, VibeLearn, learning writes and assessments.

Until then those health rows remain Unknown rather than false green.

## Shared-foundation dependencies

At Task 18 start, these relevant workstreams remain unmerged/open and therefore block final certification:
- Task 1 Auth/Onboarding;
- Task 2 migration reconstruction integrity;
- Task 3 Student identity;
- Task 4 Teacher journey;
- Task 5 Student journey;
- Task 6 Parent journey;
- Task 7 School Admin journey;
- Task 8 production authorization/privacy;
- Task 12 telemetry/observability;
- Worker Engine commissioning/governance follow-on work required by Tasks 15–17.

Task 18 must rebase/reconcile against their merged contracts before exact-current-main certification.

## Certification state

### Branch-level implemented
- coherent primary IA: implemented;
- Today primary owner surface: implemented;
- Needs Attention aggregation: implemented;
- Healthy/Degraded/Critical/Unknown semantics: implemented;
- partial failure isolation: implemented;
- cached/live distinction: implemented;
- Worker Control Room integration: implemented;
- Decision Inbox integration: implemented;
- HQ Twin integration: retained;
- mobile primary owner navigation: implemented;
- privacy-conscious aggregate Today: implemented;
- fake metric fallbacks: removed;
- permanent Task 18 CI contract: added.

### Still blocked / must not be claimed green yet
- Task 12-backed role journey health;
- final school/pilot activation metrics after upstream role contracts merge;
- definitive payment commissioning flag;
- HQ-specific telemetry on the merged Task 12 ledger;
- full disposable-database security run if/when a no-production test environment is available;
- exact-current-main reconciliation after foundations merge;
- exact-head TypeScript/build/CI completion;
- production owner E2E;
- production negative authorization attacks;
- final zero-P0/P1 certification;
- merge/deployment.

## Final gate after shared foundations merge

1. Fetch exact current `main`.
2. Confirm required upstream PRs are merged.
3. Rebase/reconcile Task 18.
4. Inspect all changed HQ, telemetry, incident, Worker, payment and authorization contracts.
5. Reinspect production read-only for drift.
6. Wire merged telemetry into Unknown health rows without fabricating history.
7. Reconcile canonical payment commissioning state.
8. Run Task 18 contract, authorization/privacy, incident, telemetry, Worker governance, migration security, clean rebuild, TypeScript, lint and production build.
9. Test mobile Today → attention → incident/decision → Workforce → Today.
10. Only then promote through the authorized release path and run production owner E2E.

## Current verdict

**FOUNDATION-BLOCKED / BRANCH IMPLEMENTATION IN PROGRESS.**

Task 18 is not production-certified and is not authorized to merge while the Shared-Foundation Hold Gate remains active.
