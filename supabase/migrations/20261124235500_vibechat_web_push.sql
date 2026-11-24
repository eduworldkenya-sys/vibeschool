-- Closed-app notification delivery. No scheduler or credentials activated here.
begin;
-- access: service-only private.vibechat_push_devices
-- authorization-test: private.vibechat_push_devices; scripts/test-vibechat-web-push.mjs
create table private.vibechat_push_devices(
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references public.profiles(id) on delete cascade,
 session_id uuid not null,
 endpoint text not null unique,
 p256dh text not null,
 auth_key text not null,
 updated_at timestamptz not null default now()
);
alter table private.vibechat_push_devices enable row level security;
revoke all on private.vibechat_push_devices from public,anon,authenticated;

-- access: service-only private.vibechat_push_jobs
-- authorization-test: private.vibechat_push_jobs; scripts/test-vibechat-web-push.mjs
create table private.vibechat_push_jobs(
 id uuid primary key default gen_random_uuid(),
 device_id uuid not null references private.vibechat_push_devices(id) on delete cascade,
 kind text not null check(kind in ('vc','tuition')),
 room_id uuid not null,
 message_id uuid not null,
 sender_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 available_at timestamptz not null default now(),
 attempts integer not null default 0,
 lease_token uuid,
 lease_until timestamptz,
 unique(device_id,kind,message_id)
);
alter table private.vibechat_push_jobs enable row level security;
revoke all on private.vibechat_push_jobs from public,anon,authenticated;
create index vibechat_push_jobs_due on private.vibechat_push_jobs(available_at,created_at);

-- Restrict subscription URLs to known browser push services. No arbitrary callback URLs.
create or replace function private.vibechat_valid_push_endpoint(p_endpoint text)
returns boolean language sql immutable set search_path='' as $endpoint$
 select coalesce(length(p_endpoint) between 30 and 2048 and p_endpoint ~ '^https://(fcm[.]googleapis[.]com/fcm/send/|updates[.]push[.]services[.]mozilla[.]com/wpush/v[12]/|web[.]push[.]apple[.]com/)[A-Za-z0-9._~:%+=/-]+$',false)
$endpoint$;
revoke all on function private.vibechat_valid_push_endpoint(text) from public,anon,authenticated;

create or replace function public.vibechat_register_push(p_endpoint text,p_p256dh text,p_auth text)
returns boolean language plpgsql volatile security definer set search_path='' as $register$
declare actor uuid:=auth.uid(); sid uuid;
begin
 if actor is null or not exists(select 1 from public.profiles p where p.id=actor and p.account_status::text='active' and not coalesce(p.is_anonymized,false)) then raise exception 'Sign-in required' using errcode='42501';end if;
 sid:=nullif(auth.jwt()->>'session_id','')::uuid;
 if sid is null or not exists(select 1 from auth.sessions s where s.id=sid and s.user_id=actor) then raise exception 'Session unavailable' using errcode='42501';end if;
 if not private.vibechat_valid_push_endpoint(p_endpoint) or coalesce(p_p256dh,'') !~ '^[A-Za-z0-9_-]{87}$' or coalesce(p_auth,'') !~ '^[A-Za-z0-9_-]{22}$' then raise exception 'Invalid device subscription' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('vibechat-push:'||actor::text,0));
 if exists(select 1 from private.vibechat_push_devices d where d.endpoint=p_endpoint and d.profile_id<>actor) then raise exception 'Device already registered; create a new browser subscription' using errcode='42501';end if;
 delete from private.vibechat_push_devices d where d.profile_id=actor and not exists(select 1 from auth.sessions s where s.id=d.session_id and s.user_id=actor);
 if not exists(select 1 from private.vibechat_push_devices d where d.endpoint=p_endpoint) and (select count(*) from private.vibechat_push_devices d where d.profile_id=actor)>=8 then raise exception 'Device limit reached' using errcode='22023';end if;
 insert into private.vibechat_push_devices(profile_id,session_id,endpoint,p256dh,auth_key)
 values(actor,sid,p_endpoint,p_p256dh,p_auth)
 on conflict(endpoint) do update set session_id=excluded.session_id,p256dh=excluded.p256dh,auth_key=excluded.auth_key,updated_at=now()
 where vibechat_push_devices.profile_id=actor;
 return found;
end;$register$;
revoke all on function public.vibechat_register_push(text,text,text) from public,anon,authenticated;
grant execute on function public.vibechat_register_push(text,text,text) to authenticated;

create or replace function public.vibechat_unregister_push(p_endpoint text)
returns boolean language plpgsql volatile security definer set search_path='' as $unregister$
begin
 if auth.uid() is null then raise exception 'Sign-in required' using errcode='42501';end if;
 delete from private.vibechat_push_devices where profile_id=auth.uid() and endpoint=p_endpoint;
 return true;
end;$unregister$;
revoke all on function public.vibechat_unregister_push(text) from public,anon,authenticated;
grant execute on function public.vibechat_unregister_push(text) to authenticated;

-- Revalidate both sides of the scoped conversation for every delivery.
-- The service worker never receives names, room IDs or message contents.
create or replace function private.vibechat_push_member(p_user uuid,p_kind text,p_room uuid)
returns boolean language sql stable security definer set search_path='' as $member$
 select exists(select 1 from public.profiles p where p.id=p_user and p.account_status::text='active' and not coalesce(p.is_anonymized,false))
 and case when p_kind='vc' then exists(
  select 1 from public.vc_threads t join public.vc_participants m on m.thread_id=t.id and m.profile_id=p_user and m.left_at is null
  where t.id=p_room and t.type='direct'
  and (select count(*) from public.vc_participants x where x.thread_id=t.id and x.left_at is null)=2
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
 )) else exists(select 1 from public.vibetutor_lesson_messages m where m.id=p_message and m.invitation_id=p_room and m.sender_id=p_sender and m.deleted_at is null) end
 and not exists(select 1 from private.vibechat_receipts r where r.profile_id=d.profile_id and r.kind=p_kind and r.room_id=p_room and r.read_at>=case when p_kind='vc' then (select m.created_at from public.vc_messages m where m.id=p_message) else (select m.created_at from public.vibetutor_lesson_messages m where m.id=p_message) end)
 )
$allowed$;
revoke all on function private.vibechat_push_allowed(uuid,uuid,text,uuid,uuid) from public,anon,authenticated;

create or replace function private.vibechat_enqueue_push()
returns trigger language plpgsql security definer set search_path='' as $enqueue$
declare k text; room uuid;
begin
 if tg_table_name='vc_messages' then k:='vc';room:=new.thread_id;
 else k:='tuition';room:=new.invitation_id;end if;
 -- Select only devices belonging to actual room participants before revalidation.
 insert into private.vibechat_push_jobs(device_id,kind,room_id,message_id,sender_id)
 select d.id,k,room,new.id,new.sender_id
 from private.vibechat_push_devices d
 where d.profile_id<>new.sender_id and (
 (k='vc' and exists(select 1 from public.vc_participants p where p.thread_id=room and p.profile_id=d.profile_id and p.left_at is null))
 or (k='tuition' and exists(select 1 from public.vibetutor_student_invitations i join public.students s on s.id=i.student_id where i.id=room and d.profile_id in (i.tutor_id,s.profile_id)))
 ) and private.vibechat_push_allowed(d.id,new.sender_id,k,room,new.id)
 on conflict(device_id,kind,message_id) do nothing;
 return new;
end;$enqueue$;
revoke all on function private.vibechat_enqueue_push() from public,anon,authenticated;
create trigger vibechat_push_vc after insert on public.vc_messages for each row execute function private.vibechat_enqueue_push();
create trigger vibechat_push_tuition after insert on public.vibetutor_lesson_messages for each row execute function private.vibechat_enqueue_push();

-- Service-only bounded claim, with lease recovery and expiry.
create or replace function public.vibechat_claim_push()
returns jsonb language plpgsql volatile security definer set search_path='' as $claim$
declare result jsonb;
begin
 delete from private.vibechat_push_jobs j where j.created_at<now()-interval '1 day' or (j.attempts>=5 and coalesce(j.lease_until,'-infinity'::timestamptz)<now());
 with candidates as (
  select j.id from private.vibechat_push_jobs j where j.available_at<=now() and coalesce(j.lease_until,'-infinity'::timestamptz)<now()
  order by j.available_at,j.created_at limit 20 for update skip locked
 ), leased as (
  update private.vibechat_push_jobs j set lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=j.attempts+1
  from candidates c where j.id=c.id returning j.*
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'lease',j.lease_token)),'[]'::jsonb) into result from leased j;
 return result;
end;$claim$;
revoke all on function public.vibechat_claim_push() from public,anon,authenticated;
grant execute on function public.vibechat_claim_push() to service_role;

create or replace function public.vibechat_push_delivery(p_id uuid,p_lease uuid)
returns jsonb language sql stable security definer set search_path='' as $delivery$
 select jsonb_build_object('endpoint',d.endpoint,'p256dh',d.p256dh,'auth',d.auth_key)
 from private.vibechat_push_jobs j join private.vibechat_push_devices d on d.id=j.device_id
 where j.id=p_id and j.lease_token=p_lease and j.lease_until>now()
 and private.vibechat_push_allowed(j.device_id,j.sender_id,j.kind,j.room_id,j.message_id)
$delivery$;
revoke all on function public.vibechat_push_delivery(uuid,uuid) from public,anon,authenticated;
grant execute on function public.vibechat_push_delivery(uuid,uuid) to service_role;

create or replace function public.vibechat_finish_push(p_id uuid,p_lease uuid,p_outcome text)
returns boolean language plpgsql volatile security definer set search_path='' as $finish$
declare device uuid;
begin
 select j.device_id into device from private.vibechat_push_jobs j where j.id=p_id and j.lease_token=p_lease and j.lease_until>now() for update;
 if not found then return false;end if;
 if p_outcome='expired' then delete from private.vibechat_push_devices where id=device;
 elsif p_outcome='retry' then update private.vibechat_push_jobs set lease_token=null,lease_until=null,available_at=now()+make_interval(secs=>least(900,30*power(2,attempts)::integer)) where id=p_id;
 elsif p_outcome in ('sent','skipped','failed') then delete from private.vibechat_push_jobs where id=p_id;
 else raise exception 'Invalid delivery outcome' using errcode='22023';end if;
 return true;
end;$finish$;
revoke all on function public.vibechat_finish_push(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.vibechat_finish_push(uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
