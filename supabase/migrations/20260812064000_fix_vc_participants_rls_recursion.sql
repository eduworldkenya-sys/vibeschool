begin;

-- Break the self-referential RLS dependency. Supabase documents that a policy
-- querying its own RLS-protected table can recurse; the permission check is
-- therefore moved into a non-API-exposed SECURITY DEFINER helper.
create schema if not exists private;

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

revoke all on function private.vc_user_is_thread_participant(uuid) from public, anon, authenticated;

-- The old SELECT policy directly queried vc_participants and recursively
-- triggered itself. Replace it with the helper.
drop policy if exists "users can view participants in their threads" on public.vc_participants;
create policy "users can view participants in their threads"
on public.vc_participants
for select
to authenticated
using ((select private.vc_user_is_thread_participant(thread_id)));

-- Make the remaining participant policies explicit about their API role.
drop policy if exists "users can update own participant row" on public.vc_participants;
create policy "users can update own participant row"
on public.vc_participants
for update
to authenticated
using ((select auth.uid()) = profile_id)
with check ((select auth.uid()) = profile_id);

drop policy if exists "vc_participants_admin" on public.vc_participants;
create policy "vc_participants_admin"
on public.vc_participants
for all
to authenticated
using (
  exists (
    select 1
    from public.vc_threads
    where vc_threads.id = vc_participants.thread_id
      and public.is_school_admin(vc_threads.school_id)
  )
)
with check (
  exists (
    select 1
    from public.vc_threads
    where vc_threads.id = vc_participants.thread_id
      and public.is_school_admin(vc_threads.school_id)
  )
);

drop policy if exists "vc_participants_insert_self" on public.vc_participants;
create policy "vc_participants_insert_self"
on public.vc_participants
for insert
to authenticated
with check (
  (select auth.uid()) = profile_id
  and school_id in (
    select sm.school_id
    from public.school_members sm
    where sm.profile_id = (select auth.uid())
  )
);

commit;
