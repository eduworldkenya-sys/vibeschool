# VibeSchool Twin Constitution v1

Status: binding architecture contract for Student, Teacher, Parent, School Admin and HQ Twin work.

## 1. Core doctrine

VibeSchool Twin is a deterministic school intelligence system, not an LLM wrapper.

**AI OFF = VibeSchool Twin works.**

The current target is 100% deterministic runtime. Generative AI may be introduced later as an optional, governed skill with a long-run ceiling of approximately 2% of Twin interactions. AI must never become the source of identity, authority, memory truth, curriculum truth, school state, workflow state or consequential decisions.

## 2. One Twin, role-scoped execution

The product has one conceptual Twin Core with role adapters:

- Student
- Teacher
- Parent
- School Admin / Owner
- HQ Owner

Roles change visible context, capabilities, data scope, workflows and UI. They do not create independent intelligence products.

HQ belongs to the same product contract but keeps an **isolated authentication and authority adapter**. The normal application session must not be allowed to weaken the HQ owner boundary.

## 3. Intelligence stack

Every Twin answer or action should be derived from this chain:

1. authenticated identity
2. current role / relationship binding
3. authorized resource scope
4. current time and school state
5. authoritative data
6. deterministic rules / decision tables
7. memory backed by evidence and provenance
8. NOW / NEXT / LATER / ALERT prioritization
9. action routing
10. outcome / evidence update

Natural-language phrasing is an interface concern, not an authority source.

## 4. Authority invariants

- Browser-supplied role, school, class, child or learner identifiers are never sufficient authority.
- **Teacher role authority derives from current Teacher school membership.** Canonical `teacher_classes` assignments restrict classroom/subject resources and capabilities; a valid Teacher does not cease to be a Teacher merely because no class has been assigned yet.
- A preferred Teacher school such as `teacher_profiles.school_id` may guide routing only after it is verified against current Teacher memberships.
- Multi-school Teacher Twin state must fail closed when school scope is ambiguous. Do not solve only the brain RPC while memory/snapshot identity remains one-school-per-teacher.
- Parent authority derives from current `parent_student_links` and access level.
- School Admin authority derives from current school membership / `is_school_admin` checks; `profiles.school_id` is not the authority root.
- Student authority derives from authenticated learner identity and current enrollment.
- HQ access remains owner-governed, session-isolated through the HQ auth client, and does not imply unrestricted learner-data use.
- A normal-app role switch must change context and capability scope before another request is evaluated. HQ entry still re-authenticates/re-authorizes through the isolated HQ boundary.

## 5. Memory contract

Twin memory is evidence, not chat history.

Memory records must declare or imply:

- subject / entity
- scope
- provenance
- confidence
- evidence count where applicable
- last confirmation time
- permanence / expiry behavior where applicable

A generated sentence is never promoted to authoritative memory merely because Twin said it.

For multi-school roles, memory and snapshots must include the school/resource scope in their identity before cross-school execution is enabled.

## 6. Deterministic interaction contract

A request follows this order:

1. normalize input
2. match known intent / entity / relationship
3. load authorized context
4. evaluate rule or decision table
5. return answer + reason + action when available
6. if ambiguous, ask a bounded clarification or show supported choices
7. if unsupported, explain the supported capability boundary

An unsupported request must **not** silently escalate to generative AI.

## 7. Role examples

### Student
- What should I do now?
- What is my timetable?
- What homework is due?
- What should I revise?
- What is my weakest recorded outcome?
- What does Twin remember from verified learning evidence?

### Teacher
- Do I have a lesson now?
- What class is next?
- Which attendance is missing?
- What is waiting for marking?
- Which learners need attention?
- Am I behind the scheme of work?

### Parent
- Was my child present today?
- Which child needs attention?
- What class is my child in?
- What learning evidence is recorded?

### School Admin
- How is attendance today?
- How many learners / teachers are current?
- How complete is the teaching lifecycle?
- Where is lesson evidence missing?
- How many parents are linked?

### HQ
- What needs platform attention?
- What schools / content / moderation work is pending?
- Which governed operational metric changed?

## 8. Optional AI boundary — future only

If AI is later enabled:

- it is an explicit skill behind a policy gate;
- deterministic routing must run first;
- only minimum authorized context is supplied;
- AI cannot mutate authoritative state directly;
- AI cannot elevate role or scope;
- AI output is untrusted until validated by deterministic rules or a human where required;
- usage is metered and observable;
- disabling AI restores the complete core Twin experience.

Examples of acceptable future AI work: rephrasing an explanation, producing a novel analogy, generating a fresh practice variant, or rewriting text for a reading level.

## 9. Deployment rule

Twin work is developed on an isolated branch. Vercel branch deployments remain disabled. Promotion to `main` occurs only after deterministic Twin contract tests, TypeScript/production build, authority tests and security review are green.

## 10. Product principle

The strongest VibeSchool Twin is not the one that talks the most. It is the one that knows what is true, knows what the user is allowed to see or do, explains why, and gives the correct next action without requiring an external model.
