begin;

-- The first recursion fix removed the direct self-reference from vc_participants,
-- but vc_threads and vc_participants also reference each other through their
-- policies. Move both relationship checks behind SECURITY DEFINER helpers so
-- policy evaluation does not re-enter either table's RLS rules.

create or replace function private.vc_user_is_thread_participant(p_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.vc_participants vp
      where vp.thread_id = p_thread_id
        and vp.profile_id = auth.uid()
    );
$$;

create or replace function private.vc_user_is_thread_admin(p_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.vc_threads vt
      where vt.id = p_thread_id
        and public.is_school_admin(vt.school_id)
    );
$$;

revoke all on function private.vc_user_is_thread_participant(uuid) from public, anon, authenticated;
revoke all on function private.vc_user_is_thread_admin(uuid) from public, anon, authenticated;

-- vc_participants policies

drop policy if exists "vc_participants_admin" on public.vc_participants;
create policy "vc_participants_admin"
on public.vc_participants
for all
to authenticated
using ((select private.vc_user_is_thread_admin(thread_id)))
with check ((select private.vc_user_is_thread_admin(thread_id)));

-- vc_threads policies

drop policy if exists "members can view their threads" on public.vc_threads;
create policy "members can view their threads"
on public.vc_threads
for select
to authenticated
using ((select private.vc_user_is_thread_participant(id)));

drop policy if exists "members can update their threads" on public.vc_threads;
create policy "members can update their threads"
on public.vc_threads
for update
to authenticated
using ((select private.vc_user_is_thread_participant(id)))
with check ((select private.vc_user_is_thread_participant(id)));

drop policy if exists "vc_threads_admin" on public.vc_threads;
create policy "vc_threads_admin"
on public.vc_threads
for all
to authenticated
using ((select private.vc_user_is_thread_admin(id)))
with check ((select private.vc_user_is_thread_admin(id)));

commit;
