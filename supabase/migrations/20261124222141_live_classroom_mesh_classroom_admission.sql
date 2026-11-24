-- Expand VibeMesh from manually provisioned pilots to existing Live Classroom access.
begin;

alter table vibe_live.mesh_pilot alter column verified_adults_at drop not null;
alter table vibe_live.mesh_pilot_seats alter column seat drop not null;

create or replace function vibe_live.mesh_command(p_room uuid,p_class uuid,p_action text,p_client uuid,p_epoch bigint,p_sdp text,p_target uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 caller uuid := auth.uid();
 pilot vibe_live.mesh_pilot%rowtype;
 peer vibe_live.mesh_pilot_seats%rowtype;
 live_room vibe_live.sessions%rowtype;
 room jsonb;
 teacher boolean;
 caller_student uuid;
 target_student uuid;
 t timestamptz;
 peers jsonb;
 free_seat integer;
begin
 if caller is null or p_client is null or p_action is null
   or p_action not in ('join','poll','offer','answer','allow','revoke','leave') then
   raise exception 'mesh_denied' using errcode='42501';
 end if;
 -- Session, then pilot, then seat. Allow calls the canonical host action.
 if p_action='allow' then
   select * into live_room from vibe_live.sessions where id=p_room for update;
 else
   select * into live_room from vibe_live.sessions where id=p_room for share;
 end if;
 t := clock_timestamp();
 room := public.vibe_live_command('get',p_class,p_room,null,'{}'::jsonb);
 teacher := caller=live_room.teacher_id;
 if live_room.id is null or room->>'id' is distinct from p_room::text
   or room->>'status' is distinct from 'active' or live_room.expires_at<=t
   or room->>'teacher' is distinct from teacher::text
   or not vibe_live.host_allowed(live_room.teacher_id,live_room.mode,live_room.class_id,live_room.school_id,live_room.group_id) then
   raise exception 'mesh_denied' using errcode='42501';
 end if;

 if not teacher then
   select st.id into caller_student from public.students st
   where st.profile_id=caller and st.deleted_at is null
     and (select count(*) from public.students x where x.profile_id=caller and x.deleted_at is null)=1
     and vibe_live.can_join(st.id,live_room.teacher_id,live_room.mode,live_room.class_id,live_room.school_id,live_room.group_id)
     and exists(select 1 from vibe_live.participants m where m.session_id=p_room and m.student_id=st.id)
     and (live_room.mode<>'open' or exists(
       select 1 from vibe_live.waiting_requests w where w.session_id=p_room and w.student_id=st.id and w.status='admitted'));
   if caller_student is null or p_target is not null or p_action in ('offer','allow','revoke') then
     raise exception 'mesh_denied' using errcode='42501';
   end if;
 elsif p_action='answer' then
   raise exception 'mesh_denied' using errcode='42501';
 end if;

 -- Provision only after canonical admission and serialize seat allocation on
 -- the room's signaling row, including simultaneous first joins.
 if p_action='join' then
   insert into vibe_live.mesh_pilot(room_id,teacher_user,expires_at)
     values(p_room,live_room.teacher_id,live_room.expires_at)
     on conflict (room_id) do nothing;
 end if;
 select * into pilot from vibe_live.mesh_pilot where room_id=p_room for update;
 if pilot.room_id is null or pilot.teacher_user is distinct from live_room.teacher_id then
   raise exception 'mesh_denied' using errcode='42501';
 end if;

 -- A dead device or a lesson entitlement change invalidates its private edge.
 if pilot.teacher_client is not null and pilot.teacher_seen<t-interval '16 seconds' then
   update vibe_live.mesh_pilot set teacher_client=null,teacher_seen=null where room_id=p_room returning * into pilot;
   update vibe_live.mesh_pilot_seats set offer=null,answer=null,speaking=false,epoch=epoch+1 where room_id=p_room;
 end if;
 update vibe_live.mesh_pilot_seats s set seat=null,learner_client=null,learner_seen=null,offer=null,answer=null,speaking=false,epoch=epoch+1
 where s.room_id=p_room and s.seat is not null and (
   s.learner_client is null or s.learner_seen<t-interval '16 seconds'
   or not exists (
     select 1 from public.students st
     where st.id=s.student_id and st.profile_id=s.learner_user and st.deleted_at is null
       and (select count(*) from public.students x where x.profile_id=s.learner_user and x.deleted_at is null)=1
       and vibe_live.can_join(st.id,pilot.teacher_user,live_room.mode,live_room.class_id,live_room.school_id,live_room.group_id)
       and exists(select 1 from vibe_live.participants m where m.session_id=p_room and m.student_id=st.id)
       and (live_room.mode<>'open' or exists(
         select 1 from vibe_live.waiting_requests w where w.session_id=p_room and w.student_id=st.id and w.status='admitted'))
   )
 );

 if teacher then
   if p_action='join' and pilot.teacher_client is not null and pilot.teacher_client<>p_client then
     raise exception 'mesh_device_busy';
   elsif p_action<>'join' and pilot.teacher_client is distinct from p_client then
     raise exception 'mesh_lease_lost' using errcode='42501';
   end if;
   if p_action='leave' then
     update vibe_live.mesh_pilot set teacher_client=null,teacher_seen=null where room_id=p_room returning * into pilot;
     update vibe_live.mesh_pilot_seats set epoch=epoch+1,offer=null,answer=null,speaking=false where room_id=p_room;
   else
     update vibe_live.mesh_pilot set teacher_client=p_client,teacher_seen=t where room_id=p_room returning * into pilot;
   end if;
   target_student := p_target;
 else
   select * into peer from vibe_live.mesh_pilot_seats where room_id=p_room and student_id=caller_student;
   if p_action='join' and peer.learner_client is not null and peer.learner_client<>p_client then
     raise exception 'mesh_device_busy';
   elsif p_action<>'join' and peer.learner_client is distinct from p_client then
     raise exception 'mesh_lease_lost' using errcode='42501';
   end if;
   if p_action='leave' then
     update vibe_live.mesh_pilot_seats set seat=null,learner_client=null,learner_seen=null,offer=null,answer=null,speaking=false,epoch=epoch+1
       where room_id=p_room and student_id=caller_student;
   elsif p_action='join' and peer.learner_client is null then
     select min(n) into free_seat from generate_series(1,8) n
       where not exists(select 1 from vibe_live.mesh_pilot_seats s where s.room_id=p_room and s.seat=n);
     if free_seat is null then raise exception 'mesh_full' using errcode='53000'; end if;
     insert into vibe_live.mesh_pilot_seats as s(room_id,seat,learner_user,student_id,learner_client,learner_seen,epoch)
       values(p_room,free_seat,caller,caller_student,p_client,t,1)
       on conflict (room_id,student_id) do update
         set seat=excluded.seat,learner_user=excluded.learner_user,learner_client=excluded.learner_client,
             learner_seen=excluded.learner_seen,epoch=s.epoch+1;
   else
     update vibe_live.mesh_pilot_seats set learner_seen=t where room_id=p_room and student_id=caller_student;
   end if;
   target_student := caller_student;
 end if;

 if p_action in ('offer','answer','allow','revoke') then
   select * into peer from vibe_live.mesh_pilot_seats where room_id=p_room and student_id=target_student;
   if pilot.teacher_client is null or peer.learner_client is null or p_epoch is distinct from peer.epoch then
     raise exception 'mesh_stale';
   end if;
 end if;

 if p_action in ('offer','answer') then
   if p_sdp is null or octet_length(p_sdp)>24000 or split_part(replace(p_sdp,chr(13),''),chr(10),1)<>'v=0'
     or (select count(*) from regexp_split_to_table(replace(p_sdp,chr(13),''),chr(10)) line where line ~* '^m=')<>1
     or not exists(select 1 from regexp_split_to_table(replace(p_sdp,chr(13),''),chr(10)) line where line ~ '^m=audio [0-9]+ UDP/TLS/RTP/SAVPF ')
     or not exists(select 1 from regexp_split_to_table(replace(p_sdp,chr(13),''),chr(10)) line where line like 'a=fingerprint:%')
     or exists(select 1 from regexp_split_to_table(replace(p_sdp,chr(13),''),chr(10)) line where line ~* '^a=rtpmap:.* (H264|VP8|VP9|AV1)/') then
     raise exception 'mesh_bad_sdp';
   end if;
   if p_action='offer' and peer.offer is null then
     update vibe_live.mesh_pilot_seats set offer=p_sdp where room_id=p_room and student_id=target_student;
   elsif p_action='answer' and peer.offer is not null and peer.answer is null then
     update vibe_live.mesh_pilot_seats set answer=p_sdp where room_id=p_room and student_id=target_student;
   else
     raise exception 'mesh_bad_signal';
   end if;
 elsif p_action='allow' then
   if peer.answer is null or not exists (
     select 1 from jsonb_array_elements(coalesce(room->'participants','[]'::jsonb)) x
       where x->>'studentId'=target_student::text and x->>'needsHelp'='true'
   ) then raise exception 'mesh_no_hand'; end if;
   perform public.vibe_live_command('ack',p_class,p_room,null,jsonb_build_object('studentId',target_student));
   update vibe_live.mesh_pilot_seats set speaking=false where room_id=p_room and speaking and student_id<>target_student;
   update vibe_live.mesh_pilot_seats set speaking=true where room_id=p_room and student_id=target_student;
 elsif p_action='revoke' then
   update vibe_live.mesh_pilot_seats set speaking=false where room_id=p_room and student_id=target_student;
 end if;

 select coalesce(jsonb_agg(jsonb_build_object(
   'studentId',s.student_id,'epoch',s.epoch,'speaking',s.speaking,
   'offer',case when not teacher then s.offer end,'answer',case when teacher then s.answer end
 ) order by s.seat),'[]'::jsonb) into peers
 from vibe_live.mesh_pilot_seats s where s.room_id=p_room and pilot.teacher_client is not null
   and s.learner_client is not null and (teacher or s.student_id=caller_student);

 return jsonb_build_object('role',case when teacher then 'teacher' else 'learner' end,
   'peers',peers,'fallback',false,'expiresAt',live_room.expires_at);
end $$;
create or replace function vibe_live.mesh_room_closed() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='ended' then
   delete from vibe_live.mesh_pilot where room_id=new.id;
 elsif new.status='paused' then
   update vibe_live.mesh_pilot set teacher_client=null,teacher_seen=null where room_id=new.id;
   update vibe_live.mesh_pilot_seats set seat=null,learner_client=null,learner_seen=null,
     offer=null,answer=null,speaking=false,epoch=epoch+1 where room_id=new.id;
 end if;
 return new;
end $$;
commit;
