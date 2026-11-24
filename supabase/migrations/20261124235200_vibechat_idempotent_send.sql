-- Durable send operation receipt, shared by existing direct and tuition rooms.
begin;
-- access: service-only private.vibechat_send_operations
-- authorization-test: private.vibechat_send_operations; scripts/sql/vibechat_outbox_authorization.sql
create table if not exists private.vibechat_send_operations(
 sender_id uuid not null references public.profiles(id) on delete cascade,
 operation_id uuid not null,
 kind text not null check(kind in ('vc','tuition')),
 room_id uuid not null,
 message_id uuid not null,
 body_digest text not null,
 created_at timestamptz not null default now(),
 primary key(sender_id,operation_id)
);
alter table private.vibechat_send_operations enable row level security;
revoke all on private.vibechat_send_operations from public,anon,authenticated;

create or replace function public.vibechat_send_once(p_owner uuid,p_kind text,p_room uuid,p_operation uuid,p_body text)
returns uuid language plpgsql volatile security definer set search_path='' as $send$
declare
 v_user uuid:=auth.uid();
 v_peer uuid;
 v_body text:=trim(coalesce(p_body,''));
 v_existing private.vibechat_send_operations%rowtype;
 v_id uuid;
 v_school uuid;
 v_digest text;
begin
 if v_user is null or p_owner is distinct from v_user then raise exception 'Sign-in required' using errcode='42501'; end if;
 if p_operation is null or p_room is null or p_kind is null or p_kind not in ('vc','tuition') or length(v_body) not between 1 and 1500 then raise exception 'Invalid message' using errcode='22023';end if;
 if not exists(select 1 from public.profiles p where p.id=v_user and p.account_status::text='active' and not coalesce(p.is_anonymized,false)) then raise exception 'Messaging unavailable' using errcode='42501';end if;
 -- Current room authorization is always checked, even on a replay.
 v_peer:=private.vibechat_room_peer(p_kind,p_room);
 if v_peer is null or private.vibechat_pair_blocked(v_user,v_peer) then raise exception 'Messaging unavailable' using errcode='42501';end if;
 -- Serialize sends by actor, including retries from multiple devices.
 perform pg_advisory_xact_lock(hashtextextended('vibechat-send:'||v_user::text,0));
 v_digest:=encode(sha256(convert_to(v_body,'UTF8')),'hex');
 select * into v_existing from private.vibechat_send_operations o where o.sender_id=v_user and o.operation_id=p_operation;
 if found then
  if v_existing.kind<>p_kind or v_existing.room_id<>p_room or v_existing.body_digest<>v_digest then raise exception 'Operation key already used' using errcode='22023';end if;
  return v_existing.message_id;
 end if;
 if (select count(*) from private.vibechat_send_operations o where o.sender_id=v_user and o.created_at>now()-interval '1 minute')>=10 then
  raise exception 'Message rate limit reached' using errcode='P0001',detail='VIBECHAT_RATE_LIMIT';
 end if;
 if p_kind='tuition' then
  -- Preserve the existing accepted-connection, block, and send-rate authority.
  v_id:=public.vibetutor_send_lesson_message(p_room,v_body);
 else
  select t.school_id into v_school from public.vc_threads t where t.id=p_room and t.type='direct' and private.vc_user_is_thread_participant(t.id);
  if not found then raise exception 'Messaging unavailable' using errcode='42501';end if;
  if (select count(*) from public.vc_messages m where m.sender_id=v_user and m.created_at>now()-interval '1 minute')>=10 then raise exception 'Message rate limit reached' using errcode='P0001',detail='VIBECHAT_RATE_LIMIT';end if;
  insert into public.vc_messages(thread_id,school_id,sender_id,body) values(p_room,v_school,v_user,v_body) returning id into v_id;
 end if;
 insert into private.vibechat_send_operations(sender_id,operation_id,kind,room_id,message_id,body_digest) values(v_user,p_operation,p_kind,p_room,v_id,v_digest);
 return v_id;
end;
$send$;
revoke all on function public.vibechat_send_once(uuid,text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.vibechat_send_once(uuid,text,uuid,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
