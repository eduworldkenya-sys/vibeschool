# VibeSchool Learner Profile Architecture

## Goal

VibeSchool represents one learner, with Student, Parent and Teacher experiences as authorized projections of one learner core.

## Canonical identity

`public.students` is the school learner identity pivot. Canonical identity fields are learner id, school name, admission number, date of birth, gender, class and claimed profile binding. `profiles` owns authentication/account presentation such as avatar; it must not override populated school identity. `child_profiles` is parent/family context only.

Application code should resolve canonical identity through `lib/learner/profile-core.ts`. Role pages may enrich the result with authorized domain evidence, but must not invent competing identity precedence.

## Role projections

### Student — Me

Student sees canonical identity plus learner-owned learning state: class/school, goals, attendance pulse, mastery, strengths/focus, achievements, journey, Twin evidence and linked support. Restricted care/safety records are not flattened into the student profile.

### Teacher — Teach me

Teacher sees canonical identity plus instructional evidence: results, attendance, assessments, homework/submissions, resources, journey, groups, badges and school interventions. Parent-authored family notes are not school facts.

### Parent — Support me

Parent reads canonical school identity and may maintain family context only when the relationship grants profile-edit permission. Parent family data cannot redefine canonical school identity, academic evidence or Twin evidence. Sensitive health/care domains remain in their dedicated parent spaces.

## Corrections and authority

Canonical identity corrections are append-only requests. A parent may create a correction request only for a learner to whom they are linked. Parents cannot update/delete submitted requests or write reviewer-owned state. Only an active school admin/owner may review through `review_child_change_request`; approval applies the allowed canonical field and records reviewer evidence atomically.

Reviewable fields are deliberately limited to name, admission number, date of birth and gender. Class/school/profile binding changes are separate enrolment/account workflows and must not be smuggled through profile corrections.

## Privacy and security boundaries

- RLS is the final boundary; UI checks are only UX.
- Parent links are verified at the database boundary for correction creation/read.
- Student views do not expose parent medical/emergency details by default.
- Teacher views do not automatically receive family notes or health information.
- Twin decisions consume authorized learning evidence, not arbitrary family prose.
- Reviewer fields are never parent-writable.

## Lifecycle rules

- A claimed account binds through `students.profile_id`; account presentation does not become school identity.
- Class/school changes follow enrolment workflows and historical academic evidence keeps its own recorded context.
- Removing/revoking a parent link immediately removes that parent's learner-profile access through RLS-aware queries.
- Unclaimed learners remain valid school learner records; account-only presentation may be absent.

## Regression contract

A learner-profile change is incomplete unless:

1. Student, parent and teacher resolve the same `students.id`.
2. Canonical name/admission/DOB/gender/class do not diverge by role.
3. Family-note edits cannot mutate canonical identity.
4. A parent cannot create/read a correction for an unlinked learner.
5. A parent cannot approve/reject, rewrite reviewer metadata, update or delete a submitted correction.
6. Only an active authorized school admin can review a pending correction.
7. Student learning state uses existing Home OS/path/Twin evidence contracts rather than duplicate profile tables.
8. Sensitive care data remains outside general teacher/student projections.
9. Non-main Vercel deployment remains disabled for feature branches.
10. TypeScript, ESLint and production build pass before promotion.
