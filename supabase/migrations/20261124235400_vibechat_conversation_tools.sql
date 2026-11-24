begin;
-- access: service-only private.vibechat_conversation_preferences
-- authorization-test: private.vibechat_conversation_preferences; scripts/sql/vibechat_conversation_tools_authorization.sql
create table private.vibechat_conversation_preferences(
 profile_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check(kind in ('vc','tuition')),
 room_id uuid not null,
 pinned boolean not null default false,
 archived boolean not null default false,
 muted boolean not null default false,
 primary key(profile_id,kind,room_id)
);
alter table private.vibechat_conversation_preferences enable row level security;
revoke all on private.vibechat_conversation_preferences from public,anon,authenticated;

create or replace function public.vibechat_my_conversation_preferences()
returns jsonb language sql stable security definer set search_path='' as $prefs$
 select coalesce(jsonb_agg(jsonb_build_object('kind',p.kind,'room_id',p.room_id,'pinned',p.pinned,'archived',p.archived,'muted',p.muted)),'[]'::jsonb)
 from private.vibechat_conversation_preferences p
 where p.profile_id=auth.uid() and private.vibechat_room_peer(p.kind,p.room_id) is not null
 and exists(select 1 from public.profiles u where u.id=auth.uid() and u.account_status::text='active' and not coalesce(u.is_anonymized,false));
$prefs$;
revoke all on function public.vibechat_my_conversation_preferences() from public,anon,authenticated;
grant execute on function public.vibechat_my_conversation_preferences() to authenticated;

create or replace function public.vibechat_set_conversation_preference(p_kind text,p_room uuid,p_setting text,p_value boolean)
returns boolean language plpgsql volatile security definer set search_path='' as $set$
begin
 perform private.vibechat_rich_peer(p_kind,p_room,false);
 if p_setting is null or p_setting not in ('pinned','archived','muted') or p_value is null then raise exception 'Invalid conversation preference' using errcode='22023';end if;
 insert into private.vibechat_conversation_preferences(profile_id,kind,room_id,pinned,archived,muted)
 values(auth.uid(),p_kind,p_room,p_setting='pinned' and p_value,p_setting='archived' and p_value,p_setting='muted' and p_value)
 on conflict(profile_id,kind,room_id) do update set
 pinned=case when p_setting='pinned' then p_value else vibechat_conversation_preferences.pinned end,
 archived=case when p_setting='archived' then p_value else vibechat_conversation_preferences.archived end,
 muted=case when p_setting='muted' then p_value else vibechat_conversation_preferences.muted end;
 perform private.vibechat_notify_inbox(auth.uid());
 return true;
end;$set$;
revoke all on function public.vibechat_set_conversation_preference(text,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.vibechat_set_conversation_preference(text,uuid,text,boolean) to authenticated;

-- access: service-only private.vibechat_notification_preferences
-- authorization-test: private.vibechat_notification_preferences; scripts/sql/vibechat_conversation_tools_authorization.sql
create table private.vibechat_notification_preferences(
 profile_id uuid primary key references public.profiles(id) on delete cascade,
 enabled boolean not null default false
);
alter table private.vibechat_notification_preferences enable row level security;
revoke all on private.vibechat_notification_preferences from public,anon,authenticated;
create or replace function public.vibechat_notification_preferences(p_enabled boolean default null)
returns boolean language plpgsql volatile security definer set search_path='' as $notifications$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles p where p.id=auth.uid() and p.account_status::text='active' and not coalesce(p.is_anonymized,false)) then raise exception 'Sign-in required' using errcode='42501';end if;
 if p_enabled is not null then
 insert into private.vibechat_notification_preferences(profile_id,enabled) values(auth.uid(),p_enabled)
 on conflict(profile_id) do update set enabled=excluded.enabled;
 perform private.vibechat_notify_inbox(auth.uid());
 end if;
 return coalesce((select p.enabled from private.vibechat_notification_preferences p where p.profile_id=auth.uid()),false);
end;$notifications$;
revoke all on function public.vibechat_notification_preferences(boolean) from public,anon,authenticated;
grant execute on function public.vibechat_notification_preferences(boolean) to authenticated;

-- History and literal substring search are scoped to an authorized room.
create or replace function public.vibechat_message_page(p_kind text,p_room uuid,p_before timestamptz default null,p_before_id uuid default null,p_query text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $read$
declare v_peer uuid; v_result jsonb;
begin
 v_peer:=private.vibechat_rich_peer(p_kind,p_room,false);
 if (p_before is null)<>(p_before_id is null) or length(coalesce(p_query,''))>100 then raise exception 'Invalid message query' using errcode='22023'; end if;
 with messages as (
   select m.id,m.sender_id,m.body,m.created_at,m.deleted_at,m.edited_at,m.reply_to_id from public.vc_messages m where p_kind='vc' and m.thread_id=p_room
   union all
   select m.id,m.sender_id,m.body,m.created_at,m.deleted_at,m.edited_at,m.reply_to_id from public.vibetutor_lesson_messages m where p_kind='tuition' and m.invitation_id=p_room
 ), latest as (
   select * from messages where (p_before is null or (created_at,id)<(p_before,p_before_id)) and (nullif(trim(p_query),'') is null or (deleted_at is null and position(lower(trim(p_query)) in lower(body))>0)) order by created_at desc,id desc limit 50
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
revoke all on function public.vibechat_message_page(text,uuid,timestamptz,uuid,text) from public,anon,authenticated;
grant execute on function public.vibechat_message_page(text,uuid,timestamptz,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
