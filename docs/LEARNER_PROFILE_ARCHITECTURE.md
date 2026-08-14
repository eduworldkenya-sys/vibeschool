# VibeSchool Learner Profile Architecture

## Goal

VibeSchool must represent one learner, not three competing student records. Student, parent and teacher experiences are role-specific projections of one learner core.

## Canonical identity

`public.students` is the school learner identity pivot.

Canonical school identity fields used by all authorized projections:

- `students.id`
- `students.name`
- `students.admission_number`
- `students.date_of_birth`
- `students.gender`
- `students.class_id`
- `students.profile_id` when the learner has claimed an account

`profiles` is the authenticated account record. It can supply account presentation such as `avatar_url`, but it must not silently override the school learner identity.

The active unique `students.profile_id` constraint prevents one authenticated student profile from representing multiple active learner rows.

## Role projections

### Student — "Me"

The student profile combines canonical school identity with learner-owned learning state:

- class and school
- admission identity
- goals and study preferences
- attendance pulse
- subject mastery
- strengths and focus areas
- achievements
- learning journey
- Twin confidence/evidence/next decision
- linked guardian/support summary
- account display preferences

The student must not see restricted care/safety records merely because they exist in the parent domain.

### Teacher — "Teach me"

The teacher learner view uses the same `students` row and adds instructional evidence:

- results
- attendance
- assessments
- homework/submissions
- resources
- journey
- groups
- badges
- teacher interventions and school workflows

Teacher views do not consume parent-authored family notes as school facts.

### Parent — "Support me"

The parent learner profile reads canonical school identity from `students` and separates parent-authored `child_profiles` data as a family layer.

Family-layer data can enrich the parent's experience but cannot silently redefine:

- learner name
- admission number
- date of birth
- gender
- class
- school
- academic evidence
- Twin evidence

Corrections to canonical identity use `child_change_requests` and school review.

Sensitive domains stay in their dedicated parent spaces (for example Health), rather than being flattened into the general profile.

## Identity precedence

For a claimed student account:

1. `students` controls school learner identity.
2. class/school are resolved from `students.class_id` -> `classes` -> `schools`.
3. `profiles` controls the authenticated account and account presentation.
4. parent `child_profiles` is family context only.
5. academic/twin state is derived from authoritative learning evidence, not from editable profile prose.

Legacy fallback to `profiles.full_name` is permitted only when the school learner name is absent. New code must not prefer it over a populated `students.name`.

## Privacy boundaries

- Parent links must be checked explicitly and still rely on RLS as the final database boundary.
- Student views must not expose parent-only medical/emergency details by default.
- Teacher views must not automatically receive parent family notes or sensitive health information.
- Twin decisions must use learning evidence and authorized learner data, not arbitrary parent-authored profile text.

## Change authority

- School identity corrections are reviewed school changes.
- Parent family notes are parent-editable within the linked-child boundary.
- Student learning goals/preferences are learner-owned where supported by existing Student Home OS authority functions.
- Academic records remain teacher/school/system authoritative.

## Regression contract

A learner-profile change is incomplete unless all of the following hold:

1. Student, parent and teacher resolve the same `students.id` for the learner.
2. `students.name`, admission, DOB, gender and class do not diverge by role projection.
3. A parent family-note edit cannot mutate canonical school identity.
4. Student profile learning state comes from the existing Student Home OS / personalized path / Twin contracts rather than duplicate profile tables.
5. No non-main Vercel deployment is enabled for the work branch.
6. TypeScript, ESLint and production build pass before promotion.
