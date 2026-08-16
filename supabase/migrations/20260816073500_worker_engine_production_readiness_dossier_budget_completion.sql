-- Worker Engine production-readiness hardening: dossier budget evidence + early-break completeness.
-- NON-ACTIVATING and read-only.

alter function public.hq_workforce_get_execution_dossier(uuid)
  rename to hq_workforce_get_execution_dossier_base;
revoke all on function public.hq_workforce_get_execution_dossier_base(uuid) from public,anon,authenticated,service_role;

create or replace function public.hq_workforce_get_execution_dossier(p_execution_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v jsonb;
  v_task_id uuid;
  v_intent_id uuid;
  v_budget jsonb;
  v_pre_break boolean:=false;
  v_missing jsonb;
  v_required integer;
  v_present integer;
begin
  perform public.hq_assert_owner();
  if auth.uid() is null then raise exception 'execution_dossier_authenticated_owner_required'; end if;

  v:=public.hq_workforce_get_execution_dossier_base(p_execution_id);
  v_task_id:=nullif(v->>'task_id','')::uuid;
  v_intent_id:=nullif(v->'execution_intent'->>'id','')::uuid;

  select coalesce(jsonb_agg(to_jsonb(b) order by b.occurred_at,b.id),'[]'::jsonb)
    into v_budget
  from public.hq_workforce_execution_budget_events b
  where b.execution_id=p_execution_id;

  select exists(
    select 1 from public.hq_workforce_execution_breaker_events be
    where be.task_id=v_task_id and be.event_kind='execution_blocked'
      and be.evidence->>'stage'='pre_reservation'
  ) into v_pre_break;

  v_missing:=coalesce(v->'completeness'->'missing','[]'::jsonb);
  v_required:=coalesce((v->'completeness'->>'required')::integer,0);
  v_present:=coalesce((v->'completeness'->>'present')::integer,0);

  -- An early breaker denial is a complete execution request without an idempotency intent:
  -- envelope + task/authority/plan lineage + durable breaker evidence are the canonical proof.
  if v_pre_break and v_intent_id is null then
    select coalesce(jsonb_agg(x.val),'[]'::jsonb) into v_missing
    from jsonb_array_elements(v_missing) x(val)
    where x.val <> '"execution_intent"'::jsonb;
    v_required:=greatest(v_required-1,0);
  end if;

  return (v - 'completeness') || jsonb_build_object(
    'telemetry_generation','r1_4_consequential',
    'budget_events',v_budget,
    'completeness',jsonb_build_object(
      'complete',jsonb_array_length(v_missing)=0,
      'present',v_present,
      'required',v_required,
      'missing',v_missing,
      'early_breaker_denial',v_pre_break
    )
  );
end $$;

revoke all on function public.hq_workforce_get_execution_dossier(uuid) from public,anon,service_role;
grant execute on function public.hq_workforce_get_execution_dossier(uuid) to authenticated;

-- Fail-closed state is unchanged.
do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) then
    raise exception 'dossier completion migration changed runtime boundary';
  end if;
end $$;
