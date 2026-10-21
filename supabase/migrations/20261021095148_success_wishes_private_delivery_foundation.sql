-- Canonical additive Success Wishes foundation; feature and M-Pesa remain disabled.
-- This migration is reviewed in disposable PostgreSQL before live deployment.
-- Do NOT enable public sending on application or payment infrastructure by applying this file.
-- access: service-only public.success_wishes_schools
-- authorization-test: public.success_wishes_schools
-- access: service-only public.success_wishes_inboxes
-- authorization-test: public.success_wishes_inboxes
-- access: service-only public.success_wishes_sessions
-- authorization-test: public.success_wishes_sessions
-- access: service-only public.success_wishes_messages
-- authorization-test: public.success_wishes_messages
-- access: service-only public.success_wishes_reports
-- authorization-test: public.success_wishes_reports
-- access: service-only public.success_wishes_audit
-- authorization-test: public.success_wishes_audit
-- access: service-only public.success_wishes_attempts
-- authorization-test: public.success_wishes_attempts
-- Requires canonical schools/students/student_classes/classes, is_school_admin,
-- is_operational_school, and pgcrypto installed in extensions.
begin;

create table public.success_wishes_schools (
  school_id uuid primary key references public.schools(id),
  enabled boolean not null default false,
  sponsored_text boolean not null default false,
  expires_at timestamptz not null default now() + interval '60 days',
  retention_days integer not null default 60 check (retention_days between 1 and 365),
  max_media_seconds integer not null default 60 check (max_media_seconds between 1 and 120),
  max_media_bytes bigint not null default 52428800 check (max_media_bytes between 1 and 104857600)
);
create table public.success_wishes_inboxes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.success_wishes_schools(school_id),
  student_id uuid not null references public.students(id),
  access_code_hash text not null check (access_code_hash ~ '^[0-9a-f]{64}$'),
  access_epoch bigint not null default 1 check (access_epoch > 0),
  expires_at timestamptz not null,
  unique (school_id, student_id)
);
create table public.success_wishes_sessions (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  inbox_id uuid not null references public.success_wishes_inboxes(id) on delete cascade,
  access_epoch bigint not null check (access_epoch > 0),
  expires_at timestamptz not null
);
create index on public.success_wishes_sessions(inbox_id);
create index on public.success_wishes_sessions(expires_at);
create table public.success_wishes_messages (
  id uuid primary key default gen_random_uuid(),
  inbox_id uuid not null references public.success_wishes_inboxes(id) on delete cascade,
  sender_name text not null check (length(trim(sender_name)) between 1 and 100),
  relationship text not null check (length(trim(relationship)) between 1 and 60),
  format text not null check (format in ('text','voice','video')),
  body text check (body is null or length(body) <= 3000),
  media_provider text,
  media_asset_id text,
  media_status text not null default 'pending' check (media_status in ('pending','ready','failed')),
  management_token_hash text not null unique check (management_token_hash ~ '^[0-9a-f]{64}$'),
  idempotency_key text not null unique check (length(idempotency_key) between 16 and 128),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','sponsored','refunded')),
  state text not null default 'request' check (state in ('request','available','blocked','withdrawn','expired','reported')),
  expires_at timestamptz not null,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  unique(id,inbox_id),
  check ((format='text' and media_asset_id is null
      and (length(trim(coalesce(body,'')))>0 or (body is null and state in ('withdrawn','expired'))))
    or (format in ('voice','video') and length(trim(coalesce(media_provider,'')))>0
      and length(trim(coalesce(media_asset_id,'')))>0)),
  check (payment_status <> 'sponsored' or format='text'),
  check (state <> 'available' or (payment_status in ('paid','sponsored')
    and (format='text' or media_status='ready')))
);
create index on public.success_wishes_messages(inbox_id,created_at desc);
create table public.success_wishes_reports (
  id uuid primary key default gen_random_uuid(),
  inbox_id uuid not null references public.success_wishes_inboxes(id) on delete cascade,
  message_id uuid not null,
  reason text not null check (length(trim(reason)) between 1 and 1000),
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(),
  foreign key(message_id,inbox_id) references public.success_wishes_messages(id,inbox_id) on delete cascade
);
create table public.success_wishes_audit (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  inbox_id uuid references public.success_wishes_inboxes(id) on delete set null,
  actor_id uuid references public.profiles(id),
  event text not null check (length(event) between 1 and 100),
  created_at timestamptz not null default now()
);
create table public.success_wishes_attempts (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started timestamptz not null,
  attempts integer not null check (attempts > 0)
);
create index on public.success_wishes_attempts(window_started);

-- These domain tables are private to trusted server code. Staff RPC below is
-- the only authenticated write surface; it cannot return private messages.
alter table public.success_wishes_schools enable row level security;
alter table public.success_wishes_inboxes enable row level security;
alter table public.success_wishes_sessions enable row level security;
alter table public.success_wishes_messages enable row level security;
alter table public.success_wishes_reports enable row level security;
alter table public.success_wishes_audit enable row level security;
alter table public.success_wishes_attempts enable row level security;
revoke all on public.success_wishes_schools, public.success_wishes_inboxes,
  public.success_wishes_sessions, public.success_wishes_messages,
  public.success_wishes_reports, public.success_wishes_audit,
  public.success_wishes_attempts from public, anon, authenticated;
grant select,insert,update,delete on public.success_wishes_schools,
  public.success_wishes_inboxes, public.success_wishes_sessions,
  public.success_wishes_messages, public.success_wishes_reports,
  public.success_wishes_audit, public.success_wishes_attempts to service_role;

-- Atomic fixed-window limiter; a single upsert serializes concurrent attempts.
create function public.success_wishes_take_attempt(
  p_key_hash text,p_limit integer,p_window_seconds integer
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$'
    or p_limit is null or p_limit not between 1 and 10000
    or p_window_seconds is null or p_window_seconds not between 1 and 86400
  then raise exception 'invalid_attempt_limit'; end if;
  insert into public.success_wishes_attempts as a(key_hash,window_started,attempts)
  values(p_key_hash,clock_timestamp(),1)
  on conflict(key_hash) do update set
    window_started=case when a.window_started <= clock_timestamp()-make_interval(secs=>p_window_seconds)
      then clock_timestamp() else a.window_started end,
    attempts=case when a.window_started <= clock_timestamp()-make_interval(secs=>p_window_seconds)
      then 1 else least(a.attempts+1,10001) end
  returning attempts into n;
  return n <= p_limit;
end; $$;
revoke all on function public.success_wishes_take_attempt(text,integer,integer) from public,anon,authenticated;
grant execute on function public.success_wishes_take_attempt(text,integer,integer) to service_role;

-- Match only a pre-issued inbox; never create identities or expose student data.
create function public.success_wishes_match_recipient(
  p_school_id uuid,p_admission_number text,p_name text
) returns uuid language plpgsql stable security invoker set search_path = '' as $$
declare n integer; learner uuid; result uuid;
begin
  if length(trim(coalesce(p_admission_number,''))) not between 1 and 80
    or length(trim(coalesce(p_name,''))) not between 1 and 200 then return null; end if;
  if not exists(select 1 from public.success_wishes_schools w join public.schools s on s.id=w.school_id
    where w.school_id=p_school_id and w.enabled and w.expires_at>now()
      and s.deleted_at is null and s.status in ('pending','active')) then return null; end if;
  select count(distinct s.id) into n from public.students s
    join public.student_classes sc on sc.student_id=s.id
    join public.classes c on c.id=sc.class_id and c.school_id=sc.school_id
    where sc.school_id=p_school_id and sc.is_current and sc.left_at is null and s.deleted_at is null
      and lower(trim(s.admission_number))=lower(trim(p_admission_number));
  if n<>1 then return null; end if;
  select distinct s.id into learner from public.students s
    join public.student_classes sc on sc.student_id=s.id
    join public.classes c on c.id=sc.class_id and c.school_id=sc.school_id
    where sc.school_id=p_school_id and sc.is_current and sc.left_at is null and s.deleted_at is null
      and lower(trim(s.admission_number))=lower(trim(p_admission_number))
      and lower(regexp_replace(trim(s.name),'\s+',' ','g'))=lower(regexp_replace(trim(p_name),'\s+',' ','g'));
  if learner is null then return null; end if;
  select i.id into result from public.success_wishes_inboxes i
    where i.school_id=p_school_id and i.student_id=learner and i.expires_at>now();
  return result;
end; $$;
revoke all on function public.success_wishes_match_recipient(uuid,text,text) from public,anon,authenticated;
grant execute on function public.success_wishes_match_recipient(uuid,text,text) to service_role;

-- The server authenticates the inbox before calling this service-only boundary.
-- A lock serializes competing accept/block/report/withdraw/expiry operations.
create function public.success_wishes_message_action(
  p_inbox_id uuid,p_message_id uuid,p_action text,p_reason text default null
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare m public.success_wishes_messages%rowtype; v_school uuid;
begin
  if p_action is null or p_action not in ('accept','block','report') then return false; end if;
  select w.school_id into v_school from public.success_wishes_inboxes i
    join public.success_wishes_schools w on w.school_id=i.school_id
    join public.schools s on s.id=w.school_id
    where i.id=p_inbox_id and i.expires_at>now() and w.enabled and w.expires_at>now()
      and s.deleted_at is null and s.status in ('pending','active')
      and exists(select 1 from public.student_classes sc
        join public.students st on st.id=sc.student_id and st.deleted_at is null
        join public.classes c on c.id=sc.class_id and c.school_id=sc.school_id
        where sc.student_id=i.student_id and sc.school_id=i.school_id and sc.is_current and sc.left_at is null);
  if v_school is null then return false; end if;
  select * into m from public.success_wishes_messages where id=p_message_id and inbox_id=p_inbox_id for update;
  if not found or m.expires_at<=now() or m.state not in ('request','available') then return false; end if;
  if p_action='accept' then
    if m.state<>'request' or m.payment_status not in ('paid','sponsored')
      or (m.format<>'text' and m.media_status<>'ready')
      or (m.payment_status='sponsored' and not exists(select 1 from public.success_wishes_schools
        where school_id=v_school and sponsored_text and m.format='text')) then return false; end if;
    update public.success_wishes_messages set state='available' where id=m.id;
  elsif p_action='block' then
    update public.success_wishes_messages set state='blocked' where id=m.id;
  else
    if length(trim(coalesce(p_reason,''))) not between 1 and 1000 then return false; end if;
    insert into public.success_wishes_reports(inbox_id,message_id,reason) values(p_inbox_id,m.id,trim(p_reason));
    update public.success_wishes_messages set state='reported' where id=m.id;
  end if;
  insert into public.success_wishes_audit(school_id,inbox_id,event)
    values(v_school,p_inbox_id,'message_'||p_action||':'||m.id::text);
  return true;
end; $$;
revoke all on function public.success_wishes_message_action(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.success_wishes_message_action(uuid,uuid,text,text) to service_role;

-- Bounded cleanup is explicitly invoked by trusted operations, not scheduled here.
-- Provider media deletion requires external reconciliation before row deletion.
create function public.success_wishes_cleanup(p_limit integer default 500)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare t integer; s integer; a integer;
begin
  if p_limit is null or p_limit not between 1 and 1000 then raise exception 'invalid_cleanup_limit'; end if;
  with batch as (select id from public.success_wishes_messages
    where format='text' and expires_at<=now() and (state<>'expired' or body is not null)
    order by expires_at limit p_limit for update skip locked)
  update public.success_wishes_messages set state='expired',body=null where id in(select id from batch);
  get diagnostics t = row_count;
  with batch as (select token_hash from public.success_wishes_sessions
    where expires_at<=now() order by expires_at limit p_limit for update skip locked)
  delete from public.success_wishes_sessions where token_hash in(select token_hash from batch);
  get diagnostics s = row_count;
  with batch as (select key_hash from public.success_wishes_attempts
    where window_started<now()-interval '1 day' order by window_started limit p_limit for update skip locked)
  delete from public.success_wishes_attempts where key_hash in(select key_hash from batch);
  get diagnostics a = row_count;
  return jsonb_build_object('text_expired',t,'sessions_deleted',s,'attempts_deleted',a);
end; $$;
revoke all on function public.success_wishes_cleanup(integer) from public,anon,authenticated;
grant execute on function public.success_wishes_cleanup(integer) to service_role;

-- School staff issue/reset a separate inbox capability, not an account claim.
-- The 128-bit code is returned ONCE. No birthday, PIN or raw code is persisted.
create function public.success_wishes_reset_access(p_school_id uuid,p_student_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare secret text; v_inbox uuid; v_expiry timestamptz; n integer;
begin
  if auth.uid() is null or not public.is_school_admin(p_school_id)
    or not public.is_operational_school(p_school_id)
    or not exists(select 1 from public.profiles p where p.id=auth.uid()
      and p.account_status::text='active' and not p.is_anonymized)
  then raise exception 'not_authorized' using errcode='42501'; end if;
  select least(w.expires_at,now()+make_interval(days=>w.retention_days)) into v_expiry
    from public.success_wishes_schools w where w.school_id=p_school_id and w.enabled and w.expires_at>now();
  if v_expiry is null then raise exception 'school_unavailable'; end if;
  select count(distinct s.id) into n from public.students s
    join public.student_classes sc on sc.student_id=s.id
    join public.classes c on c.id=sc.class_id and c.school_id=sc.school_id
    where s.id=p_student_id and s.deleted_at is null and sc.school_id=p_school_id
      and sc.is_current and sc.left_at is null;
  if n<>1 then raise exception 'recipient_unavailable'; end if;
  secret:=upper(encode(extensions.gen_random_bytes(16),'hex'));
  insert into public.success_wishes_inboxes(school_id,student_id,access_code_hash,expires_at)
    values(p_school_id,p_student_id,encode(extensions.digest('success-wishes:inbox:'||secret,'sha256'),'hex'),v_expiry)
    on conflict(school_id,student_id) do update set access_code_hash=excluded.access_code_hash,
      access_epoch=public.success_wishes_inboxes.access_epoch+1,expires_at=excluded.expires_at
    returning id into v_inbox;
  delete from public.success_wishes_sessions where inbox_id=v_inbox;
  insert into public.success_wishes_audit(school_id,inbox_id,actor_id,event)
    values(p_school_id,v_inbox,auth.uid(),'access_code_issued');
  return jsonb_build_object('inbox_id',v_inbox,'access_code',secret,'expires_at',v_expiry);
end; $$;
revoke all on function public.success_wishes_reset_access(uuid,uuid) from public,anon;
grant execute on function public.success_wishes_reset_access(uuid,uuid) to authenticated;

-- Participating schools must explicitly opt in. A school cannot grant itself
-- free sponsorship or turn on payment/media provider infrastructure.
create function public.success_wishes_set_school_participation(
  p_school_id uuid, p_opt_in boolean, p_confirm_school_consent boolean
) returns boolean language plpgsql security definer set search_path = '' as $wishes$
begin
  if auth.uid() is null or p_school_id is null or p_opt_in is null
    or not public.is_school_admin(p_school_id)
    or not public.is_operational_school(p_school_id)
    or not exists (
      select 1 from public.profiles p where p.id=auth.uid()
        and p.account_status::text='active' and not p.is_anonymized
    ) then raise exception 'not_authorized' using errcode='42501'; end if;
  if p_opt_in and p_confirm_school_consent is distinct from true
    then raise exception 'school_consent_required' using errcode='23514'; end if;
  insert into public.success_wishes_schools (school_id, enabled, sponsored_text, expires_at)
    values (p_school_id, p_opt_in, false, now()+interval '60 days')
  on conflict (school_id) do update
    set enabled=excluded.enabled,
      sponsored_text=case when p_opt_in then public.success_wishes_schools.sponsored_text else false end,
      expires_at=case when p_opt_in then greatest(public.success_wishes_schools.expires_at, excluded.expires_at)
        else now() end;
  if not p_opt_in then
    -- Access is revoked immediately by server eligibility checks.
    delete from public.success_wishes_sessions s
      using public.success_wishes_inboxes i
      where s.inbox_id=i.id and i.school_id=p_school_id;
  end if;
  insert into public.success_wishes_audit(school_id,actor_id,event)
    values (p_school_id,auth.uid(),case when p_opt_in then 'school_opted_in' else 'school_opted_out' end);
  return true;
end; $wishes$;
revoke all on function public.success_wishes_set_school_participation(uuid,boolean,boolean)
  from public,anon;
grant execute on function public.success_wishes_set_school_participation(uuid,boolean,boolean)
  to authenticated;


-- Reports can be resolved by a current school administrator. Neither the RPC
-- nor the staff report queue exposes message bodies or media access.
create function public.success_wishes_resolve_report(
  p_school_id uuid, p_report_id uuid
) returns boolean language plpgsql security definer set search_path = '' as $wishes$
declare v_inbox uuid;
begin
  if auth.uid() is null or p_school_id is null or p_report_id is null
    or not public.is_school_admin(p_school_id)
    or not public.is_operational_school(p_school_id)
    or not exists (
      select 1 from public.profiles p where p.id=auth.uid()
        and p.account_status::text='active' and not p.is_anonymized
    ) then raise exception 'not_authorized' using errcode='42501'; end if;
  select r.inbox_id into v_inbox from public.success_wishes_reports r
    join public.success_wishes_inboxes i on i.id=r.inbox_id
    where r.id=p_report_id and i.school_id=p_school_id and r.status='open'
    for update of r;
  if v_inbox is null then return false; end if;
  update public.success_wishes_reports set status='resolved' where id=p_report_id and status='open';
  insert into public.success_wishes_audit (school_id,inbox_id,actor_id,event)
    values (p_school_id,v_inbox,auth.uid(),'report_resolved:'||p_report_id::text);
  return true;
end; $wishes$;
revoke all on function public.success_wishes_resolve_report(uuid,uuid) from public,anon;
grant execute on function public.success_wishes_resolve_report(uuid,uuid) to authenticated;

commit;
