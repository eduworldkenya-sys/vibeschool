begin;

-- Parents must not be able to self-link to an arbitrary enrolled student by writing
-- parent_student_links directly. The authenticated claim RPC is the parent linking path.
drop policy if exists pol_psl_insert on public.parent_student_links;
create policy pol_psl_insert on public.parent_student_links
for insert to authenticated
with check (
  exists (
    select 1 from public.school_members sm
    where sm.profile_id = auth.uid()
      and sm.school_id = parent_student_links.school_id
      and sm.role in ('owner','admin')
  )
);

create or replace function public.guard_parent_student_link_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'parent') then
    if new.parent_id is distinct from old.parent_id
       or new.student_id is distinct from old.student_id
       or new.school_id is distinct from old.school_id then
      raise exception 'Parents cannot change child-link identity';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_parent_student_link_identity on public.parent_student_links;
create trigger trg_guard_parent_student_link_identity
before update on public.parent_student_links
for each row execute function public.guard_parent_student_link_identity();

commit;
