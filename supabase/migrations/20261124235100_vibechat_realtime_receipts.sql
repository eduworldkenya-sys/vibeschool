-- Server-authorized inbox invalidation and receipt watermarks.
begin;
-- access: service-only private.vibechat_receipts
-- authorization-test: private.vibechat_receipts; scripts/test-vibechat-contact-discovery.mjs; scripts/sql/vibechat_two_account_authorization.sql
create table if not exists private.vibechat_receipts(
  kind text not null check(kind in ('vc','tuition')),
  room_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  primary key(kind,room_id,profile_id)
);
alter table private.vibechat_receipts enable row level security;
revoke all on private.vibechat_receipts from public,anon,authenticated;
create index if not exists vibechat_vc_message_recent on public.vc_messages(thread_id,created_at desc,id desc) where deleted_at is null;
create index if not exists vibechat_tuition_message_recent on public.vibetutor_lesson_messages(invitation_id,created_at desc,id desc);

-- A private per-user channel carries only a boolean invalidation, no messages,
-- identities, room IDs or receipt timestamps.
create or replace function private.vibechat_can_receive_inbox(p_topic text)
returns boolean language sql stable security definer set search_path='' as $allow$
  select auth.uid() is not null and p_topic='vibechat-inbox:'||auth.uid()::text
    and exists(select 1 from public.profiles p where p.id=auth.uid()
      and p.account_status::text='active' and not coalesce(p.is_anonymized,false));
$allow$;
revoke all on function private.vibechat_can_receive_inbox(text) from public,anon,authenticated;
grant execute on function private.vibechat_can_receive_inbox(text) to authenticated;
drop policy if exists vibechat_inbox_receive on realtime.messages;
create policy vibechat_inbox_receive on realtime.messages for select to authenticated
  using (realtime.messages.extension='broadcast' and private.vibechat_can_receive_inbox(realtime.topic()));
-- No INSERT policy grants browser publication on this topic.

create or replace function private.vibechat_notify_inbox(p_user uuid)
returns void language plpgsql security definer set search_path='' as $notify$
begin
  if p_user is null then return; end if;
  begin
    perform realtime.send(jsonb_build_object('invalidate',true),'refresh','vibechat-inbox:'||p_user::text,true);
  exception when others then
    raise warning 'VibeChat inbox invalidation unavailable; clients use bounded polling';
  end;
end;
$notify$;
revoke all on function private.vibechat_notify_inbox(uuid) from public,anon,authenticated;

create or replace function private.vibechat_notify_room(p_kind text,p_room uuid)
returns void language plpgsql security definer set search_path='' as $room$
declare p uuid;
begin
  if p_kind='vc' then
    for p in select distinct m.profile_id from public.vc_participants m where m.thread_id=p_room and m.left_at is null
    loop perform private.vibechat_notify_inbox(p); end loop;
  elsif p_kind='tuition' then
    for p in select i.tutor_id from public.vibetutor_student_invitations i where i.id=p_room
      union select s.profile_id from public.vibetutor_student_invitations i join public.students s on s.id=i.student_id where i.id=p_room
    loop perform private.vibechat_notify_inbox(p); end loop;
  end if;
end;
$room$;
revoke all on function private.vibechat_notify_room(text,uuid) from public,anon,authenticated;

create or replace function private.vibechat_invalidate_trigger()
returns trigger language plpgsql security definer set search_path='' as $trigger$
begin
  if tg_table_name='vc_messages' then perform private.vibechat_notify_room('vc',new.thread_id);
  elsif tg_table_name='vc_participants' then
    perform private.vibechat_notify_room('vc',new.thread_id);
    perform private.vibechat_notify_inbox(new.profile_id);
  elsif tg_table_name='vibetutor_lesson_messages' then perform private.vibechat_notify_room('tuition',new.invitation_id);
  elsif tg_table_name='vibetutor_student_invitations' then perform private.vibechat_notify_room('tuition',new.id);
  elsif tg_table_name='vibechat_contact_requests' then
    perform private.vibechat_notify_inbox(new.requester_id); perform private.vibechat_notify_inbox(new.recipient_id);
  elsif tg_table_name='vibechat_receipts' then perform private.vibechat_notify_room(new.kind,new.room_id);
  elsif tg_table_name='vibechat_blocks' then
    if tg_op='DELETE' then
      perform private.vibechat_notify_inbox(old.blocker_id); perform private.vibechat_notify_inbox(old.blocked_id); return old;
    else
      perform private.vibechat_notify_inbox(new.blocker_id); perform private.vibechat_notify_inbox(new.blocked_id);
    end if;
  end if;
  return new;
end;
$trigger$;
revoke all on function private.vibechat_invalidate_trigger() from public,anon,authenticated;
create trigger vibechat_notify_messages after insert or update of deleted_at on public.vc_messages for each row execute function private.vibechat_invalidate_trigger();
create trigger vibechat_notify_participants after insert or update of left_at on public.vc_participants for each row execute function private.vibechat_invalidate_trigger();
create trigger vibechat_notify_tuition_messages after insert on public.vibetutor_lesson_messages for each row execute function private.vibechat_invalidate_trigger();
create trigger vibechat_notify_tuition_invites after insert or update of status on public.vibetutor_student_invitations for each row execute function private.vibechat_invalidate_trigger();
create trigger vibechat_notify_requests after insert or update of status on public.vibechat_contact_requests for each row execute function private.vibechat_invalidate_trigger();
create trigger vibechat_notify_receipts after insert or update on private.vibechat_receipts for each row execute function private.vibechat_invalidate_trigger();
create trigger vibechat_notify_blocks after insert or delete on public.vibechat_blocks for each row execute function private.vibechat_invalidate_trigger();

-- Direct messages must never be read by departed participants or school-wide
-- admins who are not in that direct conversation.
create policy vibechat_direct_read_integrity on public.vc_messages as restrictive for select to authenticated
  using (exists(select 1 from public.vc_threads t where t.id=vc_messages.thread_id
    and (t.type<>'direct' or private.vc_user_is_thread_participant(t.id))));
create policy vibechat_direct_write_integrity on public.vc_messages as restrictive for insert to authenticated
  with check (exists(select 1 from public.vc_threads t where t.id=vc_messages.thread_id
    and (t.type<>'direct' or private.vc_user_is_thread_participant(t.id))));

-- A receipt names a real incoming message in an authorized room; neither
-- timestamps nor other users' identities can be supplied by the client.
create or replace function public.vibechat_ack_message(p_kind text,p_room uuid,p_message uuid,p_read boolean default false)
returns boolean language plpgsql volatile security definer set search_path='' as $ack$
declare v_user uuid:=auth.uid(); v_peer uuid; v_at timestamptz;
begin
  v_peer:=private.vibechat_room_peer(p_kind,p_room);
  if v_user is null or v_peer is null or private.vibechat_pair_blocked(v_user,v_peer) or not exists(select 1 from public.profiles p where p.id=v_user and p.account_status::text='active' and not coalesce(p.is_anonymized,false)) then return false; end if;
  if p_kind='vc' then
    select m.created_at into v_at from public.vc_messages m where m.thread_id=p_room and m.id=p_message and m.sender_id=v_peer and m.deleted_at is null;
  elsif p_kind='tuition' then
    select m.created_at into v_at from public.vibetutor_lesson_messages m where m.invitation_id=p_room and m.id=p_message and m.sender_id=v_peer;
  end if;
  if v_at is null then return false; end if;
  insert into private.vibechat_receipts(kind,room_id,profile_id,delivered_at,read_at)
    values(p_kind,p_room,v_user,v_at,case when p_read then v_at end)
  on conflict(kind,room_id,profile_id) do update set
    delivered_at=greatest(vibechat_receipts.delivered_at,excluded.delivered_at),
    read_at=greatest(vibechat_receipts.read_at,excluded.read_at)
  where excluded.delivered_at>coalesce(vibechat_receipts.delivered_at,'-infinity'::timestamptz)
    or excluded.read_at>coalesce(vibechat_receipts.read_at,'-infinity'::timestamptz);
  if p_kind='vc' and p_read then
    update public.vc_participants p set last_read_at=greatest(p.last_read_at,v_at)
      where p.thread_id=p_room and p.profile_id=v_user and p.left_at is null;
  end if;
  return true;
end;
$ack$;
revoke all on function public.vibechat_ack_message(text,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.vibechat_ack_message(text,uuid,uuid,boolean) to authenticated;


-- access: service-only private.vibechat_presence
-- authorization-test: private.vibechat_presence; scripts/test-vibechat-contact-discovery.mjs; scripts/sql/vibechat_two_account_authorization.sql
create table if not exists private.vibechat_presence(
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  seen_at timestamptz
);
alter table private.vibechat_presence enable row level security;
revoke all on private.vibechat_presence from public,anon,authenticated;

create or replace function private.vibechat_presence_eligible(p_user uuid)
returns boolean language sql stable security definer set search_path='' as $presence_eligible$
 select exists(select 1 from public.profiles p where p.id=p_user
   and p.account_status::text='active' and not coalesce(p.is_anonymized,false)
   and p.date_of_birth<=current_date-interval '18 years'
   and p.role is distinct from 'student'
   and not exists(select 1 from public.students s where s.profile_id=p.id and s.deleted_at is null));
$presence_eligible$;
revoke all on function private.vibechat_presence_eligible(uuid) from public,anon,authenticated;

create or replace function public.vibechat_presence_settings(p_enabled boolean default null)
returns jsonb language plpgsql volatile security definer set search_path='' as $presence_settings$
declare v_user uuid:=auth.uid(); v_eligible boolean;
begin
 if v_user is null then raise exception 'Sign in required' using errcode='28000'; end if;
 v_eligible:=private.vibechat_presence_eligible(v_user);
 if p_enabled is not null then
   if p_enabled and not v_eligible then raise exception 'Adult account eligibility required' using errcode='42501'; end if;
   insert into private.vibechat_presence(profile_id,enabled,seen_at)
     values(v_user,p_enabled,case when p_enabled then now() end)
   on conflict(profile_id) do update set enabled=excluded.enabled,seen_at=excluded.seen_at;
 end if;
 return jsonb_build_object('eligible',v_eligible,'enabled',v_eligible and coalesce(
   (select p.enabled from private.vibechat_presence p where p.profile_id=v_user),false));
end;
$presence_settings$;
revoke all on function public.vibechat_presence_settings(boolean) from public,anon,authenticated;
grant execute on function public.vibechat_presence_settings(boolean) to authenticated;

create or replace function public.vibechat_presence_tick()
returns boolean language plpgsql volatile security definer set search_path='' as $tick$
begin
 if not private.vibechat_presence_eligible(auth.uid()) then return false; end if;
 update private.vibechat_presence p set seen_at=now()
   where p.profile_id=auth.uid() and p.enabled and (p.seen_at is null or p.seen_at<now()-interval '20 seconds');
 return exists(select 1 from private.vibechat_presence p where p.profile_id=auth.uid() and p.enabled);
end;
$tick$;
revoke all on function public.vibechat_presence_tick() from public,anon,authenticated;
grant execute on function public.vibechat_presence_tick() to authenticated;

-- Inbox metadata comes from real messages rather than client-maintained previews.
create or replace function public.vibechat_my_inbox_state()
returns jsonb language sql stable security definer set search_path='' as $state$
  with rooms as (
    select 'vc'::text as kind,t.id as room_id,p.last_read_at as legacy_read
    from public.vc_participants p join public.vc_threads t on t.id=p.thread_id and t.type='direct'
    where p.profile_id=auth.uid() and p.left_at is null and private.vc_user_is_thread_participant(t.id)
    union all
    select 'tuition',i.id,null::timestamptz from public.vibetutor_student_invitations i
      join lateral public.vibetutor_private_access(i.id) a on true where i.status='accepted'
  ), scoped as (
    select r.*,private.vibechat_room_peer(r.kind,r.room_id) as peer from rooms r
  )
  select coalesce(jsonb_agg(jsonb_build_object('kind',r.kind,'room_id',r.room_id,
    'updated',last_message.created_at,'preview',left(last_message.body,80),
    'unread',coalesce(unread.n,0),
    'latest_incoming_id',incoming.id,
    'peer_online',case when r.kind='vc' and not private.vibechat_pair_blocked(auth.uid(),r.peer)
      and private.vibechat_presence_eligible(auth.uid()) and private.vibechat_presence_eligible(r.peer)
      and coalesce(my_presence.enabled,false) and coalesce(peer_presence.enabled,false)
      then coalesce(peer_presence.seen_at>now()-interval '60 seconds',false) else false end,
    'peer_delivered_at',case when not private.vibechat_pair_blocked(auth.uid(),r.peer) then theirs.delivered_at end,
    'peer_read_at',case when not private.vibechat_pair_blocked(auth.uid(),r.peer) then theirs.read_at end)), '[]'::jsonb)
  from scoped r
  left join private.vibechat_presence my_presence on my_presence.profile_id=auth.uid()
  left join private.vibechat_presence peer_presence on peer_presence.profile_id=r.peer
  left join private.vibechat_receipts mine on mine.kind=r.kind and mine.room_id=r.room_id and mine.profile_id=auth.uid()
  left join private.vibechat_receipts theirs on theirs.kind=r.kind and theirs.room_id=r.room_id and theirs.profile_id=r.peer
  left join lateral (
    select x.id,x.created_at,x.body from (
      select m.id,m.created_at,m.body from public.vc_messages m where r.kind='vc' and m.thread_id=r.room_id and m.deleted_at is null
      union all select m.id,m.created_at,m.body from public.vibetutor_lesson_messages m where r.kind='tuition' and m.invitation_id=r.room_id
    ) x order by x.created_at desc,x.id desc limit 1
  ) last_message on true
  left join lateral (
    select x.id from (
      select m.id,m.created_at from public.vc_messages m where r.kind='vc' and m.thread_id=r.room_id and m.deleted_at is null and m.sender_id=r.peer
      union all select m.id,m.created_at from public.vibetutor_lesson_messages m where r.kind='tuition' and m.invitation_id=r.room_id and m.sender_id=r.peer
    ) x order by x.created_at desc,x.id desc limit 1
  ) incoming on true
  left join lateral (
    select count(*) as n from (
      select m.created_at from public.vc_messages m where r.kind='vc' and m.thread_id=r.room_id and m.deleted_at is null and m.sender_id=r.peer
      union all select m.created_at from public.vibetutor_lesson_messages m where r.kind='tuition' and m.invitation_id=r.room_id and m.sender_id=r.peer
    ) x where x.created_at>coalesce(greatest(mine.read_at,r.legacy_read),'-infinity'::timestamptz)
  ) unread on true
  where auth.uid() is not null and r.peer is not null and exists(select 1 from public.profiles p where p.id=auth.uid() and p.account_status::text='active' and not coalesce(p.is_anonymized,false));
$state$;
revoke all on function public.vibechat_my_inbox_state() from public,anon,authenticated;
grant execute on function public.vibechat_my_inbox_state() to authenticated;
notify pgrst,'reload schema';
commit;
