-- Adult invitation-only text groups on the canonical VibeChat thread/message tables.
-- The existing direct and learner/tuition authorization contracts are unchanged.
begin;
alter table public.vc_threads drop constraint vc_threads_type_check;
alter table public.vc_threads add constraint vc_threads_type_check check(type in ('direct','circular','group'));
alter table public.vc_threads add constraint vibechat_group_scope check(type<>'group' or (school_id is null and student_id is null));

-- access: service-only private.vibechat_group_invites
-- authorization-test: private.vibechat_group_invites; scripts/sql/vibechat_group_authorization.sql
create table private.vibechat_group_invites(
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.vc_threads(id) on delete cascade,
 inviter_id uuid not null references public.profiles(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled')),
 created_at timestamptz not null default now(),
 responded_at timestamptz,
 unique(group_id,recipient_id),
 check(inviter_id<>recipient_id)
);
alter table private.vibechat_group_invites enable row level security;
revoke all on private.vibechat_group_invites from public,anon,authenticated;

create or replace function private.vibechat_is_group(p_room uuid)
returns boolean language sql stable security definer set search_path='' as $group$
 select exists(select 1 from public.vc_threads t where t.id=p_room and t.type='group')
$group$;
revoke all on function private.vibechat_is_group(uuid) from public,anon,authenticated;
grant execute on function private.vibechat_is_group(uuid) to authenticated;

create or replace function private.vibechat_group_joined(p_room uuid)
returns timestamptz language sql stable security definer set search_path='' as $joined$
 select p.joined_at from public.vc_participants p join public.vc_threads t on t.id=p.thread_id and t.type='group'
 where p.thread_id=p_room and p.profile_id=auth.uid() and p.left_at is null
 and private.vibechat_presence_eligible(auth.uid())
$joined$;
revoke all on function private.vibechat_group_joined(uuid) from public,anon,authenticated;
grant execute on function private.vibechat_group_joined(uuid) to authenticated;

create or replace function private.vibechat_group_visible_message(p_room uuid,p_sender uuid,p_created timestamptz)
returns boolean language sql stable security definer set search_path='' as $visible$
 select coalesce(p_created>=private.vibechat_group_joined(p_room),false) and not private.vibechat_pair_blocked(auth.uid(),p_sender)
$visible$;
revoke all on function private.vibechat_group_visible_message(uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function private.vibechat_group_visible_message(uuid,uuid,timestamptz) to authenticated;

-- Existing permissive school/legacy policies cannot grant access to group data.
create policy vibechat_group_thread_read on public.vc_threads as restrictive for select to authenticated
 using(type<>'group' or private.vibechat_group_joined(id) is not null);
create policy vibechat_group_thread_insert on public.vc_threads as restrictive for insert to authenticated with check(type<>'group');
create policy vibechat_group_thread_update on public.vc_threads as restrictive for update to authenticated using(type<>'group') with check(type<>'group');
create policy vibechat_group_thread_delete on public.vc_threads as restrictive for delete to authenticated using(type<>'group');
create policy vibechat_group_participant_read on public.vc_participants as restrictive for select to authenticated
 using(not private.vibechat_is_group(thread_id) or private.vibechat_group_joined(thread_id) is not null);
create policy vibechat_group_participant_insert on public.vc_participants as restrictive for insert to authenticated with check(not private.vibechat_is_group(thread_id));
create policy vibechat_group_participant_update on public.vc_participants as restrictive for update to authenticated using(not private.vibechat_is_group(thread_id)) with check(not private.vibechat_is_group(thread_id));
create policy vibechat_group_participant_delete on public.vc_participants as restrictive for delete to authenticated using(not private.vibechat_is_group(thread_id));
create policy vibechat_group_message_read on public.vc_messages as restrictive for select to authenticated
 using(not private.vibechat_is_group(thread_id) or private.vibechat_group_visible_message(thread_id,sender_id,created_at));
create policy vibechat_group_message_insert on public.vc_messages as restrictive for insert to authenticated with check(not private.vibechat_is_group(thread_id));
create policy vibechat_group_message_update on public.vc_messages as restrictive for update to authenticated using(not private.vibechat_is_group(thread_id)) with check(not private.vibechat_is_group(thread_id));
create policy vibechat_group_message_delete on public.vc_messages as restrictive for delete to authenticated using(not private.vibechat_is_group(thread_id));

create or replace function private.vibechat_group_contact(p_actor uuid,p_peer uuid)
returns boolean language sql stable security definer set search_path='' as $contact$
 select p_actor<>p_peer and private.vibechat_presence_eligible(p_actor) and private.vibechat_presence_eligible(p_peer)
 and not private.vibechat_pair_blocked(p_actor,p_peer)
 and exists(select 1 from public.vibechat_contact_requests r join public.vc_threads t on t.id=r.thread_id and t.type='direct'
 join public.vc_participants a on a.thread_id=t.id and a.profile_id=p_actor and a.left_at is null
 join public.vc_participants b on b.thread_id=t.id and b.profile_id=p_peer and b.left_at is null
 where r.status='accepted' and t.student_id is null and least(r.requester_id,r.recipient_id)=least(p_actor,p_peer)
 and greatest(r.requester_id,r.recipient_id)=greatest(p_actor,p_peer))
$contact$;
revoke all on function private.vibechat_group_contact(uuid,uuid) from public,anon,authenticated;

create or replace function public.vibechat_group_candidates()
returns jsonb language sql stable security definer set search_path='' as $candidates$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',coalesce(nullif(p.full_name,''),'VibeSchool user'),'handle',p.vc_id) order by p.full_name),'[]'::jsonb)
 from (select distinct case when r.requester_id=auth.uid() then r.recipient_id else r.requester_id end as id from public.vibechat_contact_requests r where r.status='accepted' and auth.uid() in (r.requester_id,r.recipient_id)) c
 join public.profiles p on p.id=c.id where private.vibechat_group_contact(auth.uid(),p.id)
$candidates$;
revoke all on function public.vibechat_group_candidates() from public,anon,authenticated;
grant execute on function public.vibechat_group_candidates() to authenticated;

create or replace function public.vibechat_group_invite(p_room uuid,p_recipients uuid[])
returns boolean language plpgsql volatile security definer set search_path='' as $invite$
declare actor uuid:=auth.uid(); recipient uuid;
begin
 if private.vibechat_group_joined(p_room) is null then raise exception 'Group unavailable' using errcode='42501';end if;
 perform 1 from public.vc_threads t where t.id=p_room and t.type='group' and t.created_by=actor for update;
 if not found then raise exception 'Only the group owner may invite' using errcode='42501';end if;
 if coalesce(cardinality(p_recipients),0) not between 1 and 19 then raise exception 'Select contacts' using errcode='22023';end if;
 foreach recipient in array p_recipients loop
  if recipient is null or not private.vibechat_group_contact(actor,recipient) then raise exception 'Contact unavailable' using errcode='42501';end if;
  if exists(select 1 from public.vc_participants p where p.thread_id=p_room and p.left_at is null and private.vibechat_pair_blocked(p.profile_id,recipient)) then raise exception 'Contact unavailable' using errcode='42501';end if;
  if not exists(select 1 from public.vc_participants p where p.thread_id=p_room and p.profile_id=recipient and p.left_at is null)
     and not exists(select 1 from private.vibechat_group_invites i where i.group_id=p_room and i.recipient_id=recipient) then
   if (select count(*) from public.vc_participants p where p.thread_id=p_room and p.left_at is null)+(select count(*) from private.vibechat_group_invites i where i.group_id=p_room and i.status='pending' and i.created_at>now()-interval '7 days')>=20 then raise exception 'Group is full' using errcode='22023';end if;
   insert into private.vibechat_group_invites(group_id,inviter_id,recipient_id) values(p_room,actor,recipient);
   perform private.vibechat_notify_inbox(recipient);
  end if;
 end loop;
 return true;
end;$invite$;
revoke all on function public.vibechat_group_invite(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.vibechat_group_invite(uuid,uuid[]) to authenticated;

create or replace function public.vibechat_group_create(p_room uuid,p_name text,p_recipients uuid[])
returns uuid language plpgsql volatile security definer set search_path='' as $create$
declare actor uuid:=auth.uid(); title text:=trim(coalesce(p_name,''));
begin
 if not private.vibechat_presence_eligible(actor) then raise exception 'Adult account eligibility required' using errcode='42501';end if;
 if p_room is null or length(title) not between 1 and 80 then raise exception 'Invalid group name' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('vibechat-group:'||actor::text,0));
 if exists(select 1 from public.vc_threads t where t.id=p_room and t.type='group' and t.created_by=actor and t.subject=title) and private.vibechat_group_joined(p_room) is not null then return p_room;end if;
 if (select count(*) from public.vc_threads t where t.created_by=actor and t.type='group' and t.created_at>now()-interval '1 day')>=10 then raise exception 'Group creation limit' using errcode='22023';end if;
 insert into public.vc_threads(id,school_id,type,created_by,context_tag,subject) values(p_room,null,'group',actor,'general',title);
 insert into public.vc_participants(thread_id,profile_id,school_id,joined_at,last_read_at) values(p_room,actor,null,now(),now());
 perform public.vibechat_group_invite(p_room,p_recipients);
 return p_room;
end;$create$;
revoke all on function public.vibechat_group_create(uuid,text,uuid[]) from public,anon,authenticated;
grant execute on function public.vibechat_group_create(uuid,text,uuid[]) to authenticated;

create or replace function public.vibechat_group_respond(p_invite uuid,p_accept boolean)
returns uuid language plpgsql volatile security definer set search_path='' as $respond$
declare actor uuid:=auth.uid(); i private.vibechat_group_invites%rowtype;
begin
 if actor is null or p_accept is null then raise exception 'Invitation unavailable' using errcode='42501';end if;
 select * into i from private.vibechat_group_invites x where x.id=p_invite and x.recipient_id=actor;
 if not found then raise exception 'Invitation unavailable' using errcode='42501';end if;
 perform 1 from public.vc_threads t where t.id=i.group_id and t.type='group' and t.created_by=i.inviter_id for update;
 if not found then raise exception 'Invitation unavailable' using errcode='42501';end if;
 select * into i from private.vibechat_group_invites x where x.id=p_invite and x.recipient_id=actor for update;
 if i.status='accepted' and p_accept and private.vibechat_group_joined(i.group_id) is not null then return i.group_id;end if;
 if i.status<>'pending' or i.created_at<now()-interval '7 days' then raise exception 'Invitation unavailable' using errcode='42501';end if;
 if not p_accept then update private.vibechat_group_invites set status='declined',responded_at=now() where id=p_invite;perform private.vibechat_notify_inbox(i.inviter_id);return null;end if;
 if not private.vibechat_group_contact(i.inviter_id,actor)
 or not exists(select 1 from public.vc_participants p where p.thread_id=i.group_id and p.profile_id=i.inviter_id and p.left_at is null)
 or exists(select 1 from public.vc_participants p where p.thread_id=i.group_id and p.left_at is null and (not private.vibechat_presence_eligible(p.profile_id) or private.vibechat_pair_blocked(actor,p.profile_id)))
 or (select count(*) from public.vc_participants p where p.thread_id=i.group_id and p.left_at is null)>=20 then raise exception 'Invitation unavailable' using errcode='42501';end if;
 insert into public.vc_participants(thread_id,profile_id,school_id,joined_at,last_read_at) values(i.group_id,actor,null,now(),now())
 on conflict(thread_id,profile_id) do update set joined_at=excluded.joined_at,last_read_at=excluded.last_read_at,left_at=null;
 update private.vibechat_group_invites set status='accepted',responded_at=now() where id=p_invite;
 perform private.vibechat_notify_room('vc',i.group_id);
 return i.group_id;
end;$respond$;
revoke all on function public.vibechat_group_respond(uuid,boolean) from public,anon,authenticated;
grant execute on function public.vibechat_group_respond(uuid,boolean) to authenticated;

create or replace function public.vibechat_group_leave(p_room uuid)
returns boolean language plpgsql volatile security definer set search_path='' as $leave$
declare actor uuid:=auth.uid(); owner_id uuid;
begin
 if actor is null or not exists(select 1 from public.vc_participants p where p.thread_id=p_room and p.profile_id=actor and p.left_at is null) then raise exception 'Group unavailable' using errcode='42501';end if;
 select t.created_by into owner_id from public.vc_threads t where t.id=p_room and t.type='group' for update;
 if not found then raise exception 'Group unavailable' using errcode='42501';end if;
 -- The owner closing a group revokes access for every participant.
 update public.vc_participants set left_at=now() where thread_id=p_room and left_at is null and (profile_id=actor or owner_id=actor);
 if owner_id=actor then
  update private.vibechat_group_invites set status='cancelled',responded_at=now() where group_id=p_room and status='pending';
 end if;
 perform private.vibechat_notify_inbox(actor);
 return true;
end;$leave$;
revoke all on function public.vibechat_group_leave(uuid) from public,anon,authenticated;
grant execute on function public.vibechat_group_leave(uuid) to authenticated;

create or replace function public.vibechat_group_send(p_owner uuid,p_room uuid,p_operation uuid,p_body text)
returns uuid language plpgsql volatile security definer set search_path='' as $send$
declare actor uuid:=auth.uid(); body_text text:=trim(coalesce(p_body,'')); digest_text text; old private.vibechat_send_operations%rowtype; message_id uuid;
begin
 if actor is null or p_owner is distinct from actor or private.vibechat_group_joined(p_room) is null then raise exception 'Group unavailable' using errcode='42501';end if;
 if p_operation is null or length(body_text) not between 1 and 1500 then raise exception 'Invalid message' using errcode='22023';end if;
 perform 1 from public.vc_threads t where t.id=p_room and t.type='group' for update;
 if not found or private.vibechat_group_joined(p_room) is null or exists(select 1 from public.vc_participants p where p.thread_id=p_room and p.left_at is null and (not private.vibechat_presence_eligible(p.profile_id) or private.vibechat_pair_blocked(actor,p.profile_id))) then raise exception 'Group unavailable' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('vibechat-send:'||actor::text,0));
 digest_text:=encode(sha256(convert_to(body_text,'UTF8')),'hex');
 select * into old from private.vibechat_send_operations o where o.sender_id=actor and o.operation_id=p_operation;
 if found then
  if old.kind<>'vc' or old.room_id<>p_room or old.body_digest<>digest_text then raise exception 'Operation key already used' using errcode='22023';end if;
  return old.message_id;
 end if;
 if (select count(*) from private.vibechat_send_operations o where o.sender_id=actor and o.created_at>now()-interval '1 minute')>=10 then raise exception 'Message rate limit reached' using errcode='P0001',detail='VIBECHAT_RATE_LIMIT';end if;
 insert into public.vc_messages(thread_id,school_id,sender_id,body) values(p_room,null,actor,body_text) returning id into message_id;
 insert into private.vibechat_send_operations(sender_id,operation_id,kind,room_id,message_id,body_digest) values(actor,p_operation,'vc',p_room,message_id,digest_text);
 return message_id;
end;$send$;
revoke all on function public.vibechat_group_send(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.vibechat_group_send(uuid,uuid,uuid,text) to authenticated;

create or replace function public.vibechat_group_list()
returns jsonb language sql stable security definer set search_path='' as $list$
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.subject,'owner',t.created_by=auth.uid(),'members',(select count(*) from public.vc_participants x where x.thread_id=t.id and x.left_at is null),
 'updated',coalesce(last_msg.created_at,t.created_at),'preview',coalesce(last_msg.body,''),'unread',(select count(*) from public.vc_messages m where m.thread_id=t.id and m.sender_id<>auth.uid() and m.deleted_at is null and m.created_at>coalesce(p.last_read_at,p.joined_at) and private.vibechat_group_visible_message(t.id,m.sender_id,m.created_at)),
 'pinned',coalesce(pref.pinned,false),'archived',coalesce(pref.archived,false),'muted',coalesce(pref.muted,false))
 order by coalesce(pref.pinned,false) desc,coalesce(last_msg.created_at,t.created_at) desc),'[]'::jsonb)
 from public.vc_participants p join public.vc_threads t on t.id=p.thread_id and t.type='group'
 left join private.vibechat_conversation_preferences pref on pref.profile_id=auth.uid() and pref.kind='vc' and pref.room_id=t.id
 left join lateral(select left(m.body,80) as body,m.created_at from public.vc_messages m where m.thread_id=t.id and m.deleted_at is null and private.vibechat_group_visible_message(t.id,m.sender_id,m.created_at) order by m.created_at desc,m.id desc limit 1) last_msg on true
 where p.profile_id=auth.uid() and p.left_at is null and private.vibechat_group_joined(t.id) is not null
$list$;
revoke all on function public.vibechat_group_list() from public,anon,authenticated;
grant execute on function public.vibechat_group_list() to authenticated;

create or replace function public.vibechat_group_invitations()
returns jsonb language sql stable security definer set search_path='' as $invitations$
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'group_name',t.subject,'inviter_name',p.full_name,'created_at',i.created_at) order by i.created_at desc),'[]'::jsonb)
 from private.vibechat_group_invites i join public.vc_threads t on t.id=i.group_id and t.type='group' join public.profiles p on p.id=i.inviter_id
 where i.recipient_id=auth.uid() and i.status='pending' and i.created_at>now()-interval '7 days' and private.vibechat_group_contact(i.inviter_id,auth.uid())
$invitations$;
revoke all on function public.vibechat_group_invitations() from public,anon,authenticated;
grant execute on function public.vibechat_group_invitations() to authenticated;

create or replace function public.vibechat_group_messages(p_room uuid,p_before timestamptz default null,p_before_id uuid default null,p_query text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $messages$
declare result jsonb;
begin
 if private.vibechat_group_joined(p_room) is null then raise exception 'Group unavailable' using errcode='42501';end if;
 if (p_before is null)<>(p_before_id is null) or length(coalesce(p_query,''))>100 then raise exception 'Invalid message query' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'body',m.body,'mine',m.sender_id=auth.uid(),'sender',coalesce(p.full_name,'VibeSchool user'),'created_at',m.created_at) order by m.created_at,m.id),'[]'::jsonb) into result
 from (select x.* from public.vc_messages x where x.thread_id=p_room and x.deleted_at is null and private.vibechat_group_visible_message(p_room,x.sender_id,x.created_at)
 and (p_before is null or (x.created_at,x.id)<(p_before,p_before_id)) and (nullif(trim(p_query),'') is null or position(lower(trim(p_query)) in lower(x.body))>0)
 order by x.created_at desc,x.id desc limit 50) m left join public.profiles p on p.id=m.sender_id;
 return result;
end;$messages$;
revoke all on function public.vibechat_group_messages(uuid,timestamptz,uuid,text) from public,anon,authenticated;
grant execute on function public.vibechat_group_messages(uuid,timestamptz,uuid,text) to authenticated;

create or replace function public.vibechat_group_ack(p_room uuid,p_message uuid)
returns boolean language plpgsql volatile security definer set search_path='' as $ack$
declare at_time timestamptz;
begin
 if private.vibechat_group_joined(p_room) is null then return false;end if;
 select m.created_at into at_time from public.vc_messages m where m.id=p_message and m.thread_id=p_room and m.deleted_at is null and private.vibechat_group_visible_message(p_room,m.sender_id,m.created_at);
 if not found then return false;end if;
 update public.vc_participants p set last_read_at=greatest(p.last_read_at,at_time) where p.thread_id=p_room and p.profile_id=auth.uid() and p.left_at is null;
 return true;
end;$ack$;
revoke all on function public.vibechat_group_ack(uuid,uuid) from public,anon,authenticated;
grant execute on function public.vibechat_group_ack(uuid,uuid) to authenticated;

create or replace function public.vibechat_group_preference(p_room uuid,p_setting text,p_value boolean)
returns boolean language plpgsql volatile security definer set search_path='' as $pref$
begin
 if private.vibechat_group_joined(p_room) is null then raise exception 'Group unavailable' using errcode='42501';end if;
 if p_setting is null or p_setting not in ('pinned','archived','muted') or p_value is null then raise exception 'Invalid preference' using errcode='22023';end if;
 insert into private.vibechat_conversation_preferences(profile_id,kind,room_id,pinned,archived,muted)
 values(auth.uid(),'vc',p_room,p_setting='pinned' and p_value,p_setting='archived' and p_value,p_setting='muted' and p_value)
 on conflict(profile_id,kind,room_id) do update set
 pinned=case when p_setting='pinned' then p_value else vibechat_conversation_preferences.pinned end,
 archived=case when p_setting='archived' then p_value else vibechat_conversation_preferences.archived end,
 muted=case when p_setting='muted' then p_value else vibechat_conversation_preferences.muted end;
 perform private.vibechat_notify_inbox(auth.uid());
 return true;
end;$pref$;
revoke all on function public.vibechat_group_preference(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.vibechat_group_preference(uuid,text,boolean) to authenticated;

create or replace function public.vibechat_group_report(p_room uuid,p_reason text)
returns uuid language plpgsql volatile security definer set search_path='' as $report$
declare result uuid;
begin
 if private.vibechat_group_joined(p_room) is null then raise exception 'Group unavailable' using errcode='42501';end if;
 if p_reason is null or p_reason not in ('spam','harassment','safety','other') then raise exception 'Invalid report reason' using errcode='22023';end if;
 if (select count(*) from public.vibechat_reports r where r.reporter_id=auth.uid() and r.created_at>now()-interval '1 day')>=10 then raise exception 'Report limit' using errcode='22023';end if;
 insert into public.vibechat_reports(reporter_id,room_kind,room_id,reason) values(auth.uid(),'vc',p_room,p_reason) returning id into result;
 return result;
end;$report$;
revoke all on function public.vibechat_group_report(uuid,text) from public,anon,authenticated;
grant execute on function public.vibechat_group_report(uuid,text) to authenticated;
-- Extend the existing private push eligibility to accepted adult group members.
create or replace function private.vibechat_push_member(p_user uuid,p_kind text,p_room uuid)
returns boolean language sql stable security definer set search_path='' as $member$
 select exists(select 1 from public.profiles p where p.id=p_user and p.account_status::text='active' and not coalesce(p.is_anonymized,false))
 and case when p_kind='vc' then exists(
  select 1 from public.vc_threads t join public.vc_participants m on m.thread_id=t.id and m.profile_id=p_user and m.left_at is null
  where t.id=p_room and (t.type='direct' or (t.type='group' and private.vibechat_presence_eligible(p_user)))
  and (t.type='group' or (select count(*) from public.vc_participants x where x.thread_id=t.id and x.left_at is null)=2)
  and (t.student_id is null or exists(
    select 1 from public.parent_student_links l join public.students s on s.id=l.student_id and s.deleted_at is null join public.classes c on c.id=s.class_id
    where l.parent_id=p_user and l.student_id=t.student_id and c.school_id=t.school_id and (l.school_id is null or l.school_id=c.school_id)
  ) or exists(
    select 1 from public.students s join public.classes c on c.id=s.class_id
    join public.school_members sm on sm.school_id=c.school_id and sm.profile_id=p_user
    join public.profiles staff on staff.id=p_user and staff.role in ('teacher','admin')
    where s.id=t.student_id and s.deleted_at is null and c.school_id=t.school_id and (staff.role='admin' or exists(
      select 1 from public.teacher_classes a where a.teacher_id=p_user and a.class_id=c.id and a.school_id=c.school_id
    ))
  ))
 ) when p_kind='tuition' then exists(
  select 1 from public.vibetutor_student_invitations i join public.students s on s.id=i.student_id and s.deleted_at is null
  where i.id=p_room and i.status='accepted' and p_user in (i.tutor_id,s.profile_id)
 ) else false end
$member$;
revoke all on function private.vibechat_push_member(uuid,text,uuid) from public,anon,authenticated;

create or replace function private.vibechat_push_allowed(p_device uuid,p_sender uuid,p_kind text,p_room uuid,p_message uuid)
returns boolean language sql stable security definer set search_path='' as $allowed$
 select exists(select 1 from private.vibechat_push_devices d
 join private.vibechat_notification_preferences n on n.profile_id=d.profile_id and n.enabled
 join auth.sessions s on s.id=d.session_id and s.user_id=d.profile_id
 where d.id=p_device and d.profile_id<>p_sender and private.vibechat_valid_push_endpoint(d.endpoint)
 and private.vibechat_push_member(d.profile_id,p_kind,p_room) and private.vibechat_push_member(p_sender,p_kind,p_room)
 and not private.vibechat_pair_blocked(d.profile_id,p_sender)
 and not exists(select 1 from private.vibechat_conversation_preferences p where p.profile_id=d.profile_id and p.kind=p_kind and p.room_id=p_room and p.muted)
 and case when p_kind='vc' then exists(select 1 from public.vc_messages m where m.id=p_message and m.thread_id=p_room and m.sender_id=p_sender and m.deleted_at is null and not exists(
  select 1 from public.vc_participants cp where cp.thread_id=p_room and cp.profile_id=d.profile_id and cp.last_read_at>=m.created_at
 ) and (not private.vibechat_is_group(p_room) or exists(select 1 from public.vc_participants cp where cp.thread_id=p_room and cp.profile_id=d.profile_id and cp.left_at is null and m.created_at>=cp.joined_at))) else exists(select 1 from public.vibetutor_lesson_messages m where m.id=p_message and m.invitation_id=p_room and m.sender_id=p_sender and m.deleted_at is null) end
 and not exists(select 1 from private.vibechat_receipts r where r.profile_id=d.profile_id and r.kind=p_kind and r.room_id=p_room and r.read_at>=case when p_kind='vc' then (select m.created_at from public.vc_messages m where m.id=p_message) else (select m.created_at from public.vibetutor_lesson_messages m where m.id=p_message) end)
 )
$allowed$;
revoke all on function private.vibechat_push_allowed(uuid,uuid,text,uuid,uuid) from public,anon,authenticated;
-- Preserve the existing production read contract on fresh reconstructions.
-- Supabase defaults vary; authenticated inbox readers need explicit SELECT.
-- Existing RLS plus the restrictive direct/group policies above remain mandatory.
grant select on public.vc_threads,public.vc_participants,public.vc_messages to authenticated;
notify pgrst,'reload schema';
commit;
