-- VIBESCHOOL TASK 15: owner-safe R1.4 authority draft bridge.
-- NON-ACTIVATING. This function cannot create worker identity, certification, legacy
-- capability authority, budgets, runtime policy, or active R1.4 authority. It only
-- derives a DRAFT from an already-earned canonical worker/capability/skill/tool package.

create or replace function public.hq_workforce_owner_authority_catalog(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  lim integer:=greatest(1,least(coalesce(p_limit,50),100));
begin
  perform public.hq_assert_owner();
  return jsonb_build_object(
    'generated_at',clock_timestamp(),
    'counts',jsonb_build_object(
      'certified_packages',(
        select count(*)
        from public.hq_workforce_capabilities c
        join public.hq_workforce_skill_capabilities sc on sc.capability_id=c.id and sc.role='implements'
        join public.hq_workforce_skill_manifests sm on sm.id=sc.skill_manifest_id
        join public.hq_workforce_tool_contracts tc on tc.id=sm.tool_contract_id
        where c.lifecycle_status='certified'
          and sm.certification_status='certified'
          and (sm.expires_at is null or sm.expires_at>clock_timestamp())
          and tc.status='approved'
      ),
      'active_worker_identities',(
        select count(*) from public.hq_workforce_identities
        where status='active' and expires_at>clock_timestamp()
      ),
      'active_legacy_capability_grants',(
        select count(*) from public.hq_workforce_capability_grants
        where status='active' and expires_at>clock_timestamp()
      ),
      'active_budgets',(
        select count(*) from public.hq_workforce_execution_budgets
        where status='active' and period_start<=clock_timestamp() and period_end>clock_timestamp()
      )
    ),
    'candidates',coalesce((
      select jsonb_agg(to_jsonb(q) order by q.worker_key,q.capability_key,q.version desc)
      from (
        select
          w.worker_key,
          w.title as worker_title,
          c.capability_key,
          c.version,
          c.display_name,
          greatest(c.risk_class,sm.risk_class)::smallint as required_risk,
          sm.autonomy_required::smallint as required_autonomy,
          sm.id as skill_manifest_id,
          sm.skill_key,
          sm.max_records_affected,
          sm.max_attempts,
          sm.verification_required,
          sm.compensation_strategy,
          tc.id as tool_contract_id,
          tc.tool_key,
          tc.operation,
          tc.resource_type,
          lg.scope_type,
          lg.scope_ref,
          lg.expires_at as foundational_authority_expires_at,
          wi.expires_at as identity_expires_at,
          sm.expires_at as skill_expires_at
        from public.hq_workforce_capability_grants lg
        join public.hq_workforce_workers w on w.worker_key=lg.worker_key
        join public.hq_workforce_identities wi on wi.worker_key=w.worker_key
          and wi.status='active' and wi.expires_at>clock_timestamp()
        join public.hq_workforce_capabilities c on c.capability_key=lg.capability_key
          and c.lifecycle_status='certified'
        join public.hq_workforce_skill_capabilities sc on sc.capability_id=c.id and sc.role='implements'
        join public.hq_workforce_skill_manifests sm on sm.id=sc.skill_manifest_id
          and sm.certification_status='certified'
          and (sm.expires_at is null or sm.expires_at>clock_timestamp())
        join public.hq_workforce_tool_contracts tc on tc.id=sm.tool_contract_id
          and tc.status='approved'
          and tc.required_capability_key=c.capability_key
          and tc.operation=lg.operation
          and tc.resource_type=lg.resource_type
        where lg.status='active'
          and lg.expires_at>clock_timestamp()
          and public.hq_workforce_current_lifecycle_state(w.worker_key)='active'
          and lg.scope_type=any(sm.allowed_scope_types)
          and sm.autonomy_required<=c.autonomy_ceiling
          and exists(
            select 1 from public.hq_workforce_execution_budgets b
            where b.worker_key=w.worker_key and b.status='active'
              and b.period_start<=clock_timestamp() and b.period_end>clock_timestamp()
          )
          and not exists(
            select 1 from public.hq_workforce_capability_authority_grants ag
            where ag.permitted_worker_key=w.worker_key
              and ag.capability_key=c.capability_key
              and ag.capability_version=c.version
              and ag.skill_manifest_id=sm.id
              and ag.tool_contract_id=tc.id
              and ag.operation=tc.operation
              and ag.resource_type=tc.resource_type
              and ag.scope_type=lg.scope_type
              and ag.scope_ref=lg.scope_ref
              and ag.status in ('draft','certified','active','suspended')
              and ag.expires_at>clock_timestamp()
          )
        order by w.worker_key,c.capability_key,c.version desc
        limit lim
      ) q
    ),'[]'::jsonb)
  );
end $$;

create or replace function public.hq_workforce_owner_issue_authority_draft(
  p_worker_key text,
  p_capability_key text,
  p_capability_version integer,
  p_duration_minutes integer default 60,
  p_max_operations_per_cycle integer default 1,
  p_max_records_per_operation integer default 1,
  p_max_concurrency integer default 1,
  p_max_executions_per_minute integer default 5,
  p_reason text default 'HQ Control Room temporary authority draft'
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid;
  ec public.hq_workforce_engine_contract%rowtype;
  w public.hq_workforce_workers%rowtype;
  wi public.hq_workforce_identities%rowtype;
  c public.hq_workforce_capabilities%rowtype;
  sm public.hq_workforce_skill_manifests%rowtype;
  tc public.hq_workforce_tool_contracts%rowtype;
  lg public.hq_workforce_capability_grants%rowtype;
  v_expiry timestamptz;
  v_grant_key text;
  v_grant_id uuid;
  v_required_autonomy smallint;
  v_required_risk smallint;
  v_verification jsonb;
  v_preconditions jsonb;
begin
  perform public.hq_assert_owner();
  v_uid:=auth.uid();
  if v_uid is null then raise exception 'control_room_owner_required'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'control_room_reason_required'; end if;
  if p_duration_minutes<5 or p_duration_minutes>1440 then raise exception 'control_room_authority_duration_out_of_range'; end if;
  if p_max_operations_per_cycle<1 or p_max_operations_per_cycle>20 then raise exception 'control_room_authority_operation_limit_out_of_range'; end if;
  if p_max_records_per_operation<1 then raise exception 'control_room_authority_record_limit_out_of_range'; end if;
  if p_max_concurrency<1 or p_max_concurrency>20 then raise exception 'control_room_authority_concurrency_out_of_range'; end if;
  if p_max_executions_per_minute<1 or p_max_executions_per_minute>1000 then raise exception 'control_room_authority_rate_out_of_range'; end if;

  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'runtime_contract_missing'; end if;
  if ec.runtime_execution_enabled then raise exception 'control_room_authority_draft_requires_runtime_off'; end if;

  select * into w from public.hq_workforce_workers where worker_key=p_worker_key;
  if not found then raise exception 'control_room_worker_not_found'; end if;
  if public.hq_workforce_current_lifecycle_state(w.worker_key)<>'active' then raise exception 'control_room_worker_not_active'; end if;
  perform public.hq_workforce_assert_certification(w.worker_key);
  perform public.hq_workforce_assert_identity(w.worker_key);
  select * into wi from public.hq_workforce_identities
    where worker_key=w.worker_key and status='active' and expires_at>clock_timestamp()
    order by issued_at desc limit 1;
  if not found then raise exception 'control_room_worker_identity_missing'; end if;

  select * into c from public.hq_workforce_capabilities
   where capability_key=p_capability_key and version=p_capability_version and lifecycle_status='certified';
  if not found then raise exception 'control_room_capability_not_certified'; end if;

  select smx.* into sm
    from public.hq_workforce_skill_manifests smx
    join public.hq_workforce_skill_capabilities sc on sc.skill_manifest_id=smx.id
      and sc.capability_id=c.id and sc.role='implements'
    where smx.certification_status='certified'
      and (smx.expires_at is null or smx.expires_at>clock_timestamp())
    order by smx.certified_at desc nulls last,smx.created_at desc
    limit 1;
  if not found then raise exception 'control_room_skill_not_certified'; end if;
  if sm.requires_human_approval then raise exception 'control_room_skill_requires_human_approval'; end if;
  if p_max_records_per_operation>sm.max_records_affected then raise exception 'control_room_authority_record_limit_exceeds_skill'; end if;

  select * into tc from public.hq_workforce_tool_contracts
   where id=sm.tool_contract_id and status='approved'
     and required_capability_key=c.capability_key;
  if not found then raise exception 'control_room_tool_contract_not_approved'; end if;

  select * into lg from public.hq_workforce_capability_grants
   where worker_key=w.worker_key and capability_key=c.capability_key
     and operation=tc.operation and resource_type=tc.resource_type
     and status='active' and expires_at>clock_timestamp()
   order by granted_at desc limit 1;
  if not found then raise exception 'control_room_foundational_capability_grant_missing'; end if;
  if not (lg.scope_type=any(sm.allowed_scope_types)) then raise exception 'control_room_foundational_scope_denied'; end if;
  if not exists(
    select 1 from public.hq_workforce_execution_budgets b
    where b.worker_key=w.worker_key and b.status='active'
      and b.period_start<=clock_timestamp() and b.period_end>clock_timestamp()
  ) then raise exception 'control_room_worker_budget_missing'; end if;

  v_required_autonomy:=sm.autonomy_required;
  v_required_risk:=greatest(c.risk_class,sm.risk_class);
  if v_required_autonomy>c.autonomy_ceiling then raise exception 'control_room_capability_autonomy_ceiling_exceeded'; end if;

  v_expiry:=least(
    clock_timestamp()+make_interval(mins=>p_duration_minutes),
    lg.expires_at,
    wi.expires_at,
    coalesce(sm.expires_at,'infinity'::timestamptz)
  );
  if v_expiry<=clock_timestamp()+interval '1 minute' then raise exception 'control_room_authority_effective_duration_too_short'; end if;

  if exists(
    select 1 from public.hq_workforce_capability_authority_grants ag
    where ag.permitted_worker_key=w.worker_key
      and ag.capability_key=c.capability_key and ag.capability_version=c.version
      and ag.skill_manifest_id=sm.id and ag.tool_contract_id=tc.id
      and ag.operation=tc.operation and ag.resource_type=tc.resource_type
      and ag.scope_type=lg.scope_type and ag.scope_ref=lg.scope_ref
      and ag.status in ('draft','certified','active','suspended')
      and ag.expires_at>clock_timestamp()
  ) then raise exception 'control_room_authority_nonterminal_grant_already_exists'; end if;

  v_grant_key:='hq-control-room-'||left(md5(
    v_uid::text||'|'||w.worker_key||'|'||c.capability_key||'|'||c.version::text||'|'||clock_timestamp()::text
  ),24);
  v_verification:=jsonb_build_array(
    jsonb_build_object('type','certified_capability_verification','contract',c.verification_contract),
    jsonb_build_object('type','skill_verification_required','required',sm.verification_required)
  );
  v_preconditions:=jsonb_build_array(
    jsonb_build_object('type','worker_identity_active','worker_key',w.worker_key),
    jsonb_build_object('type','worker_certification_active','worker_key',w.worker_key),
    jsonb_build_object('type','foundational_capability_grant_active','grant_id',lg.id),
    jsonb_build_object('type','tool_contract_approved','tool_contract_id',tc.id),
    jsonb_build_object('type','runtime_policy_intersection_required','required',true)
  );

  v_grant_id:=public.hq_workforce_issue_capability_authority_draft(
    v_grant_key,c.capability_key,c.version,sm.id,tc.id,w.worker_key,
    tc.operation,tc.resource_type,lg.scope_type,lg.scope_ref,
    v_required_autonomy,v_required_risk,
    p_max_operations_per_cycle,p_max_records_per_operation,p_max_concurrency,p_max_executions_per_minute,
    true,true,true,sm.compensation_strategy,v_preconditions,v_verification,v_expiry
  );

  insert into public.hq_workforce_owner_control_events(
    action_key,actor_id,previous_state,requested_state,result_state,outcome,reason
  ) values(
    'authority_change',v_uid,
    jsonb_build_object('worker_key',w.worker_key,'capability_key',c.capability_key,'existing_r1_4_authority',false),
    jsonb_build_object('action','issue_draft','duration_minutes',p_duration_minutes,
      'max_operations_per_cycle',p_max_operations_per_cycle,'max_records_per_operation',p_max_records_per_operation,
      'max_concurrency',p_max_concurrency,'max_executions_per_minute',p_max_executions_per_minute),
    jsonb_build_object('grant_id',v_grant_id,'grant_key',v_grant_key,'status','draft','expires_at',v_expiry,
      'worker_key',w.worker_key,'capability_key',c.capability_key,'capability_version',c.version),
    'succeeded',btrim(p_reason)
  );

  return jsonb_build_object(
    'grant_id',v_grant_id,'grant_key',v_grant_key,'status','draft','expires_at',v_expiry,
    'worker_key',w.worker_key,'capability_key',c.capability_key,'capability_version',c.version,
    'operation',tc.operation,'resource_type',tc.resource_type,'scope_type',lg.scope_type,'scope_ref',lg.scope_ref,
    'autonomy_level',v_required_autonomy,'risk_class',v_required_risk
  );
end $$;

revoke all on function public.hq_workforce_owner_authority_catalog(integer) from public,anon,service_role;
revoke all on function public.hq_workforce_owner_issue_authority_draft(text,text,integer,integer,integer,integer,integer,integer,text) from public,anon,service_role;
grant execute on function public.hq_workforce_owner_authority_catalog(integer) to authenticated;
grant execute on function public.hq_workforce_owner_issue_authority_draft(text,text,integer,integer,integer,integer,integer,integer,text) to authenticated;
