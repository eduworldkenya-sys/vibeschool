# Task 26 — Teacher Profile, Professional Identity & Account Experience Certification

Date: 2026-08-19  
Status: **IN PROGRESS / SHARED-FOUNDATION HOLD**  
Branch: `task26/teacher-profile-identity-certification-20260819`  
Dependency base: Task 4 draft head `686344735e5346c3f39ce4db123ee0042290d6e5`  
Observed `main`: `77051a4011d7712a275f76af41efed382f017398`

## Hold gate

Until required shared foundations merge, this branch must not be merged and Task 26 must not mutate production Supabase, apply production migrations, change production RLS/grants, repair production profile data, deploy Edge Functions, or intentionally trigger Vercel. Production work in this phase is read-only inspection only.

Before final certification: fetch exact current `main`, reconcile auth/Teacher/school/security/UX changes, reinspect production read-only, rerun all affected gates, then perform the intended promotion and production smoke only after the hold is released.

## Starting state

The previously merged Teacher Profile work (#257 and #261) established a professional-profile UX, avatar lifecycle, account security/privacy and verification surfaces. Current `main`, however, still queries profile columns that are not present in the inspected production schema. Task 4 (#286) independently repairs that schema drift and introduces the canonical multi-school Teacher operating context. Task 26 therefore branches from Task 4 and tightens the remaining professional-identity/account authority boundary instead of creating a competing resolver.

## Authoritative identity contract

### Authentication identity

`auth.users.id` is the authenticated account identity.

### User/profile identity

`public.profiles.id = auth.users.id` is the application profile identity and role/account-status record.

### Teacher professional profile

`public.teacher_profiles.profile_id = public.profiles.id`. This table contains optional professional detail plus institution/HR fields. Presence of this row is not sufficient to authorize Teacher OS access.

### School membership

`public.school_members(profile_id, school_id, role='teacher')` is the authoritative current teacher-to-school relationship.

### Teaching context

`public.teacher_classes.teacher_id = public.profiles.id` is the authoritative assignment identity. `teacher_classes.school_id/class_id/subject_id` connect the teacher to the current school/class/subject records. Task 4 `teacher_get_operating_context()` resolves those relationships and `teacher_set_active_school()` selects among memberships without changing membership.

### Legacy `teachers` table

`public.teachers.user_id` is not used as the canonical assignment identity. Production has 47/48 explicit teacher-role accounts without a `teachers` row while current canonical assignment FKs point to `profiles.id`; therefore Task 26 treats `teachers` as legacy/non-authoritative unless a later foundation explicitly migrates it into the canonical chain.

## Field authority

Teacher self-service currently owns only presentation/personal/professional-context fields required by the Teacher product:

- `profiles.full_name`
- `profiles.phone`
- `profiles.bio`
- `profiles.gender`
- `profiles.date_of_birth`
- `profiles.avatar_url` through the owner-scoped avatar storage contract
- `teacher_profiles.tsc_number` as a self-declared value whose verification is separate
- `teacher_profiles.teaching_style`
- notification preferences through `/teacher/settings`
- privacy preferences through `/teacher/profile/account`

School/platform-controlled fields include school membership, active employment relationship, role, class/subject assignment, designation, employment type, subject allocation, leave/appraisal/finance/documents and verification status. Active-school selection is context, not membership mutation.

## Production identity findings — read-only

Aggregate inspection of the production project found:

- 48 authenticated accounts whose `profiles.role = 'teacher'`.
- 48/48 have a `profiles` row.
- 15/48 have a `school_members` teacher membership; 33/48 do not.
- 14/48 have `teacher_classes` assignments.
- 0 assignments exist without a matching teacher school membership.
- 0 class-school assignment mismatches found.
- 0 subject-school assignment mismatches found.
- 1 teacher has memberships in more than one school.
- 18/48 explicit teacher-role accounts have a `teacher_profiles` row; absence is treated as an incomplete optional professional profile, not identity authority failure.
- 15 additional `teacher_profiles` rows belong to authenticated profiles whose role is null; none has a teacher membership or assignment. These are ambiguous legacy/incomplete identities and are not auto-repaired.
- `profiles.school_id` is populated for 29 teacher-role accounts, but 16 of those values do not match a current teacher membership. It is therefore not safe as Teacher OS school authority.
- 33 total `teacher_profiles` rows exist; 17 have `teacher_profiles.school_id`, and 4 of those school values do not match a current teacher membership. This field is not used as active Teacher OS context.
- 0 duplicate `teacher_profiles.profile_id` mappings found.
- 0 duplicate `teachers.user_id` mappings found.
- 0 orphan `teacher_classes.teacher_id` references found.
- 0 production verification rows currently exist; verification UI must therefore display an unverified state rather than imply trust evidence.

No production rows were changed during this audit.

## Findings and classification

### P0 — current-main Profile schema drift

Current `main` `/teacher/profile` selects multiple columns not present in the inspected production `profiles` and `teacher_profiles` schemas. Task 4 repairs the page onto the actual current contracts. Task 26 inherits that repair and must not merge independently ahead of the Task 4/shared-foundation chain.

### P0 — teacher self-service could mutate authoritative professional fields

Production grants/RLS permit an authenticated teacher to update their own `teacher_profiles` row by `profile_id`, but the row contains institution/HR/finance fields. RLS protects *which row* can be changed, not *which fields* in that row. A manipulated direct payload could therefore attempt to change school/employment/designation/subject/appraisal/finance/document fields on the caller's own row.

Task 26 closes this in repository code with a database trigger guard and a narrow atomic self-profile RPC. Production remains unchanged until the hold is released.

### P1 — Task 4 Profile wrote active context into `teacher_profiles.school_id`

An active school choice is operating context, not professional membership authority. Task 26 removes `school_id` from Profile save entirely.

### P1 — institution fields presented as teacher-editable

Task 4 allowed self-edit of `employment_type` and `designation`. Task 26 renders them read-only and explicitly school-managed.

### P1 — duplicate/non-contract notification controls

Task 4 Profile introduced preference keys different from the existing `/teacher/settings` contract. Task 26 removes notification toggles from Profile and links to the canonical Settings surface.

### P1 — missing/incomplete membership states

33 explicit teacher-role accounts currently have no teacher school membership. Task 26 does not guess or fabricate school identity. The Profile uses the canonical context state and presents a clear `needs_school` recovery message; a valid membership with no assignment presents `needs_class` instead of a generic failure.

## Branch changes

### Database / authority

`supabase/migrations/20260819083000_task26_teacher_profile_identity_authority.sql`

- adds `guard_teacher_profile_self_service()` before insert/update trigger on `teacher_profiles`;
- direct self-service attempts to change school/employment/designation/subjects/leave/appraisal/finance/documents or other protected institutional fields fail with `teacher_profile_authoritative_fields_school_managed`;
- adds `teacher_update_my_profile(...)`, an authenticated active-teacher-only atomic RPC;
- the RPC updates only the approved self-service fields and never changes membership, school context, role, class/subject assignment, employment authority or verification;
- execute grants are explicit and public/anonymous execution is revoked.

### Teacher Profile UX

`app/teacher/profile/page.tsx`

- consumes Task 4 canonical `teacher_get_operating_context()`;
- uses the membership-checked active-school switch for the real multi-school edge case;
- treats school switching as context only;
- displays assignments from canonical `teacher_classes` context;
- makes employment type/designation read-only school-managed values;
- keeps TSC value editable but labels verification separately;
- saves editable profile fields atomically through `teacher_update_my_profile()`;
- removes duplicate notification controls and links to `/teacher/settings`;
- links Account Security & Privacy, Teacher Home and Help/Report Problem;
- handles no-school and no-class states explicitly;
- keeps avatar file-type/size validation and owner-folder storage path.

### Regression protection

`scripts/test-teacher-profile-task26-contract.mjs`

Checks canonical context use, bounded profile RPC use, no class/school mutation from Profile, account logout/password flows, notification centralization, protected database fields and explicit RPC grants.

`.github/workflows/teacher-profile-task26.yml`

Runs the Task 26 contract plus the two existing Teacher Profile professional/trust contracts on relevant PR changes.

## Security model to certify after foundation reconciliation

The exact candidate must prove:

1. Teacher A can read only allowed own/private profile data.
2. Teacher A cannot update Teacher B.
3. Teacher A cannot change `profiles.role` or `profiles.school_id` through self-service.
4. Teacher A cannot change `teacher_profiles.school_id`, employment/designation/subject allocation, appraisal, finance or documents.
5. Teacher A cannot insert/update/delete arbitrary `teacher_classes`.
6. Teacher A cannot manufacture `school_members` authority.
7. Multi-school selection accepts only a current membership and does not mutate membership.
8. Revoked membership produces no school/class/student access and clears Teacher OS scope on re-resolution.
9. Anonymous access to protected Teacher profile/account data fails closed.
10. Admin-controlled professional relationship fields remain writable only through the appropriate admin/system authority.

## Account and return behavior

Existing `/teacher/profile/account` uses Supabase Auth for password update and global sign-out, then returns to `/login`. Privacy preferences and verification evidence are separate. Task 26 preserves this boundary. Final logout → anonymous → login → same teacher/school/classes proof requires the exact merged candidate and an authorized test account after the hold is released.

## Remaining dependency gates

At minimum reconcile after these shared foundations land:

- #281 Task 1 — canonical authentication/onboarding and positive profile update allowlist.
- #282 Task 2 — migration reconstruction and generated database types.
- #286 Task 4 — canonical Teacher journey and operating context.
- #287 Task 7 — School Admin teacher relationship management.
- #288 Task 8 — platform authorization/privacy hardening.
- #289 Task 12 — telemetry/observability foundation where Task 26 events are added.

Task 26 must not create competing auth, school-membership or analytics authority while these are open.

## Validation completed so far

- production schema inspected read-only;
- teacher/profile/membership/assignment FKs inspected read-only;
- production identity populations quantified read-only;
- teacher/class/subject cross-school mismatch checks return zero;
- production Teacher Profile RLS/grants inspected read-only;
- existing Account and Settings surfaces inspected;
- Task 4 Profile and operating-context migration inspected;
- branch implementation created without applying production SQL;
- no intentional Vercel action performed.

## Still required before Definition of Done

- Task 26 contract run on exact branch head;
- existing Teacher Profile contracts;
- migration-security contract;
- clean reconstruction with Task 1/2/4 merged authority;
- direct authenticated cross-teacher and privileged-field negative tests;
- deactivated/revoked membership tests;
- TypeScript and production build;
- Teacher journey regressions;
- Android/mobile browser interaction and keyboard checks;
- accessibility checks;
- session expiry behavior;
- logout/re-login identity consistency;
- exact-current-main reconciliation after shared foundation merge;
- production migration/app deployment only after hold release;
- production Teacher Profile smoke and final handover.

## Current certification verdict

**NOT YET CERTIFIED — FOUNDATION-BLOCKED.**

Branch-level P0 repairs are implemented, but production remains intentionally unchanged and final exact-current-main, authenticated security, browser/mobile, build and production-smoke evidence are still required. No Task 26 merge is permitted in the current state.
