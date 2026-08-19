# VibeSchool Autopilot — Canonical Architecture Reconstruction & Certification

Date: 2026-08-19
Branch base/current main at certification: `8fff836a89cc3ebb9499cde77d654667be553e8a`
State: INTEGRATION GREEN / READY FOR PROMOTION

## Canonical architecture

VibeSchool Autopilot is the governance/orchestration contract over the existing Worker Engine execution subsystem, HQ Founder surface, Content Factory, Curriculum Intelligence and evidence systems. It is not a replacement Worker Engine or second HQ.

`Objective/Intent -> Approved Plan -> Work -> Constitution/Policy -> Authority -> Budget -> Execution Intent/Lease -> Execution -> Artifact/Evidence -> Independent Verification -> Outcome -> Finding/Decision/Dead Letter/Learning -> HQ`

No broad parallel `autopilot_*` schema is permitted unless reconstruction proves a primitive genuinely absent.

## Eight contracts

| Contract | Canonical owner |
|---|---|
| Intent | workforce objectives/events/context |
| Work | plans, steps, dependencies, task contracts |
| Authority | capability-authority grants intersected with policy, certified capability/skill, resource scope and approved plan hash |
| Budget | execution budgets plus rate/concurrency ceilings |
| Execution | task contract, execution intent, consequential gateway and immutable evidence |
| Artifact | HQ artifact/version/provenance plus vertical immutable ledgers |
| Verification | verifier assignments, execution/task/outcome verification |
| Outcome | execution outcomes mapped to findings, decisions, dead letters, incidents and learning |

## Constitution

Effective authority is the minimum allowed by owner-controlled engine/global-stop state, runtime policy, certified capability/skill/tool contract, authority-grant lifecycle, immutable approved plan hash, resource scope, autonomy/risk ceilings, execution budget/rate/concurrency limits, breaker state, idempotency/preconditions, verification and compensation requirements.

`service_role` is transport, not Founder authority. Workers cannot activate their own grant, modify owner policy, approve objectives, release Global Stop or expand autonomy.

## Primitive classification

KEEP/EXTEND: Worker Engine, HQ, objectives, plans/steps/dependencies, task contracts, capabilities/skills/resources, authority grants, runtime policies/engine contract, budgets, execution intents/runs/verifications, verifier assignments, outcomes, compensation, breakers, dead letters, findings, decisions, artifacts/provenance and Content R2 research/verifier/authoring.

RETIRE/DO NOT CREATE: duplicate broad `autopilot_workers`, `autopilot_runs`, `autopilot_authority_grants`, `autopilot_execution_intents` or competing ledgers.

## Organizational identities

Presentation-only aliases are defined in `lib/autopilot/organization.ts` with no authorization data:

- Laban — Cofounder / Chief Operating Intelligence
- Travis — Content Leadership
- David — Operations
- Mykphyl — Intelligence / Planning
- Luca — QA / Verification
- Damian — Platform / Reliability
- Nina — Research / Evidence
- Michael — Security / Reconciliation
- Phyllys — School Success / Institutional Operations

Authorization remains machine-contract-derived. Renaming an alias cannot change permissions.

Laban may observe, plan, decompose, coordinate, diagnose, recommend retries and prepare Founder decisions. Laban may not approve its own objective, issue/activate its own authority, modify Constitution, bypass budgets, self-verify high-risk work, release Global Stop, publish protected content, authorize payment or perform unapproved production repair.

## Content proof

Content Factory supplies the first vertical: trusted research evidence -> semantic verification -> source-grounded authoring -> immutable draft -> explicit HQ owner acceptance -> prepared editorial patch -> separate proposal approval/apply. Authoring cannot independently research, self-verify, approve/apply/publish or bypass Worker Engine model authorization.

## HQ Autopilot read model

`20260819162500_autopilot_canonical_founder_read_model.sql` adds owner-only, read-only projections:

- `hq_autopilot_constitution_snapshot()` — Constitution/runtime/authority/breaker truth.
- `hq_autopilot_founder_brief()` — completion, independent verification, retries, dead letters, findings and decisions without treating completion as verification.

Both deny `public`, `anon` and `service_role`; authenticated callers must pass `hq_assert_owner()`.

## Production reconstruction

Read-only production observed: 9 identities, 9 objectives, 9 plans, 27 plan steps, 27 authority grants, 18 budgets, 17 task contracts, 18 workforce runs, 421 HQ automation runs, 1 dead letter, 1 finding, 0 decisions, 0 HQ artifacts, 0 execution intents, 0 execution verifications and 0 task verifications.

The zero intent/verification counts are live usage evidence, not missing repository primitives. Future consequential execution must traverse the existing canonical intent/verification contracts.

## Failure/recovery certification

The permanent Autopilot suite composes Worker Engine production closure covering replay/idempotency, plan binding, authority, budget/rate/concurrency, breaker/global stop, independent verification, compensation, dead letters and forensic evidence. It additionally rejects duplicate control-plane schemas, verifies Founder-only read models, owner-governed authority/runtime, verifier closure, Content publication separation and non-activation.

## Exact implementation-head evidence

Implementation head `2354e7e4cf240c786b18af2e94770c4fffc65e45` passed:

- Autopilot Canonical Control Plane
- canonical Autopilot SQL contract
- Worker Engine production closure rerun
- organizational TypeScript typecheck
- explicit non-activation assertion
- Supabase Migration Security Contract
- TBL-011 Isolated Clean Rebuild
- TBL-012 M(repo) extractor
- TypeScript and Production Build Gate
- CI Production Build Contract
- Auth & Onboarding Hardening
- Task 2 Database Reconstruction Integrity
- Teacher Pilot Task 4
- Student Core Journey Pilot
- Student One Full Journey
- Student One Legacy Identity Recovery
- Parent Core Journey Contract

This final documentation-only update changes no executable behavior; repository gates must still be green on its resulting SHA before merge.

## Exact-main reconciliation

At certification, `main` remained exactly `8fff836a89cc3ebb9499cde77d654667be553e8a`, the branch base. No intervening upstream commits existed to reconcile. Re-check immediately before merge.

## Safety / commissioning handover

Repository merge is NON-ACTIVATING. Production Supabase remained read-only. No production migration, RLS/grant, Edge Function, data repair, publication, communication, payment, runtime/autonomy, authority grant or Global Stop change was performed.

Expected post-merge state: architecture active in code; governance contracts present; production autonomy unchanged/off; Global Stop preserved; unbounded worker authority none; Founder authority preserved; Content ready only for a separately authorized controlled commissioning phase.
