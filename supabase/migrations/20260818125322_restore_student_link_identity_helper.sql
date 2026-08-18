-- Restore the production prerequisite used by downstream Student = 1 policies.
--
-- This helper existed in production before the downstream authorization
-- hardening migration, but its DDL was missing from repository migration
-- history. Keeping the prerequisite immediately before 20260818125323 makes
-- blank rebuilds reproduce the production authority boundary.

create or replace function public.is_own_student_link(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.students
    where id = p_student_id
      and profile_id = auth.uid()
  );
$$;

revoke all on function public.is_own_student_link(uuid) from public;
revoke all on function public.is_own_student_link(uuid) from anon;
grant execute on function public.is_own_student_link(uuid) to authenticated;

comment on function public.is_own_student_link(uuid) is
  'Canonical Student = 1 ownership helper: authenticated profile -> students.profile_id -> students.id.';
