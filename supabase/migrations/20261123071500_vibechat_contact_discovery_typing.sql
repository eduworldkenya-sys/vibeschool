-- VibeChat contacts + private typing. Draft migration only; do not apply to production
-- without the independent security/negative-path gate.
-- Existing school and tuition message history remains authoritative.
begin;

-- The existing production schema has this column, but blank reconstruction did not.
-- Additive repair; retain every existing VibeConnect ID.
alter table public.profiles add column if not exists vc_id text;

-- Parent/teacher context is stored on the thread, never inferred from the
-- caller's arbitrary route parameters or the participant's school account.
alter table public.vc_threads
  add column if not exists student_id uuid references public.students(id);
create index if not exists vibechat_child_threads
  on public.vc_threads(student_id, created_at desc) where student_id is not null;

-- Child-scoped admission: a linked guardian and an assigned, currently active
-- class teacher, for this exact learner. There is no arbitrary staff discovery.
create or replace function public.parent_start_child_thread(
  p_student_id uuid,
  p_staff_id uuid,
  p_context_tag text default 'general'
) returns uuid
language plpgsql volatile security definer set search_path='' as $vcparent$
declare
  v_parent uuid := auth.uid();
  v_school uuid;
  v_thread uuid;
begin
  if v_parent is null then raise exception 'Sign-in required' using errcode='28000'; end if;
  if p_student_id is null or p_staff_id is null or
     coalesce(p_context_tag,'') not in ('question','general','urgent','concern','enquiry')
  then raise exception 'Invalid child message request' using errcode='22023'; end if;
  select cl.school_id into v_school
  from public.parent_student_links link
  join public.students learner on learner.id=link.student_id
    and learner.deleted_at is null
  join public.classes cl on cl.id=learner.class_id
  join public.profiles guardian on guardian.id=link.parent_id
    and guardian.account_status::text='active'
    and not coalesce(guardian.is_anonymized,false)
  join public.profiles staff_profile on staff_profile.id=p_staff_id
    and staff_profile.role in ('teacher','admin')
    and staff_profile.account_status::text='active'
    and not coalesce(staff_profile.is_anonymized,false)
  where link.parent_id=v_parent and link.student_id=p_student_id
    and (link.school_id is null or link.school_id=cl.school_id)
    and exists (select 1 from public.school_members sm
      where sm.profile_id=p_staff_id and sm.school_id=cl.school_id)
    and (
      (staff_profile.role='teacher' and exists (
        select 1 from public.teacher_classes assignment
        where assignment.teacher_id=p_staff_id and assignment.class_id=cl.id
          and assignment.school_id=cl.school_id
      ))
      or staff_profile.role='admin'
    )
  limit 1;
  if v_school is null then
    raise exception 'Parent or assigned teacher is not authorized'
      using errcode='42501';
  end if;

  -- Concurrent requests for the same exact guardian/learner/teacher are
  -- serialized, avoiding accidental duplicate threads.
  perform pg_advisory_xact_lock(hashtextextended(
    v_parent::text || ':' || p_student_id::text || ':' || p_staff_id::text,0));
  select thread.id into v_thread
  from public.vc_threads thread
  where thread.student_id=p_student_id and thread.school_id=v_school
    and thread.type='direct'
    and exists (select 1 from public.vc_participants mine
      where mine.thread_id=thread.id and mine.profile_id=v_parent and mine.left_at is null)
    and exists (select 1 from public.vc_participants other
      where other.thread_id=thread.id and other.profile_id=p_staff_id and other.left_at is null)
  order by thread.created_at desc limit 1;
  if v_thread is not null then return v_thread; end if;

  insert into public.vc_threads(school_id,student_id,type,created_by,context_tag,subject)
    values(v_school,p_student_id,'direct',v_parent,p_context_tag,'Child-scoped teacher conversation')
    returning id into v_thread;
  insert into public.vc_participants(thread_id,profile_id,school_id)
    values (v_thread,v_parent,v_school),(v_thread,p_staff_id,v_school);
  return v_thread;
end;
$vcparent$;
revoke all on function public.parent_start_child_thread(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.parent_start_child_thread(uuid,uuid,text)
  to authenticated;



-- Teacher outreach uses the learner/guardian relationship, not a people search.
-- No email, phone, admission number, or unlinked learner is returned.
create or replace function public.vibechat_my_school_families()
returns jsonb language sql stable security definer set search_path='' as $vcfamily$
  select coalesce(jsonb_agg(jsonb_build_object(
      'student_id', selection.student_id,
      'student_name', selection.student_name,
      'parent_id', selection.parent_id,
      'parent_name', selection.parent_name,
      'avatar_url', selection.avatar_url
  ) order by selection.student_name, selection.parent_name), '[]'::jsonb)
  from (
    select distinct learner.id as student_id, learner.name as student_name,
      guardian.id as parent_id, guardian.full_name as parent_name,
      guardian.avatar_url
    from public.teacher_classes assignment
    join public.classes class on class.id=assignment.class_id
      and class.school_id=assignment.school_id
    join public.school_members staff on staff.profile_id=assignment.teacher_id
      and staff.school_id=class.school_id
    join public.students learner on learner.class_id=class.id and learner.deleted_at is null
    join public.parent_student_links guardian_link on guardian_link.student_id=learner.id
      and (guardian_link.school_id is null or guardian_link.school_id=class.school_id)
    join public.profiles guardian on guardian.id=guardian_link.parent_id
      and guardian.account_status::text='active'
      and not coalesce(guardian.is_anonymized,false)
    join public.profiles teacher on teacher.id=assignment.teacher_id
      and teacher.role='teacher' and teacher.account_status::text='active'
      and not coalesce(teacher.is_anonymized,false)
    where auth.uid() is not null and assignment.teacher_id=auth.uid()
    order by learner.name, guardian.full_name
    limit 150
  ) selection
$vcfamily$;
revoke all on function public.vibechat_my_school_families()
  from public,anon,authenticated;
grant execute on function public.vibechat_my_school_families() to authenticated;

create or replace function public.vibechat_start_teacher_parent_thread(
  p_student_id uuid,
  p_parent_id uuid,
  p_context_tag text default 'general'
) returns uuid
language plpgsql volatile security definer set search_path='' as $vcteacher$
declare
  v_teacher uuid := auth.uid();
  v_school uuid;
  v_thread uuid;
begin
  if v_teacher is null then raise exception 'Sign-in required' using errcode='28000'; end if;
  if p_student_id is null or p_parent_id is null
     or coalesce(p_context_tag,'') not in ('general','question','urgent','concern')
  then raise exception 'Invalid teacher message request' using errcode='22023'; end if;
  select class.school_id into v_school
    from public.teacher_classes assignment
    join public.classes class on class.id=assignment.class_id
      and class.school_id=assignment.school_id
    join public.school_members staff on staff.profile_id=v_teacher
      and staff.school_id=class.school_id
    join public.students learner on learner.class_id=class.id
      and learner.id=p_student_id and learner.deleted_at is null
    join public.parent_student_links guardian_link on guardian_link.student_id=learner.id
      and guardian_link.parent_id=p_parent_id
      and (guardian_link.school_id is null or guardian_link.school_id=class.school_id)
    join public.profiles teacher on teacher.id=v_teacher and teacher.role='teacher'
      and teacher.account_status::text='active'
      and not coalesce(teacher.is_anonymized,false)
    join public.profiles guardian on guardian.id=p_parent_id
      and guardian.account_status::text='active'
      and not coalesce(guardian.is_anonymized,false)
    where assignment.teacher_id=v_teacher limit 1;
  if v_school is null then
    raise exception 'Teacher and guardian are not authorized for this learner'
      using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    p_parent_id::text || ':' || p_student_id::text || ':' || v_teacher::text,0));
  select thread.id into v_thread from public.vc_threads thread
  where thread.student_id=p_student_id and thread.school_id=v_school and thread.type='direct'
    and exists(select 1 from public.vc_participants parent
      where parent.thread_id=thread.id and parent.profile_id=p_parent_id and parent.left_at is null)
    and exists(select 1 from public.vc_participants staff
      where staff.thread_id=thread.id and staff.profile_id=v_teacher and staff.left_at is null)
  order by thread.created_at desc limit 1;
  if v_thread is not null then return v_thread; end if;
  insert into public.vc_threads(school_id,student_id,type,created_by,context_tag,subject)
    values(v_school,p_student_id,'direct',v_teacher,p_context_tag,'School-family conversation')
    returning id into v_thread;
  insert into public.vc_participants(thread_id,profile_id,school_id)
    values(v_thread,v_teacher,v_school),(v_thread,p_parent_id,v_school);
  return v_thread;
end;
$vcteacher$;
revoke all on function public.vibechat_start_teacher_parent_thread(uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.vibechat_start_teacher_parent_thread(uuid,uuid,text)
  to authenticated;

-- The historical participant helper omitted departure and child-link checks.
-- Restore both at the canonical source of truth used by thread/message RLS.
create or replace function private.vc_user_is_thread_participant(p_thread_id uuid)
returns boolean language sql stable security definer set search_path='' as $vcactive$
  select auth.uid() is not null and exists (
    select 1 from public.vc_participants membership
    join public.vc_threads thread on thread.id=membership.thread_id
    join public.profiles actor on actor.id=membership.profile_id
      and actor.account_status::text='active'
      and not coalesce(actor.is_anonymized,false)
    where membership.thread_id=p_thread_id and membership.profile_id=auth.uid()
      and membership.left_at is null
      and (
        thread.student_id is null
        or exists (
          select 1 from public.parent_student_links link
          join public.students learner on learner.id=link.student_id
            and learner.deleted_at is null
          join public.classes cl on cl.id=learner.class_id
          where link.parent_id=auth.uid() and link.student_id=thread.student_id
            and cl.school_id=thread.school_id
            and (link.school_id is null or link.school_id=cl.school_id)
        )
        or exists (
          select 1 from public.students learner
          join public.classes cl on cl.id=learner.class_id
          join public.school_members member on member.school_id=cl.school_id
            and member.profile_id=auth.uid()
          join public.profiles staff_profile on staff_profile.id=auth.uid()
            and staff_profile.role in ('teacher','admin')
          where learner.id=thread.student_id and learner.deleted_at is null
            and cl.school_id=thread.school_id
            and (
              staff_profile.role='admin'
              or exists (select 1 from public.teacher_classes assignment
                where assignment.teacher_id=auth.uid() and assignment.class_id=cl.id
                  and assignment.school_id=cl.school_id)
            )
        )
      )
  );
$vcactive$;
revoke all on function private.vc_user_is_thread_participant(uuid)
  from public, anon;
grant execute on function private.vc_user_is_thread_participant(uuid)
  to authenticated;

-- School administrators keep their existing circular rights, but may not
-- bypass learner-specific parent/teacher admission to read a private direct chat.
drop policy if exists vibechat_child_message_read_integrity on public.vc_messages;
create policy vibechat_child_message_read_integrity on public.vc_messages
  as restrictive for select to authenticated
  using (exists (
    select 1 from public.vc_threads thread
    where thread.id=vc_messages.thread_id
      and (thread.student_id is null
        or private.vc_user_is_thread_participant(thread.id))
  ));

-- access: service-only public.vibechat_blocks
-- authorization-test: public.vibechat_blocks; scripts/test-vibechat-contact-discovery.mjs
create table if not exists public.vibechat_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id,blocked_id),
  constraint vibechat_block_nonself check(blocker_id<>blocked_id)
);
alter table public.vibechat_blocks enable row level security;
revoke all on public.vibechat_blocks from public,anon,authenticated;

-- access: service-only public.vibechat_reports
-- authorization-test: public.vibechat_reports; scripts/test-vibechat-contact-discovery.mjs
create table if not exists public.vibechat_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  room_kind text not null check(room_kind in ('vc','tuition')),
  room_id uuid not null,
  reason text not null check(reason in ('spam','harassment','safety','other')),
  created_at timestamptz not null default now(),
  review_status text not null default 'pending' check(review_status in ('pending','reviewed','closed'))
);
create index if not exists vibechat_pending_reports
  on public.vibechat_reports(review_status,created_at desc);
alter table public.vibechat_reports enable row level security;
revoke all on public.vibechat_reports from public,anon,authenticated;

create or replace function private.vibechat_room_peer(p_kind text,p_room uuid)
returns uuid language plpgsql stable security definer set search_path='' as $vcpeer$
declare v_peer uuid; v_tutor uuid; v_learner uuid;
begin
  if auth.uid() is null or p_room is null then return null; end if;
  if p_kind='vc' then
    if not private.vc_user_is_thread_participant(p_room) then return null; end if;
    -- Only two-member direct rooms expose a peer; group rooms cannot be blocked
    -- using this one-to-one safety contract.
    if not exists(select 1 from public.vc_threads t where t.id=p_room and t.type='direct')
      or (select count(*) from public.vc_participants p
          where p.thread_id=p_room and p.left_at is null)<>2
    then return null; end if;
    select p.profile_id into v_peer from public.vc_participants p
      where p.thread_id=p_room and p.left_at is null and p.profile_id<>auth.uid()
      limit 1;
    return v_peer;
  elsif p_kind='tuition' then
    select tutor_id,student_profile_id into v_tutor,v_learner
      from public.vibetutor_private_access(p_room) limit 1;
    if v_tutor=auth.uid() then return v_learner; end if;
    if v_learner=auth.uid() then return v_tutor; end if;
  end if;
  return null;
end;
$vcpeer$;
revoke all on function private.vibechat_room_peer(text,uuid) from public,anon;
grant execute on function private.vibechat_room_peer(text,uuid) to authenticated;

create or replace function private.vibechat_pair_blocked(p_a uuid,p_b uuid)
returns boolean language sql stable security definer set search_path='' as $vcblocked$
  select p_a is not null and p_b is not null and exists(
    select 1 from public.vibechat_blocks b
    where (b.blocker_id=p_a and b.blocked_id=p_b)
       or (b.blocker_id=p_b and b.blocked_id=p_a)
  )
$vcblocked$;
revoke all on function private.vibechat_pair_blocked(uuid,uuid)
  from public,anon;
grant execute on function private.vibechat_pair_blocked(uuid,uuid)
  to authenticated;

create or replace function private.vibechat_room_blocked(p_kind text,p_room uuid)
returns boolean language sql stable security definer set search_path='' as $vcroomblocked$
  select private.vibechat_pair_blocked(
    auth.uid(),private.vibechat_room_peer(p_kind,p_room))
$vcroomblocked$;
revoke all on function private.vibechat_room_blocked(text,uuid)
  from public,anon;
grant execute on function private.vibechat_room_blocked(text,uuid)
  to authenticated;

-- Revoke the legacy ability to spoof another sender or post after leaving.
-- This restrictive INSERT policy cannot grant access to an unauthorized user.
drop policy if exists vibechat_member_sender_integrity on public.vc_messages;
create policy vibechat_member_sender_integrity on public.vc_messages
  as restrictive for insert to authenticated
  with check (sender_id=auth.uid() and exists (
    select 1 from public.vc_participants member
    where member.thread_id=vc_messages.thread_id
      and member.profile_id=auth.uid() and member.left_at is null
  ) and not private.vibechat_room_blocked('vc',vc_messages.thread_id));

-- Production inspection on 2026-11-23 found zero case-insensitive collisions.
-- Preserve one canonical VibeChat ID regardless of mixed case.
create unique index if not exists profiles_vibechat_id_casefold_unique
  on public.profiles (lower(vc_id)) where vc_id is not null;

-- Only the two participants can see an invitation; no user directory table is exposed.
-- access: service-only public.vibechat_contact_requests
-- authorization-test: public.vibechat_contact_requests; scripts/test-vibechat-contact-discovery.mjs
-- Owner-scoped RPCs perform all reads/writes; direct client table privileges are revoked.
create table if not exists public.vibechat_contact_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  thread_id uuid null references public.vc_threads(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint vibechat_contact_distinct_users check (requester_id <> recipient_id)
);
create unique index if not exists vibechat_contact_pair_once
  on public.vibechat_contact_requests (least(requester_id, recipient_id), greatest(requester_id, recipient_id));
create index if not exists vibechat_incoming_requests
  on public.vibechat_contact_requests (recipient_id, status, created_at desc);
create index if not exists vibechat_outgoing_requests
  on public.vibechat_contact_requests (requester_id, created_at desc);
alter table public.vibechat_contact_requests enable row level security;
revoke all on public.vibechat_contact_requests from public, anon, authenticated;
-- No generic SELECT/INSERT policies: verified, scoped RPCs are the only API.




create or replace function public.vibechat_thread_safety(p_kind text,p_room uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $vcsafety$
declare v_peer uuid; v_by_me boolean;
begin
  v_peer:=private.vibechat_room_peer(p_kind,p_room);
  if v_peer is null then raise exception 'Conversation not available' using errcode='42501'; end if;
  select exists(select 1 from public.vibechat_blocks b
    where b.blocker_id=auth.uid() and b.blocked_id=v_peer) into v_by_me;
  return jsonb_build_object(
    'blocked',private.vibechat_pair_blocked(auth.uid(),v_peer),
    'blocked_by_me',v_by_me);
end;
$vcsafety$;
revoke all on function public.vibechat_thread_safety(text,uuid)
  from public,anon,authenticated;
grant execute on function public.vibechat_thread_safety(text,uuid) to authenticated;

create or replace function public.vibechat_block_thread(
  p_kind text,p_room uuid,p_block boolean
) returns boolean language plpgsql volatile security definer set search_path='' as $vcblock$
declare v_peer uuid;
begin
  v_peer:=private.vibechat_room_peer(p_kind,p_room);
  if v_peer is null then raise exception 'Conversation not available' using errcode='42501'; end if;
  if coalesce(p_block,false) then
    insert into public.vibechat_blocks(blocker_id,blocked_id)
      values(auth.uid(),v_peer) on conflict do nothing;
  else
    delete from public.vibechat_blocks b
      where b.blocker_id=auth.uid() and b.blocked_id=v_peer;
  end if;
  return true;
end;
$vcblock$;
revoke all on function public.vibechat_block_thread(text,uuid,boolean)
  from public,anon,authenticated;
grant execute on function public.vibechat_block_thread(text,uuid,boolean)
  to authenticated;

create or replace function public.vibechat_report_thread(
  p_kind text,p_room uuid,p_reason text
) returns uuid language plpgsql volatile security definer set search_path='' as $vcreport$
declare v_peer uuid; v_id uuid;
begin
  v_peer:=private.vibechat_room_peer(p_kind,p_room);
  if v_peer is null then raise exception 'Conversation not available' using errcode='42501'; end if;
  if p_reason not in ('spam','harassment','safety','other') or p_reason is null
  then raise exception 'Invalid report reason' using errcode='22023'; end if;
  if (select count(*) from public.vibechat_reports r
    where r.reporter_id=auth.uid() and r.created_at>now()-interval '1 day')>=10
  then raise exception 'Report limit reached' using errcode='42501'; end if;
  insert into public.vibechat_reports(reporter_id,room_kind,room_id,reason)
    values(auth.uid(),p_kind,p_room,p_reason) returning id into v_id;
  return v_id;
end;
$vcreport$;
revoke all on function public.vibechat_report_thread(text,uuid,text)
  from public,anon,authenticated;
grant execute on function public.vibechat_report_thread(text,uuid,text)
  to authenticated;

create or replace function private.vibechat_contact_allowed(p_sender uuid, p_target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles sender
    join public.profiles target on target.id = p_target
    where sender.id = p_sender and sender.id <> target.id
      and not private.vibechat_pair_blocked(p_sender,p_target)
      -- Students/minors are NEVER exposed in discoverability or connection requests.
      and sender.role in ('teacher','parent','admin')
      and target.role in ('teacher','admin')
      and target.vc_id is not null
      and (
        exists (select 1 from public.vibetutor_tutors vt
                where vt.profile_id = target.id and vt.status = 'published')
        or (
          sender.role in ('teacher','admin') and
          exists (
            select 1 from public.school_members first_member
            join public.school_members second_member on second_member.school_id = first_member.school_id
            where first_member.profile_id = sender.id
              and second_member.profile_id = target.id
          )
        )
      )
  );
$$;
revoke all on function private.vibechat_contact_allowed(uuid, uuid) from public, anon, authenticated;

-- Canonical existing profiles.vc_id is already unique. Create an ID only for
-- the signed-in profile; a random suffix prevents collisions and guessable IDs.
create or replace function public.vibechat_my_handle()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_current text;
  v_name text;
  v_slug text;
  v_candidate text;
  i integer;
begin
  if v_user is null then
    raise exception 'Sign-in required' using errcode = '28000';
  end if;
  select p.vc_id, p.full_name into v_current, v_name
    from public.profiles p where p.id = v_user for update;
  if not found then
    raise exception 'Account profile missing' using errcode = '42501';
  end if;
  if nullif(trim(v_current), '') is not null then return v_current; end if;
  v_slug := left(regexp_replace(lower(split_part(coalesce(v_name,''), ' ', 1)), '[^a-z0-9]', '', 'g'), 12);
  if length(v_slug) < 3 then v_slug := 'user'; end if;
  for i in 1..8 loop
    v_candidate := '@' || v_slug || '.' || left(replace(gen_random_uuid()::text, '-', ''), 8);
    begin
      update public.profiles p set vc_id = v_candidate where p.id = v_user;
      return v_candidate;
    exception when unique_violation then
      -- Retry with a different suffix, never overwrite somebody else's ID.
    end;
  end loop;
  raise exception 'Could not reserve a VibeChat ID; try again' using errcode = '23505';
end;
$$;
revoke all on function public.vibechat_my_handle() from public, anon, authenticated;
grant execute on function public.vibechat_my_handle() to authenticated;

create or replace function public.vibechat_lookup_handle(p_handle text)
returns table(handle text, display_name text, account_role text, avatar_url text)
language plpgsql stable security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_handle text := lower(trim(coalesce(p_handle, '')));
begin
  if v_user is null then raise exception 'Sign-in required' using errcode='28000'; end if;
  -- Exact lookup only: no prefix search, phone/email search, student directory or enumeration.
  if v_handle !~ '^@[a-z0-9][a-z0-9.]{2,30}$' then return; end if;
  -- A searchable published tutor only exposes their consent-safe public VibeMe
  -- avatar; a verified school colleague may see the regular profile photo.
  return query select p.vc_id, p.full_name::text, p.role,
    case when exists (
      select 1 from public.school_members mine
      join public.school_members theirs on theirs.school_id = mine.school_id
      where mine.profile_id = v_user and theirs.profile_id = p.id
    ) then p.avatar_url
    else (select pub.avatar_url from public.vibetutor_public_tutors pub
          where pub.profile_id = p.id limit 1)
    end
    from public.profiles p
    where lower(p.vc_id) = v_handle
      and private.vibechat_contact_allowed(v_user, p.id)
    limit 1;
end;
$$;
revoke all on function public.vibechat_lookup_handle(text) from public, anon, authenticated;
grant execute on function public.vibechat_lookup_handle(text) to authenticated;

create or replace function public.vibechat_request_contact(p_handle text)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_target uuid;
  v_existing uuid;
  v_request uuid;
begin
  if v_user is null then raise exception 'Sign-in required' using errcode='28000'; end if;
  if lower(trim(coalesce(p_handle,''))) !~ '^@[a-z0-9][a-z0-9.]{2,30}$' then
    raise exception 'Enter an exact VibeChat ID' using errcode='22023';
  end if;
  select p.id into v_target from public.profiles p
    where lower(p.vc_id) = lower(trim(p_handle))
      and private.vibechat_contact_allowed(v_user, p.id);
  if v_target is null then
    raise exception 'This contact is not available' using errcode='42501';
  end if;
  -- Both directions share one stable request; a declined invitation cannot be spammed.
  select r.id into v_existing from public.vibechat_contact_requests r
    where (r.requester_id=v_user and r.recipient_id=v_target)
       or (r.requester_id=v_target and r.recipient_id=v_user);
  if v_existing is not null then return v_existing; end if;
  if (select count(*) from public.vibechat_contact_requests r
      where r.requester_id=v_user and r.created_at>now()-interval '24 hours') >= 5 then
    raise exception 'Daily contact request limit reached' using errcode='42501';
  end if;
  insert into public.vibechat_contact_requests(requester_id, recipient_id)
    values(v_user, v_target)
    on conflict do nothing returning id into v_request;
  if v_request is null then
    select r.id into v_request from public.vibechat_contact_requests r
      where (r.requester_id=v_user and r.recipient_id=v_target)
         or (r.requester_id=v_target and r.recipient_id=v_user);
  end if;
  return v_request;
end;
$$;
revoke all on function public.vibechat_request_contact(text) from public, anon, authenticated;
grant execute on function public.vibechat_request_contact(text) to authenticated;

create or replace function public.vibechat_my_contacts()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'direction', case when r.recipient_id = auth.uid() then 'incoming' else 'outgoing' end,
    'status', r.status,
    'handle', peer.vc_id,
    'name', peer.full_name,
    'avatar_url', peer.avatar_url,
    'thread_id', r.thread_id,
    'created_at', r.created_at
  ) order by r.created_at desc),'[]'::jsonb)
  from public.vibechat_contact_requests r
  join public.profiles peer on peer.id =
    case when r.recipient_id = auth.uid() then r.requester_id else r.recipient_id end
  where auth.uid() is not null
    and (r.requester_id = auth.uid() or r.recipient_id = auth.uid())
$$;
revoke all on function public.vibechat_my_contacts() from public, anon, authenticated;
grant execute on function public.vibechat_my_contacts() to authenticated;

create or replace function public.vibechat_respond_contact(p_request uuid, p_accept boolean)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_sender uuid;
  v_recipient uuid;
  v_status text;
  v_school uuid;
  v_thread uuid;
begin
  if v_user is null then raise exception 'Sign-in required' using errcode='28000'; end if;
  select r.requester_id, r.recipient_id, r.status into v_sender, v_recipient, v_status
    from public.vibechat_contact_requests r
    where r.id=p_request and r.recipient_id=v_user for update;
  if not found or v_status <> 'pending' then
    raise exception 'Invitation is unavailable' using errcode='42501';
  end if;
  if not coalesce(p_accept, false) then
    update public.vibechat_contact_requests set status='declined', responded_at=now()
      where id=p_request;
    return null;
  end if;
  if not private.vibechat_contact_allowed(v_sender, v_recipient) then
    raise exception 'Contact is no longer eligible' using errcode='42501';
  end if;
  -- A shared school scope is used only if both are verified members.
  select a.school_id into v_school from public.school_members a
    join public.school_members b on a.school_id=b.school_id
    where a.profile_id=v_sender and b.profile_id=v_recipient
    order by a.school_id limit 1;
  insert into public.vc_threads(school_id, type, created_by, context_tag, subject)
    values(v_school, 'direct', v_user, 'general', 'VibeChat contact') returning id into v_thread;
  insert into public.vc_participants(thread_id, profile_id, school_id)
    values(v_thread, v_sender, v_school), (v_thread, v_recipient, v_school);
  update public.vibechat_contact_requests
    set status='accepted', responded_at=now(), thread_id=v_thread
    where id=p_request;
  return v_thread;
end;
$$;
revoke all on function public.vibechat_respond_contact(uuid, boolean) from public, anon, authenticated;
grant execute on function public.vibechat_respond_contact(uuid, boolean) to authenticated;


-- Avatar/name projection only for the other active participant in an existing direct chat.
-- Bypasses restrictive profiles directory RLS without creating public profile browsing.
create or replace function public.vibechat_my_chat_peers()
returns jsonb language sql stable security definer set search_path = '' as $vcchatpeers$
  select coalesce(jsonb_agg(jsonb_build_object(
    'thread_id', t.id, 'name', peer.full_name, 'avatar_url', peer.avatar_url
  )),'[]'::jsonb)
  from public.vc_participants mine
  join public.vc_threads t on t.id = mine.thread_id and t.type='direct'
  join public.vc_participants other on other.thread_id = t.id
    and other.profile_id <> mine.profile_id and other.left_at is null
  join public.profiles peer on peer.id = other.profile_id
  where auth.uid() is not null
    and mine.profile_id = auth.uid() and mine.left_at is null
    and private.vc_user_is_thread_participant(t.id)
    and peer.account_status::text='active'
    and not coalesce(peer.is_anonymized,false)
$vcchatpeers$;
revoke all on function public.vibechat_my_chat_peers() from public, anon, authenticated;
grant execute on function public.vibechat_my_chat_peers() to authenticated;

-- In tuition, the existing accepted-invitation RPC is the authority.
-- A learner profile is returned only to its accepted tutor, or vice versa.
create or replace function public.vibechat_my_tuition_peers()
returns jsonb language sql stable security definer set search_path = '' as $vctuitionpeers$
  select coalesce(jsonb_agg(jsonb_build_object(
    'invitation_id', i.id, 'name', peer.full_name, 'avatar_url', peer.avatar_url
  )),'[]'::jsonb)
  from public.vibetutor_student_invitations i
  join lateral public.vibetutor_private_access(i.id) access on true
  join public.profiles peer on peer.id = case
    when access.tutor_id = auth.uid() then access.student_profile_id
    else access.tutor_id end
  where auth.uid() is not null and i.status = 'accepted'
    and peer.account_status::text='active'
    and not coalesce(peer.is_anonymized,false)
$vctuitionpeers$;
revoke all on function public.vibechat_my_tuition_peers() from public, anon, authenticated;
grant execute on function public.vibechat_my_tuition_peers() to authenticated;


-- Client table grants are column-minimal. Nobody may self-resurrect a left
-- participant, replace a thread's learner context or change another user.
-- Trusted SECURITY DEFINER admission functions retain their scoped writes.
revoke update on public.vc_participants from anon,authenticated;
grant update(last_read_at) on public.vc_participants to authenticated;
revoke update on public.vc_threads from anon,authenticated;
grant update(last_message_at,last_message_preview,updated_at)
  on public.vc_threads to authenticated;
revoke update on public.vc_messages from authenticated;
grant update(deleted_at) on public.vc_messages to authenticated;


-- Preserve VibeTutor's accepted-invitation, size and rate-limit conditions,
-- adding a server-side block check to the existing canonical RPC. Client-only
-- disabling must never be the authority for tuition safety.
create or replace function public.vibetutor_send_lesson_message(
  p_invitation uuid,p_body text
) returns uuid language plpgsql security definer set search_path='' as $vcsend$
declare v_id uuid;
begin
  if not exists(select 1 from public.vibetutor_private_access(p_invitation))
  then raise exception 'Accepted tuition connection required' using errcode='42501'; end if;
  if private.vibechat_room_blocked('tuition',p_invitation)
  then raise exception 'This conversation is blocked' using errcode='42501'; end if;
  if length(trim(coalesce(p_body,''))) not between 1 and 1500
  then raise exception 'Message must be 1 to 1500 characters' using errcode='22023'; end if;
  if (select count(*) from public.vibetutor_lesson_messages
    where sender_id=auth.uid() and created_at>now()-interval '1 minute')>=10
  then raise exception 'Message limit reached' using errcode='42501'; end if;
  insert into public.vibetutor_lesson_messages(invitation_id,sender_id,body)
    values(p_invitation,auth.uid(),trim(p_body)) returning id into v_id;
  return v_id;
end;
$vcsend$;
revoke all on function public.vibetutor_send_lesson_message(uuid,text) from public,anon;
grant execute on function public.vibetutor_send_lesson_message(uuid,text)
  to authenticated;

-- Realtime typing broadcasts are private and ephemeral. Not message bodies;
-- caller is checked for every school/tuition topic at the server boundary.
create or replace function private.vibechat_can_use_typing_topic(p_topic text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_kind text; v_id uuid;
begin
  if auth.uid() is null or p_topic is null or
     p_topic !~ '^vibechat:(vc|tuition):[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  then return false; end if;
  v_kind := split_part(p_topic, ':', 2);
  v_id := split_part(p_topic, ':', 3)::uuid;
  if v_kind = 'tuition' then
    return exists (select 1 from public.vibetutor_private_access(v_id))
      and not private.vibechat_room_blocked('tuition',v_id);
  end if;
  return exists (
    select 1 from public.vc_participants p
    join public.vc_threads t on t.id=p.thread_id
    where p.thread_id=v_id and p.profile_id=auth.uid() and p.left_at is null
      and t.type='direct'
      and private.vc_user_is_thread_participant(t.id)
      and not private.vibechat_room_blocked('vc',t.id)
  );
end;
$$;
revoke all on function private.vibechat_can_use_typing_topic(text) from public, anon;
grant execute on function private.vibechat_can_use_typing_topic(text) to authenticated;
drop policy if exists vibechat_typing_receive on realtime.messages;
create policy vibechat_typing_receive on realtime.messages for select to authenticated
  using (realtime.messages.extension = 'broadcast' and private.vibechat_can_use_typing_topic(realtime.topic()));
drop policy if exists vibechat_typing_send on realtime.messages;
create policy vibechat_typing_send on realtime.messages for insert to authenticated
  with check (realtime.messages.extension = 'broadcast' and private.vibechat_can_use_typing_topic(realtime.topic()));
commit;
