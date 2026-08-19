-- Task 5 reconciliation: preserve school-bound notification authority after Task 2.
-- authorization-test: public.notifications
--
-- Task 2 reconstructed notifications, but its admin INSERT policy only proved that
-- the caller was an admin somewhere. Student OS requires the caller's current
-- school authority to match the notification school and the recipient to have a
-- current relationship to that same school.

alter table public.notifications enable row level security;

drop policy if exists notifications_admin_insert on public.notifications;
create policy notifications_admin_insert
on public.notifications
for insert
to authenticated
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
        and coalesce(psl.access_level, 'full') <> 'none'
    )
  )
);

revoke all on table public.notifications from public, anon;
revoke all on table public.notifications from authenticated;
grant select, insert, update on table public.notifications to authenticated;
grant all on table public.notifications to service_role;
