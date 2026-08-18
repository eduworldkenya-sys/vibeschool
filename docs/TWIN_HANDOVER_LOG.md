# VibeSchool Twin Program — Handover Log

Last updated: 2026-08-18 EAT
Branch: `agent/universal-deterministic-twin-20260818`
PR: #221 — Twin Core: deterministic role-scoped intelligence without AI

## Binding product rule

**Twin Constitution — 98/2 Principle**

- 98% or more of Twin intelligence is deterministic VibeSchool intelligence: identity, relationships, school/class scope, timetable, curriculum, workflow state, evidence, memory, prioritization, permissions, safety and next actions.
- Generative AI is optional and may account for at most approximately 2% of Twin capability/interactions later.
- `AI OFF = VibeSchool Twin works fully.`
- AI can never become the authority source for identity, memory truth, permissions, school state, curriculum truth, workflow state, recommendations that cause consequential school actions, or safety.
- Any future AI capability must live behind a separate policy/authority gateway. Deterministic routing runs first; minimum authorized context is supplied; output is untrusted until deterministic or human validation; AI cannot directly mutate authoritative state.

## Architectural state

One conceptual Twin Core serves Student, Teacher, Parent, School Admin and HQ. Roles are relationship-derived rather than browser-selected authorization or `profiles.role` truth. HQ remains an isolated authentication/authorization adapter. Teacher school scope is a first-class state/memory identity.

Core execution chain:

`Identity → Role/relationship → Authorized scope → Current time/state → Authoritative data → Rules/decision tables → Evidence memory → NOW/NEXT/LATER/ALERT → Authority gate → Action → Outcome evidence`

## Production safety status

Production Supabase project `yauqsxggtuxuykcbrtzf` was inspected only.

Confirmed already present in the production migration ledger:

- `20260807150121_teacher_twin_authoritative_brain`
- `20260807150508_teacher_twin_student_signal_bridge`
- `20260807151514_teacher_twin_operational_context_completion`
- `20260807152114_teacher_twin_context_integrity_fix`

Confirmed **not applied** to production as of this handover:

- `20260818050300_teacher_twin_multi_school_scope`
- `20260818050400_teacher_twin_active_school_preference`

No production schema/data mutation was made during this continuation. No Vercel deployment was intentionally triggered. Branch deployment remains disabled by repository guard; promotion is deferred until exact-head certification is green.

## Continuation work completed

### 1. Multi-school Teacher Twin runtime closure

Problem found: `getTeacherTwinState()` selected a Teacher role binding before the server had resolved the active Teacher school. A teacher with multiple valid Teacher memberships could therefore fail locally before the governed server preference was evaluated.

Resolution:

- zero-argument `teacher_get_twin_brain()` remains the compatibility/deployment-boundary entry point;
- server resolves an authorized active school under the multi-school migration contract;
- returned `school_id` is then validated against the shared relationship-derived Twin authority graph;
- client never accepts a server-returned school outside current Teacher memberships;
- this preserves fail-closed behavior while avoiding arbitrary client selection.

### 2. Teacher Smart Insights scope closure

Problem found: Smart Insights used `school_members ... limit(1)` and could therefore read an arbitrary Teacher school when a teacher serves multiple schools.

Resolution:

- Smart Insights now resolves shared Twin authority;
- reads `teacher_profiles.school_id` only as the active-school preference hint;
- verifies that hint through `selectTwinRoleBinding` against current Teacher membership;
- all Teacher class, current learner enrollment, attendance and class evidence are then constrained to that verified school.

### 3. Regression contracts hardened

The deterministic Twin and Teacher multi-school contracts now require:

- server-selected Teacher school to be validated after brain resolution;
- no unscoped `selectTwinRoleBinding(authority, 'teacher')` in the Teacher adapter;
- Teacher Smart Insights to use the governed active-school preference + membership validation;
- no arbitrary `school_members ... first/limit(1)` school choice in Teacher Insights.

## Cross-functional operating doctrine

### CTO / Security

Priority is deterministic authority correctness before conversational breadth. Every Twin read and action must be scope-bound server-side. Browser role/school/class/child IDs are hints only. New role skills require an authority test and an evidence-provenance test before UI exposure.

### Product management

Twin is judged by completed user jobs, not chat fluency. Primary jobs are:

- Student: what to do now, timetable, due work, revision priority, weak recorded outcome, guided practice, evidence memory.
- Teacher: current/next lesson, attendance gap, marking queue, learner attention, curriculum pacing, reflection, deadlines.
- Parent: child presence, class/school, learning evidence, family attention and next safe action.
- Admin: attendance, staffing/enrollment, teaching lifecycle completion, missing evidence, family links and operational priorities.
- HQ: platform health, schools, content/moderation, operational queues and governed priorities.

Unsupported requests must produce bounded capability guidance or clarification, never silent AI escalation.

### Learning science / psychology

Twin must separate evidence from inference. Missing evidence is not positive or negative evidence. It must not label learner ability, motivation, behaviour, family circumstances or diagnosis from thin operational data. Recommendations should identify the observed signal, confidence/evidence level and reversible next action.

### Data analytics

Track Twin quality with deterministic operational metrics rather than token usage:

- deterministic answer coverage rate;
- authorized-scope resolution success/failure;
- unsupported-intent rate;
- next-action click-through and completion;
- evidence completeness before/after Twin action;
- time from signal to teacher/admin action;
- false-positive/overridden recommendation rate;
- role/school boundary denial tests;
- percentage of Twin sessions completed with AI disabled — target effectively 100% for core jobs.

### Business / Sales

Positioning proof should be: **“VibeSchool knows the school because it is connected to the school workflow — not because an AI guessed.”** School-buyer demos should show real deterministic examples such as lesson-now, missing attendance, unmarked work, learner evidence gaps and stalled onboarding. This is a trust and cost advantage: core Twin usefulness does not depend on per-query LLM spend.

### Marketing

Avoid marketing Twin as a generic chatbot. Market it as role-aware school intelligence and next-action guidance. Evidence claims should be demonstrable in the public sandbox/pilot rather than abstract “AI-powered” claims.

### Administration / Operations

Every automated recommendation must preserve human accountability. Twin may route and prioritize; authorized users remain responsible for consequential school actions unless a specific deterministic automation has separately defined authority and rollback.

### Vision

Future AI is an optional skill layer for tasks such as alternate explanations, analogies, reading-level rewrites and fresh practice variants. It is not the brain. VibeSchool’s durable moat is its curriculum/workflow/evidence/relationship graph and deterministic decision system.

## Remaining program sequence

1. Reconcile PR #221 onto current `main` and certify the exact merged-content candidate without promoting it.
2. Run/verify deterministic Twin, Teacher multi-school, portal authority, migration security, TypeScript and production-build checks at the reconciled exact head.
3. Review multi-school scope UX for School Admin and multi-enrollment Student/Parent cases; current behavior is deliberately fail-closed where no explicit selector exists.
4. Validate the two pending Teacher Twin migrations in an isolated/rebuild environment, including RPC overload/grant/RLS behavior.
5. Only after all gates are green: promote the two certified migrations and application code in a controlled sequence that avoids a migration/app race.
6. Keep PR draft until production promotion evidence exists; then merge intentionally to trigger the single planned production deployment.
7. After deterministic core promotion, expand role decision tables and instrumentation before considering any AI gateway.

## Handover invariant

A future engineer should be able to delete every LLM/API key from VibeSchool and still have Student, Teacher, Parent, Admin and HQ Twin core school intelligence operate correctly. Any change that makes that statement false violates the Twin Constitution.
