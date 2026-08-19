-- Autopilot production commissioning: complete durable Shadow lineage.
-- NON-ACTIVATING. This enriches the existing append-only scheduler/shadow evidence
-- at INSERT time; it creates no executor, grant, budget, policy, or side effect.

create or replace function public.hq_autopilot_enrich_shadow_scheduler_event()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
declare
  v_worker_keys jsonb := '[]'::jsonb;
  v_capabilities jsonb := '[]'::jsonb;
  v_policy jsonb := '{}'::jsonb;
  v_budget jsonb := '{}'::jsonb;
  v_preconditions jsonb := '{}'::jsonb;
  v_verification jsonb := '{}'::jsonb;
  v_grants jsonb := '[]'::jsonb;
  v_global_stop boolean := true;
  v_runtime_enabled boolean := false;
  v_objective_scope_type text;
  v_objective_scope_ref jsonb := '{}'::jsonb;
begin
  if new.stage <> 'shadow' then return new; end if;

  select coalesce(jsonb_agg(distinct ps.worker_key) filter(where ps.worker_key is not null),'[]'::jsonb)
    into v_worker_keys
    from public.hq_workforce_plan_steps ps
   where (new.plan_step_id is not null and ps.id=new.plan_step_id)
      or (new.plan_step_id is null and new.plan_id is not null and ps.plan_id=new.plan_id);

  select coalesce(jsonb_agg(distinct jsonb_build_object(
           'capability_id',c.id,'capability_key',c.capability_key,'capability_version',c.version,
           'lifecycle_status',c.lifecycle_status,'autonomy_ceiling',c.autonomy_ceiling,'risk_class',c.risk_class
         )),'[]'::jsonb)
    into v_capabilities
    from public.hq_workforce_plan_steps ps
    join public.hq_workforce_plan_step_capabilities psc on psc.plan_step_id=ps.id and psc.role='required'
    join public.hq_workforce_capabilities c on c.id=psc.capability_id
   where (new.plan_step_id is not null and ps.id=new.plan_step_id)
      or (new.plan_step_id is null and new.plan_id is not null and ps.plan_id=new.plan_id);

  if new.objective_id is not null then
    select scope_type,scope_ref into v_objective_scope_type,v_objective_scope_ref
      from public.hq_workforce_objectives where id=new.objective_id;
  end if;

  select coalesce(to_jsonb(rp),'{}'::jsonb) into v_policy
    from public.hq_workforce_runtime_policies rp
   where rp.status='active' and rp.scope_kind='global' and rp.scope_key='global'
   order by rp.updated_at desc limit 1;

  select runtime_execution_enabled,shadow_global_stop into v_runtime_enabled,v_global_stop
    from public.hq_workforce_engine_contract where singleton=true;

  select coalesce(jsonb_agg(jsonb_build_object(
           'grant_id',g.id,'grant_key',g.grant_key,'worker_key',g.permitted_worker_key,
           'capability_key',g.capability_key,'capability_version',g.capability_version,
           'scope_type',g.scope_type,'scope_ref',g.scope_ref,'autonomy_level',g.autonomy_level,
           'risk_class',g.risk_class,'verification_required',g.verification_required,
           'idempotency_required',g.idempotency_required,'expires_at',g.expires_at
         )),'[]'::jsonb)
    into v_grants
    from public.hq_workforce_capability_authority_grants g
   where g.status='active' and g.activated_at is not null and g.activated_at<=clock_timestamp()
     and g.revoked_at is null and g.expires_at>clock_timestamp()
     and (jsonb_array_length(v_worker_keys)=0 or to_jsonb(g.permitted_worker_key) <@ v_worker_keys)
     and (jsonb_array_length(v_capabilities)=0 or exists(
       select 1 from jsonb_array_elements(v_capabilities) x
       where x->>'capability_key'=g.capability_key and (x->>'capability_version')::integer=g.capability_version));

  select jsonb_build_object(
           'decision',case when count(*)=0 then 'deny_no_active_budget' else 'available_not_reserved_shadow' end,
           'active_budget_count',count(*),
           'available_capacity',coalesce(sum(greatest(limit_amount-consumed_amount-reserved_amount,0)),0)
         ) into v_budget
    from public.hq_workforce_execution_budgets b
   where b.status='active' and b.period_start<=clock_timestamp() and b.period_end>clock_timestamp()
     and (jsonb_array_length(v_worker_keys)=0 or to_jsonb(b.worker_key) <@ v_worker_keys);

  select jsonb_build_object(
           'decision',case when count(*)=0 then 'no_bound_grant_precondition_contract' else 'contracts_present_not_snapshotted_shadow' end,
           'contracts',coalesce(jsonb_agg(g.precondition_contract) filter(where g.precondition_contract is not null),'[]'::jsonb)
         ) into v_preconditions
    from public.hq_workforce_capability_authority_grants g
   where g.status='active' and g.activated_at is not null and g.revoked_at is null and g.expires_at>clock_timestamp()
     and (jsonb_array_length(v_worker_keys)=0 or to_jsonb(g.permitted_worker_key) <@ v_worker_keys)
     and (jsonb_array_length(v_capabilities)=0 or exists(
       select 1 from jsonb_array_elements(v_capabilities) x
       where x->>'capability_key'=g.capability_key and (x->>'capability_version')::integer=g.capability_version));

  select jsonb_build_object(
           'required',coalesce(bool_or(coalesce(g.verification_required,false)),false)
                      or coalesce(bool_or(ps.verification_contract <> '{}'::jsonb),false),
           'route','independent_verifier_assignment_required_before_verified_success',
           'plan_step_contracts',coalesce(jsonb_agg(distinct ps.verification_contract) filter(where ps.verification_contract <> '{}'::jsonb),'[]'::jsonb)
         ) into v_verification
    from public.hq_workforce_plan_steps ps
    left join public.hq_workforce_capability_authority_grants g
      on g.permitted_worker_key=ps.worker_key and g.status='active' and g.revoked_at is null and g.expires_at>clock_timestamp()
   where (new.plan_step_id is not null and ps.id=new.plan_step_id)
      or (new.plan_step_id is null and new.plan_id is not null and ps.plan_id=new.plan_id);

  new.details := coalesce(new.details,'{}'::jsonb) || jsonb_build_object(
    'commissioning_lineage',jsonb_build_object(
      'cycle_key',new.cycle_key,
      'objective_id',new.objective_id,
      'plan_id',new.plan_id,
      'plan_step_id',new.plan_step_id,
      'worker_keys',v_worker_keys,
      'capabilities',v_capabilities,
      'objective_scope',jsonb_build_object('scope_type',v_objective_scope_type,'scope_ref',coalesce(v_objective_scope_ref,'{}'::jsonb)),
      'authority_decision',jsonb_build_object(
        'active_grants',v_grants,
        'decision',case
          when coalesce(v_global_stop,true) then 'deny_global_stop'
          when not coalesce(v_runtime_enabled,false) then 'deny_runtime_disabled'
          when jsonb_array_length(v_grants)=0 then 'deny_no_active_authority'
          else 'hypothetically_eligible_requires_all_gateway_checks'
        end
      ),
      'budget_decision',v_budget,
      'precondition_decision',v_preconditions,
      'would_execute',false,
      'verification_route',v_verification,
      'predicted_outcome',coalesce(new.details->'simulation',new.details),
      'policy_version',case when v_policy='{}'::jsonb then jsonb_build_object('status','absent') else jsonb_build_object('id',v_policy->>'id','policy_key',v_policy->>'policy_key','updated_at',v_policy->>'updated_at') end,
      'reason','Shadow evaluation records hypothetical control decisions only; consequential execution is structurally false.'
    )
  );
  return new;
end $$;

drop trigger if exists trg_hq_autopilot_enrich_shadow_scheduler_event on public.hq_workforce_scheduler_events;
create trigger trg_hq_autopilot_enrich_shadow_scheduler_event
before insert on public.hq_workforce_scheduler_events
for each row execute function public.hq_autopilot_enrich_shadow_scheduler_event();

-- No direct client or transport invocation is required; this is a table trigger only.
revoke all on function public.hq_autopilot_enrich_shadow_scheduler_event() from public,anon,authenticated,service_role;

do $$
declare ec public.hq_workforce_engine_contract%rowtype; d text;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'shadow_lineage_requires_engine_contract'; end if;
  if coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'shadow_lineage_changed_fail_closed_posture';
  end if;
  select lower(pg_get_functiondef('public.hq_autopilot_enrich_shadow_scheduler_event()'::regprocedure)) into d;
  if position('would_execute'',false' in d)=0 or position('commissioning_lineage' in d)=0 then
    raise exception 'shadow_lineage_contract_incomplete';
  end if;
end $$;
