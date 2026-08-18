-- Parent Command Center R1: close explicit-recipient circular visibility and
-- surface child-scoped incoming teacher/admin VibeConnect messages in the
-- canonical parent event inbox.

-- A parent explicitly named in vc_circular_recipients must be able to read the
-- corresponding circular even when they are not represented in school_members.
drop policy if exists vc_circulars_member_read on public.vc_circulars;
create policy vc_circulars_member_read
  on public.vc_circulars
  for select to authenticated
  using (
    school_id in (
      select sm.school_id
      from public.school_members sm
      where sm.profile_id = (select auth.uid())
    )
    or recipient_profile_id = (select auth.uid())
    or exists (
      select 1
      from public.vc_circular_recipients vcr
      where vcr.circular_id = vc_circulars.id
        and vcr.profile_id = (select auth.uid())
    )
  );

create or replace function private.parent_event_from_vibeconnect_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_thread record;
  v_sender_role text;
  v_sender_name text;
  v_recipient record;
begin
  if new.thread_id is null or new.sender_id is null then return new; end if;

  select t.student_id, t.school_id
    into v_thread
  from public.vc_threads t
  where t.id = new.thread_id;

  -- General/non-child conversations remain in VibeConnect but are not promoted
  -- into the child event stream because they do not carry canonical learner context.
  if v_thread.student_id is null then return new; end if;

  select p.role, p.full_name
    into v_sender_role, v_sender_name
  from public.profiles p
  where p.id = new.sender_id;

  if v_sender_role not in ('teacher', 'admin') then return new; end if;

  for v_recipient in
    select distinct vp.profile_id as parent_id
    from public.vc_participants vp
    join public.profiles pp on pp.id = vp.profile_id
    join public.parent_student_links psl
      on psl.parent_id = vp.profile_id
     and psl.student_id = v_thread.student_id
    where vp.thread_id = new.thread_id
      and vp.profile_id <> new.sender_id
      and vp.left_at is null
      and pp.role = 'parent'
      and coalesce(psl.access_level, 'full') <> 'none'
  loop
    perform private.parent_event_emit(
      v_recipient.parent_id,
      v_thread.student_id,
      v_thread.school_id,
      'teacher_message',
      'info',
      case when v_sender_role = 'teacher' then 'New teacher message' else 'New school message' end,
      left(coalesce(v_sender_name, initcap(v_sender_role)) || ': ' || coalesce(new.body, ''), 240),
      'vc_messages',
      new.id,
      'vibeconnect-message:' || new.id::text || ':' || v_recipient.parent_id::text,
      '/parent/child/' || v_thread.student_id::text || '/messages',
      jsonb_build_object(
        'thread_id', new.thread_id,
        'sender_id', new.sender_id,
        'sender_role', v_sender_role,
        'sender_name', v_sender_name
      ),
      coalesce(new.created_at, now())
    );
  end loop;

  return new;
end;
$$;

revoke all on function private.parent_event_from_vibeconnect_message() from public, anon, authenticated;

drop trigger if exists trg_parent_event_vibeconnect_message on public.vc_messages;
create trigger trg_parent_event_vibeconnect_message
after insert on public.vc_messages
for each row execute function private.parent_event_from_vibeconnect_message();
