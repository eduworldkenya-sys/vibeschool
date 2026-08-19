-- VibeSchool Task 12: reconciled pilot telemetry, observability and product analytics foundation.
-- Built on canonical main after Worker lineage merge. Production remains migration-disconnected until promotion.

begin;

alter table public.platform_events
  add column if not exists journey text,
  add column if not exists surface text,
  add column if not exists outcome text,
  add column if not exists failure_class text,
  add column if not exists error_code text,
  add column if not exists latency_ms integer,
  add column if not exists correlation_id uuid,
  add column if not exists session_id uuid,
  add column if not exists source text,
  add column if not exists authoritative boolean not null default false,
  add column if not exists network_class text,
  add column if not exists app_version text;

alter table public.platform_events drop constraint if exists platform_events_outcome_check;
alter table public.platform_events add constraint platform_events_outcome_check
  check (outcome is null or outcome in ('attempted','succeeded','failed','denied','cancelled')) not valid;

alter table public.platform_events drop constraint if exists platform_events_failure_class_check;
alter table public.platform_events add constraint platform_events_failure_class_check
  check (failure_class is null or failure_class in ('authentication','authorization','identity','database','rpc','network','content','validation','application','external_integration','unknown')) not valid;

alter table public.platform_events drop constraint if exists platform_events_network_class_check;
alter table public.platform_events add constraint platform_events_network_class_check
  check (network_class is null or network_class in ('online','slow','timeout','offline','unknown')) not valid;

alter table public.platform_events drop constraint if exists platform_events_latency_check;
alter table public.platform_events add constraint platform_events_latency_check
  check (latency_ms is null or latency_ms between 0 and 3600000) not valid;

create index if not exists platform_events_journey_time_idx
  on public.platform_events (journey, occurred_at desc) where journey is not null;
create index if not exists platform_events_outcome_time_idx
  on public.platform_events (outcome, occurred_at desc) where outcome is not null;
create index if not exists platform_events_correlation_idx
  on public.platform_events (correlation_id, occurred_at) where correlation_id is not null;
create index if not exists platform_events_failure_idx
  on public.platform_events (failure_class, error_code, occurred_at desc) where outcome in ('failed','denied');

create table if not exists public.pilot_event_contract (
  event_name text primary key,
  journey text not null,
  stage text not null,
  success_semantics text not null,
  authoritative_required boolean not null default false,
  allowed_roles text[] not null default '{}',
  metadata_keys text[] not null default '{}',
  activation_role text,
  retention_days integer not null default 90 check (retention_days between 7 and 730),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pilot_event_contract enable row level security;
revoke all on public.pilot_event_contract from public, anon, authenticated;
drop policy if exists pilot_event_contract_authenticated_read on public.pilot_event_contract;

insert into public.pilot_event_contract(event_name,journey,stage,success_semantics,authoritative_required,allowed_roles,metadata_keys,activation_role) values
('auth.login_started','authentication','login_started','User submitted a sign-in attempt',false,array['teacher','student','parent','admin','global_user'],array['method'],null),
('auth.login_succeeded','authentication','authentication_success','Supabase Auth returned an authenticated user',false,array['teacher','student','parent','admin','global_user'],array['method'],null),
('auth.login_failed','authentication','authentication_failure','Authentication attempt failed',false,array['teacher','student','parent','admin','global_user'],array['method'],null),
('auth.identity_resolved','authentication','identity_resolution','Canonical application identity and role resolved',true,array['teacher','student','parent','admin','global_user'],array[]::text[],null),
('auth.identity_failed','authentication','identity_resolution_failure','Identity resolution failed',true,array['teacher','student','parent','admin','global_user'],array[]::text[],null),
('auth.onboarding_resolved','onboarding','onboarding_resolution','Onboarding state and safe destination resolved',true,array['teacher','student','parent','admin','global_user'],array['state'],null),
('auth.dashboard_reached','authentication','dashboard','Authorized dashboard destination reached',false,array['teacher','student','parent','admin','global_user'],array[]::text[],null),
('teacher.useful_action_committed','teacher','activation','A real classroom or teaching operation committed',true,array['teacher'],array['action_type'],'teacher'),
('student.learning_activity_committed','student','activation','Meaningful learning activity committed',true,array['student'],array['activity_type'],'student'),
('student.progress_saved','student','progress_saved','Learning progress persisted authoritatively',true,array['student'],array['content_type'],null),
('student.resume_succeeded','student','resume','Previous learning state was restored successfully',true,array['student'],array['content_type'],null),
('parent.child_insight_viewed','parent','activation','Verified parent viewed useful child information',true,array['parent'],array['insight_type'],'parent'),
('admin.school_operation_committed','admin','activation','Legitimate school operation committed',true,array['admin'],array['operation_type'],'admin'),
('vibelearn.content_requested','vibelearn','content_requested','User requested an approved learning asset',false,array['student','teacher','parent','admin','global_user'],array['content_type'],null),
('vibelearn.content_opened','vibelearn','content_opened','Learning asset rendered and became usable',false,array['student','teacher','parent','admin','global_user'],array['content_type'],null),
('vibelearn.render_failed','vibelearn','render_failure','Learning asset failed to render',false,array['student','teacher','parent','admin','global_user'],array['content_type'],null),
('assessment.submit_committed','assessment','submission','Assessment submission committed',true,array['student','teacher'],array['assessment_type'],null),
('assessment.submit_failed','assessment','submission_failure','Assessment submission failed',true,array['student','teacher'],array['assessment_type'],null),
('security.authorization_denied','security','authorization_denied','Protected operation was denied',true,array['teacher','student','parent','admin','global_user'],array['resource_type'],null),
('payment.completed','payments','payment_completed','Payment completion is authoritative',true,array['parent','teacher','admin','global_user'],array['provider'],null),
('worker.execution_verified','worker_engine','execution_verified','Consequential worker execution independently verified',true,array[]::text[],array['worker_key'],null)
on conflict (event_name) do update set journey=excluded.journey, stage=excluded.stage, success_semantics=excluded.success_semantics,
  authoritative_required=excluded.authoritative_required, allowed_roles=excluded.allowed_roles, metadata_keys=excluded.metadata_keys,
  activation_role=excluded.activation_role, updated_at=now(), active=true;

create or replace function public.pilot_sanitize_event_metadata(p_metadata jsonb, p_allowed text[])
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb)
  from jsonb_each(coalesce(p_metadata,'{}'::jsonb)) e
  where e.key = any(coalesce(p_allowed,'{}'::text[]))
    and lower(e.key) <> all(array['password','token','access_token','refresh_token','authorization','cookie','secret','answer','message','prompt','conversation','email','phone','name']);
$$;
revoke all on function public.pilot_sanitize_event_metadata(jsonb,text[]) from public, anon, authenticated;

create or replace function public.pilot_record_event(
  p_event_name text,
  p_surface text,
  p_outcome text,
  p_correlation_id uuid default null,
  p_session_id uuid default null,
  p_entity_type text default 'application',
  p_entity_id uuid default null,
  p_school_id uuid default null,
  p_failure_class text default null,
  p_error_code text default null,
  p_latency_ms integer default null,
  p_network_class text default null,
  p_app_version text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_idempotency_key text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_contract public.pilot_event_contract%rowtype;
  v_role text;
  v_school_id uuid;
  v_id uuid;
  v_metadata jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select role::text, school_id into v_role, v_school_id from public.profiles where id=v_uid;
  if v_role is null then raise exception 'ROLE_NOT_RESOLVED' using errcode='42501'; end if;
  select * into v_contract from public.pilot_event_contract where event_name=p_event_name and active=true;
  if not found then raise exception 'UNKNOWN_EVENT_NAME' using errcode='22023'; end if;
  if v_contract.authoritative_required then raise exception 'AUTHORITATIVE_EVENT_REQUIRES_BACKEND' using errcode='42501'; end if;
  if cardinality(v_contract.allowed_roles)>0 and not (v_role=any(v_contract.allowed_roles)) then
    raise exception 'ROLE_NOT_ALLOWED_FOR_EVENT' using errcode='42501';
  end if;
  if p_outcome not in ('attempted','succeeded','failed','denied','cancelled') then raise exception 'INVALID_OUTCOME' using errcode='22023'; end if;
  if p_failure_class is not null and p_failure_class not in ('authentication','authorization','identity','database','rpc','network','content','validation','application','external_integration','unknown') then raise exception 'INVALID_FAILURE_CLASS' using errcode='22023'; end if;
  if p_latency_ms is not null and (p_latency_ms<0 or p_latency_ms>3600000) then raise exception 'INVALID_LATENCY' using errcode='22023'; end if;
  v_metadata := public.pilot_sanitize_event_metadata(p_metadata,v_contract.metadata_keys);
  insert into public.platform_events(event_type,actor_id,actor_role,school_id,entity_type,entity_id,metadata,occurred_at,idempotency_key,
    journey,surface,outcome,failure_class,error_code,latency_ms,correlation_id,session_id,source,authoritative,network_class,app_version)
  values(p_event_name,v_uid,v_role,v_school_id,'application',null,v_metadata,now(),p_idempotency_key,
    v_contract.journey,left(coalesce(p_surface,'unknown'),120),p_outcome,p_failure_class,left(p_error_code,80),p_latency_ms,p_correlation_id,p_session_id,
    'client',false,p_network_class,left(p_app_version,80))
  on conflict (idempotency_key) where idempotency_key is not null do nothing
  returning id into v_id;
  if v_id is null and p_idempotency_key is not null then
    select id into v_id from public.platform_events where idempotency_key=p_idempotency_key and actor_id=v_uid;
  end if;
  return v_id;
end;
$$;
revoke all on function public.pilot_record_event(text,text,text,uuid,uuid,text,uuid,uuid,text,text,integer,text,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.pilot_record_event(text,text,text,uuid,uuid,text,uuid,uuid,text,text,integer,text,text,jsonb,text) to authenticated;

create or replace function public.pilot_record_authoritative_event(
  p_event_name text,
  p_actor_id uuid,
  p_actor_role text,
  p_school_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_outcome text,
  p_correlation_id uuid default null,
  p_failure_class text default null,
  p_error_code text default null,
  p_latency_ms integer default null,
  p_metadata jsonb default '{}'::jsonb,
  p_idempotency_key text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract public.pilot_event_contract%rowtype;
  v_id uuid;
  v_metadata jsonb;
begin
  select * into v_contract from public.pilot_event_contract where event_name=p_event_name and active=true;
  if not found then raise exception 'UNKNOWN_EVENT_NAME' using errcode='22023'; end if;
  if not v_contract.authoritative_required then raise exception 'NON_AUTHORITATIVE_EVENT_NOT_ALLOWED_HERE' using errcode='22023'; end if;
  if p_outcome not in ('attempted','succeeded','failed','denied','cancelled') then raise exception 'INVALID_OUTCOME' using errcode='22023'; end if;
  if p_failure_class is not null and p_failure_class not in ('authentication','authorization','identity','database','rpc','network','content','validation','application','external_integration','unknown') then raise exception 'INVALID_FAILURE_CLASS' using errcode='22023'; end if;
  if p_latency_ms is not null and (p_latency_ms<0 or p_latency_ms>3600000) then raise exception 'INVALID_LATENCY' using errcode='22023'; end if;
  if cardinality(v_contract.allowed_roles)>0 and (p_actor_role is null or not (p_actor_role=any(v_contract.allowed_roles))) then
    raise exception 'ROLE_NOT_ALLOWED_FOR_EVENT' using errcode='22023';
  end if;
  v_metadata := public.pilot_sanitize_event_metadata(p_metadata,v_contract.metadata_keys);
  insert into public.platform_events(event_type,actor_id,actor_role,school_id,entity_type,entity_id,metadata,occurred_at,idempotency_key,
    journey,surface,outcome,failure_class,error_code,latency_ms,correlation_id,source,authoritative)
  values(p_event_name,p_actor_id,p_actor_role,p_school_id,coalesce(nullif(p_entity_type,''),'application'),p_entity_id,v_metadata,now(),p_idempotency_key,
    v_contract.journey,'backend',p_outcome,p_failure_class,left(p_error_code,80),p_latency_ms,p_correlation_id,'backend',true)
  on conflict (idempotency_key) where idempotency_key is not null do nothing returning id into v_id;
  if v_id is null and p_idempotency_key is not null then select id into v_id from public.platform_events where idempotency_key=p_idempotency_key; end if;
  return v_id;
end;
$$;
revoke all on function public.pilot_record_authoritative_event(text,uuid,text,uuid,text,uuid,text,uuid,text,text,integer,jsonb,text) from public, anon, authenticated;
grant execute on function public.pilot_record_authoritative_event(text,uuid,text,uuid,text,uuid,text,uuid,text,text,integer,jsonb,text) to service_role;

create or replace function public.hq_get_pilot_observability_scorecard(p_since timestamptz default now()-interval '7 days')
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v jsonb;
begin
  if auth.uid() is null or not public.is_platform_owner() then raise exception 'HQ_OWNER_REQUIRED' using errcode='42501'; end if;
  with e as (select * from public.platform_events where occurred_at>=p_since),
  rollup as (
    select count(*) filter(where event_type='auth.login_started') login_attempts,
      count(*) filter(where event_type='auth.login_succeeded' and outcome='succeeded') login_successes,
      count(*) filter(where event_type='auth.identity_failed' or (outcome='failed' and journey='authentication')) auth_identity_failures,
      count(distinct actor_id) filter(where event_type='teacher.useful_action_committed' and outcome='succeeded' and authoritative) activated_teachers,
      count(distinct actor_id) filter(where event_type='student.learning_activity_committed' and outcome='succeeded' and authoritative) activated_students,
      count(distinct actor_id) filter(where event_type='parent.child_insight_viewed' and outcome='succeeded' and authoritative) activated_parents,
      count(distinct actor_id) filter(where event_type='admin.school_operation_committed' and outcome='succeeded' and authoritative) activated_admins,
      count(*) filter(where journey='vibelearn' and outcome='failed') content_failures,
      count(*) filter(where outcome in ('failed','denied')) failures,
      percentile_cont(0.95) within group(order by latency_ms) filter(where latency_ms is not null) p95_latency_ms
    from e)
  select jsonb_build_object('since',p_since,'generated_at',now(),'entry',jsonb_build_object('login_attempts',login_attempts,'login_successes',login_successes,
    'login_success_rate',case when login_attempts=0 then null else round(100.0*login_successes/login_attempts,1) end),
    'activation',jsonb_build_object('teachers',activated_teachers,'students',activated_students,'parents',activated_parents,'admins',activated_admins),
    'reliability',jsonb_build_object('failures',failures,'content_failures',content_failures,'auth_identity_failures',auth_identity_failures,'p95_latency_ms',p95_latency_ms))
  into v from rollup;
  return v;
end;
$$;
revoke all on function public.hq_get_pilot_observability_scorecard(timestamptz) from public, anon, authenticated;
grant execute on function public.hq_get_pilot_observability_scorecard(timestamptz) to authenticated;

create or replace function public.hq_get_pilot_failure_drilldown(p_since timestamptz default now()-interval '24 hours', p_limit integer default 100)
returns table(event_id uuid,occurred_at timestamptz,journey text,surface text,actor_role text,school_id uuid,event_type text,outcome text,failure_class text,error_code text,correlation_id uuid,latency_ms integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_platform_owner() then raise exception 'HQ_OWNER_REQUIRED' using errcode='42501'; end if;
  return query select e.id,e.occurred_at,e.journey,e.surface,e.actor_role,e.school_id,e.event_type,e.outcome,e.failure_class,e.error_code,e.correlation_id,e.latency_ms
  from public.platform_events e where e.occurred_at>=p_since and e.outcome in ('failed','denied') order by e.occurred_at desc limit greatest(1,least(p_limit,500));
end;
$$;
revoke all on function public.hq_get_pilot_failure_drilldown(timestamptz,integer) from public, anon, authenticated;
grant execute on function public.hq_get_pilot_failure_drilldown(timestamptz,integer) to authenticated;

comment on table public.pilot_event_contract is 'Task 12 canonical allowlist for pilot telemetry. Internal-only contract; metadata is schema-limited; platform_events remains canonical ledger.';
comment on function public.pilot_record_event(text,text,text,uuid,uuid,text,uuid,uuid,text,text,integer,text,text,jsonb,text) is 'Privacy-safe authenticated client telemetry ingress. Actor role and school are server-derived; cannot emit authoritative success events.';
comment on function public.pilot_record_authoritative_event(text,uuid,text,uuid,text,uuid,text,uuid,text,text,integer,jsonb,text) is 'Service-role-only authoritative event ingress for committed backend operations.';

commit;
