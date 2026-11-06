# Learner identity, guardian authorization and consent rollout

Status: **Foundation staged; no new registration journey enabled.** Existing school-issued learner identity and PIN remain unchanged until a reviewed cutover. Do not present an email click as proof of guardianship.

## Existing facts / protected constraints
- School learner creation: `app/signup/student/page.tsx` → `app/api/create-student-account/route.ts`.
- Existing code calls Supabase admin `createUser` with `@vs.internal` and `email_confirm: true`. This is an internal technical identity, **not verified control of a real learner mailbox**.
- Existing teacher-authorized school claim and learner-to-class mapping must remain intact. No unverified self-enrollment into schools.
- Parent linkage is currently independent from learner activation. Enforcing guardian approval on all accounts requires a coordinated, tested migration that does not strand existing learners.
- Login, OAuth redirect, RLS and role claims must not be loosened.
- Existing `profiles.parental_consent_at`, `profiles.parental_consent_by`, `parent_student_links`, `parent_students` are **not sufficient evidence of a verified independent guardian approval workflow** by themselves.

## Where each safeguard belongs
| Layer | Implementation requirement |
| --- | --- |
| Learner signup | Add two paths in the existing page: join school (claim code) and learn independently (no school access). Request minimum age information and real email only when creating a personal account. |
| Supabase Auth | Confirm email for real email/password identities; keep Google OAuth; don't assert `@vs.internal` is email-verified. Rate-limit signups, emails and approval attempts. |
| Guardian step | Ask for guardian name, relationship and email only when necessary. Guardian receives expiring single-use token; store only hash; guardian must verify their *own* email and make a specific, recorded declaration. For elevated-risk cases require additional manual verification. |
| Data model | Use restricted `learner_guardian_consent_requests` and append-only `learner_guardian_consent_events` for verified timestamps, policy versions, approval and withdrawal. Do not let public/authenticated clients read or write them directly. |
| Access guard | Until consent and age-specific requirements pass, no saved learner profile, private messaging, tutoring, school records or school-linked content. Enforce backend-side, not by hiding buttons. Public anonymous lessons remain available if lawfully configured. |
| School linking | Require existing authorized school claim; independent account linking must preserve its identity/progress and never auto-grant access to private school data. |
| HQ | Count pending/approved/rejected/withdrawn/review-required; show minimal redacted learner details only to authorized safeguarding staff; searchable audit history without sensitive tokens. |
| Guardian controls | Review purposes and linked learners, withdraw consent, request correction/deletion according to retention schedule, and report impersonation. |
| Validation | Negative tests: learner approves themselves, token replay, token expiry, forged guardian ID, missing consent, session role swap, duplicate claim, cross-student RLS, multiple accounts, existing student PIN journey. |

## Release gate (do not bypass)
1. Implement server-owned request/approve/withdraw endpoints with audited, purpose-limited guardian evidence and protected delivery; secure email provider must be configured and tested.
2. Complete backend authorization checks for every relevant private learner resource, and guardian identity + withdrawal semantics.
3. Test consent state transitions, school-claim linkage, access denials, mobile screens, and legacy student sessions.
4. Run database security advisors and CI; review minors' privacy and retention under applicable Kenyan requirements.
5. Only then expose the independent learner registration UI and enable the consent gate for newly registered minors. Migrate existing school learners separately with a non-destructive transition plan.

This foundation schema does **not** authorize accounts and does **not** change the current production login behavior.
