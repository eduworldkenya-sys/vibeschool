-- TASK 16: make the explicit envelope compatible with R1.4 authority resolution order
-- without allowing hidden active grants outside the owner-selected envelope.

create or replace function public.hq_workforce_guard_activation_envelope_authority_set()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_active integer; v_selected_active integer;
begin
  select count(*) into v_active
    from public.hq_workforce_capability_authority_grants
   where status='active' and activated_at is not null and activated_by is not null and expires_at>clock_timestamp();

  select count(*) into v_selected_active
    from public.hq_workforce_capability_authority_grants
   where id=any(new.authority_grant_ids)
     and status='active' and activated_at is not null and activated_by is not null and expires_at>clock_timestamp();

  if v_selected_active<>cardinality(new.authority_grant_ids) then
    raise exception 'runtime_activation_envelope_selected_authority_not_active';
  end if;
  if v_active<>v_selected_active then
    raise exception 'runtime_activation_unselected_active_authority_present';
  end if;
  return new;
end $$;

drop trigger if exists trg_hq_workforce_guard_activation_envelope_authority_set
  on public.hq_workforce_runtime_activation_envelopes;
create trigger trg_hq_workforce_guard_activation_envelope_authority_set
before insert on public.hq_workforce_runtime_activation_envelopes
for each row execute function public.hq_workforce_guard_activation_envelope_authority_set();

create or replace function public.hq_workforce_assert_task_in_active_envelope(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  ec public.hq_workforce_engine_contract%rowtype;
  e public.hq_workforce_runtime_activation_envelopes%rowtype;
  t public.hq_workforce_task_contracts%rowtype;
  v_matching_grants integer:=0;
  v_active_outside integer:=0;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found or ec.runtime_state<>'CONTROLLED_OPERATING' or not ec.runtime_execution_enabled
     or ec.runtime_activation_envelope_id is null then
    raise exception 'worker_runtime_activation_envelope_required';
  end if;

  select * into e from public.hq_workforce_runtime_activation_envelopes
   where id=ec.runtime_activation_envelope_id and status='active';
  if not found then raise exception 'worker_runtime_activation_envelope_not_active'; end if;
  if e.runtime_state_version<>ec.runtime_state_version then raise exception 'worker_runtime_activation_envelope_version_mismatch'; end if;
  if e.expires_at<=clock_timestamp() then raise exception 'worker_runtime_activation_envelope_expired'; end if;
  if e.autonomy_level<>ec.runtime_autonomy_level or e.max_risk<>ec.runtime_max_risk then
    raise exception 'worker_runtime_activation_envelope_projection_mismatch';
  end if;

  -- No hidden active authority may exist while an explicit envelope is operating.
  select count(*) into v_active_outside
    from public.hq_workforce_capability_authority_grants g
   where g.status='active' and g.activated_at is not null and g.activated_by is not null
     and g.expires_at>clock_timestamp() and not (g.id=any(e.authority_grant_ids));
  if v_active_outside<>0 then raise exception 'worker_runtime_unselected_active_authority_detected'; end if;

  select * into t from public.hq_workforce_task_contracts where id=p_task_id;
  if not found then raise exception 'worker_runtime_task_not_found'; end if;

  if t.autonomous_authority_grant_id is not null then
    if not (t.autonomous_authority_grant_id=any(e.authority_grant_ids)) then
      raise exception 'worker_runtime_task_outside_activation_envelope';
    end if;
    v_matching_grants:=1;
  else
    -- First execution reaches runtime authorization before the R1.4 consequential
    -- authorizer persists the grant ID. Match the task against the exact selected
    -- authority semantics; because no active grant outside the envelope is allowed,
    -- the subsequent canonical resolver cannot choose hidden authority.
    select count(*) into v_matching_grants
      from public.hq_workforce_capability_authority_grants g
     where g.id=any(e.authority_grant_ids)
       and g.status='active' and g.activated_at is not null and g.activated_by is not null and g.expires_at>clock_timestamp()
       and (g.permitted_worker_key is null or g.permitted_worker_key=t.worker_key)
       and g.capability_key=t.capability_key
       and g.capability_version=t.capability_version
       and g.operation=t.operation
       and g.resource_type=t.resource_type
       and g.scope_type=t.scope_type
       and g.scope_ref=t.scope_ref;
    if v_matching_grants<1 then raise exception 'worker_runtime_task_outside_activation_envelope'; end if;
  end if;

  return jsonb_build_object(
    'activation_envelope_id',e.id,
    'runtime_state_version',e.runtime_state_version,
    'envelope_expires_at',e.expires_at,
    'authority_grant_id',t.autonomous_authority_grant_id,
    'matching_selected_authority_count',v_matching_grants
  );
end $$;

revoke all on function public.hq_workforce_guard_activation_envelope_authority_set()
  from public,anon,authenticated,service_role;
