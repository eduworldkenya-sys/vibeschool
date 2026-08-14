begin;

create or replace function public.is_parent_of_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.parent_student_links
    where student_id = p_student_id
      and parent_id = auth.uid()
      and coalesce(access_level, 'full') <> 'none'
  );
$$;

revoke all on function public.is_parent_of_student(uuid) from public, anon;
grant execute on function public.is_parent_of_student(uuid) to authenticated;

commit;
