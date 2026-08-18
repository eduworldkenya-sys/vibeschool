# Teacher Profile Trust & Security Closure — 2026-08-18

## Mission
Close the remaining Teacher Profile maturity gaps after PR #257 without turning Profile back into an HR/admin control room.

## Completed
- Dedicated `/teacher/profile/account` workspace for password change, global session sign-out, privacy preferences, verification state and avatar removal.
- `/teacher/settings` is now the discoverable entry point to Account & Trust.
- Removed non-functional `Delete Account` and `Export My Data` danger-zone buttons. Destructive/privacy rights are not represented unless a governed backend workflow exists.
- Added owner-scoped `teacher_profile_privacy` authority with RLS.
- Added read-own/service-governed `teacher_profile_verifications` authority. Teachers cannot self-award TSC, school or employment verification.
- Added avatar remove lifecycle that clears profile variants in the teacher-owned storage folder and restores initials fallback.
- Preserved photo replacement on `/teacher/profile`.
- Added dedicated regression contract.

## Authority boundaries
Teacher-owned: profile text, credentials/preferences, avatar, privacy preferences, password/session controls.
School/platform-owned: verification state, school membership, class/subject assignment.
Operational modules: attendance, leave, appraisal, messages, documents, payroll/finance remain outside Profile.

## Production Supabase
Applied `teacher_profile_trust_privacy` on production project `yauqsxggtuxuykcbrtzf`.

## Safety
- Verification table grants authenticated users SELECT only and limits that SELECT to `profile_id = auth.uid()`.
- Verification writes remain outside the teacher browser authority.
- Privacy preferences do not bypass downstream RLS or authorization.
- No intentional Vercel connector action during branch work.

## Release gate
Merge only after exact-head TypeScript/production build, auth/onboarding, migration security, repository extraction and isolated rebuild gates pass.

## Physical-device acceptance
CI cannot prove hardware/browser behavior. Pilot acceptance should still exercise low-end Android photo removal/replacement, slow-network saves, password re-authentication behavior, and global sign-out recovery. This is operational acceptance, not an unresolved code defect.
