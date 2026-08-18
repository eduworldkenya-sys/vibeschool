# Public Real-Product Sandbox — Category Leadership V2

**Status:** implementation candidate on `agent/public-category-leadership-v2`  
**Strategic gap:** public visitors can understand VibeSchool, but they should also be able to *use* the connected education model before registration.

## Product objective

Give any visitor a safe, immediate demonstration of VibeSchool's north-star educational chain:

**Plan → Teach → Evidence → Assess → Understand → Next Action**

The public experience must demonstrate connection, evidence discipline and role authority. It must not imitate a school dashboard with screenshots or fabricate customer activity.

## Evidence used for this implementation

A read-only production Supabase inspection on 2026-08-18 confirmed that the live schema already contains the relevant architectural domains, including:

- `scheme_of_work`
- `lesson_plans`
- `lesson_evidence`
- `homework`
- `homework_submissions`
- `assessment_definitions`
- `assessment_attempts`
- `assessment_gradebook_entries`
- `student_outcome_mastery`
- `student_learning_recommendations`
- `teacher_classes`
- `parent_student_links`

The public sandbox does **not** read those production rows. Production usage is uneven, and public demonstration data must never be confused with pilot or adoption evidence.

## Public demo contract

1. **No login.**
2. **No production learner, teacher, parent or school data.**
3. **No Supabase learner/data request from the sandbox.**
4. **No screenshot dependency.**
5. **No generated mastery claim from attendance or participation.**
6. **Missing evidence remains missing.**
7. **Assessment language describes demonstration evidence coverage, not certified mastery.**
8. **Role lenses change visibility and explanation, not the underlying evidence.**
9. **Family lens answers:** how is my child doing, where is the difficulty, what happens next?
10. **Leadership lens preserves causality:** curriculum → teaching → participation → evidence → response.
11. **Telemetry is anonymous event + public path only.**
12. **The page clearly labels fabricated demo state and curriculum wording boundaries.**

## Why this is strategically superior

Competitors can demonstrate modules, generated documents, dashboards or adaptive practice. VibeSchool should demonstrate something harder to copy: continuity of educational truth across the full learning loop and across authorised roles.

The visitor should leave the sandbox understanding:

> The value is not that VibeSchool has a lesson plan, attendance, assessment or parent view. The value is that each of those experiences can continue the same evidence-backed learning story.

## Certification

`Public Real-Product Sandbox` CI must verify:

- production build succeeds;
- `/sandbox` renders on a 390×844 mobile viewport without horizontal overflow;
- product truth-boundary copy is visible;
- visitor interactions mutate safe demo state;
- evidence state is derived deterministically from observations;
- weakest-evidence logic drives the next action;
- family and school-leader views reflect the same underlying evidence;
- reset clears the demonstration state;
- no Supabase REST/Functions request is made by the sandbox;
- interactive controls have accessible names.

## Next sequence after certification

1. VibeSchool Evidence Engine — pilot measurement → verified metric → permissioned proof.
2. Readiness Prescription — transform readiness score into a first workflow and 30-day pilot.
3. Education Knowledge Authority — high-intent, provenance-backed Kenyan education knowledge.
4. School Buyer / ROI System — business-case builder, pilot scope and procurement trust.
