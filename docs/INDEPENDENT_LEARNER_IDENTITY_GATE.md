# Independent learner signup — gated implementation contract

Issue #1161. This change introduces **only the separate identity storage boundary**; it does not enable public Google student signup.

## Verified findings
- School PIN onboarding uses a school-issued code and an existing `students` record; it must not be changed.
- `app/auth/callback/route.ts` allows initial role claims only for teacher/parent, by design.
- `lib/student-context.tsx` requires a current Student Twin binding and `students.profile_id`; a Google account alone does not satisfy it.
- Guardian consent requests support `learner_user_id` without a school `student_id`, but the active request route currently requires a school learner.
- Public access to the independent identity table is revoked and RLS is enabled; browser reads/writes are intentionally impossible.

## Next release gates (mandatory before enabling Google student signup)
1. Signed-in Google account with verified email, exact canonical role-claim authority, and idempotent restricted independent identity provisioning; reject existing school students and conflicting roles without duplicate account.
2. Student Twin authorization must resolve restricted independent learners separately from school-owned students; no phantom school/class scope, no school-owned task/attendance access.
3. Extend guardian email challenge and verified-parent approval to independent learners; enforce age policy and verified consent via server authorization on protected learning/tutoring/video APIs. Withdrawal must immediately revoke access.
4. Authenticated school-code linking should atomically bind an **existing** school learner record after verified code/ownership checks, retaining the same auth user, progress, tutoring and consent history. Directory choice grants no membership.
5. Adversarial RLS, missing/withdrawn/replayed consent, two-school admission collision, duplicate role, transfer, and mobile OAuth tests; exact-head CI and real production browser certification.

Do **not** set `LEARNER_GUARDIAN_CONSENT_ENABLED=true` or expose a Google student CTA before these gates pass.
