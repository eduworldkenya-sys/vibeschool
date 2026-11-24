-- Rich text-message actions, on canonical school and tuition conversations.
begin;
alter table public.vc_messages add column if not exists reply_to_id uuid references public.vc_messages(id) on delete set null;
alter table public.vc_messages add column if not exists edited_at timestamptz;
alter table public.vibetutor_lesson_messages add column if not exists reply_to_id uuid references public.vibetutor_lesson_messages(id) on delete set null;
alter table public.vibetutor_lesson_messages add column if not exists edited_at timestamptz;
alter table public.vibetutor_lesson_messages add column if not exists deleted_at timestamptz;

-- access: service-only private.vibechat_reactions
-- authorization-test: private.vibechat_reactions; scripts/sql/vibechat_rich_authorization.sql
create table private.vibechat_reactions(
 kind text not null check(kind in ('vc','tuition')),
 room_id uuid not null,
 message_id uuid not null,
 actor_id uuid not null references public.profiles(id) on delete cascade,
 reaction text not null check(reaction in ('like','love','laugh','wow','thanks')),
 primary key(kind,message_id,actor_id)
);
alter table private.vibechat_reactions enable row level security;
revoke all on private.vibechat_reactions from public,anon,authenticated;

-- Every operation rechecks the existing scoped peer authority.
create or replace function private.vibechat_rich_peer(p_kind text,p_room uuid,p_write boolean)
returns uuid language plpgsql stable security definer set search_path='' as $peer$
declare v_user uuid:=auth.uid(); v_peer uuid;
begin
 if v_user is null or not exists(select 1 from public.profiles p where p.id=v_user and p.account_status::text='active' and not coalesce(p.is_anonymized,false)) then raise exception 'Messaging unavailable' using errcode='42501'; end if;
 v_peer:=private.vibechat_room_peer(p_kind,p_room);
 if v_peer is null or (p_write and private.vibechat_pair_blocked(v_user,v_peer)) then raise exception 'Messaging unavailable' using errcode='42501';end if;
 return v_peer;
end;$peer$;
revoke all on function private.vibechat_rich_peer(text,uuid,boolean) from public,anon,authenticated;

-- The original send operation is still the authority for idempotency and rates.
-- Reply linkage and the message are committed atomically.
create or replace function public.vibechat_send_rich(p_owner uuid,p_kind text,p_room uuid,p_operation uuid,p_body text,p_reply uuid default null)
returns uuid language plpgsql volatile security definer set search_path='' as $send$
declare v_id uuid; v_existing uuid; v_reply uuid; v_user uuid:=auth.uid();
begin
 if p_owner is distinct from v_user or v_user is null then raise exception 'Messaging unavailable' using errcode='42501';end if;
 perform private.vibechat_rich_peer(p_kind,p_room,true);
 perform pg_advisory_xact_lock(hashtextextended('vibechat-send:'||v_user::text,0));
 select o.message_id into v_existing from private.vibechat_send_operations o where o.sender_id=v_user and o.operation_id=p_operation;
 if v_existing is null and p_reply is not null then
   if p_kind='vc' then
     perform 1 from public.vc_messages m where m.id=p_reply and m.thread_id=p_room and m.deleted_at is null for share;
   else
     perform 1 from public.vibetutor_lesson_messages m where m.id=p_reply and m.invitation_id=p_room and m.deleted_at is null for share;
   end if;
   if not found then raise exception 'Reply target unavailable' using errcode='22023';end if;
 end if;
 v_id:=public.vibechat_send_once(p_owner,p_kind,p_room,p_operation,p_body);
 if v_existing is not null then
   if p_kind='vc' then select m.reply_to_id into v_reply from public.vc_messages m where m.id=v_id and m.thread_id=p_room;
   else select m.reply_to_id into v_reply from public.vibetutor_lesson_messages m where m.id=v_id and m.invitation_id=p_room;end if;
   if v_reply is distinct from p_reply then raise exception 'Operation key already used' using errcode='22023';end if;
 elsif p_reply is not null then
   if p_kind='vc' then update public.vc_messages set reply_to_id=p_reply where id=v_id and thread_id=p_room;
   else update public.vibetutor_lesson_messages set reply_to_id=p_reply where id=v_id and invitation_id=p_room;end if;
 end if;
 return v_id;
end;$send$;
revoke all on function public.vibechat_send_rich(uuid,text,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.vibechat_send_rich(uuid,text,uuid,uuid,text,uuid) to authenticated;

-- All message changes are actor-owned, room-scoped and atomic.
create or replace function public.vibechat_change_message(p_kind text,p_room uuid,p_message uuid,p_action text,p_value text default null)
returns boolean language plpgsql volatile security definer set search_path='' as $change$
declare v_user uuid:=auth.uid(); v_sender uuid; v_deleted timestamptz; v_created timestamptz;
begin
 perform private.vibechat_rich_peer(p_kind,p_room,true);
 if p_kind='vc' then
   select m.sender_id,m.deleted_at,m.created_at into v_sender,v_deleted,v_created from public.vc_messages m where m.id=p_message and m.thread_id=p_room for update;
 else
   select m.sender_id,m.deleted_at,m.created_at into v_sender,v_deleted,v_created from public.vibetutor_lesson_messages m where m.id=p_message and m.invitation_id=p_room for update;
 end if;
 if not found or v_deleted is not null then raise exception 'Message unavailable' using errcode='42501';end if;
 if p_action='react' then
   if p_value is null then
     delete from private.vibechat_reactions where kind=p_kind and room_id=p_room and message_id=p_message and actor_id=v_user;
   elsif p_value in ('like','love','laugh','wow','thanks') then
     insert into private.vibechat_reactions(kind,room_id,message_id,actor_id,reaction) values(p_kind,p_room,p_message,v_user,p_value)
     on conflict(kind,message_id,actor_id) do update set reaction=excluded.reaction;
   else raise exception 'Invalid reaction' using errcode='22023';end if;
 elsif p_action in ('edit','delete') then
   if v_sender is distinct from v_user then raise exception 'Only the sender can change this message' using errcode='42501';end if;
   if p_action='edit' then
     if v_created<now()-interval '15 minutes' or length(trim(coalesce(p_value,''))) not between 1 and 1500 then raise exception 'Message cannot be edited' using errcode='22023';end if;
     if p_kind='vc' then update public.vc_messages set body=trim(p_value),edited_at=now() where id=p_message and thread_id=p_room;
     else update public.vibetutor_lesson_messages set body=trim(p_value),edited_at=now() where id=p_message and invitation_id=p_room;end if;
   else
     -- Redact the canonical body so older readers cannot surface deleted text.
     if p_kind='vc' then update public.vc_messages set body='Message deleted',deleted_at=now() where id=p_message and thread_id=p_room;
     else update public.vibetutor_lesson_messages set body='Message deleted',deleted_at=now() where id=p_message and invitation_id=p_room;end if;
     delete from private.vibechat_reactions where kind=p_kind and room_id=p_room and message_id=p_message;
   end if;
 else raise exception 'Invalid message action' using errcode='22023';end if;
 perform private.vibechat_notify_room(p_kind,p_room);
 return true;
end;$change$;
revoke all on function public.vibechat_change_message(text,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.vibechat_change_message(text,uuid,uuid,text,text) to authenticated;

-- One bounded, room-authorized projection for both types of conversation.
-- Reply excerpts resolve against current canonical content, not stale snapshots.
create or replace function public.vibechat_rich_messages(p_kind text,p_room uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $read$
declare v_peer uuid; v_result jsonb;
begin
 v_peer:=private.vibechat_rich_peer(p_kind,p_room,false);
 with messages as (
   select m.id,m.sender_id,m.body,m.created_at,m.deleted_at,m.edited_at,m.reply_to_id from public.vc_messages m where p_kind='vc' and m.thread_id=p_room
   union all
   select m.id,m.sender_id,m.body,m.created_at,m.deleted_at,m.edited_at,m.reply_to_id from public.vibetutor_lesson_messages m where p_kind='tuition' and m.invitation_id=p_room
 ), latest as (
   select * from messages order by created_at desc,id desc limit 200
 )
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',m.id,'body',case when m.deleted_at is null then m.body else 'Message deleted' end,
   'mine',m.sender_id=auth.uid(),'created_at',m.created_at,'deleted_at',m.deleted_at,'edited_at',m.edited_at,
   'reply_to_id',m.reply_to_id,'reply_excerpt',case when m.reply_to_id is null then null when target.id is null or target.deleted_at is not null then 'Message unavailable' else left(target.body,120) end,
   'reactions',case when m.deleted_at is not null then '[]'::jsonb else coalesce(rx.items,'[]'::jsonb) end
 ) order by m.created_at,m.id),'[]'::jsonb) into v_result
 from latest m left join messages target on target.id=m.reply_to_id
 left join lateral (select jsonb_agg(jsonb_build_object('reaction',r.reaction,'mine',r.actor_id=auth.uid()) order by r.actor_id) items
 from private.vibechat_reactions r where r.kind=p_kind and r.room_id=p_room and r.message_id=m.id and r.actor_id in (auth.uid(),v_peer)) rx on true;
 return v_result;
end;$read$;
revoke all on function public.vibechat_rich_messages(text,uuid) from public,anon,authenticated;
grant execute on function public.vibechat_rich_messages(text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
