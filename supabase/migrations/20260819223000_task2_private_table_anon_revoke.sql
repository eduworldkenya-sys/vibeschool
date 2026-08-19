-- Task 2: private application relations are authenticated surfaces.
--
-- Production and clean-history inspection showed legacy broad anon grants on a
-- subset of these tables even though their RLS contracts are identity-, school-,
-- parent-, teacher-, or authenticated-user scoped. Keep public catalogue access
-- separate; this migration only hardens private user/domain relations.
--
-- REVOKE is data-neutral and safe to replay. Authenticated and service-role grants
-- are intentionally left intact; row authority continues to be enforced by RLS.

revoke all on table public.profiles from anon;
revoke all on table public.school_members from anon;
revoke all on table public.students from anon;
revoke all on table public.student_classes from anon;
revoke all on table public.teacher_classes from anon;
revoke all on table public.attendance from anon;
revoke all on table public.homework_submissions from anon;
revoke all on table public.class_join_requests from anon;
revoke all on table public.exam_results from anon;
revoke all on table public.content_learning_events from anon;
revoke all on table public.notifications from anon;
revoke all on table public.assessment_attempts from anon;
revoke all on table public.assessment_responses from anon;

comment on table public.students is
  'Canonical learner identity. Anonymous table privileges are revoked; authenticated access is RLS-scoped.';
comment on table public.student_classes is
  'Canonical learner-class membership. Anonymous table privileges are revoked; authenticated access is RLS-scoped.';
comment on table public.attendance is
  'Attendance evidence. Anonymous table privileges are revoked; authenticated access is RLS-scoped.';
comment on table public.homework_submissions is
  'Learner homework submissions. Anonymous table privileges are revoked; authenticated access is RLS-scoped.';
comment on table public.assessment_attempts is
  'Learner assessment attempts. Anonymous table privileges are revoked; authenticated access is RLS-scoped.';
comment on table public.assessment_responses is
  'Learner assessment responses. Anonymous table privileges are revoked; authenticated access is RLS-scoped.';
