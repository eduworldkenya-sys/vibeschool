-- Restrict direct learner Data API reads to released assessment records.
-- Learner workspace and draft saves use owner-authorised SECURITY DEFINER RPCs.
-- Teacher read policies remain unchanged.
alter policy assessment_attempts_student_read on public.assessment_attempts
  using (
    status='released' and result_status='released'
    and exists (
      select 1 from public.students s
      where s.id=assessment_attempts.student_id
        and s.profile_id=(select auth.uid())
    )
  );

alter policy assessment_responses_student_read on public.assessment_responses
  using (
    exists (
      select 1
      from public.assessment_attempts a
      join public.students s on s.id=a.student_id
      where a.id=assessment_responses.attempt_id
        and s.profile_id=(select auth.uid())
        and a.status='released'
        and a.result_status='released'
    )
  );
