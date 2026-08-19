-- Forward-only repair for missing WE-R1.4.10 priority-canary semantics on production lineage.
-- Preserves later R1.4.12+ approval, durable-breaker and independent-verifier wrappers.

create or replace function public.hq_workforce_consequential_execution_gateway_r14_pre_approval_binding(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  t public.hq_workforce_task_contracts%rowtype;
  tc public.hq_workforce_tool_contracts%rowtype;
  g public.hq_workforce_capability_authority_grants%rowtype;
  wi public.hq_work_items%rowtype;
  budget_id uuid;
  work_item_id uuid;
  auth jsonb;
  limits jsonb;
  v_authority_id uuid;
  v_resource_identity jsonb;
  v_precondition jsonb;
  v_desired jsonb;
  v_intent jsonb;
  v_intent_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_priority text;
  result jsonb;
  started_at timestamptz:=clock_timestamp();
  max_runtime_ms integer;
begin
  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'task_not_found'; end if;
  if t.status<>'running' then raise exception 'task_not_running'; end if;
  auth:=public.hq_workforce_assert_consequential_task_authorized(t.id);
  v_authority_id:=nullif(auth->>'authority_grant_id','')::uuid;
  if v_authority_id is null then raise exception 'consequential_authority_evidence_missing'; end if;
  select * into t from public.hq_workforce_task_contracts where id=p_task_id;
  if t.autonomous_authority_grant_id is distinct from v_authority_id then raise exception 'consequential_authority_binding_mismatch'; end if;
  select * into g from public.hq_workforce_capability_authority_grants where id=v_authority_id;
  if not found then raise exception 'capability_execution_authority_not_found'; end if;
  max_runtime_ms:=g.max_runtime_ms;
  select * into tc from public.hq_workforce_tool_contracts where id=t.tool_contract_id and status='approved';
  if not found then raise exception 'tool_contract_not_approved'; end if;
  work_item_id:=nullif(t.payload->>'work_item_id','')::uuid;
  if work_item_id is null then raise exception 'work_item_id_required'; end if;
  v_resource_identity:=jsonb_build_object('work_item_id',work_item_id);
  v_precondition:=t.payload->'precondition_snapshot';
  v_desired:=t.payload->'desired_state';
  if coalesce(jsonb_typeof(v_precondition),'null')<>'object' then raise exception 'precondition_snapshot_required'; end if;
  if coalesce(jsonb_typeof(v_desired),'null')<>'object' then raise exception 'desired_state_required'; end if;
  if tc.handler_key='work_item.triage_and_own' then
    if not (v_precondition ? 'status' and v_precondition ? 'updated_at') then raise exception 'work_item_precondition_incomplete'; end if;
    if v_desired->>'status' is distinct from 'in_progress' then raise exception 'work_item_desired_state_denied'; end if;
  elsif tc.handler_key='work_item.prioritize' then
    if t.capability_key<>'internal.work_queue.prioritize' or t.capability_version<>1 or t.operation<>'update_priority' or t.resource_type<>'hq_work_items' or t.scope_type<>'platform_internal' then raise exception 'priority_canary_contract_mismatch'; end if;
    if not (v_precondition ? 'priority' and v_precondition ? 'updated_at') then raise exception 'priority_canary_precondition_incomplete'; end if;
    if jsonb_object_length(v_desired)<>1 or not (v_desired ? 'priority') then raise exception 'priority_canary_desired_state_not_priority_only'; end if;
    v_priority:=v_desired->>'priority';
    if v_priority is null or v_priority not in ('low','normal','high','critical') then raise exception 'priority_canary_priority_invalid'; end if;
    perform 1 from public.hq_workforce_canary_queue_memberships m where m.work_item_id=work_item_id and m.queue_key='worker_engine_internal' for key share;
    if not found then raise exception 'priority_canary_queue_membership_required'; end if;
  else raise exception 'tool_handler_not_allowlisted'; end if;
  v_intent:=public.hq_workforce_reserve_execution_intent(t.id,v_authority_id,v_resource_identity,v_precondition,v_desired);
  v_intent_id:=nullif(v_intent->>'intent_id','')::uuid;
  if coalesce((v_intent->>'reused')::boolean,false) then return coalesce(v_intent->'result','{}'::jsonb)||jsonb_build_object('idempotent_replay',true,'intent_id',v_intent_id); end if;
  if v_intent_id is null then raise exception 'execution_intent_evidence_missing'; end if;
  perform public.hq_workforce_assert_execution_not_stopped(t.id,'pre_reservation');
  if extract(epoch from (clock_timestamp()-started_at))*1000 >= max_runtime_ms then raise exception 'capability_runtime_ceiling_exceeded_before_mutation'; end if;
  budget_id:=public.hq_workforce_reserve_budget(t.worker_key,t.budget_key,t.budget_amount);
  begin
    select * into wi from public.hq_work_items where id=work_item_id for update;
    if not found then raise exception 'work_item_not_found'; end if;
    if tc.handler_key='work_item.triage_and_own' then
      if wi.status is distinct from (v_precondition->>'status') then raise exception 'work_item_precondition_status_changed'; end if;
      if wi.updated_at is distinct from (v_precondition->>'updated_at')::timestamptz then raise exception 'work_item_precondition_version_changed'; end if;
      if wi.status<>'open' then raise exception 'work_item_not_open'; end if;
      v_before:=jsonb_build_object('status',wi.status,'action_taken',coalesce(wi.action_taken,'null'::jsonb),'acted_at',case when wi.acted_at is null then null else to_jsonb(wi.acted_at) end);
      v_after:=jsonb_build_object('status','in_progress','task_id',t.id::text,'authority_grant_id',v_authority_id::text,'plan_step_id',t.plan_step_id::text,'execution_intent_id',v_intent_id::text);
    else
      if not exists(select 1 from public.hq_workforce_canary_queue_memberships m where m.work_item_id=wi.id and m.queue_key='worker_engine_internal') then raise exception 'priority_canary_queue_membership_lost'; end if;
      if wi.priority is distinct from (v_precondition->>'priority') then raise exception 'priority_canary_precondition_priority_changed'; end if;
      if wi.updated_at is distinct from (v_precondition->>'updated_at')::timestamptz then raise exception 'work_item_precondition_version_changed'; end if;
      v_before:=jsonb_build_object('priority',wi.priority);
      v_after:=jsonb_build_object('priority',v_priority);
    end if;
    update public.hq_workforce_execution_intents set authoritative_before_state=v_before,expected_after_state=v_after where id=v_intent_id and status='reserved';
    if not found then raise exception 'execution_recovery_snapshot_not_recorded'; end if;
    if extract(epoch from (clock_timestamp()-started_at))*1000 >= max_runtime_ms then raise exception 'capability_runtime_ceiling_exceeded_before_mutation'; end if;
    limits:=public.hq_workforce_reserve_capability_execution(t.id,1);
    if extract(epoch from (clock_timestamp()-started_at))*1000 >= max_runtime_ms then raise exception 'capability_runtime_ceiling_exceeded_before_mutation'; end if;
    perform public.hq_workforce_assert_execution_not_stopped(t.id,'pre_mutation');
    if tc.handler_key='work_item.triage_and_own' then
      update public.hq_work_items set action_taken=coalesce(action_taken,'{}'::jsonb)||jsonb_build_object('worker_key',t.worker_key,'action','triage_and_own','task_id',t.id,'authority_grant_id',v_authority_id,'plan_step_id',t.plan_step_id,'execution_intent_id',v_intent_id),acted_at=coalesce(acted_at,clock_timestamp()),updated_at=clock_timestamp(),status='in_progress' where id=work_item_id;
    else update public.hq_work_items set priority=v_priority where id=work_item_id; end if;
    if not found then raise exception 'work_item_mutation_failed'; end if;
    if not exists(select 1 from public.hq_workforce_execution_intents where id=v_intent_id and status='reserved' and authoritative_before_state<>'{}'::jsonb and expected_after_state<>'{}'::jsonb) then raise exception 'execution_recovery_snapshot_not_recorded'; end if;
    if extract(epoch from (clock_timestamp()-started_at))*1000 >= max_runtime_ms then raise exception 'capability_runtime_ceiling_exceeded'; end if;
    result:=jsonb_build_object('handler',tc.handler_key,'work_item_id',work_item_id,'worker_key',t.worker_key,'authority_grant_id',v_authority_id,'plan_step_id',t.plan_step_id,'execution_intent_id',v_intent_id,'side_effect',case when tc.handler_key='work_item.prioritize' then 'hq_work_items.priority_updated' else 'hq_work_items.updated' end,'authorization',auth,'capability_limits',limits,'circuit_breakers_checked',true,'records_affected',1,'elapsed_ms',floor(extract(epoch from (clock_timestamp()-started_at))*1000),'idempotent_replay',false);
    perform public.hq_workforce_consume_budget(budget_id,t.budget_amount);
    perform public.hq_workforce_commit_execution_intent(v_intent_id,result);
    return result;
  exception when others then perform public.hq_workforce_release_budget(budget_id,t.budget_amount); raise; end;
end $$;

create or replace function public.hq_workforce_verify_consequential_execution_r14_unbound_internal(p_task_id uuid,p_verifier_key text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  t public.hq_workforce_task_contracts%rowtype; i public.hq_workforce_execution_intents%rowtype; g public.hq_workforce_capability_authority_grants%rowtype; wi public.hq_work_items%rowtype;
  v_expected jsonb; v_observed jsonb; v_pass boolean:=false; v_id uuid; v_work_item_id uuid; v_is_priority_canary boolean:=false;
begin
  if char_length(btrim(coalesce(p_verifier_key,'')))<3 then raise exception 'independent_verifier_required'; end if;
  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'verification_task_not_found'; end if;
  if p_verifier_key=t.worker_key then raise exception 'worker_cannot_verify_own_execution'; end if;
  if t.status<>'completed' then raise exception 'verification_task_not_completed'; end if;
  if t.verification_status<>'pending' then raise exception 'verification_task_already_finalized'; end if;
  if t.autonomous_authority_grant_id is null or t.plan_step_id is null or t.capability_version is null then raise exception 'verification_task_lineage_missing'; end if;
  select * into i from public.hq_workforce_execution_intents where task_id=t.id for update;
  if not found then raise exception 'verification_execution_intent_missing'; end if;
  if i.status<>'committed' then raise exception 'verification_execution_intent_not_committed'; end if;
  if i.verification_status<>'pending' then raise exception 'verification_intent_already_finalized'; end if;
  if i.authority_grant_id is distinct from t.autonomous_authority_grant_id or i.plan_step_id is distinct from t.plan_step_id or i.capability_key is distinct from t.capability_key or i.capability_version is distinct from t.capability_version then raise exception 'verification_execution_lineage_mismatch'; end if;
  select * into g from public.hq_workforce_capability_authority_grants where id=i.authority_grant_id;
  if not found then raise exception 'verification_authority_missing'; end if;
  if not g.verification_required then raise exception 'verification_not_required_by_authority'; end if;
  if g.verification_contract='{}'::jsonb then raise exception 'verification_contract_missing'; end if;
  if g.capability_key is distinct from i.capability_key or g.capability_version is distinct from i.capability_version or g.operation is distinct from i.operation or g.resource_type is distinct from i.resource_type or g.scope_type is distinct from i.scope_type or g.scope_ref is distinct from i.scope_ref then raise exception 'verification_authority_lineage_mismatch'; end if;
  v_work_item_id:=nullif(i.resource_identity->>'work_item_id','')::uuid;
  if v_work_item_id is null then raise exception 'verification_resource_identity_missing'; end if;
  v_is_priority_canary:=t.capability_key='internal.work_queue.prioritize' and t.capability_version=1 and t.operation='update_priority' and t.resource_type='hq_work_items' and t.scope_type='platform_internal';
  if v_is_priority_canary then
    if not (i.expected_after_state ? 'priority') or jsonb_object_length(i.expected_after_state)<>1 then raise exception 'priority_canary_verification_expected_state_invalid'; end if;
    select * into wi from public.hq_work_items where id=v_work_item_id;
    v_expected:=jsonb_build_object('resource_exists',true,'queue_member',true,'priority',i.expected_after_state->>'priority','execution_intent_id',i.id::text,'authority_grant_id',i.authority_grant_id::text,'plan_step_id',i.plan_step_id::text);
    if not found then v_observed:=jsonb_build_object('resource_exists',false,'queue_member',false,'priority',null,'execution_intent_id',i.id::text,'authority_grant_id',i.authority_grant_id::text,'plan_step_id',i.plan_step_id::text);
    else v_observed:=jsonb_build_object('resource_exists',true,'queue_member',exists(select 1 from public.hq_workforce_canary_queue_memberships m where m.work_item_id=wi.id and m.queue_key='worker_engine_internal'),'priority',wi.priority,'execution_intent_id',i.id::text,'authority_grant_id',i.authority_grant_id::text,'plan_step_id',i.plan_step_id::text); end if;
    v_pass:=v_expected=v_observed;
  elsif t.resource_type='hq_work_items' and t.operation='update' then
    select * into wi from public.hq_work_items where id=v_work_item_id;
    if not found then v_expected:=jsonb_build_object('resource_exists',true,'desired_state',i.desired_state,'task_id',t.id,'intent_id',i.id); v_observed:=jsonb_build_object('resource_exists',false); v_pass:=false;
    else v_expected:=jsonb_build_object('resource_exists',true,'status',i.desired_state->>'status','task_id',t.id::text,'authority_grant_id',i.authority_grant_id::text,'plan_step_id',i.plan_step_id::text,'execution_intent_id',i.id::text); v_observed:=jsonb_build_object('resource_exists',true,'status',wi.status,'task_id',wi.action_taken->>'task_id','authority_grant_id',wi.action_taken->>'authority_grant_id','plan_step_id',wi.action_taken->>'plan_step_id','execution_intent_id',wi.action_taken->>'execution_intent_id'); v_pass:=v_expected=v_observed; end if;
  else raise exception 'unsupported_consequential_verification_contract'; end if;
  insert into public.hq_workforce_execution_verifications(intent_id,task_id,authority_grant_id,plan_step_id,capability_key,capability_version,verifier_key,expected_outcome,observed_outcome,verification_contract,passed) values(i.id,t.id,i.authority_grant_id,i.plan_step_id,i.capability_key,i.capability_version,btrim(p_verifier_key),v_expected,v_observed,g.verification_contract,v_pass) returning id into v_id;
  update public.hq_workforce_execution_intents set verification_status=case when v_pass then 'passed' else 'failed' end,verified_at=clock_timestamp() where id=i.id;
  update public.hq_workforce_task_contracts set verification_status=case when v_pass then 'verified' else 'failed' end where id=t.id;
  return v_id;
end $$;

create or replace function public.hq_workforce_compensate_consequential_execution(p_task_id uuid,p_requested_by text,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  t public.hq_workforce_task_contracts%rowtype; i public.hq_workforce_execution_intents%rowtype; g public.hq_workforce_capability_authority_grants%rowtype; wi public.hq_work_items%rowtype;
  v_work_item_id uuid; v_observed jsonb; v_comp_id uuid; v_before_action jsonb; v_before_acted_at timestamptz; v_is_priority_canary boolean:=false;
begin
  if char_length(btrim(coalesce(p_requested_by,'')))<3 then raise exception 'compensation_requester_required'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'compensation_reason_required'; end if;
  select * into t from public.hq_workforce_task_contracts where id=p_task_id for update;
  if not found then raise exception 'compensation_task_not_found'; end if;
  if t.verification_status<>'failed' then raise exception 'compensation_requires_failed_verification'; end if;
  select * into i from public.hq_workforce_execution_intents where task_id=t.id for update;
  if not found then raise exception 'compensation_execution_intent_missing'; end if;
  if i.status<>'committed' then raise exception 'compensation_execution_intent_not_committed'; end if;
  if i.verification_status<>'failed' then raise exception 'compensation_requires_failed_intent_verification'; end if;
  if i.authoritative_before_state='{}'::jsonb or i.expected_after_state='{}'::jsonb then raise exception 'compensation_recovery_snapshot_missing'; end if;
  v_is_priority_canary:=t.capability_key='internal.work_queue.prioritize' and t.capability_version=1 and t.operation='update_priority' and t.resource_type='hq_work_items' and t.scope_type='platform_internal';
  if v_is_priority_canary then if not (i.authoritative_before_state ? 'priority' and i.expected_after_state ? 'priority') then raise exception 'priority_canary_compensation_state_incomplete'; end if;
  else if not (i.expected_after_state ? 'status' and i.expected_after_state ? 'action_taken' and i.expected_after_state ? 'acted_at' and i.expected_after_state ? 'updated_at') then raise exception 'compensation_authoritative_after_state_incomplete'; end if; end if;
  select * into g from public.hq_workforce_capability_authority_grants where id=i.authority_grant_id;
  if not found then raise exception 'compensation_authority_missing'; end if;
  if g.capability_key is distinct from i.capability_key or g.capability_version is distinct from i.capability_version or g.operation is distinct from i.operation or g.resource_type is distinct from i.resource_type or g.scope_type is distinct from i.scope_type or g.scope_ref is distinct from i.scope_ref or i.plan_step_id is distinct from t.plan_step_id or i.authority_grant_id is distinct from t.autonomous_authority_grant_id then raise exception 'compensation_authority_lineage_mismatch'; end if;
  if not g.compensation_required then raise exception 'compensation_not_required_by_authority'; end if;
  if char_length(btrim(coalesce(g.compensation_strategy,'')))<3 then raise exception 'compensation_strategy_missing'; end if;
  if v_is_priority_canary then if g.compensation_strategy<>'restore_exact_pre_execution_priority_if_expected_state_still_matches' then raise exception 'priority_canary_compensation_strategy_mismatch'; end if;
  elsif t.resource_type<>'hq_work_items' or t.operation<>'update' then raise exception 'unsupported_consequential_compensation_contract'; end if;
  v_work_item_id:=nullif(i.resource_identity->>'work_item_id','')::uuid;
  if v_work_item_id is null then raise exception 'compensation_resource_identity_missing'; end if;
  select * into wi from public.hq_work_items where id=v_work_item_id for update;
  if not found then
    v_observed:=jsonb_build_object('resource_exists',false);
    insert into public.hq_workforce_execution_compensations(intent_id,task_id,authority_grant_id,plan_step_id,capability_key,capability_version,requested_by,reason,before_state,expected_current_state,observed_current_state,outcome,evidence) values(i.id,t.id,i.authority_grant_id,i.plan_step_id,i.capability_key,i.capability_version,btrim(p_requested_by),btrim(p_reason),i.authoritative_before_state,i.expected_after_state,v_observed,'conflict_escalated',jsonb_build_object('cause','resource_missing','mutation_applied',false)) returning id into v_comp_id;
    return jsonb_build_object('compensation_id',v_comp_id,'outcome','conflict_escalated','mutation_applied',false);
  end if;
  if v_is_priority_canary then v_observed:=jsonb_build_object('priority',wi.priority); else v_observed:=jsonb_build_object('status',wi.status,'action_taken',coalesce(wi.action_taken,'null'::jsonb),'acted_at',case when wi.acted_at is null then null else to_jsonb(wi.acted_at) end,'updated_at',case when wi.updated_at is null then null else to_jsonb(wi.updated_at) end); end if;
  if v_observed is distinct from i.expected_after_state then
    insert into public.hq_workforce_execution_compensations(intent_id,task_id,authority_grant_id,plan_step_id,capability_key,capability_version,requested_by,reason,before_state,expected_current_state,observed_current_state,outcome,evidence) values(i.id,t.id,i.authority_grant_id,i.plan_step_id,i.capability_key,i.capability_version,btrim(p_requested_by),btrim(p_reason),i.authoritative_before_state,i.expected_after_state,v_observed,'conflict_escalated',jsonb_build_object('cause',case when v_is_priority_canary then 'current_priority_diverged' else 'current_state_diverged' end,'mutation_applied',false,'aba_safe',not v_is_priority_canary,'certified_state_exact',v_is_priority_canary)) returning id into v_comp_id;
    return jsonb_build_object('compensation_id',v_comp_id,'outcome','conflict_escalated','mutation_applied',false);
  end if;
  if v_is_priority_canary then update public.hq_work_items set priority=i.authoritative_before_state->>'priority' where id=v_work_item_id;
  else v_before_action:=case when i.authoritative_before_state->'action_taken'='null'::jsonb then null else i.authoritative_before_state->'action_taken' end; v_before_acted_at:=nullif(i.authoritative_before_state->>'acted_at','')::timestamptz; update public.hq_work_items set status=i.authoritative_before_state->>'status',action_taken=v_before_action,acted_at=v_before_acted_at,updated_at=clock_timestamp() where id=v_work_item_id; end if;
  update public.hq_workforce_execution_intents set status='compensated',compensated_at=clock_timestamp() where id=i.id and status='committed';
  if not found then raise exception 'compensation_intent_transition_failed'; end if;
  insert into public.hq_workforce_execution_compensations(intent_id,task_id,authority_grant_id,plan_step_id,capability_key,capability_version,requested_by,reason,before_state,expected_current_state,observed_current_state,outcome,evidence) values(i.id,t.id,i.authority_grant_id,i.plan_step_id,i.capability_key,i.capability_version,btrim(p_requested_by),btrim(p_reason),i.authoritative_before_state,i.expected_after_state,v_observed,'compensated',jsonb_build_object('mutation_applied',true,'resource_type',t.resource_type,'resource_identity',i.resource_identity,'exact_state_match',true,'mutation',case when v_is_priority_canary then 'priority_only' else 'legacy_exact_state_restore' end)) returning id into v_comp_id;
  return jsonb_build_object('compensation_id',v_comp_id,'outcome','compensated','mutation_applied',true);
end $$;

revoke all on function public.hq_workforce_consequential_execution_gateway_r14_pre_approval_binding(uuid) from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_verify_consequential_execution_r14_unbound_internal(uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.hq_workforce_compensate_consequential_execution(uuid,text,text) from public,anon,authenticated;
grant execute on function public.hq_workforce_compensate_consequential_execution(uuid,text,text) to service_role;

DO $$ declare ec public.hq_workforce_engine_contract%rowtype; v_active integer; begin
 select * into ec from public.hq_workforce_engine_contract where singleton=true;
 if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false) or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0 or coalesce(ec.runtime_max_risk,0)<>0 then raise exception 'priority canary forward repair changed runtime boundary'; end if;
 select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active'; if v_active<>0 then raise exception 'priority canary forward repair activated authority'; end if;
end $$;
