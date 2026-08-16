-- WE-R1.4.18: owner-governed capability authority lifecycle.
-- NON-ACTIVATING. This migration installs the transition mechanism but performs no
-- transition. Draft creation may be deterministic; certification/activation/revocation
-- are identity-bound governance decisions. Activation is allowed only while runtime is OFF.

alter table public.hq_workforce_capability_authority_grants
  add column if not exists certified_by uuid,
  add column if not exists activated_by uuid,
  add column if not exists lifecycle_reason text,
  add column if not exists lifecycle_evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(lifecycle_evidence)='array');

create or replace function public.hq_workforce_owner_transition_capability_authority(
  p_grant_id uuid,
  p_action text,
  p_reason text,
  p_evidence jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  g public.hq_workforce_capability_authority_grants%rowtype;
  ec public.hq_workforce_engine_contract%rowtype;
  gp public.hq_workforce_runtime_policies%rowtype;
  v_uid uuid;
  v_next text;
begin
  perform public.hq_assert_owner();
  v_uid:=auth.uid();
  if v_uid is null then raise exception 'authority_transition_requires_authenticated_owner'; end if;
  if p_action not in ('certify','activate','suspend','revoke') then raise exception 'authority_transition_action_invalid'; end if;
  if char_length(btrim(coalesce(p_reason,'')))<3 then raise exception 'authority_transition_reason_required'; end if;
  if coalesce(jsonb_typeof(p_evidence),'null')<>'array' or jsonb_array_length(p_evidence)=0 then raise exception 'authority_transition_evidence_required'; end if;

  select * into g from public.hq_workforce_capability_authority_grants where id=p_grant_id for update;
  if not found then raise exception 'capability_authority_grant_not_found'; end if;
  select * into ec from public.hq_workforce_engine_contract where singleton=true for update;
  if not found then raise exception 'runtime_contract_missing'; end if;

  if p_action='certify' then
    if g.status<>'draft' then raise exception 'authority_certification_invalid_state:%',g.status; end if;
    if g.expires_at<=clock_timestamp() then raise exception 'authority_certification_expired'; end if;
    if not g.idempotency_required or not g.verification_required or not g.compensation_required then raise exception 'authority_certification_missing_safety_contract'; end if;
    if g.verification_contract='{}'::jsonb or jsonb_array_length(g.precondition_contract)=0 then raise exception 'authority_certification_incomplete_contract'; end if;
    if not exists(select 1 from public.hq_workforce_capabilities c where c.capability_key=g.capability_key and c.version=g.capability_version and c.lifecycle_status='certified') then raise exception 'authority_certification_capability_not_certified'; end if;
    if not exists(select 1 from public.hq_workforce_skill_manifests s where s.id=g.skill_manifest_id and s.certification_status='certified' and (s.expires_at is null or s.expires_at>clock_timestamp())) then raise exception 'authority_certification_skill_not_certified'; end if;
    if not exists(select 1 from public.hq_workforce_tool_contracts t where t.id=g.tool_contract_id and t.status='approved') then raise exception 'authority_certification_tool_not_approved'; end if;
    v_next:='certified';
    update public.hq_workforce_capability_authority_grants
       set status='certified',certified_at=clock_timestamp(),certified_by=v_uid,
           governance_evidence=coalesce(governance_evidence,'{}'::jsonb)||jsonb_build_object('certified_by',v_uid,'certification_reason',btrim(p_reason)),
           lifecycle_reason=btrim(p_reason),lifecycle_evidence=p_evidence
     where id=g.id;

  elsif p_action='activate' then
    if g.status<>'certified' then raise exception 'authority_activation_invalid_state:%',g.status; end if;
    if ec.runtime_execution_enabled or ec.heartbeat_enabled or ec.factory_enabled then raise exception 'authority_activation_requires_runtime_off'; end if;
    if g.expires_at<=clock_timestamp() then raise exception 'authority_activation_expired'; end if;
    if g.certified_at is null or g.certified_by is null then raise exception 'authority_activation_certification_identity_missing'; end if;
    select * into gp from public.hq_workforce_runtime_policies
      where status='active' and scope_kind='global' and scope_key='global' and enabled
      order by updated_at desc limit 1;
    if not found then raise exception 'authority_activation_enabled_global_policy_required'; end if;
    if g.autonomy_level>gp.max_autonomy_level or g.risk_class>gp.max_risk_class
       or g.max_concurrency>gp.max_concurrency or g.max_executions_per_minute>gp.max_executions_per_minute then
      raise exception 'authority_activation_exceeds_global_policy';
    end if;
    if exists(select 1 from public.hq_workforce_execution_breakers b where b.status='tripped' and (
      (b.scope_type='global' and b.scope_ref='global') or
      (b.scope_type='capability' and b.scope_ref=g.capability_key||'@'||g.capability_version::text) or
      (b.scope_type='authority_grant' and b.scope_ref=g.id::text))) then raise exception 'authority_activation_circuit_breaker_tripped'; end if;
    if g.permitted_worker_key is not null then
      if not exists(select 1 from public.hq_workforce_workers w where w.worker_key=g.permitted_worker_key and w.status='active') then raise exception 'authority_activation_worker_not_active'; end if;
      if public.hq_workforce_current_lifecycle_state(g.permitted_worker_key)<>'active' then raise exception 'authority_activation_worker_lifecycle_not_active'; end if;
      if not exists(select 1 from public.hq_workforce_identities i where i.worker_key=g.permitted_worker_key and i.status='active' and i.expires_at>clock_timestamp()) then raise exception 'authority_activation_worker_identity_invalid'; end if;
      if not exists(select 1 from public.hq_workforce_certifications c where c.worker_key=g.permitted_worker_key and c.status='active' and c.expires_at>clock_timestamp()) then raise exception 'authority_activation_worker_certification_invalid'; end if;
    end if;
    v_next:='active';
    update public.hq_workforce_capability_authority_grants
       set status='active',activated_at=clock_timestamp(),activated_by=v_uid,
           governance_evidence=coalesce(governance_evidence,'{}'::jsonb)||jsonb_build_object('activated_by',v_uid,'activation_reason',btrim(p_reason)),
           lifecycle_reason=btrim(p_reason),lifecycle_evidence=p_evidence
     where id=g.id;

  elsif p_action='suspend' then
    if g.status not in ('certified','active') then raise exception 'authority_suspension_invalid_state:%',g.status; end if;
    v_next:='suspended';
    update public.hq_workforce_capability_authority_grants
       set status='suspended',lifecycle_reason=btrim(p_reason),lifecycle_evidence=p_evidence
     where id=g.id;

  else
    if g.status='revoked' then return jsonb_build_object('grant_id',g.id,'status','revoked','idempotent',true); end if;
    if g.status='expired' then raise exception 'authority_revocation_expired_terminal'; end if;
    v_next:='revoked';
    update public.hq_workforce_capability_authority_grants
       set status='revoked',revoked_at=clock_timestamp(),revocation_reason=btrim(p_reason),
           lifecycle_reason=btrim(p_reason),lifecycle_evidence=p_evidence
     where id=g.id;
  end if;

  return jsonb_build_object('grant_id',g.id,'from_status',g.status,'to_status',v_next,'changed_by',v_uid,'reason',btrim(p_reason));
end $$;

revoke all on function public.hq_workforce_owner_transition_capability_authority(uuid,text,text,jsonb)
  from public,anon,service_role;
grant execute on function public.hq_workforce_owner_transition_capability_authority(uuid,text,text,jsonb)
  to authenticated;

-- Direct grant writes remain denied to service transport.
revoke insert,update,delete,truncate on table public.hq_workforce_capability_authority_grants from service_role;
grant select on table public.hq_workforce_capability_authority_grants to service_role;

-- Installation must remain authority-free and runtime-off.
do $$
declare ec public.hq_workforce_engine_contract%rowtype; v_active integer;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WE-R1.4.18 requires engine contract'; end if;
  if coalesce(ec.heartbeat_enabled,false) or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0 or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'WE-R1.4.18 violated fail_closed_activation_boundary';
  end if;
  select count(*) into v_active from public.hq_workforce_capability_authority_grants where status='active';
  if v_active<>0 then raise exception 'WE-R1.4.18 installation activated authority'; end if;
  if has_table_privilege('service_role','public.hq_workforce_capability_authority_grants','UPDATE') then
    raise exception 'WE-R1.4.18 direct authority write remains';
  end if;
end $$;
