# HQ User & Value Intelligence — handover

## Mission
Upgrade `/hq/users` from a passive account directory into an owner-gated founder intelligence surface without invasive tracking and without conflating account status, sign-in or real educational value.

## Audit findings
- The old UI exposed name/ID, role, account status and billing only.
- `active` meant account status; it did not mean recently logged in.
- Production already stores authoritative `auth.users.last_sign_in_at`.
- Production has canonical teaching and learning evidence in lesson plans, homework, submissions, student learning events, content learning events, reading sessions, adaptive sessions and learner outcomes.
- At audit time production had 101 auth users; 2 had signed in within 24h, 11 within 7d and 4 were new within 7d.
- At the deeper value audit, production had 48 teacher profiles, 14 teachers with a class, 2 teachers with lesson-plan activity in 30d, 1 with homework activity in 30d, 1 learner with recent learning/reading evidence and 2 parent-student links. These are current-state observations, not hard-coded product values.

## Implemented
Branch: `feature/hq-user-intelligence-20260818`

### Authentication and account intelligence
- Added `hq_user_intelligence_overview()` owner-only RPC.
- Extended `hq_user_directory()` with authoritative `last_sign_in_at` and sign-in age.
- Added total users, new users, 24h/7d/30d sign-in reach, never-signed-in, affiliation and subscription health.
- Individual rows now distinguish account status from last sign-in.

### Founder value intelligence
- Added `hq_founder_value_intelligence()` owner-only RPC.
- Added a North Star surface based on learning evidence rather than page views:
  - learners with canonical learning evidence in 7d;
  - learners with progression evidence in 30d;
  - teachers creating learning value in 7d;
  - active schools in 30d.
- Added role-specific activation ratios:
  - teacher profile -> teacher with class;
  - student profile -> canonical student identity;
  - parent profile -> linked learner.
- Added 7-day teaching metrics: active teachers, lesson plans, homework and submissions.
- Added 7-day learning metrics: active learners, learning events, reading and adaptive sessions.
- Added 30-day mastery metrics: progressing learners, assessed learners, proficient/mastered outcomes and adaptive mastery-gain sessions.
- Added measurement-coverage signals and deliberately marks cohort retention, acquisition attribution and governed experimentation as not yet certified instead of inventing numbers.

## Product principle
Authentication is not engagement. Engagement is not learning. Learning activity is not automatically mastery. HQ exposes those layers separately so founder decisions cannot be driven by vanity metrics.

## Research direction
The implementation follows current product-analytics guidance to prioritize activation, retention and a North Star tied to user value, while education analytics should emphasize mastery/progression rather than time or visits alone.

## Security and privacy
- Both RPCs remain platform-owner gated through `is_platform_owner()`.
- `anon` and `public` execution are revoked.
- The dashboard uses aggregate educational evidence and operational account data; it does not expose learner prompts, content bodies or private message contents.
- Existing canonical student identity remains the learner key for learning evidence.

## Deliberately not fabricated
The repository contains event kernels, but VibeSchool does not yet have certified end-to-end acquisition attribution, experiment registry or D1/D7/D30 product cohort instrumentation. The UI surfaces this as instrumentation debt rather than using login as a fake retention metric.

## Deployment discipline
- Production Supabase was inspected read-only during design.
- Apply repository migrations only after exact-head security, isolated rebuild and TypeScript/production-build gates pass.
- Because the new frontend depends on additive RPCs, commission and verify those RPCs in production immediately before the final merge. This prevents the application from deploying against a missing database contract.
- Use the final merge as the application promotion point; do not make additional deployment-triggering code commits afterward unless a verified defect requires it.
- No direct Vercel action is part of this work; normal deployment may occur only through the repository's existing main-branch integration after final merge.

## Finalization
This is the final handover state for PR #271. Any later change must correspond to a verified defect.
