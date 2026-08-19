-- VibeSchool Task 6: revoked family relationships must lose child-scoped
-- communication and notification access immediately.
--
-- Runs after Parent Command Center R1 migrations in a clean rebuild.
-- authorization-test: public.parent_events
-- authorization-test: public.vc_threads
-- authorization-test: public.vc_participants
-- authorization-test: public.vc_messages

begin;

-- Historical event rows remain parent-owned, but child-scoped events are learner
-- data. Once the relationship is revoked they must disappear from the inbox.
drop policy if exists parent_events_parent_select on public.parent_events;
create policy parent_events_parent_select
on public.parent_events
for select
to authenticated
using (
  parent_events.parent_id = (select auth.uid())
  and (
    parent_events.student_id is null
    or (select public.is_parent_of_student(parent_events.student_id))
  )
);

drop policy if exists parent_events_parent_update_receipt on public.parent_events;
create policy parent_events_parent_update_receipt
on public.parent_events
for update
to authenticated
using (
  parent_events.parent_id = (select auth.uid())
  and (
    parent_events.student_id is null
    or (select public.is_parent_of_student(parent_events.student_id))
  )
)
with check (
  parent_events.parent_id = (select auth.uid())
  and (
    parent_events.student_id is null
    or (select public.is_parent_of_student(parent_events.student_id))
  )
);

-- Parent Command Center R1 adds vc_threads.student_id. Keep ordinary staff and
-- general threads working, but require active relationship for a parent viewing
-- any learner-scoped conversation.
create or replace function private.vc_child_scope_authorized(p_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.vc_threads t
    left join public.profiles p on p.id = (select auth.uid())
    where t.id = p_thread_id
      and (
        t.student_id is null
        or coalesce(p.role, '') <> 'parent'
        or public.is_parent_of_student(t.student_id)
      )
  );
$function$;

revoke all on function private.vc_child_scope_authorized(uuid) from public, anon;
grant execute on function private.vc_child_scope_authorized(uuid) to authenticated, service_role;

-- A revoked parent must not be able to create a fresh child thread even if an
-- older R1 RPC only checked link-row existence. This trigger is defense in depth
-- below every client/RPC entrypoint.
create or replace function private.vc_guard_parent_child_thread_relationship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.student_id is null then
    return new;
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id = new.created_by and p.role = 'parent'
  ) and not exists (
    select 1
    from public.parent_student_links psl
    where psl.parent_id = new.created_by
      and psl.student_id = new.student_id
      and coalesce(psl.access_level, 'full') <> 'none'
  ) then
    raise exception 'active parent relationship required' using errcode = '42501';
  end if;

  return new;
end;
$function$;

revoke all on function private.vc_guard_parent_child_thread_relationship() from public, anon, authenticated;
grant execute on function private.vc_guard_parent_child_thread_relationship() to service_role;

drop trigger if exists vc_guard_parent_child_thread_relationship on public.vc_threads;
create trigger vc_guard_parent_child_thread_relationship
before insert or update of student_id, created_by on public.vc_threads
for each row execute function private.vc_guard_parent_child_thread_relationship();

-- Preserve existing participant/admin semantics and add the learner-scope gate.
drop policy if exists "members can view their threads" on public.vc_threads;
create policy "members can view their threads"
on public.vc_threads
for select
to authenticated
using (
  (select private.vc_user_is_thread_participant(vc_threads.id))
  and (select private.vc_child_scope_authorized(vc_threads.id))
);

drop policy if exists "members can update their threads" on public.vc_threads;
create policy "members can update their threads"
on public.vc_threads
for update
to authenticated
using (
  (select private.vc_user_is_thread_participant(vc_threads.id))
  and (select private.vc_child_scope_authorized(vc_threads.id))
)
with check (
  (select private.vc_user_is_thread_participant(vc_threads.id))
  and (select private.vc_child_scope_authorized(vc_threads.id))
);

drop policy if exists "users can view participants in their threads" on public.vc_participants;
create policy "users can view participants in their threads"
on public.vc_participants
for select
to authenticated
using (
  (select private.vc_user_is_thread_participant(vc_participants.thread_id))
  and (select private.vc_child_scope_authorized(vc_participants.thread_id))
);

drop policy if exists "thread members can view messages" on public.vc_messages;
create policy "thread members can view messages"
on public.vc_messages
for select
to authenticated
using (
  (select private.vc_user_is_thread_participant(vc_messages.thread_id))
  and (select private.vc_child_scope_authorized(vc_messages.thread_id))
);

drop policy if exists "thread members can insert messages" on public.vc_messages;
create policy "thread members can insert messages"
on public.vc_messages
for insert
to authenticated
with check (
  (select private.vc_user_is_thread_participant(vc_messages.thread_id))
  and (select private.vc_child_scope_authorized(vc_messages.thread_id))
);

commit;
