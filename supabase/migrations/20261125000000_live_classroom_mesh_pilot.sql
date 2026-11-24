-- Empty by default. Operators must verify the age and consent of both test accounts.
-- access: owner-only vibe_live.mesh_pilot
-- authorization-test: vibe_live.mesh_pilot denies direct access in scripts/test-live-mesh.mjs.
begin;
create table vibe_live.mesh_pilot (
 room_id uuid primary key references vibe_live.sessions(id) on delete cascade,
 teacher_user uuid not null references auth.users(id) on delete cascade,
 learner_user uuid not null references auth.users(id) on delete cascade,
 expires_at timestamptz not null,
 verified_adults_at timestamptz not null,
 daily_fallback boolean not null default false,
 teacher_client uuid, learner_client uuid,
 teacher_seen timestamptz, learner_seen timestamptz,
 epoch bigint not null default 0,
 offer text, answer text, speaking boolean not null default false,
 check (teacher_user <> learner_user),
 check (length(offer)<=24000 and length(answer)<=24000)
);
alter table vibe_live.mesh_pilot enable row level security;
revoke all on vibe_live.mesh_pilot from public, anon, authenticated, service_role;

create function vibe_live.mesh_command(p_room uuid,p_class uuid,p_action text,p_client uuid,p_epoch bigint,p_sdp text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 caller uuid := auth.uid();
 pair vibe_live.mesh_pilot%rowtype;
 room jsonb; live_room vibe_live.sessions%rowtype; teacher boolean; student uuid; t timestamptz := clock_timestamp();
 both_present boolean; current_client uuid; target_student uuid; learner_count integer;
begin
 if caller is null or p_client is null or p_action is null or p_action not in ('join','poll','offer','answer','allow','revoke','leave','fallback') then
   raise exception 'mesh_denied' using errcode='42501';
 end if;
 -- Reject uncommissioned callers before taking any Live session lock.
 if not exists(select 1 from vibe_live.mesh_pilot m where m.room_id=p_room
               and caller in (m.teacher_user,m.learner_user)) then
   if p_action='join' then raise exception 'mesh_unavailable' using errcode='P0002'; end if;
   raise exception 'mesh_denied' using errcode='42501';
 end if;
 -- Match canonical session-first locking; an allow action needs an exclusive
 -- session lock because the canonical acknowledgement mutates the room.
 if p_action='allow' then
   select * into live_room from vibe_live.sessions where id=p_room for update;
 else
   select * into live_room from vibe_live.sessions where id=p_room for share;
 end if;
 if live_room.id is null then raise exception 'mesh_denied' using errcode='42501'; end if;
 select * into pair from vibe_live.mesh_pilot where room_id=p_room for update;
 t:=clock_timestamp();
 if pair.room_id is null or pair.expires_at<=t or pair.verified_adults_at>t
   or pair.expires_at>pair.verified_adults_at+interval '2 hours' or caller not in (pair.teacher_user,pair.learner_user) then
   raise exception 'mesh_denied' using errcode='42501';
 end if;
 teacher := caller=pair.teacher_user;
 room := public.vibe_live_command('get',p_class,p_room,null,'{}'::jsonb);
 if room->>'id' is distinct from p_room::text or room->>'status' is distinct from 'active'
   or room->>'teacher' is distinct from teacher::text or (room->>'expiresAt') is null
   or (room->>'expiresAt')::timestamptz <= t then
   raise exception 'mesh_denied' using errcode='42501';
 end if;
 -- Both endpoints must remain authorized; do not rely solely on the caller's
 -- RPC result. A learner must have joined the room and retain open-class admission.
 if live_room.teacher_id is distinct from pair.teacher_user
   or not vibe_live.host_allowed(pair.teacher_user,live_room.mode,live_room.class_id,live_room.school_id,live_room.group_id)
   or (select count(*) from public.profiles p where p.id in (pair.teacher_user,pair.learner_user)
       and p.account_status::text='active' and not coalesce(p.is_anonymized,false))<>2 then
   raise exception 'mesh_denied' using errcode='42501';
 end if;
 select count(*), min(st.id::text)::uuid into learner_count,student from public.students st
   where st.profile_id=pair.learner_user and st.deleted_at is null;
 if learner_count<>1 then raise exception 'mesh_denied' using errcode='42501'; end if;
 if not vibe_live.can_join(student,pair.teacher_user,live_room.mode,live_room.class_id,live_room.school_id,live_room.group_id)
   or not exists(select 1 from vibe_live.participants p where p.session_id=p_room and p.student_id=student)
   or (live_room.mode='open' and not exists(select 1 from vibe_live.waiting_requests w where w.session_id=p_room and w.student_id=student and w.status='admitted')) then
   -- Teacher can prepare while the named learner is not yet admitted, but cannot
   -- exchange media or receive a grant until both are actually admitted.
   if not teacher or p_action not in ('join','poll','leave','fallback') then
     raise exception 'mesh_denied' using errcode='42501';
   end if;
   if pair.learner_client is not null then
     pair.learner_client:=null;pair.epoch:=pair.epoch+1;pair.offer:=null;pair.answer:=null;pair.speaking:=false;
   end if;
 end if;
 -- Both authorized clients observe the same provider. Discard media state
 -- immediately so an in-flight offer or grant cannot revive the direct call.
 if p_action='fallback' and not pair.daily_fallback then
   update vibe_live.mesh_pilot set daily_fallback=true,teacher_client=null,learner_client=null,
     teacher_seen=null,learner_seen=null,offer=null,answer=null,speaking=false,epoch=epoch+1
     where room_id=p_room returning * into pair;
 end if;
 if pair.daily_fallback then
   return jsonb_build_object('role',case when teacher then 'teacher' else 'learner' end,
     'epoch',pair.epoch,'peerPresent',false,'offer',null,'answer',null,'speaking',false,
     'learnerStudentId',null,'fallback',true,
     'expiresAt',least(pair.expires_at,live_room.expires_at));
 end if;
 -- Expired client leases invalidate all SDP and speaking grants.
 if (pair.teacher_client is not null and coalesce(pair.teacher_seen,'-infinity'::timestamptz)<t-interval '16 seconds')
 or (pair.learner_client is not null and coalesce(pair.learner_seen,'-infinity'::timestamptz)<t-interval '16 seconds') then
   if coalesce(pair.teacher_seen,'-infinity'::timestamptz)<t-interval '16 seconds' then pair.teacher_client:=null; end if;
   if coalesce(pair.learner_seen,'-infinity'::timestamptz)<t-interval '16 seconds' then pair.learner_client:=null; end if;
   pair.epoch:=pair.epoch+1; pair.offer:=null; pair.answer:=null; pair.speaking:=false;
 end if;
 current_client:=case when teacher then pair.teacher_client else pair.learner_client end;
 if p_action='join' then
   -- Prevent a second tab silently replacing the active device.
   if current_client is not null and current_client<>p_client then raise exception 'mesh_device_busy'; end if;
   if current_client is distinct from p_client then
     if teacher then pair.teacher_client:=p_client; else pair.learner_client:=p_client; end if;
     pair.epoch:=pair.epoch+1;pair.offer:=null;pair.answer:=null;pair.speaking:=false;
   end if;
 elsif current_client is distinct from p_client then raise exception 'mesh_lease_lost' using errcode='42501'; end if;
 if p_action='leave' then
   if teacher then pair.teacher_client:=null; else pair.learner_client:=null; end if;
   pair.epoch:=pair.epoch+1;pair.offer:=null;pair.answer:=null;pair.speaking:=false;
 else
   if teacher then pair.teacher_seen:=t; else pair.learner_seen:=t; end if;
 end if;
 both_present:=pair.teacher_client is not null and pair.learner_client is not null;
 if teacher then
   select id into target_student from public.students where profile_id=pair.learner_user and deleted_at is null
     and id::text in (select x->>'studentId' from jsonb_array_elements(coalesce(room->'participants','[]'::jsonb)) x);
 end if;
 if p_action in ('offer','answer','allow','revoke') then
   if p_epoch is distinct from pair.epoch or not both_present then raise exception 'mesh_stale'; end if;
 end if;
 if p_action in ('offer','answer') then
   if p_sdp is null or length(p_sdp)>24000 or split_part(replace(p_sdp,chr(13),''),chr(10),1)<>'v=0'
     or (select count(*) from regexp_split_to_table(replace(p_sdp,chr(13),''),chr(10)) line where line ~* '^m=')<>1
     or not exists(select 1 from regexp_split_to_table(replace(p_sdp,chr(13),''),chr(10)) line where line ~ '^m=audio [0-9]+ UDP/TLS/RTP/SAVPF ')
     or not exists(select 1 from regexp_split_to_table(replace(p_sdp,chr(13),''),chr(10)) line where line like 'a=fingerprint:%')
     or exists(select 1 from regexp_split_to_table(replace(p_sdp,chr(13),''),chr(10)) line where line ~* '^a=rtpmap:.* (H264|VP8|VP9|AV1)/') then raise exception 'mesh_bad_sdp'; end if;
   if p_action='offer' and teacher and pair.offer is null then pair.offer:=p_sdp;
   elsif p_action='answer' and not teacher and pair.offer is not null and pair.answer is null then pair.answer:=p_sdp;
   else raise exception 'mesh_bad_signal'; end if;
 elsif p_action='allow' then
   if not teacher or pair.answer is null then raise exception 'mesh_denied' using errcode='42501'; end if;
   if student is null or not exists (select 1 from jsonb_array_elements(coalesce(room->'participants','[]'::jsonb)) x where x->>'studentId'=student::text and x->>'needsHelp'='true') then
     raise exception 'mesh_no_hand';
   end if;
   perform public.vibe_live_command('ack',p_class,p_room,null,jsonb_build_object('studentId',student));
   pair.speaking:=true;
 elsif p_action='revoke' then
   if not teacher then raise exception 'mesh_denied' using errcode='42501'; end if;
   pair.speaking:=false;
 end if;
 update vibe_live.mesh_pilot set teacher_client=pair.teacher_client, learner_client=pair.learner_client,
 teacher_seen=pair.teacher_seen, learner_seen=pair.learner_seen, epoch=pair.epoch,
 offer=pair.offer, answer=pair.answer, speaking=pair.speaking where room_id=p_room;
 return jsonb_build_object('role',case when teacher then 'teacher' else 'learner' end,
 'epoch',pair.epoch,'peerPresent',both_present,'offer',case when not teacher then pair.offer end,
 'answer',case when teacher then pair.answer end,'speaking',pair.speaking,
 'learnerStudentId',case when teacher then target_student end,'fallback',false,
 'expiresAt',least(pair.expires_at,(room->>'expiresAt')::timestamptz));
end $$;
revoke all on function vibe_live.mesh_command(uuid,uuid,text,uuid,bigint,text) from public,anon,authenticated,service_role;
grant execute on function vibe_live.mesh_command(uuid,uuid,text,uuid,bigint,text) to authenticated;
create function public.vibe_live_mesh(p_room uuid,p_class uuid,p_action text,p_client uuid,p_epoch bigint default null,p_sdp text default null)
returns jsonb language sql security invoker set search_path='' as $$
 select vibe_live.mesh_command(p_room,p_class,p_action,p_client,p_epoch,p_sdp);
$$;
revoke all on function public.vibe_live_mesh(uuid,uuid,text,uuid,bigint,text) from public,anon,authenticated,service_role;
grant execute on function public.vibe_live_mesh(uuid,uuid,text,uuid,bigint,text) to authenticated;

-- Invalidate direct media and clear network identifiers as soon as Live pauses.
-- Keep the pair for resume. An ended lesson can never use the pilot again.
create function vibe_live.mesh_room_closed() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='ended' then
   delete from vibe_live.mesh_pilot where room_id=new.id;
 elsif new.status='paused' then
   update vibe_live.mesh_pilot set teacher_client=null,learner_client=null,
     teacher_seen=null,learner_seen=null,offer=null,answer=null,speaking=false,epoch=epoch+1
     where room_id=new.id and (teacher_client is not null or learner_client is not null);
 end if;
 return new;
end $$;
revoke all on function vibe_live.mesh_room_closed() from public,anon,authenticated,service_role;
create trigger live_mesh_room_closed after update of status on vibe_live.sessions
 for each row when (old.status is distinct from new.status and new.status in ('paused','ended'))
 execute function vibe_live.mesh_room_closed();
commit;
