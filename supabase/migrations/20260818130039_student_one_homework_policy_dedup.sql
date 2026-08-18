-- Remove duplicate teacher ALL policy on homework_submissions.
-- homework_submissions_teacher remains the canonical teacher ownership policy.
drop policy if exists "Teachers manage submissions for their homework" on public.homework_submissions;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='homework_submissions'
      and policyname='Teachers manage submissions for their homework'
  ) then
    raise exception 'student_one_homework_policy_dedup_failed_legacy_policy_remains';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='homework_submissions'
      and policyname='homework_submissions_teacher'
      and cmd='ALL'
      and roles = array['authenticated']::name[]
  ) then
    raise exception 'student_one_homework_policy_dedup_failed_canonical_policy_missing';
  end if;
end
$$;
