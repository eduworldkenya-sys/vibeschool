-- HQ Notification Signal Center R2 contract certification.
-- Read-only assertions except for transaction-local test state; safe to run repeatedly.

begin;

do $$
begin
  if to_regclass('public.content_engine_orchestration_runs') is null then
    raise exception 'HQ-R2: canonical content_engine_orchestration_runs relation is missing';
  end if;
  if to_regclass('public.hq_notifications') is null then
    raise exception 'HQ-R2: hq_notifications relation is missing';
  end if;
end $$;

do $$
declare
  v_missing text[];
begin
  select array_agg(required.name order by required.name)
    into v_missing
  from (values
    ('notification_class'),('fingerprint'),('occurrence_count'),('first_seen_at'),
    ('last_seen_at'),('action_label'),('acknowledged_at'),('source_type'),('source_id')
  ) as required(name)
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema='public'
      and c.table_name='hq_notifications'
      and c.column_name=required.name
  );

  if v_missing is not null then
    raise exception 'HQ-R2: missing notification columns: %', v_missing;
  end if;
end $$;

do $$
begin
  if has_table_privilege('anon','public.content_engine_orchestration_runs','select')
     or has_table_privilege('authenticated','public.content_engine_orchestration_runs','select') then
    raise exception 'HQ-R2: raw orchestration ledger is readable by a client role';
  end if;

  if has_function_privilege('anon','public.hq_generate_notification_signals()','execute')
     or has_function_privilege('authenticated','public.hq_generate_notification_signals()','execute') then
    raise exception 'HQ-R2: internal signal generator is executable by a client role';
  end if;

  if not has_function_privilege('authenticated','public.hq_list_notifications(integer)','execute') then
    raise exception 'HQ-R2: owner notification reader is not exposed through authenticated RPC boundary';
  end if;
end $$;

do $$
declare
  v_count bigint;
begin
  select count(*) into v_count
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in ('hq_list_notifications','hq_acknowledge_notification','hq_mark_notification_read','hq_resolve_notification','hq_generate_notification_signals');

  if v_count < 5 then
    raise exception 'HQ-R2: expected governed notification RPC set is incomplete (% found)', v_count;
  end if;
end $$;

rollback;
