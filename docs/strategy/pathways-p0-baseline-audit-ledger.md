# VibeSchool Pathways — P0.0 Baseline Freeze & Collision Audit Ledger

**Mission branch:** `agent/pathways-customer-acquisition-strategy`  
**Status:** ACTIVE — repository + live Supabase archaeology in progress  
**Started:** 2026-08-16  
**Safety:** inspection/documentation only until ownership/collision findings are resolved. No production schema/data mutation is authorized by this gate.

## Objective

Establish the exact existing VibeSchool product/data/runtime surfaces that Pathways must REUSE, EXTEND, KEEP SEPARATE or RETIRE before any Pathways schema or feature implementation.

## Audit Domains

1. Public entry/navigation and `/learn` surfaces.
2. Existing career/pathway-like routes and data.
3. Learner identity/profile authority.
4. Student Home, Tasks and personalized path infrastructure.
5. Student Twin / recommendation-adjacent logic.
6. Assessment engine and reusable session/question/evidence primitives.
7. National school identity, discovery, search and offering data.
8. Curriculum/subject identity and senior-school concepts.
9. Auth/onboarding and anonymous→authenticated continuation.
10. Parent and teacher learner projections.
11. SEO: metadata, sitemap, robots, public/private boundaries.
12. Analytics/event/observability foundations.
13. Live Supabase tables/views/functions/RLS/grants relevant to all above.

## Classification Contract

- **REUSE** — canonical capability already fits Pathways without ownership duplication.
- **EXTEND** — canonical capability exists but needs additive Pathways semantics.
- **KEEP SEPARATE** — valid neighboring subsystem; integrate through a contract but do not merge ownership.
- **RETIRE / DO NOT REUSE** — legacy/duplicate/unsafe semantics that must not become Pathways foundation.
- **UNRESOLVED** — insufficient evidence; blocks dependent implementation until resolved.

## Non-Negotiable Invariants

- No second learner identity.
- No second school identity.
- No second recommendation truth engine.
- No second auth/onboarding router.
- No second sitemap/robots authority.
- No schema invention before live-database archaeology.
- No public SEO surface may expose private learner data.
- Pathways recommendation truth must remain evidence/provenance reconstructable.
- Twin may explain/coach from Pathways state but may not independently invent canonical pathway eligibility/offering truth.
- School-offering facts must attach to canonical school identities with provenance rather than copy school identity into a Pathways directory.
- No merge to `main` until the complete Pathways mission is implemented and certified.

# First Evidence Pass — 2026-08-16

## A. Public `/learn/careers` — RETIRE AS PATHWAYS AUTHORITY / KEEP AS LEGACY LEARNING NAV UNTIL REPLACED

Repository inspection shows `app/learn/careers/page.tsx` is a small client-side course-domain launcher, not a canonical career guidance system. It contains a hard-coded five-item `CAREERS` array (Nurse, Teacher, Pharmacist, Electrician, Tech), derives availability from `courses.domain`, and sends every career card back to `/learn` rather than producing pathway/subject/school guidance.

**Decision:** Do not extend this hard-coded list into the national Pathways career graph. It may remain temporarily as a learning discovery surface, but it is **not** a valid source of career truth or recommendation authority. P1.2 must either canonicalize/redirect it into the new career decision taxonomy or explicitly keep it as non-indexable learning navigation.

**Risk avoided:** two conflicting career taxonomies and thin duplicate SEO intent.

## B. Canonical learner identity — REUSE

Live Supabase confirms `public.students` is already the learner identity relation used by current student services. Key fields include `id`, `profile_id`, `class_id`, `name`, DOB/gender and learner autonomy/self-use controls.

Current learner RPCs locate the learner through `students.profile_id = auth.uid()` and fail if no canonical learner is found.

**Decision:** Pathways Passport must reference `students.id`. No `pathway_users`, `pathway_students`, copied learner-name/DOB identity or parallel profile is allowed.

## C. Student Home — EXTEND, DO NOT CREATE PATHWAYS DASHBOARD

Repository `app/student/page.tsx` already composes:

- `student_get_home_os_brief`;
- current learner identity;
- timetable;
- attendance;
- task feed;
- personalized recommendations;
- Twin state;
- one explicit “WHAT SHOULD I DO NOW?” action hierarchy.

Live `student_get_home_os_brief()` already joins the task feed, `student_refresh_personalized_path()`, learner assessment hub, recent changes, recovery plan, study plan and targets.

**Decision:** returning Pathways state belongs as an additive projection into Student Home/Profile. A second authenticated `/student/pathways/dashboard` should not be created unless a later user test proves a dedicated deep workspace is necessary; even then it must not duplicate Home authority.

## D. Existing personalized learning path — KEEP SEPARATE / REUSE PRIMITIVES, NOT SEMANTICS

`student_refresh_personalized_path()` is a **learning/mastery prioritization engine**, not a career/pathway selector. It derives recommendations from `student_outcome_mastery`, curriculum learning outcomes, teacher interventions and task urgency.

Its current recommendation types are learning-oriented (`intervention`, `practice`, `revise`, `teacher_priority`) and its `next_mission` is a learning task.

**Decision:** Do not rename or overload this system as Senior School Pathways. Reuse its proven patterns—evidence snapshots, confidence, priority, lifecycle/versioning concepts—where useful, but Pathways requires its own bounded decision domain referencing canonical learner evidence.

**Risk avoided:** silently making low mastery in one topic determine national pathway suitability.

## E. VibeTwin — KEEP SEPARATE AS CONSUMER/EXPLAINER

Live Supabase confirms `student_get_twin_brain()` is a broad learner-learning brain that composes mastery, prediction, priority, evidence, learning, adaptation, teacher context and school context, with explicit bounded-tutor behavior.

It updates `student_twin_state_snapshots` and is policy-gated.

**Decision:** Twin must not own Pathways eligibility, school-offering truth or the canonical Pathways recommendation. Pathways should expose a governed read projection that Twin can later explain, question and coach around.

**Risk avoided:** two recommendation brains disagreeing about the learner's educational future.

## F. Assessment engine — KEEP SEPARATE, REUSE SELECTED PRIMITIVES

Live Supabase contains a mature assessment family including definitions, sections, items/questions, assignments, attempts, responses, gradebook, moderation, interventions, audit events and learner hub RPCs.

`assessment_definitions` is school/class/subject/teacher/lesson oriented, and `assessment_attempts` is tied to formal assessment assignments and grading lifecycle.

**Decision:** the 60-second Pathway Check should **not** be forced into `assessment_definitions/assessment_attempts` as if it were a graded classroom assessment. Reuse compatible UI/session/idempotency/audit patterns, but create a separate decision-session contract if no existing generic questionnaire/session primitive is found in the remaining audit.

**Risk avoided:** school/class grading semantics contaminating anonymous public guidance and account-free acquisition.

## G. National school identity/search — REUSE + EXTEND

Live Supabase confirms a substantial school authority stack:

- `schools` canonical identities;
- `schools_directory` discovery candidates;
- `school_directory_public` public projection;
- source registry/observations/ingest batches;
- authoritative reconciliation;
- identity candidates/evidence/review queue/coverage runs;
- `search_school_directory(...)`.

The live search function explicitly unifies active canonical schools with unmatched directory candidates and returns source labels (`CANONICAL` / `DIRECTORY`) while using KNEC/NEMIS identifiers and levels.

**Decision:** Pathways school discovery must call/reference this identity layer. New school-offering/pathway/combination facts must reference canonical school IDs or explicitly labeled directory observations; never clone identity into a Pathways-owned school table.

**Important limitation:** the current search RPC is `authenticated`-executable, so public anonymous Pathways school discovery cannot simply expose it unchanged. P0 must design a safe public projection/RPC with no ownership/membership side effects and provenance/freshness semantics.

## H. Curriculum/subject identity — REUSE/EXTEND WITH CARE

Live Supabase has `curriculum`, `curriculum_learning_outcomes` and `subjects`; `subjects` may be school-scoped but includes `global_subject_id`, while `curriculum` also carries `global_subject_id` and curricular grade/strand/sub-strand/topic identity.

**Decision:** Pathways must first identify the canonical global subject identity before introducing subject-combination relationships. Do not reference a school-local subject row as the national subject identity unless that is proven to be the canonical contract.

**Remaining proof:** inspect the global subject table and current Senior School curriculum mapping.

## I. Auth/onboarding — REUSE + EXTEND CONTINUATION OUTSIDE THE RESOLVER

Live `get_my_onboarding_state()` is the canonical role/onboarding destination resolver. It is `SECURITY INVOKER`, executable by `authenticated`, and returns canonical destinations for student/admin/global/teacher/parent states.

**Decision:** Pathways must not introduce another role router. Anonymous Pathways state should be adopted/restored **around** the existing sign-in/onboarding resolution, then return to the preserved Pathways journey after the canonical onboarding requirement is satisfied.

**Important design constraint:** the resolver currently knows nothing about continuation/deep-link state. We should not mutate its core role authority merely to carry Pathways data; use a bounded continuation contract that cannot override required onboarding destinations.

## J. SEO/sitemap — EXTEND

Repository `app/sitemap.ts` already owns sitemap generation for static pages and published content.

**Decision:** Pathway, career, school/pathway and subject-combination indexable URLs must be added through this authority (or a deliberate scalable sitemap partition if volume requires it), not a second sitemap system.

Current sitemap has no Pathways routes, so technical discoverability is not yet implemented.

## K. Analytics/event foundation — EXTEND, NOT BLINDLY REUSE

Live Supabase contains `platform_events` with actor/entity/metadata/idempotency fields and an HQ product-event contract/trace family.

**Decision:** there is an existing event foundation worth reusing, but P0 must inspect grants/RLS, cardinality, retention and current client/server writers before deciding whether Pathways acquisition telemetry belongs directly in `platform_events`, through a server RPC, or in a purpose-built privacy-safe event façade.

# Current Ownership Matrix

| Domain | Classification | Current decision |
|---|---|---|
| `/learn/careers` hard-coded list | RETIRE AS AUTHORITY / KEEP TEMPORARILY | do not grow into Pathways graph |
| `students` identity | REUSE | Pathway Passport references `students.id` |
| Student Home/Profile | EXTEND | show pathway state + next action here |
| personalized learning path | KEEP SEPARATE | learning/mastery engine, not future-pathway selector |
| VibeTwin | KEEP SEPARATE | consumer/explainer only |
| formal assessment engine | KEEP SEPARATE / REUSE PRIMITIVES | Pathway Check is not a graded assessment |
| school identity/search | REUSE + EXTEND | attach offering facts to canonical identities |
| curriculum/subject identity | REUSE/EXTEND | prove global subject authority first |
| auth/onboarding resolver | REUSE | preserve canonical role/onboarding authority |
| anonymous continuation | UNRESOLVED | needs bounded state-adoption contract |
| sitemap | EXTEND | one SEO authority |
| analytics/events | EXTEND / UNRESOLVED WRITER | inspect permissions/writers before binding |
| canonical Pathway/Career graph | ABSENT IN FIRST LIVE INVENTORY | candidate new bounded domain after remaining archaeology |

# Important Root-Cause Conclusions

1. **The repository is infrastructure-rich but Pathways-domain-poor.** The missing work is primarily the canonical pathway/career/combination/offering decision graph and public decision UX—not another learner/school/assessment/Twin platform.
2. **Existing learning recommendations must not be reused as career recommendations.** They solve a different problem and use different evidence.
3. **The current public careers UI is placeholder navigation, not national authority.** Extending it directly would encode the wrong architecture.
4. **The national school identity engine is the correct school foundation.** Pathways should add verified offering facts, not identities.
5. **Auth continuation is an integration problem, not a new auth problem.** Canonical onboarding remains authoritative.
6. **Public school discovery requires a new safe public read contract or projection.** The current school search RPC is authenticated-only.

# Remaining P0.0 Proofs

Before P0.0 is CLOSED, inspect and classify:

- canonical global subject table and Senior School/CBE subject identity;
- any hidden career/pathway/program/combination objects not caught by name search;
- current parent/teacher learner projection contracts;
- exact Student Profile extension point for Pathway Passport;
- auth entry/callback implementation and safe continuation mechanism;
- `platform_events` writers, RLS/grants and privacy suitability;
- public school projection grants/RLS and whether it can support anonymous Pathways safely;
- school authoritative observation schema for attaching senior-school pathway/combination evidence;
- current robots/metadata/canonical conventions;
- relevant route collisions under `/pathways`, `/learn`, `/school(s)` and career pages.

# Exit Criteria

P0.0 closes only when:

1. Repository topology and live Supabase topology agree or divergences are recorded.
2. Every P0 dependency has an ownership classification.
3. Existing canonical learner, school and subject IDs are identified.
4. Duplicate/legacy surfaces that must not be reused are identified.
5. Anonymous continuation has a safe integration point.
6. The first safe P0.1 implementation slice is specified at file/table/RPC/route level.
7. No unresolved ownership collision remains for P0.1–P0.4.

## Current Action

Continue the remaining archaeology above. No Pathways schema or feature code is authorized until those ownership proofs are complete.