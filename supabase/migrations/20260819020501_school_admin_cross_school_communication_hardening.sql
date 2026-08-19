-- Task 7: School Admin cross-school communication hardening.
-- Repository-first and clean-rebuild safe. Notification policy hardening is
-- conditional because notifications is reconstructed later in the canonical chain.

create or replace function public.is_school_community_profile(
  p_school_id uuid,
  p_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() is not null
    and p_school_id is not null
    and p_profile_id is not null
    and exists (
      select 1 from public.schools school
      where school.id = p_school_id
        and school.deleted_at is null
        and school.status = 'active'
    )
    and (
      exists (
        select 1 from public.school_members member
        where member.school_id = p_school_id
          and member.profile_id = p_profile_id
      )
      or exists (
        select 1
        from public.students student
        join public.student_classes enrollment
          on enrollment.student_id = student.id
         and enrollment.school_id = p_school_id
         and enrollment.is_current = true
        where student.profile_id = p_profile_id
          and student.deleted_at is null
      )
      or exists (
        select 1
        from public.parent_student_links link
        join public.student_classes enrollment
          on enrollment.student_id = link.student_id
         and enrollment.school_id = p_school_id
         and enrollment.is_current = true
        join public.students student
          on student.id = enrollment.student_id
         and student.deleted_at is null
        where link.parent_id = p_profile_id
          and link.school_id = p_school_id
          and coalesce(link.access_level, 'full') <> 'none'
      )
    );
$$;

revoke all on function public.is_school_community_profile(uuid, uuid) from public;
grant execute on function public.is_school_community_profile(uuid, uuid) to authenticated;
grant execute on function public.is_school_community_profile(uuid, uuid) to service_role;

do $task7_notifications$
begin
  if to_regclass('public.notifications') is not null then
    execute 'drop policy if exists notifications_admin_insert on public.notifications';
    execute $policy$
      create policy notifications_admin_insert
      on public.notifications
      for insert
      to authenticated
      with check (
        school_id is not null
        and public.is_school_admin(school_id)
        and public.is_school_community_profile(school_id, user_id)
      )
    $policy$;
  end if;
end
$task7_notifications$;

drop policy if exists vc_recipients_admin_insert on public.vc_circular_recipients;
create policy vc_recipients_admin_insert
on public.vc_circular_recipients
for insert
to authenticated
with check (
  exists (
    select 1
    from public.vc_circulars circular
    where circular.id = vc_circular_recipients.circular_id
      and public.is_school_admin(circular.school_id)
      and public.is_school_community_profile(circular.school_id, vc_circular_recipients.profile_id)
  )
);

drop policy if exists vc_participants_admin on public.vc_participants;
create policy vc_participants_admin
on public.vc_participants
for all
to authenticated
using ((select private.vc_user_is_thread_admin(vc_participants.thread_id)))
with check (
  (select private.vc_user_is_thread_admin(vc_participants.thread_id))
  and exists (
    select 1
    from public.vc_threads thread
    where thread.id = vc_participants.thread_id
      and public.is_school_community_profile(thread.school_id, vc_participants.profile_id)
  )
);
