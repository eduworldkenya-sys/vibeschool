-- Task 12 observability contract certification. Safe to run in disposable/CI databases.
\set ON_ERROR_STOP on

begin;

do $$ begin
  if to_regclass('public.platform_events') is null then raise exception 'platform_events missing'; end if;
  if to_regclass('public.pilot_event_contract') is null then raise exception 'pilot_event_contract missing'; end if;
end $$;

do $$
declare missing text;
begin
  select string_agg(x.col, ', ') into missing
  from (values ('journey'),('surface'),('outcome'),('failure_class'),('error_code'),('latency_ms'),('correlation_id'),('session_id'),('source'),('authoritative'),('network_class'),('app_version')) x(col)
  where not exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name='platform_events' and c.column_name=x.col);
  if missing is not null then raise exception 'missing platform_events columns: %', missing; end if;
end $$;

-- Contract and canonical role reconciliation.
do $$ begin
  if not exists(select 1 from public.pilot_event_contract where event_name='auth.login_started' and authoritative_required=false) then raise exception 'auth login contract missing'; end if;
  if not exists(select 1 from public.pilot_event_contract where event_name='teacher.useful_action_committed' and authoritative_required=true) then raise exception 'teacher activation is not backend-authoritative'; end if;
  if not exists(select 1 from public.pilot_event_contract where event_name='admin.school_operation_committed' and allowed_roles=array['admin']::text[] and activation_role='admin') then raise exception 'admin telemetry role not reconciled'; end if;
  if exists(select 1 from public.pilot_event_contract where allowed_roles @> array['school_admin']::text[]) then raise exception 'stale school_admin role remains'; end if;
  if exists(select 1 from public.pilot_event_contract where metadata_keys && array['password','token','access_token','refresh_token','authorization','cookie','secret','answer','message','prompt','conversation','email','phone','name']) then raise exception 'sensitive metadata key allowed'; end if;
end $$;

-- Least privilege: contract and canonical ledger are not directly readable by ordinary API roles.
do $$ begin
  if has_table_privilege('anon','public.platform_events','select') then raise exception 'anon can select platform_events'; end if;
  if has_table_privilege('authenticated','public.platform_events','select') then raise exception 'authenticated has direct platform_events select'; end if;
  if has_table_privilege('anon','public.pilot_event_contract','select') then raise exception 'anon can select pilot_event_contract'; end if;
  if has_table_privilege('authenticated','public.pilot_event_contract','select') then raise exception 'authenticated can select pilot_event_contract'; end if;
  if has_function_privilege('anon','public.pilot_record_event(text,text,text,uuid,uuid,text,uuid,uuid,text,text,integer,text,text,jsonb,text)','execute') then raise exception 'anon can emit telemetry'; end if;
  if not has_function_privilege('authenticated','public.pilot_record_event(text,text,text,uuid,uuid,text,uuid,uuid,text,text,integer,text,text,jsonb,text)','execute') then raise exception 'authenticated telemetry ingress missing'; end if;
  if has_function_privilege('authenticated','public.pilot_record_authoritative_event(text,uuid,text,uuid,text,uuid,text,uuid,text,text,integer,jsonb,text)','execute') then raise exception 'authenticated can emit authoritative telemetry'; end if;
end $$;

-- HQ reporting functions must exist; their bodies enforce owner authority.
do $$ begin
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='hq_get_pilot_observability_scorecard' and p.prosecdef) then raise exception 'HQ pilot scorecard missing or not definer protected'; end if;
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='hq_get_pilot_failure_drilldown' and p.prosecdef) then raise exception 'HQ failure drilldown missing or not definer protected'; end if;
end $$;

rollback;
\echo 'TASK12_OBSERVABILITY_CONTRACT_PASS'
