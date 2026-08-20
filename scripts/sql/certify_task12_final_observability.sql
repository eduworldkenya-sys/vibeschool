-- Task 12 final observability / SLO / privacy certification.
-- Run after all Task-12 migrations in a clean reconstruction or production-equivalent upgrade database.

begin;

-- Core objects must exist.
do $$
begin
  if to_regclass('public.platform_events') is null then raise exception 'TASK12_CERT: platform_events missing'; end if;
  if to_regclass('public.pilot_event_contract') is null then raise exception 'TASK12_CERT: pilot_event_contract missing'; end if;
  if to_regclass('public.pilot_slo_contract') is null then raise exception 'TASK12_CERT: pilot_slo_contract missing'; end if;
end $$;

-- Required normalized dimensions must be reconstructible.
do $$
declare missing text;
begin
  select string_agg(c, ', ' order by c) into missing
  from unnest(array['journey','surface','outcome','failure_class','error_code','latency_ms','correlation_id','session_id','source','authoritative','network_class','app_version']) c
  where not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='platform_events' and column_name=c
  );
  if missing is not null then raise exception 'TASK12_CERT: platform_events missing columns: %', missing; end if;
end $$;

-- Raw registry tables are internal-only.
do $$
begin
  if has_table_privilege('anon','public.pilot_event_contract','SELECT')
     or has_table_privilege('authenticated','public.pilot_event_contract','SELECT') then
    raise exception 'TASK12_CERT: raw pilot_event_contract is broadly readable';
  end if;
  if has_table_privilege('anon','public.pilot_slo_contract','SELECT')
     or has_table_privilege('authenticated','public.pilot_slo_contract','SELECT') then
    raise exception 'TASK12_CERT: raw pilot_slo_contract is broadly readable';
  end if;
end $$;

-- Client ingress must be authenticated-only and authoritative ingress service-only.
do $$
declare client_oid oid; authoritative_oid oid;
begin
  select p.oid into client_oid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='pilot_record_event'
  order by p.oid desc limit 1;
  if client_oid is null then raise exception 'TASK12_CERT: pilot_record_event missing'; end if;
  if has_function_privilege('anon',client_oid,'EXECUTE') then raise exception 'TASK12_CERT: anon can execute pilot_record_event'; end if;
  if not has_function_privilege('authenticated',client_oid,'EXECUTE') then raise exception 'TASK12_CERT: authenticated cannot execute pilot_record_event'; end if;

  select p.oid into authoritative_oid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='pilot_record_authoritative_event'
  order by p.oid desc limit 1;
  if authoritative_oid is null then raise exception 'TASK12_CERT: pilot_record_authoritative_event missing'; end if;
  if has_function_privilege('anon',authoritative_oid,'EXECUTE') or has_function_privilege('authenticated',authoritative_oid,'EXECUTE') then
    raise exception 'TASK12_CERT: authoritative ingress exposed to browser roles';
  end if;
  if not has_function_privilege('service_role',authoritative_oid,'EXECUTE') then raise exception 'TASK12_CERT: service_role cannot execute authoritative ingress'; end if;
end $$;

-- Owner scorecards may be callable by authenticated, but body must preserve owner check.
do $$
declare def text;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='hq_get_pilot_slo_scorecard'
  order by p.oid desc limit 1;
  if def is null then raise exception 'TASK12_CERT: SLO scorecard missing'; end if;
  if position('is_platform_owner' in def)=0 then raise exception 'TASK12_CERT: SLO scorecard lacks owner gate'; end if;

  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='hq_get_pilot_alert_candidates'
  order by p.oid desc limit 1;
  if def is null then raise exception 'TASK12_CERT: alert candidate function missing'; end if;
  if position('is_platform_owner' in def)=0 then raise exception 'TASK12_CERT: alert candidate function lacks owner gate'; end if;
  if position('hq_incidents' in def)>0 or position('insert into' in lower(def))>0 then
    raise exception 'TASK12_CERT: Task12 alert detection must not mutate Task11 incident authority';
  end if;
end $$;

-- Canonical pilot journeys and SLOs must be registered.
do $$
declare missing text;
begin
  select string_agg(j, ', ' order by j) into missing
  from unnest(array['authentication','teacher','student','parent','admin','vibelearn','homework','assessment']) j
  where not exists (select 1 from public.pilot_slo_contract s where s.journey=j and s.active);
  if missing is not null then raise exception 'TASK12_CERT: missing active SLO journeys: %', missing; end if;
end $$;

-- Every SLO endpoint must resolve to registered event contracts.
do $$
declare bad text;
begin
  select string_agg(s.slo_key, ', ' order by s.slo_key) into bad
  from public.pilot_slo_contract s
  left join public.pilot_event_contract a on a.event_name=s.attempt_event_name and a.active
  left join public.pilot_event_contract ok on ok.event_name=s.success_event_name and ok.active
  where s.active and (a.event_name is null or ok.event_name is null);
  if bad is not null then raise exception 'TASK12_CERT: SLO references missing events: %', bad; end if;
end $$;

-- Auth denominator semantics: anonymous client events are intentionally not treated as credential attempts.
do $$
declare attempt_name text; success_name text;
begin
  select attempt_event_name, success_event_name into attempt_name, success_name
  from public.pilot_slo_contract where journey='authentication' and active limit 1;
  if attempt_name is distinct from 'auth.login_succeeded' or success_name is distinct from 'auth.dashboard_reached' then
    raise exception 'TASK12_CERT: auth SLO denominator regressed to an untrusted/pre-auth signal';
  end if;
end $$;

-- Sensitive payload keys must not be whitelisted by active contracts.
do $$
declare offender text;
begin
  select string_agg(event_name, ', ' order by event_name) into offender
  from public.pilot_event_contract
  where active and metadata_keys && array['password','token','access_token','refresh_token','authorization','cookie','secret','answer','message','prompt','conversation','email','phone','name']::text[];
  if offender is not null then raise exception 'TASK12_CERT: prohibited metadata keys whitelisted by: %', offender; end if;
end $$;

-- Authoritative success boundaries for core academic/business commits.
do $$
declare offender text;
begin
  select string_agg(event_name, ', ' order by event_name) into offender
  from public.pilot_event_contract
  where event_name in ('teacher.useful_action_committed','student.learning_activity_committed','homework.submit_committed','assessment.submit_committed','payment.completed','worker.execution_verified')
    and not authoritative_required;
  if offender is not null then raise exception 'TASK12_CERT: authoritative contract weakened for: %', offender; end if;
end $$;

-- UNKNOWN must remain a first-class scorecard state for zero/stale/low-sample evidence.
do $$
declare def text;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='hq_get_pilot_slo_scorecard'
  order by p.oid desc limit 1;
  if position('UNKNOWN' in def)=0 or position('LOW_SAMPLE' in def)=0 or position('STALE' in def)=0 or position('NO_OBSERVATIONS' in def)=0 then
    raise exception 'TASK12_CERT: UNKNOWN/freshness/low-volume semantics missing';
  end if;
end $$;

-- RLS remains enabled on shared event ledger and internal registries.
do $$
declare disabled text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into disabled
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in ('platform_events','pilot_event_contract','pilot_slo_contract')
    and not c.relrowsecurity;
  if disabled is not null then raise exception 'TASK12_CERT: RLS disabled on: %', disabled; end if;
end $$;

rollback;
