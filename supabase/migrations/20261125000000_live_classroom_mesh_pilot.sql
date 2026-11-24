-- No rooms or seats are provisioned by this migration.
begin;

-- access: owner-only vibe_live.mesh_pilot
-- authorization-test: vibe_live.mesh_pilot denies direct access in scripts/test-live-mesh.mjs.
create table vibe_live.mesh_pilot (
 room_id uuid primary key references vibe_live.sessions(id) on delete cascade,
 teacher_user uuid not null references auth.users(id) on delete cascade,
 verified_adults_at timestamptz not null,
 expires_at timestamptz not null,
 teacher_client uuid,
 teacher_seen timestamptz,
 daily_fallback boolean not null default false,
 check (expires_at > verified_adults_at and expires_at <= verified_adults_at + interval '2 hours')
);

-- access: owner-only vibe_live.mesh_pilot_seats
-- authorization-test: vibe_live.mesh_pilot_seats denies direct access in scripts/test-live-mesh.mjs.
create table vibe_live.mesh_pilot_seats (
 room_id uuid not null references vibe_live.mesh_pilot(room_id) on delete cascade,
 seat integer not null check (seat between 1 and 8),
 learner_user uuid not null references auth.users(id) on delete cascade,
 student_id uuid not null references public.students(id) on delete cascade,
 learner_client uuid,
 learner_seen timestamptz,
 epoch bigint not null default 0,
 offer text check (octet_length(offer) <= 24000),
 answer text check (octet_length(answer) <= 24000),
 speaking boolean not null default false,
 primary key (room_id, student_id),
 unique (room_id, learner_user),
 unique (room_id, seat)
);
create unique index mesh_one_speaking_learner on vibe_live.mesh_pilot_seats(room_id) where speaking;
alter table vibe_live.mesh_pilot enable row level security;
alter table vibe_live.mesh_pilot_seats enable row level security;
revoke all on vibe_live.mesh_pilot, vibe_live.mesh_pilot_seats from public, anon, authenticated, service_role;

create function vibe_live.mesh_command(p_room uuid,p_class uuid,p_action text,p_client uuid,p_epoch bigint,p_sdp text,p_target uuid)
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
begin
 if caller is null or p_client is null or p_action is null
   or p_action not in ('join','poll','offer','answer','allow','revoke','leave','fallback') then
   raise exception 'mesh_denied' using errcode='42501';
 end if;
 if not exists(
   select 1 from vibe_live.mesh_pilot p where p.room_id=p_room
     and (p.teacher_user=caller or exists(
       select 1 from vibe_live.mesh_pilot_seats s where s.room_id=p_room and s.learner_user=caller
     ))
 ) then
   if p_action='join' then raise exception 'mesh_unavailable' using errcode='P0002'; end if;
   raise exception 'mesh_denied' using errcode='42501';
 end if;
 -- Session, then pilot, then seat. Allow calls the canonical host action.
 if p_action='allow' then
   select * into live_room from vibe_live.sessions where id=p_room for update;
 else
   select * into live_room from vibe_live.sessions where id=p_room for share;
 end if;
 select * into pilot from vibe_live.mesh_pilot where room_id=p_room for update;
 t := clock_timestamp();
 if pilot.room_id is null or pilot.expires_at<=t or pilot.verified_adults_at>t
   or live_room.teacher_id is distinct from pilot.teacher_user
   or not vibe_live.host_allowed(pilot.teacher_user,live_room.mode,live_room.class_id,live_room.school_id,live_room.group_id) then
   raise exception 'mesh_denied' using errcode='42501';
 end if;
 teacher := caller=pilot.teacher_user;
 room := public.vibe_live_command('get',p_class,p_room,null,'{}'::jsonb);
 if room->>'id' is distinct from p_room::text or room->>'status' is distinct from 'active'
   or room->>'teacher' is distinct from teacher::text or live_room.expires_at<=t then
   raise exception 'mesh_denied' using errcode='42501';
 end if;

 if not teacher then
   -- Protect existing seats against identity relinking or ambiguous profiles.
   select s.student_id into caller_student from vibe_live.mesh_pilot_seats s
   join public.students st on st.id=s.student_id and st.profile_id=caller and st.deleted_at is null
   where s.room_id=p_room and s.learner_user=caller
     and (select count(*) from public.students x where x.profile_id=caller and x.deleted_at is null)=1
     and vibe_live.can_join(st.id,pilot.teacher_user,live_room.mode,live_room.class_id,live_room.school_id,live_room.group_id)
     and exists(select 1 from vibe_live.participants m where m.session_id=p_room and m.student_id=st.id)
     and (live_room.mode<>'open' or exists(
       select 1 from vibe_live.waiting_requests w where w.session_id=p_room and w.student_id=st.id and w.status='admitted'));
   if caller_student is null or p_target is not null or p_action in ('offer','allow','revoke','fallback') then
     raise exception 'mesh_denied' using errcode='42501';
   end if;
 elsif p_action='answer' then
   raise exception 'mesh_denied' using errcode='42501';
 end if;

 -- Explicit host fallback or an ordinary classroom participant joining the
 -- pilot room closes every edge atomically. Avoid splitting one class by provider.
 if teacher and not pilot.daily_fallback and (p_action='fallback' or exists (
   select 1 from jsonb_array_elements(coalesce(room->'participants','[]'::jsonb)) x
   where not exists (
     select 1 from vibe_live.mesh_pilot_seats s where s.room_id=p_room and s.student_id::text=x->>'studentId'
   )
 )) then
   update vibe_live.mesh_pilot set daily_fallback=true,teacher_client=null,teacher_seen=null where room_id=p_room
     returning * into pilot;
   update vibe_live.mesh_pilot_seats set learner_client=null,learner_seen=null,
     epoch=epoch+1,offer=null,answer=null,speaking=false where room_id=p_room;
 end if;
 if pilot.daily_fallback then
   return jsonb_build_object('role',case when teacher then 'teacher' else 'learner' end,
     'peers','[]'::jsonb,'fallback',true,'expiresAt',least(pilot.expires_at,live_room.expires_at));
 end if;

 -- A dead device or a lesson entitlement change invalidates its private edge.
 if pilot.teacher_client is not null and pilot.teacher_seen<t-interval '16 seconds' then
   update vibe_live.mesh_pilot set teacher_client=null,teacher_seen=null where room_id=p_room returning * into pilot;
   update vibe_live.mesh_pilot_seats set offer=null,answer=null,speaking=false,epoch=epoch+1 where room_id=p_room;
 end if;
 update vibe_live.mesh_pilot_seats s set learner_client=null,learner_seen=null,offer=null,answer=null,speaking=false,epoch=epoch+1
 where s.room_id=p_room and s.learner_client is not null and (
   s.learner_seen<t-interval '16 seconds'
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
     update vibe_live.mesh_pilot_seats set learner_client=null,learner_seen=null,offer=null,answer=null,speaking=false,epoch=epoch+1
       where room_id=p_room and student_id=caller_student;
   elsif p_action='join' and peer.learner_client is null then
     update vibe_live.mesh_pilot_seats set learner_client=p_client,learner_seen=t,epoch=epoch+1
       where room_id=p_room and student_id=caller_student;
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
   'peers',peers,'fallback',false,'expiresAt',least(pilot.expires_at,live_room.expires_at));
end $$;
revoke all on function vibe_live.mesh_command(uuid,uuid,text,uuid,bigint,text,uuid) from public,anon,authenticated,service_role;
grant execute on function vibe_live.mesh_command(uuid,uuid,text,uuid,bigint,text,uuid) to authenticated;
create function public.vibe_live_mesh(p_room uuid,p_class uuid,p_action text,p_client uuid,p_epoch bigint default null,p_sdp text default null,p_target uuid default null)
returns jsonb language sql security invoker set search_path='' as $$
 select vibe_live.mesh_command(p_room,p_class,p_action,p_client,p_epoch,p_sdp,p_target);
$$;
revoke all on function public.vibe_live_mesh(uuid,uuid,text,uuid,bigint,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.vibe_live_mesh(uuid,uuid,text,uuid,bigint,text,uuid) to authenticated;

create function vibe_live.mesh_room_closed() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='ended' then
   delete from vibe_live.mesh_pilot where room_id=new.id;
 elsif new.status='paused' then
   update vibe_live.mesh_pilot set teacher_client=null,teacher_seen=null where room_id=new.id;
   update vibe_live.mesh_pilot_seats set learner_client=null,learner_seen=null,
     offer=null,answer=null,speaking=false,epoch=epoch+1 where room_id=new.id;
 end if;
 return new;
end $$;
revoke all on function vibe_live.mesh_room_closed() from public,anon,authenticated,service_role;
create trigger live_mesh_room_closed after update of status on vibe_live.sessions
 for each row when (old.status is distinct from new.status and new.status in ('paused','ended'))
 execute function vibe_live.mesh_room_closed();

commit;
