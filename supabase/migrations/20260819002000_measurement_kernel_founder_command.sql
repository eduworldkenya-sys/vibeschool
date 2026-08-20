begin;

-- Governed product measurement kernel. This intentionally records only low-cardinality
-- product telemetry: account/day presence, acquisition tags and experiment assignment.
-- It never stores prompts, message bodies, lesson content, email addresses or free-text URLs.
-- Access: service-only public.product_measurement_state
-- Authorization-test: public.product_measurement_state direct anon/authenticated table access is revoked; owner intelligence reads through gated RPCs.
-- Access: service-only public.product_account_sessions
-- Authorization-test: public.product_account_sessions direct anon/authenticated table access is revoked; authenticated writes are bound to auth.uid() by product_record_session.
-- Access: service-only public.product_acquisition_attribution
-- Authorization-test: public.product_acquisition_attribution direct anon/authenticated table access is revoked; authenticated writes are bound to auth.uid() by product_record_session.
-- Access: service-only public.product_experiments
-- Authorization-test: public.product_experiments direct anon/authenticated table access is revoked; owner mutation is gated by hq_assert_owner().
-- Access: service-only public.product_experiment_assignments
-- Authorization-test: public.product_experiment_assignments direct anon/authenticated table access is revoked; assignment is produced only by product_get_experiment_variant for auth.uid().
-- Access: service-only public.product_experiment_exposures
-- Authorization-test: public.product_experiment_exposures direct anon/authenticated table access is revoked; exposure is produced only by product_get_experiment_variant for auth.uid().

create table if not exists public.product_measurement_state (
  singleton boolean primary key default true check (singleton),
  certified_from timestamptz not null default now(),
  schema_version text not null default '1.0',
  notes text not null default 'End-to-end account session, acquisition attribution and experiment instrumentation.'
);
insert into public.product_measurement_state(singleton) values (true) on conflict(singleton) do nothing;

create table if not exists public.product_account_sessions (
  user_id uuid not null,
  activity_date date not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  first_path text,
  last_path text,
  primary key(user_id, activity_date)
);
create index if not exists product_account_sessions_day_idx on public.product_account_sessions(activity_date desc);

create table if not exists public.product_acquisition_attribution (
  user_id uuid primary key,
  first_seen_at timestamptz not null default now(),
  first_source text,
  first_medium text,
  first_campaign text,
  first_referrer_host text,
  first_landing_path text,
  last_seen_at timestamptz not null default now(),
  last_source text,
  last_medium text,
  last_campaign text,
  last_referrer_host text,
  last_landing_path text
);
create index if not exists product_acquisition_source_idx on public.product_acquisition_attribution(first_source, first_seen_at desc);

create table if not exists public.product_experiments (
  experiment_key text primary key,
  name text not null,
  hypothesis text not null,
  primary_metric text not null,
  variants text[] not null check (cardinality(variants) between 2 and 8),
  status text not null default 'draft' check (status in ('draft','running','paused','completed')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (experiment_key ~ '^[a-z0-9][a-z0-9._-]{1,79}$')
);

create table if not exists public.product_experiment_assignments (
  experiment_key text not null references public.product_experiments(experiment_key) on delete cascade,
  user_id uuid not null,
  variant text not null,
  assigned_at timestamptz not null default now(),
  primary key(experiment_key,user_id)
);
create index if not exists product_experiment_assignment_user_idx on public.product_experiment_assignments(user_id, assigned_at desc);

create table if not exists public.product_experiment_exposures (
  experiment_key text not null references public.product_experiments(experiment_key) on delete cascade,
  user_id uuid not null,
  variant text not null,
  exposure_date date not null default current_date,
  exposed_at timestamptz not null default now(),
  primary key(experiment_key,user_id,exposure_date)
);

alter table public.product_measurement_state enable row level security;
alter table public.product_account_sessions enable row level security;
alter table public.product_acquisition_attribution enable row level security;
alter table public.product_experiments enable row level security;
alter table public.product_experiment_assignments enable row level security;
alter table public.product_experiment_exposures enable row level security;

revoke all on table public.product_measurement_state from public,anon,authenticated;
revoke all on table public.product_account_sessions from public,anon,authenticated;
revoke all on table public.product_acquisition_attribution from public,anon,authenticated;
revoke all on table public.product_experiments from public,anon,authenticated;
revoke all on table public.product_experiment_assignments from public,anon,authenticated;
revoke all on table public.product_experiment_exposures from public,anon,authenticated;

create or replace function public.product_record_session(
  p_path text default null,
  p_source text default null,
  p_medium text default null,
  p_campaign text default null,
  p_referrer_host text default null,
  p_landing_path text default null
) returns boolean
language plpgsql security definer
set search_path=public,extensions,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_path text;
  v_source text;
  v_medium text;
  v_campaign text;
  v_referrer text;
  v_landing text;
begin
  if v_uid is null then return false; end if;
  if not exists(select 1 from public.profiles p where p.id=v_uid and not coalesce(p.is_anonymized,false)) then return false; end if;

  v_path:=left(nullif(split_part(coalesce(p_path,''),'?',1),''),180);
  v_source:=left(nullif(trim(p_source),''),80);
  v_medium:=left(nullif(trim(p_medium),''),80);
  v_campaign:=left(nullif(trim(p_campaign),''),120);
  v_referrer:=left(nullif(lower(trim(p_referrer_host)),''),120);
  v_landing:=left(nullif(split_part(coalesce(p_landing_path,''),'?',1),''),180);

  insert into public.product_account_sessions(user_id,activity_date,first_seen_at,last_seen_at,first_path,last_path)
  values(v_uid,current_date,now(),now(),v_path,v_path)
  on conflict(user_id,activity_date) do update set
    last_seen_at=greatest(public.product_account_sessions.last_seen_at,excluded.last_seen_at),
    last_path=coalesce(excluded.last_path,public.product_account_sessions.last_path);

  insert into public.product_acquisition_attribution(
    user_id,first_seen_at,first_source,first_medium,first_campaign,first_referrer_host,first_landing_path,
    last_seen_at,last_source,last_medium,last_campaign,last_referrer_host,last_landing_path
  ) values(
    v_uid,now(),v_source,v_medium,v_campaign,v_referrer,v_landing,
    now(),v_source,v_medium,v_campaign,v_referrer,v_landing
  ) on conflict(user_id) do update set
    last_seen_at=now(),
    last_source=coalesce(excluded.last_source,public.product_acquisition_attribution.last_source),
    last_medium=coalesce(excluded.last_medium,public.product_acquisition_attribution.last_medium),
    last_campaign=coalesce(excluded.last_campaign,public.product_acquisition_attribution.last_campaign),
    last_referrer_host=coalesce(excluded.last_referrer_host,public.product_acquisition_attribution.last_referrer_host),
    last_landing_path=coalesce(excluded.last_landing_path,public.product_acquisition_attribution.last_landing_path);

  return true;
end;
$$;
revoke all on function public.product_record_session(text,text,text,text,text,text) from public,anon;
grant execute on function public.product_record_session(text,text,text,text,text,text) to authenticated;

create or replace function public.product_get_experiment_variant(p_experiment_key text)
returns text
language plpgsql security definer
set search_path=public,extensions,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_exp public.product_experiments%rowtype;
  v_variant text;
  v_index integer;
begin
  if v_uid is null then return null; end if;
  select * into v_exp from public.product_experiments e
  where e.experiment_key=p_experiment_key
    and e.status='running'
    and (e.starts_at is null or e.starts_at<=now())
    and (e.ends_at is null or e.ends_at>now());
  if not found then return null; end if;

  select a.variant into v_variant from public.product_experiment_assignments a
  where a.experiment_key=p_experiment_key and a.user_id=v_uid;

  if v_variant is null then
    v_index := 1 + ((hashtextextended(v_uid::text||':'||p_experiment_key,0) & 9223372036854775807) % cardinality(v_exp.variants))::integer;
    v_variant := v_exp.variants[v_index];
    insert into public.product_experiment_assignments(experiment_key,user_id,variant)
    values(p_experiment_key,v_uid,v_variant)
    on conflict(experiment_key,user_id) do nothing;
    select a.variant into v_variant from public.product_experiment_assignments a where a.experiment_key=p_experiment_key and a.user_id=v_uid;
  end if;

  insert into public.product_experiment_exposures(experiment_key,user_id,variant,exposure_date,exposed_at)
  values(p_experiment_key,v_uid,v_variant,current_date,now())
  on conflict(experiment_key,user_id,exposure_date) do nothing;
  return v_variant;
end;
$$;
revoke all on function public.product_get_experiment_variant(text) from public,anon;
grant execute on function public.product_get_experiment_variant(text) to authenticated;

create or replace function public.hq_upsert_product_experiment(
  p_experiment_key text,
  p_name text,
  p_hypothesis text,
  p_primary_metric text,
  p_variants text[],
  p_status text default 'draft',
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null
) returns boolean
language plpgsql security definer
set search_path=public,extensions,pg_temp
as $$
begin
  perform public.hq_assert_owner();
  if p_status not in ('draft','running','paused','completed') then raise exception 'invalid_experiment_status'; end if;
  if cardinality(p_variants) < 2 or cardinality(p_variants) > 8 then raise exception 'invalid_experiment_variants'; end if;
  insert into public.product_experiments(experiment_key,name,hypothesis,primary_metric,variants,status,starts_at,ends_at,created_by,updated_at)
  values(p_experiment_key,left(p_name,120),left(p_hypothesis,500),left(p_primary_metric,120),p_variants,p_status,p_starts_at,p_ends_at,auth.uid(),now())
  on conflict(experiment_key) do update set
    name=excluded.name,hypothesis=excluded.hypothesis,primary_metric=excluded.primary_metric,
    variants=excluded.variants,status=excluded.status,starts_at=excluded.starts_at,ends_at=excluded.ends_at,updated_at=now();
  return true;
end;
$$;
revoke all on function public.hq_upsert_product_experiment(text,text,text,text,text[],text,timestamptz,timestamptz) from public,anon;
grant execute on function public.hq_upsert_product_experiment(text,text,text,text,text[],text,timestamptz,timestamptz) to authenticated;

-- Certified retention starts at deployment of this kernel. Pre-kernel cohorts are intentionally
-- not retroactively inferred from logins. This avoids presenting reconstructed behaviour as measured truth.
create or replace function public.hq_get_retention_metrics(p_as_of date default current_date)
returns jsonb
language plpgsql security definer
set search_path=public,extensions,pg_temp
as $$
declare
  v_started date;
  v_result jsonb;
begin
  perform public.hq_assert_owner();
  select certified_from::date into v_started from public.product_measurement_state where singleton=true;
  with cohorts as (
    select p.id,p.created_at::date signup_date
    from public.profiles p
    where p.created_at::date between greatest(v_started,p_as_of-30) and p_as_of
      and coalesce(p.is_anonymized,false)=false
  ), flags as (
    select c.id,c.signup_date,
      exists(select 1 from public.product_account_sessions s where s.user_id=c.id and s.activity_date=c.signup_date+1) d1,
      exists(select 1 from public.product_account_sessions s where s.user_id=c.id and s.activity_date=c.signup_date+7) d7,
      exists(select 1 from public.product_account_sessions s where s.user_id=c.id and s.activity_date=c.signup_date+30) d30
    from cohorts c
  )
  select jsonb_build_object(
    'as_of',p_as_of,
    'certified_from',v_started,
    'eligible_d1',(select count(*) from flags where signup_date<=p_as_of-1),
    'retained_d1',(select count(*) from flags where signup_date<=p_as_of-1 and d1),
    'd1_rate',(select case when count(*)=0 then null else round(count(*) filter(where d1)::numeric/count(*),4) end from flags where signup_date<=p_as_of-1),
    'eligible_d7',(select count(*) from flags where signup_date<=p_as_of-7),
    'retained_d7',(select count(*) from flags where signup_date<=p_as_of-7 and d7),
    'd7_rate',(select case when count(*)=0 then null else round(count(*) filter(where d7)::numeric/count(*),4) end from flags where signup_date<=p_as_of-7),
    'eligible_d30',(select count(*) from flags where signup_date<=p_as_of-30),
    'retained_d30',(select count(*) from flags where signup_date<=p_as_of-30 and d30),
    'd30_rate',(select case when count(*)=0 then null else round(count(*) filter(where d30)::numeric/count(*),4) end from flags where signup_date<=p_as_of-30),
    'definition','Certified cohort retention: a post-kernel signup is retained when an authenticated product session is observed exactly 1, 7, or 30 calendar days after signup.',
    'historical_backfill',false
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.hq_get_retention_metrics(date) from public,anon;
grant execute on function public.hq_get_retention_metrics(date) to authenticated;

create or replace function public.hq_measurement_founder_command(p_days integer default 30)
returns jsonb
language plpgsql security definer
set search_path=public,extensions,pg_temp
as $$
declare
  v_days integer:=greatest(1,least(coalesce(p_days,30),90));
  v_started timestamptz;
  v_retention jsonb;
  v_total_new bigint;
  v_attributed bigint;
  v_activated bigint;
begin
  perform public.hq_assert_owner();
  select certified_from into v_started from public.product_measurement_state where singleton=true;
  v_retention:=public.hq_get_retention_metrics(current_date);

  select count(*) into v_total_new from public.profiles p
    where p.created_at>=greatest(v_started,now()-make_interval(days=>v_days)) and not coalesce(p.is_anonymized,false);
  select count(*) into v_attributed from public.product_acquisition_attribution a
    join public.profiles p on p.id=a.user_id
    where p.created_at>=greatest(v_started,now()-make_interval(days=>v_days))
      and (a.first_source is not null or a.first_referrer_host is not null);
  select count(distinct p.id) into v_activated from public.profiles p
    where p.created_at>=greatest(v_started,now()-make_interval(days=>v_days))
      and exists(select 1 from public.product_account_sessions s where s.user_id=p.id and s.first_seen_at>p.created_at and s.first_seen_at<=p.created_at+interval '7 days');

  return jsonb_build_object(
    'generated_at',now(),
    'certified_from',v_started,
    'window_days',v_days,
    'certification',jsonb_build_object(
      'account_sessions',true,
      'acquisition_attribution',true,
      'cohort_retention',true,
      'experiment_registry',true,
      'historical_backfill',false,
      'privacy_minimized',true
    ),
    'acquisition',jsonb_build_object(
      'new_accounts',v_total_new,
      'attributed_accounts',v_attributed,
      'attribution_coverage',case when v_total_new=0 then null else round(v_attributed::numeric/v_total_new,4) end,
      'first_touch_sources',coalesce((select jsonb_agg(jsonb_build_object('source',source,'accounts',cnt) order by cnt desc) from (
        select coalesce(nullif(a.first_source,''),case when a.first_referrer_host is null then 'direct_or_unknown' else 'referral' end) source,count(*) cnt
        from public.product_acquisition_attribution a join public.profiles p on p.id=a.user_id
        where p.created_at>=greatest(v_started,now()-make_interval(days=>v_days)) group by 1
      )x),'[]'::jsonb),
      'campaigns',coalesce((select jsonb_agg(jsonb_build_object('campaign',campaign,'accounts',cnt) order by cnt desc) from (
        select a.first_campaign campaign,count(*) cnt from public.product_acquisition_attribution a join public.profiles p on p.id=a.user_id
        where p.created_at>=greatest(v_started,now()-make_interval(days=>v_days)) and a.first_campaign is not null group by 1
      )x),'[]'::jsonb)
    ),
    'activation',jsonb_build_object(
      'new_accounts',v_total_new,
      'activated_with_session_7d',v_activated,
      'rate',case when v_total_new=0 then null else round(v_activated::numeric/v_total_new,4) end,
      'definition','A post-kernel signup is session-activated after returning to authenticated product use after account creation and within seven days.'
    ),
    'retention',v_retention,
    'sessions',jsonb_build_object(
      'dau',(select count(*) from public.product_account_sessions where activity_date=current_date),
      'wau',(select count(distinct user_id) from public.product_account_sessions where activity_date between current_date-6 and current_date),
      'mau',(select count(distinct user_id) from public.product_account_sessions where activity_date between current_date-29 and current_date),
      'observations',(select count(*) from public.product_account_sessions where activity_date>=greatest(v_started::date,current_date-v_days+1))
    ),
    'experiments',jsonb_build_object(
      'running',(select count(*) from public.product_experiments where status='running' and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now())),
      'total',(select count(*) from public.product_experiments),
      'assignments',(select count(*) from public.product_experiment_assignments),
      'exposures_window',(select count(*) from public.product_experiment_exposures where exposure_date>=current_date-v_days+1),
      'registry',coalesce((select jsonb_agg(jsonb_build_object('key',experiment_key,'name',name,'status',status,'primary_metric',primary_metric,'variants',variants,'starts_at',starts_at,'ends_at',ends_at) order by updated_at desc) from public.product_experiments),'[]'::jsonb)
    ),
    'role_value',jsonb_build_object(
      'teachers_with_class',(select count(distinct tc.teacher_id) from public.teacher_classes tc join public.profiles p on p.id=tc.teacher_id where p.role='teacher' and not coalesce(p.is_anonymized,false)),
      'teachers_creating_value_7d',(select count(*) from (select teacher_id from public.lesson_plans where created_at>=now()-interval '7 days' union select teacher_id from public.homework where created_at>=now()-interval '7 days')t),
      'learners_with_value_7d',(select count(*) from (
        select s.profile_id from public.student_learning_events e join public.students s on s.id=e.student_id where s.profile_id is not null and e.occurred_at>=now()-interval '7 days'
        union select s.profile_id from public.content_learning_events e join public.students s on s.id=e.student_id where s.profile_id is not null and e.occurred_at>=now()-interval '7 days'
        union select coalesce(s.profile_id,r.viewer_id) from public.vibe_reading_sessions r left join public.students s on s.id=r.student_id where coalesce(s.profile_id,r.viewer_id) is not null and r.started_at>=now()-interval '7 days'
        union select coalesce(s.profile_id,a.profile_id) from public.student_adaptive_learning_sessions a left join public.students s on s.id=a.student_id where coalesce(s.profile_id,a.profile_id) is not null and a.started_at>=now()-interval '7 days'
      )l),
      'parents_linked_to_learner',(select count(distinct parent_id) from public.parent_student_links)
    ),
    'anomalies',jsonb_build_array(
      jsonb_build_object('key','attribution_coverage_low','active',v_total_new>=5 and v_attributed::numeric/nullif(v_total_new,0)<0.7,'severity','warning','definition','At least 70% of post-kernel new accounts should carry a first-touch source or referrer once campaigns are running.'),
      jsonb_build_object('key','activation_low','active',v_total_new>=5 and v_activated::numeric/nullif(v_total_new,0)<0.3,'severity','warning','definition','Investigate onboarding when fewer than 30% of new accounts record an authenticated product session after signup within seven days.'),
      jsonb_build_object('key','d7_retention_low','active',coalesce((v_retention->>'eligible_d7')::int,0)>=10 and coalesce((v_retention->>'d7_rate')::numeric,0)<0.15,'severity','high','definition','Investigate value delivery when certified D7 retention falls below 15% with at least 10 eligible accounts.')
    ),
    'lineage',jsonb_build_array(
      jsonb_build_object('key','account_session','source','product_account_sessions','definition','One authenticated product-presence row per account per calendar day; HQ/auth routes are excluded client-side.','grain','account_day'),
      jsonb_build_object('key','acquisition_first_touch','source','product_acquisition_attribution','definition','First observed UTM source/medium/campaign or referrer host captured at authenticated product use. Query strings and full referrer URLs are not stored.','grain','account'),
      jsonb_build_object('key','cohort_retention','source','profiles + product_account_sessions','definition','Exact D1/D7/D30 calendar-day return for users who signed up after certified instrumentation began.','grain','signup_cohort'),
      jsonb_build_object('key','experiments','source','product_experiments + assignments + exposures','definition','Owner-governed experiment registry with stable account assignment and daily deduplicated exposure.','grain','experiment_account')
    )
  );
end;
$$;
revoke all on function public.hq_measurement_founder_command(integer) from public,anon;
grant execute on function public.hq_measurement_founder_command(integer) to authenticated;

-- Update the existing founder value coverage contract now that the missing instrumentation exists.
create or replace function public.hq_founder_value_intelligence()
returns jsonb
language plpgsql security definer
set search_path=public,extensions,pg_temp
as $$
declare v_base jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
  with active_learners_7d as (
    select s.profile_id account_id from public.student_learning_events e join public.students s on s.id=e.student_id where s.profile_id is not null and e.occurred_at>=now()-interval '7 days'
    union select s.profile_id from public.content_learning_events e join public.students s on s.id=e.student_id where s.profile_id is not null and e.occurred_at>=now()-interval '7 days'
    union select coalesce(s.profile_id,r.viewer_id) from public.vibe_reading_sessions r left join public.students s on s.id=r.student_id where coalesce(s.profile_id,r.viewer_id) is not null and r.last_active_at>=now()-interval '7 days'
    union select coalesce(s.profile_id,a.profile_id) from public.student_adaptive_learning_sessions a left join public.students s on s.id=a.student_id where coalesce(s.profile_id,a.profile_id) is not null and a.started_at>=now()-interval '7 days'
  ), active_teachers_7d as (
    select teacher_id from public.lesson_plans where teacher_id is not null and created_at>=now()-interval '7 days'
    union select teacher_id from public.homework where teacher_id is not null and created_at>=now()-interval '7 days'
  ), progressing_learners_30d as (
    select s.profile_id from public.student_adaptive_learning_sessions a join public.students s on s.id=a.student_id where s.profile_id is not null and a.completed_at>=now()-interval '30 days' and a.mastery_before is not null and a.mastery_after>a.mastery_before
    union select s.profile_id from public.learner_outcomes o join public.students s on s.id=o.student_id where s.profile_id is not null and o.assessed_at>=now()-interval '30 days' and lower(coalesce(o.status,'')) in ('proficient','mastered')
  ), teacher_activation as (
    select distinct tc.teacher_id from public.teacher_classes tc join public.profiles p on p.id=tc.teacher_id where p.role='teacher' and not coalesce(p.is_anonymized,false)
  ), school_activity_30d as (
    select school_id from public.lesson_plans where school_id is not null and created_at>=now()-interval '30 days'
    union select school_id from public.homework where school_id is not null and created_at>=now()-interval '30 days'
    union select school_id from public.platform_events where school_id is not null and occurred_at>=now()-interval '30 days'
  )
  select jsonb_build_object(
    'north_star',jsonb_build_object('learners_with_learning_evidence_7d',(select count(*) from active_learners_7d),'learners_progressing_30d',(select count(*) from progressing_learners_30d),'teachers_creating_learning_value_7d',(select count(*) from active_teachers_7d)),
    'activation',jsonb_build_object('teacher_profiles',(select count(*) from public.profiles where role='teacher' and not coalesce(is_anonymized,false)),'teachers_with_class',(select count(*) from teacher_activation),'student_profiles',(select count(*) from public.profiles where role='student' and not coalesce(is_anonymized,false)),'students_with_canonical_identity',(select count(*) from public.students where profile_id is not null and deleted_at is null),'parent_profiles',(select count(*) from public.profiles where role='parent' and not coalesce(is_anonymized,false)),'parents_linked_to_student',(select count(distinct parent_id) from public.parent_student_links)),
    'learning_7d',jsonb_build_object('active_learners',(select count(*) from active_learners_7d),'student_learning_events',(select count(*) from public.student_learning_events where occurred_at>=now()-interval '7 days'),'content_learning_events',(select count(*) from public.content_learning_events where occurred_at>=now()-interval '7 days'),'reading_sessions',(select count(*) from public.vibe_reading_sessions where last_active_at>=now()-interval '7 days'),'adaptive_sessions',(select count(*) from public.student_adaptive_learning_sessions where started_at>=now()-interval '7 days')),
    'teaching_7d',jsonb_build_object('active_teachers',(select count(*) from active_teachers_7d),'lesson_plans_created',(select count(*) from public.lesson_plans where created_at>=now()-interval '7 days'),'homework_created',(select count(*) from public.homework where created_at>=now()-interval '7 days'),'homework_submissions',(select count(*) from public.homework_submissions where coalesce(submitted_at,created_at)>=now()-interval '7 days')),
    'mastery_30d',jsonb_build_object('learners_progressing',(select count(*) from progressing_learners_30d),'assessed_learners',(select count(distinct s.profile_id) from public.learner_outcomes o join public.students s on s.id=o.student_id where s.profile_id is not null and o.assessed_at>=now()-interval '30 days'),'proficient_or_mastered_outcomes',(select count(*) from public.learner_outcomes where assessed_at>=now()-interval '30 days' and lower(coalesce(status,'')) in ('proficient','mastered')),'adaptive_mastery_gain_sessions',(select count(*) from public.student_adaptive_learning_sessions where completed_at>=now()-interval '30 days' and mastery_before is not null and mastery_after is not null and mastery_after>mastery_before)),
    'schools',jsonb_build_object('active_30d',(select count(*) from school_activity_30d),'with_teacher_members',(select count(distinct school_id) from public.school_members where role::text='teacher'),'with_learning_value_30d',(select count(distinct school_id) from public.lesson_plans where school_id is not null and created_at>=now()-interval '30 days')),
    'coverage',jsonb_build_object('product_event_kernel_present',to_regclass('public.platform_events') is not null,'learning_event_kernel_present',to_regclass('public.student_learning_events') is not null,'mastery_evidence_present',to_regclass('public.learner_outcomes') is not null,'cohort_retention_instrumented',to_regclass('public.product_account_sessions') is not null,'acquisition_attribution_instrumented',to_regclass('public.product_acquisition_attribution') is not null,'experiment_registry_instrumented',to_regclass('public.product_experiments') is not null,'certified_from',(select certified_from from public.product_measurement_state where singleton=true))
  ) into v_base;
  return v_base;
end;
$$;
revoke all on function public.hq_founder_value_intelligence() from public,anon;
grant execute on function public.hq_founder_value_intelligence() to authenticated;

commit;
