begin;

drop policy if exists vc_threads_insert on public.vc_threads;
create policy vc_threads_insert on public.vc_threads
for insert to authenticated
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role <> 'parent')
  and school_id in (select sm.school_id from public.school_members sm where sm.profile_id = auth.uid())
);

drop policy if exists vc_participants_insert_self on public.vc_participants;
create policy vc_participants_insert_self on public.vc_participants
for insert to authenticated
with check (
  profile_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role <> 'parent')
  and school_id in (select sm.school_id from public.school_members sm where sm.profile_id = auth.uid())
);

create or replace function public.guard_parent_thread_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'parent') then
    if new.id is distinct from old.id
       or new.school_id is distinct from old.school_id
       or new.type is distinct from old.type
       or new.created_by is distinct from old.created_by
       or new.context_tag is distinct from old.context_tag then
      raise exception 'Parents cannot modify thread metadata';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_parent_thread_update on public.vc_threads;
create trigger trg_guard_parent_thread_update
before update on public.vc_threads
for each row execute function public.guard_parent_thread_update();

commit;
