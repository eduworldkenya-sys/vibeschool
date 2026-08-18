-- Task 8 — authenticated privilege minimization and notification tenant binding.
-- Browser/application roles never require TRUNCATE, TRIGGER or REFERENCES.
do $$
declare r record;
begin
  for r in
    select n.nspname,c.relname
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p')
  loop
    execute format('revoke truncate, trigger, references on table %I.%I from authenticated',r.nspname,r.relname);
    execute format('revoke truncate, trigger, references on table %I.%I from anon',r.nspname,r.relname);
  end loop;
end $$;

-- School-admin notification writes must be both tenant-bound and recipient-bound.
drop policy if exists notifications_admin_insert on public.notifications;
create policy notifications_admin_insert on public.notifications
for insert to authenticated
with check (
  public.is_school_admin(school_id)
  and (
    exists (
      select 1
      from public.school_members sm
      where sm.school_id = notifications.school_id
        and sm.profile_id = notifications.user_id
    )
    or exists (
      select 1
      from public.students s
      join public.student_classes sc
        on sc.student_id = s.id
       and sc.is_current = true
      where s.profile_id = notifications.user_id
        and s.deleted_at is null
        and sc.school_id = notifications.school_id
    )
    or exists (
      select 1
      from public.parent_student_links psl
      where psl.parent_id = notifications.user_id
        and psl.school_id = notifications.school_id
        and coalesce(psl.access_level,'full') <> 'none'
    )
  )
);
