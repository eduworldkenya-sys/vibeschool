-- WE-R1.3X cross-gate repair: X7 end-to-end certification exposed a latent X2 context-binding defect.
-- Forward-only correction; historical X2 migration remains immutable.
-- NON-ACTIVATING: heartbeat OFF, Factory OFF, consequential execution OFF, autonomy L0/R0.

create or replace function public.hq_workforce_bind_objective_context(
  p_objective_id uuid,
  p_memory_id uuid,
  p_context_role text,
  p_selected_reason text,
  p_required_freshness_seconds bigint default null
) returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  m public.hq_workforce_memory_records%rowtype;
begin
  if not exists(select 1 from public.hq_workforce_objectives where id=p_objective_id) then
    raise exception 'objective_not_found';
  end if;
  if p_context_role not in ('required','supporting','constraint','policy','risk','verification') then
    raise exception 'objective_context_role_invalid';
  end if;
  if char_length(btrim(coalesce(p_selected_reason,''))) not between 3 and 2000 then
    raise exception 'objective_context_reason_required';
  end if;
  if p_required_freshness_seconds is not null and p_required_freshness_seconds < 0 then
    raise exception 'objective_context_freshness_invalid';
  end if;

  select * into m
  from public.hq_workforce_memory_records
  where id=p_memory_id;
  if not found then raise exception 'memory_not_found'; end if;
  if m.verification_state in ('superseded','revoked') then
    raise exception 'memory_not_usable:%',m.verification_state;
  end if;
  if m.valid_until is not null and m.valid_until<=clock_timestamp() then
    raise exception 'memory_stale';
  end if;
  if p_required_freshness_seconds is not null
     and coalesce(m.observed_at,m.created_at) < clock_timestamp()-make_interval(secs=>p_required_freshness_seconds::double precision) then
    raise exception 'memory_freshness_requirement_failed';
  end if;
  if m.contradiction_group is not null and exists(
    select 1
    from public.hq_workforce_memory_records x
    where x.id<>m.id
      and x.contradiction_group=m.contradiction_group
      and x.verification_state not in ('superseded','revoked')
      and (x.valid_until is null or x.valid_until>clock_timestamp())
  ) then
    raise exception 'memory_contradiction_unresolved';
  end if;

  insert into public.hq_workforce_objective_context(
    objective_id,memory_id,context_role,selected_reason,required_freshness_seconds
  ) values (
    p_objective_id,p_memory_id,p_context_role,btrim(p_selected_reason),p_required_freshness_seconds
  )
  on conflict (objective_id,memory_id,context_role)
  do update set
    selected_reason=excluded.selected_reason,
    required_freshness_seconds=excluded.required_freshness_seconds,
    selected_at=clock_timestamp();

  insert into public.hq_workforce_memory_events(memory_id,event_kind,reason,payload)
  values(
    p_memory_id,'bound_to_objective','Memory selected as governed objective context.',
    jsonb_build_object('objective_id',p_objective_id,'context_role',p_context_role)
  );
end $$;

revoke all on function public.hq_workforce_bind_objective_context(uuid,uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.hq_workforce_bind_objective_context(uuid,uuid,text,text,bigint) to service_role;

-- Migration-time invariant: reconciliation must not activate any consequential Worker Engine surface.
do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'X7 context binding repair requires engine contract'; end if;
  if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled
     or ec.runtime_autonomy_level<>0 or ec.runtime_max_risk<>0
     or ec.shadow_enabled or ec.shadow_scheduler_enabled or not ec.shadow_global_stop then
    raise exception 'X7 context binding repair violated fail-closed L0/R0 boundary';
  end if;
end $$;
