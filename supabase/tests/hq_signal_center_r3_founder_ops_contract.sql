-- HQ Signal Center R3 founder-ops contract certification.
begin;

do $$
declare v_missing text[];
begin
  select array_agg(required.name order by required.name) into v_missing
  from (values ('owner_department'),('due_at'),('escalation_level'),('escalated_at'),('work_item_id'),('feedback'),('feedback_at')) required(name)
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema='public' and c.table_name='hq_notifications' and c.column_name=required.name
  );
  if v_missing is not null then raise exception 'HQ-R3: missing notification columns: %',v_missing; end if;
end $$;

do $$ begin
  if to_regclass('public.hq_notification_delivery_outbox') is null then raise exception 'HQ-R3: delivery outbox missing'; end if;
  if has_table_privilege('anon','public.hq_notification_delivery_outbox','select') or has_table_privilege('authenticated','public.hq_notification_delivery_outbox','select') then
    raise exception 'HQ-R3: delivery outbox exposed to client role';
  end if;
  if not has_table_privilege('service_role','public.hq_notification_delivery_outbox','select') then raise exception 'HQ-R3: service role cannot read delivery outbox'; end if;
end $$;

do $$ begin
  if has_function_privilege('anon','public.hq_process_notification_escalations()','execute') or has_function_privilege('authenticated','public.hq_process_notification_escalations()','execute') then
    raise exception 'HQ-R3: escalation processor exposed to client role';
  end if;
  if has_function_privilege('anon','public.hq_detect_founder_opportunities()','execute') or has_function_privilege('authenticated','public.hq_detect_founder_opportunities()','execute') then
    raise exception 'HQ-R3: opportunity detector exposed to client role';
  end if;
  if not has_function_privilege('authenticated','public.hq_get_founder_brief()','execute') then raise exception 'HQ-R3: founder brief RPC missing'; end if;
  if not has_function_privilege('authenticated','public.hq_set_notification_feedback(uuid,text)','execute') then raise exception 'HQ-R3: feedback RPC missing'; end if;
  if not has_function_privilege('authenticated','public.hq_open_notification_workroom(uuid)','execute') then raise exception 'HQ-R3: workroom bridge missing'; end if;
end $$;

do $$ declare v_result integer;
begin
  if public.hq_notification_sla_minutes('critical') <> 15 then raise exception 'HQ-R3: critical SLA drift'; end if;
  if public.hq_notification_sla_minutes('action_required') <> 240 then raise exception 'HQ-R3: action SLA drift'; end if;
  if public.hq_notification_department('security') <> 'security_identity' then raise exception 'HQ-R3: security ownership routing drift'; end if;
end $$;

do $$ declare v_count bigint;
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    select count(*) into v_count from cron.job where jobname='hq-signal-escalations-r3';
    if v_count<>1 then raise exception 'HQ-R3: expected exactly one escalation cron, found %',v_count; end if;
    select count(*) into v_count from cron.job where jobname='hq-founder-opportunities-r3';
    if v_count<>1 then raise exception 'HQ-R3: expected exactly one opportunity cron, found %',v_count; end if;
  end if;
end $$;

rollback;
