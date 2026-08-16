-- WE-R1.4.12: owner-bound objective approval + immutable executable plan binding.
-- NON-ACTIVATING. This migration removes service_role as an approval identity and binds
-- every executable objective to the exact plan definition reviewed by a platform owner.
-- service_role remains transport for deterministic planning functions, never human truth.

alter table public.hq_workforce_objectives
  add column if not exists approved_plan_id uuid references public.hq_workforce_plans(id) on delete restrict,
  add column if not exists approved_plan_hash text,
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists approval_evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(approval_evidence)='array');

create or replace function public.hq_workforce_plan_authority_hash(p_plan_id uuid)
returns text
language sql
security definer
set search_path=public,extensions,pg_temp
stable
as $$
  select encode(extensions.digest(
    jsonb_build_object(
      'plan',jsonb_build_object(
        'id',p.id,'objective_id',p.objective_id,'plan_key',p.plan_key,'version',p.version,
        'strategy_key',p.strategy_key,'required_autonomy',p.required_autonomy,
        'required_risk',p.required_risk,'estimated_cost',p.estimated_cost,
        'estimated_latency_ms',p.estimated_latency_ms,'rationale',p.rationale,
        'verification_contract',p.verification_contract,'compensation_contract',p.compensation_contract,
        'provenance',p.provenance
      ),
      'steps',coalesce((select jsonb_agg(jsonb_build_object(
        'id',s.id,'step_key',s.step_key,'ordinal',s.ordinal,'purpose',s.purpose,
        'actor_mode',s.actor_mode,'worker_key',s.worker_key,'input_contract',s.input_contract,
        'expected_output',s.expected_output,'verification_contract',s.verification_contract,
        'required_autonomy',s.required_autonomy,'required_risk',s.required_risk,
        'estimated_cost',s.estimated_cost,'estimated_latency_ms',s.estimated_latency_ms
      ) order by s.ordinal,s.id) from public.hq_workforce_plan_steps s where s.plan_id=p.id),'[]'::jsonb),
      'capabilities',coalesce((select jsonb_agg(jsonb_build_object(
        'plan_step_id',c.plan_step_id,'capability_id',c.capability_id,'role',c.role,'minimum_coverage',c.minimum_coverage
      ) order by c.plan_step_id,c.capability_id,c.role)
        from public.hq_workforce_plan_step_capabilities c join public.hq_workforce_plan_steps s on s.id=c.plan_step_id where s.plan_id=p.id),'[]'::jsonb),
      'resources',coalesce((select jsonb_agg(jsonb_build_object(
        'plan_step_id',r.plan_step_id,'capability_id',r.capability_id,'resource_id',r.resource_id,
        'access_mode',r.access_mode,'resolution_event_id',r.resolution_event_id,'required',r.required
      ) order by r.plan_step_id,r.capability_id,r.resource_id,r.access_mode)
        from public.hq_workforce_plan_step_resources r join public.hq_workforce_plan_steps s on s.id=r.plan_step_id where s.plan_id=p.id),'[]'::jsonb),
      'dependencies',coalesce((select jsonb_agg(jsonb_build_object(
        'step_id',d.step_id,'depends_on_step_id',d.depends_on_step_id,'dependency_type',d.dependency_type
      ) order by d.step_id,d.depends_on_step_id,d.dependency_type)
        from public.hq_workforce_plan_dependencies d where d.plan_id=p.id),'[]'::jsonb)
    )::text,'sha256'
  ),'hex')
  from public.hq_workforce_plans p where p.id=p_plan_id;
$$;

-- Autonomous/system transition cannot manufacture human review state.
create or replace function public.hq_workforce_transition_objective(
  p_objective_id uuid,p_to_status text,p_reason text,p_actor_type text default 'system',p_actor_ref text default null,p_evidence_refs jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.hq_workforce_objectives%rowtype; v_allowed boolean:=false; v_event text;
begin
  if p_to_status in ('approved','rejected') then raise exception 'objective_review_requires_owner_identity'; end if;
  if p_actor_type not in ('system','worker','human') then raise exception 'objective_actor_type_invalid'; end if;
  if p_actor_type='human' then raise exception 'objective_human_actor_requires_owner_review_gateway'; end if;
  if char_length(btrim(coalesce(p_reason,''))) not between 3 and 4000 then raise exception 'objective_transition_reason_required'; end if;
  if coalesce(jsonb_typeof(p_evidence_refs),'null') <> 'array' then raise exception 'objective_evidence_refs_invalid'; end if;
  select * into o from public.hq_workforce_objectives where id=p_objective_id for update;
  if not found then raise exception 'objective_not_found'; end if;
  if o.status in ('achieved','cancelled','rejected') then raise exception 'objective_terminal_state'; end if;
  v_allowed := case o.status
    when 'detected' then p_to_status in ('context_pending','planning','blocked','cancelled')
    when 'context_pending' then p_to_status in ('planning','blocked','cancelled')
    when 'planning' then p_to_status in ('shadow_ready','blocked','cancelled')
    when 'shadow_ready' then p_to_status in ('awaiting_review','blocked','cancelled')
    when 'approved' then p_to_status in ('achieved','blocked','cancelled')
    when 'blocked' then p_to_status in ('context_pending','planning','cancelled')
    else false end;
  if not v_allowed then raise exception 'objective_transition_invalid:%->%',o.status,p_to_status; end if;
  if p_to_status='achieved' and jsonb_array_length(p_evidence_refs)=0 then raise exception 'objective_achievement_requires_evidence'; end if;
  v_event := case p_to_status when 'context_pending' then 'context_requested' when 'planning' then 'planning_started' when 'shadow_ready' then 'shadow_ready' when 'awaiting_review' then 'review_requested' when 'blocked' then 'blocked' when 'achieved' then 'achieved' when 'cancelled' then 'cancelled' else 'correction' end;
  update public.hq_workforce_objectives
     set status=p_to_status,updated_at=clock_timestamp(),
         achieved_at=case when p_to_status='achieved' then clock_timestamp() else null end,
         cancelled_at=case when p_to_status='cancelled' then clock_timestamp() else null end
   where id=p_objective_id;
  insert into public.hq_workforce_objective_events(objective_id,event_kind,from_status,to_status,actor_type,actor_ref,reason,evidence_refs)
  values(p_objective_id,v_event,o.status,p_to_status,p_actor_type,p_actor_ref,btrim(p_reason),p_evidence_refs);
  return jsonb_build_object('objective_id',p_objective_id,'from_status',o.status,'to_status',p_to_status,'consequential_execution',false);
end $$;

create or replace function public.hq_workforce_owner_review_objective(
  p_objective_id uuid,p_decision text,p_reason text,p_evidence_refs jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  o public.hq_workforce_objectives%rowtype;
  v_plan_id uuid;
  v_plan_count integer;
  v_hash text;
  v_uid uuid;
  v_dag jsonb;
begin
  perform public.hq_assert_owner();
  v_uid:=auth.uid();
  if v_uid is null then raise exception 'objective_review_requires_authenticated_owner'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'objective_review_decision_invalid'; end if;
  if char_length(btrim(coalesce(p_reason,''))) not between 3 and 4000 then raise exception 'objective_review_reason_required'; end if;
  if coalesce(jsonb_typeof(p_evidence_refs),'null')<>'array' or jsonb_array_length(p_evidence_refs)=0 then raise exception 'objective_review_evidence_required'; end if;

  select * into o from public.hq_workforce_objectives where id=p_objective_id for update;
  if not found then raise exception 'objective_not_found'; end if;
  if o.status<>'awaiting_review' then raise exception 'objective_not_awaiting_review:%',o.status; end if;

  if p_decision='approved' then
    select count(*),min(id) into v_plan_count,v_plan_id from public.hq_workforce_plans where objective_id=o.id and status='selected';
    if v_plan_count<>1 or v_plan_id is null then raise exception 'objective_approval_requires_exactly_one_selected_plan:%',v_plan_count; end if;
    v_dag:=public.hq_workforce_validate_plan_dag(v_plan_id);
    if not coalesce((v_dag->>'valid')::boolean,false) then raise exception 'objective_approval_plan_dag_invalid'; end if;
    if exists(select 1 from public.hq_workforce_plan_steps where plan_id=v_plan_id and status not in ('resolvable','simulated')) then
      raise exception 'objective_approval_plan_has_unresolved_steps';
    end if;
    v_hash:=public.hq_workforce_plan_authority_hash(v_plan_id);
    if v_hash is null then raise exception 'objective_approval_plan_hash_missing'; end if;

    update public.hq_workforce_objectives
       set status='approved',approved_plan_id=v_plan_id,approved_plan_hash=v_hash,
           approved_by=v_uid,approved_at=clock_timestamp(),approval_evidence=p_evidence_refs,
           updated_at=clock_timestamp()
     where id=o.id;
  else
    update public.hq_workforce_objectives
       set status='rejected',approved_plan_id=null,approved_plan_hash=null,
           approved_by=v_uid,approved_at=clock_timestamp(),approval_evidence=p_evidence_refs,
           updated_at=clock_timestamp()
     where id=o.id;
  end if;

  insert into public.hq_workforce_objective_events(objective_id,event_kind,from_status,to_status,actor_type,actor_ref,reason,evidence_refs,payload)
  values(o.id,p_decision,'awaiting_review',p_decision,'human',v_uid::text,btrim(p_reason),p_evidence_refs,
         jsonb_build_object('approved_plan_id',v_plan_id,'approved_plan_hash',v_hash));
  return jsonb_build_object('objective_id',o.id,'decision',p_decision,'approved_plan_id',v_plan_id,'approved_plan_hash',v_hash);
end $$;

create or replace function public.hq_workforce_assert_approved_plan_binding(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  s public.hq_workforce_plan_steps%rowtype;
  p public.hq_workforce_plans%rowtype;
  o public.hq_workforce_objectives%rowtype;
  v_hash text;
begin
  select * into t from public.hq_workforce_task_contracts where id=p_task_id;
  if not found then raise exception 'task_not_found'; end if;
  if t.plan_step_id is null then raise exception 'approved_plan_binding_plan_step_required'; end if;
  select * into s from public.hq_workforce_plan_steps where id=t.plan_step_id;
  if not found then raise exception 'approved_plan_binding_step_missing'; end if;
  select * into p from public.hq_workforce_plans where id=s.plan_id;
  if not found then raise exception 'approved_plan_binding_plan_missing'; end if;
  select * into o from public.hq_workforce_objectives where id=p.objective_id;
  if not found then raise exception 'approved_plan_binding_objective_missing'; end if;
  if o.status<>'approved' or o.approved_plan_id is distinct from p.id or o.approved_by is null or o.approved_at is null then
    raise exception 'approved_plan_binding_denied';
  end if;
  v_hash:=public.hq_workforce_plan_authority_hash(p.id);
  if o.approved_plan_hash is null or v_hash is distinct from o.approved_plan_hash then
    raise exception 'approved_plan_definition_changed_after_review';
  end if;
end $$;

-- Preserve the already-certified R1.4 implementation as an inaccessible internal body,
-- and put the owner-approved plan binding in front of every canonical gateway call.
alter function public.hq_workforce_consequential_execution_gateway(uuid)
  rename to hq_workforce_consequential_execution_gateway_r14_pre_approval_binding;

create or replace function public.hq_workforce_consequential_execution_gateway(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  perform public.hq_workforce_assert_approved_plan_binding(p_task_id);
  return public.hq_workforce_consequential_execution_gateway_r14_pre_approval_binding(p_task_id);
end $$;

-- Direct data-plane writes can no longer manufacture planning/approval truth.
revoke insert,update,delete on table public.hq_workforce_objectives from service_role;
revoke insert,update,delete on table public.hq_workforce_plans from service_role;
revoke insert,update,delete on table public.hq_workforce_plan_steps from service_role;
revoke insert,update,delete on table public.hq_workforce_plan_step_capabilities from service_role;
revoke insert,update,delete on table public.hq_workforce_plan_step_resources from service_role;
revoke insert,update,delete on table public.hq_workforce_plan_dependencies from service_role;
revoke insert,update,delete on table public.hq_workforce_plan_step_work_items from service_role;

revoke all on function public.hq_workforce_plan_authority_hash(uuid) from public,anon,authenticated,service_role;
grant execute on function public.hq_workforce_plan_authority_hash(uuid) to service_role;
revoke all on function public.hq_workforce_transition_objective(uuid,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.hq_workforce_transition_objective(uuid,text,text,text,text,jsonb) to service_role;
revoke all on function public.hq_workforce_owner_review_objective(uuid,text,text,jsonb) from public,anon,service_role;
grant execute on function public.hq_workforce_owner_review_objective(uuid,text,text,jsonb) to authenticated;
revoke all on function public.hq_workforce_assert_approved_plan_binding(uuid) from public,anon,authenticated,service_role;
grant execute on function public.hq_workforce_assert_approved_plan_binding(uuid) to service_role;
revoke all on function public.hq_workforce_consequential_execution_gateway_r14_pre_approval_binding(uuid) from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_consequential_execution_gateway(uuid) from public,anon,authenticated;
grant execute on function public.hq_workforce_consequential_execution_gateway(uuid) to service_role;

-- tool_gateway_execute resolves the canonical gateway by name at runtime, so it now
-- inherits the approval binding without creating a second mutation implementation.

-- NON-ACTIVATION + schema contract attestation.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WE-R1.4.12 requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'WE-R1.4.12 violated fail_closed_activation_boundary';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'WE-R1.4.12 cannot install with active capability authority'; end if;
  if has_table_privilege('service_role','public.hq_workforce_objectives','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_plans','UPDATE')
     or has_table_privilege('service_role','public.hq_workforce_plan_steps','UPDATE') then
    raise exception 'WE-R1.4.12 direct planning write closure failed';
  end if;
end $$;
