begin;

-- A provider/admission configuration incident must not erase immutable attempts or
-- permanently strand a chapter. Recovery opens a fresh bounded generation only
-- for a proven executor-infrastructure failure. It does not activate runtime,
-- schedulers, publishing, payments, or weaken Global Stop.
-- access: service-only public.chemistry_recover_infrastructure_failure
-- authorization-test: public.chemistry_recover_infrastructure_failure denies public/anon/authenticated and requires an explicit incident reference

alter table public.chemistry_worker_mission_items
  add column recovery_generation integer not null default 0
  check (recovery_generation between 0 and 3);

alter table public.chemistry_worker_stage_attempts
  add column recovery_generation integer not null default 0
  check (recovery_generation between 0 and 3);

alter table public.chemistry_worker_stage_attempts
  drop constraint chemistry_worker_stage_attemp_item_id_stage_iteration_attem_key;

alter table public.chemistry_worker_stage_attempts
  add constraint chemistry_worker_stage_attempts_generation_attempt_key
  unique(item_id,stage,iteration,recovery_generation,attempt);

create or replace function public.chemistry_claim_stage(p_item_id uuid,p_expected_queued_stage text,p_executor_key text,p_lease_seconds integer default 120)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  i public.chemistry_worker_mission_items%rowtype;
  m public.chemistry_worker_missions%rowtype;
  ec public.hq_workforce_engine_contract%rowtype;
  v_stage text; v_worker text; v_cert jsonb; v_spec jsonb; v_spec_stage text;
  v_attempt integer; v_id uuid; v_token uuid; v_key text;
  v_existing public.chemistry_worker_stage_attempts%rowtype;
begin
  if nullif(trim(p_executor_key),'') is null then raise exception 'CHEMISTRY_EXECUTOR_ID_REQUIRED'; end if;
  if p_lease_seconds not between 15 and 300 then raise exception 'CHEMISTRY_LEASE_BOUNDS'; end if;
  select * into i from public.chemistry_worker_mission_items where id=p_item_id for update;
  if not found then raise exception 'CHEMISTRY_ITEM_NOT_FOUND'; end if;
  select * into m from public.chemistry_worker_missions where id=i.mission_id for update;
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.shadow_enabled,false) or coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then raise exception 'CHEMISTRY_SHADOW_REQUIRES_RUNTIME_OFF_GLOBAL_STOP_ON'; end if;
  if m.mode<>'shadow' or m.state in ('COMPLETED','ESCALATED','PAUSED','BLOCKED_READINESS') then raise exception 'CHEMISTRY_MISSION_NOT_CLAIMABLE'; end if;

  v_stage:=case p_expected_queued_stage
    when 'AUTHOR_QUEUED' then 'AUTHORING'
    when 'P2_QUEUED' then 'P2_REVIEW'
    when 'P3_QUEUED' then 'P3_REVIEW'
    when 'REPAIR_QUEUED' then 'REPAIRING'
    when 'FRESH_P2_QUEUED' then 'FRESH_P2_REVIEW'
    when 'FRESH_P3_QUEUED' then 'FRESH_P3_REVIEW'
    else null end;
  if v_stage is null then raise exception 'CHEMISTRY_STAGE_NOT_CLAIMABLE'; end if;
  if i.stage<>p_expected_queued_stage and not (i.stage=v_stage and exists(
    select 1 from public.chemistry_worker_stage_attempts x
    where x.item_id=i.id and x.stage=v_stage and x.iteration=i.iteration
      and x.recovery_generation=i.recovery_generation and x.state='CLAIMED'
      and x.lease_expires_at<=clock_timestamp()
  )) then raise exception 'STALE_CHEMISTRY_ITEM_STAGE'; end if;

  v_worker:=public.chemistry_stage_worker(v_stage);
  v_cert:=public.content_convergence_assert_certified_worker(v_worker,case when v_stage='AUTHORING' then 'author' when v_stage='REPAIRING' then 'repair' else 'critic' end);
  v_spec_stage:=case v_stage when 'AUTHORING' then 'AUTHOR' when 'P2_REVIEW' then 'QUALITY' when 'FRESH_P2_REVIEW' then 'QUALITY' when 'P3_REVIEW' then 'CRITIC' when 'FRESH_P3_REVIEW' then 'RECRITIC' when 'REPAIRING' then 'REPAIR' else null end;
  if v_spec_stage is null then raise exception 'CHEMISTRY_SPECIALIZATION_STAGE_UNMAPPED'; end if;
  v_spec:=public.hq_workforce_assert_worker_specialization(v_worker,'curriculum_content',v_spec_stage,'chemistry.grade10');

  select * into v_existing from public.chemistry_worker_stage_attempts
  where item_id=i.id and stage=v_stage and iteration=i.iteration
    and recovery_generation=i.recovery_generation and state='CLAIMED'
  order by attempt desc limit 1;
  if found and v_existing.lease_expires_at>clock_timestamp() then
    return jsonb_build_object('attempt_id',v_existing.id,'lease_token',v_existing.lease_token,'idempotent_replay',true,'stage',v_stage,'worker_key',v_worker,'specialization',v_spec,'input_packet',v_existing.input_packet);
  end if;
  if found then
    update public.chemistry_worker_stage_attempts set state='TIMED_OUT',evidence_refs=array['lease:'||v_existing.id::text],error_code='LEASE_EXPIRED',completed_at=clock_timestamp() where id=v_existing.id;
    insert into public.chemistry_worker_stage_events(attempt_id,event_type,actor_key,evidence_refs,payload) values(v_existing.id,'TIMED_OUT',p_executor_key,array['lease:'||v_existing.id::text],jsonb_build_object('expired_at',v_existing.lease_expires_at));
  end if;
  select coalesce(max(attempt),0)+1 into v_attempt from public.chemistry_worker_stage_attempts
  where item_id=i.id and stage=v_stage and iteration=i.iteration and recovery_generation=i.recovery_generation;
  if v_attempt>3 then
    update public.chemistry_worker_mission_items set stage='ESCALATED',blocker_codes=array_append(blocker_codes,'STAGE_RETRY_LIMIT'),next_action='Human investigation required after three failed attempts.',updated_at=clock_timestamp() where id=i.id;
    raise exception 'CHEMISTRY_STAGE_RETRY_LIMIT';
  end if;

  v_key:=concat(m.mission_key,':',i.chapter_id,':',v_stage,':',i.iteration,':recovery:',i.recovery_generation,':',v_attempt);
  insert into public.chemistry_worker_stage_attempts(item_id,stage,iteration,recovery_generation,attempt,idempotency_key,claimed_by,worker_key,worker_version,source_version,source_hash,input_packet,lease_expires_at)
  values(i.id,v_stage,i.iteration,i.recovery_generation,v_attempt,v_key,p_executor_key,v_worker,v_cert->>'worker_version',i.source_version,i.source_hash,
    jsonb_build_object('mission_id',m.id,'item_id',i.id,'chapter_id',i.chapter_id,'artifact_version_id',i.artifact_version_id,'convergence_run_id',i.convergence_run_id,'source_version',i.source_version,'source_hash',i.source_hash,'iteration',i.iteration,'recovery_generation',i.recovery_generation,'mode','shadow','side_effects_allowed',false,'publication_allowed',false,'worker_identity',v_cert,'worker_specialization',v_spec,'prior_evidence',i.evidence),
    clock_timestamp()+make_interval(secs=>p_lease_seconds)) returning id,lease_token into v_id,v_token;
  update public.chemistry_worker_mission_items set stage=v_stage,next_action='Complete the exact leased stage and submit immutable evidence.',updated_at=clock_timestamp() where id=i.id;
  update public.chemistry_worker_missions set state='RUNNING',updated_at=clock_timestamp() where id=m.id and state='READY';
  insert into public.chemistry_worker_stage_events(attempt_id,event_type,actor_key,evidence_refs,payload) values(v_id,'CLAIMED',p_executor_key,array['idempotency:'||v_key],jsonb_build_object('stage',v_stage,'source_hash',i.source_hash,'specialization',v_spec,'recovery_generation',i.recovery_generation));
  return jsonb_build_object('attempt_id',v_id,'lease_token',v_token,'idempotency_key',v_key,'stage',v_stage,'worker_key',v_worker,'worker_version',v_cert->>'worker_version','specialization',v_spec,'source_version',i.source_version,'source_hash',i.source_hash,'recovery_generation',i.recovery_generation,'side_effects_allowed',false);
end $$;

create or replace function public.chemistry_recover_infrastructure_failure(p_item_id uuid,p_incident_ref text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  i public.chemistry_worker_mission_items%rowtype;
  a public.chemistry_worker_stage_attempts%rowtype;
  v_queued text;
begin
  if nullif(trim(p_incident_ref),'') is null then raise exception 'CHEMISTRY_RECOVERY_INCIDENT_REQUIRED'; end if;
  select * into i from public.chemistry_worker_mission_items where id=p_item_id for update;
  if not found then raise exception 'CHEMISTRY_ITEM_NOT_FOUND'; end if;
  if i.stage<>'ESCALATED' then raise exception 'CHEMISTRY_RECOVERY_REQUIRES_ESCALATED_ITEM'; end if;
  if i.recovery_generation>=3 then raise exception 'CHEMISTRY_RECOVERY_GENERATION_LIMIT'; end if;
  select * into a from public.chemistry_worker_stage_attempts
  where item_id=i.id and iteration=i.iteration and recovery_generation=i.recovery_generation
  order by completed_at desc nulls last,claimed_at desc limit 1;
  if not found or a.state<>'FAILED' or a.error_code<>'CHEMISTRY_STAGE_EXECUTOR_ERROR' then raise exception 'CHEMISTRY_RECOVERY_INFRASTRUCTURE_FAILURE_REQUIRED'; end if;
  if coalesce(a.output_packet->>'executor_error','') not like 'CYBORG_ADMISSION_FAILED:%'
     and coalesce(a.output_packet->>'executor_error','') not like 'CYBORG_GATEWAY_FAILED:%'
     and coalesce(a.output_packet->>'executor_error','') not like 'CYBORG_PROVIDER_CREDENTIAL_REQUIRED:%' then
    raise exception 'CHEMISTRY_RECOVERY_ERROR_NOT_ALLOWLISTED';
  end if;
  if exists(select 1 from public.chemistry_stage_execution_receipts r where r.attempt_id=a.id) then raise exception 'CHEMISTRY_RECOVERY_RECEIPT_ALREADY_EXISTS'; end if;
  v_queued:=case a.stage when 'AUTHORING' then 'AUTHOR_QUEUED' when 'P2_REVIEW' then 'P2_QUEUED' when 'P3_REVIEW' then 'P3_QUEUED' when 'REPAIRING' then 'REPAIR_QUEUED' when 'FRESH_P2_REVIEW' then 'FRESH_P2_QUEUED' when 'FRESH_P3_REVIEW' then 'FRESH_P3_QUEUED' else null end;
  if v_queued is null then raise exception 'CHEMISTRY_RECOVERY_STAGE_UNMAPPED'; end if;
  update public.chemistry_worker_mission_items set
    recovery_generation=recovery_generation+1,
    stage=v_queued,
    blocker_codes=array_remove(array_remove(blocker_codes,'CHEMISTRY_STAGE_EXECUTOR_ERROR'),'STAGE_RETRY_LIMIT'),
    next_action='Retry the same governed stage after verified infrastructure repair.',
    evidence=evidence||jsonb_build_object('infrastructure_recovery_'||(recovery_generation+1)::text,jsonb_build_object('incident_ref',trim(p_incident_ref),'failed_attempt_id',a.id,'failed_generation',recovery_generation,'error',a.output_packet->>'executor_error','recovered_at',clock_timestamp())),
    updated_at=clock_timestamp()
  where id=i.id;
  update public.chemistry_worker_missions set state='RUNNING',updated_at=clock_timestamp() where id=i.mission_id and state='WAITING_HUMAN_REVIEW';
  return jsonb_build_object('item_id',i.id,'stage',v_queued,'recovery_generation',i.recovery_generation+1,'incident_ref',trim(p_incident_ref),'failed_attempt_id',a.id);
end $$;

revoke all on function public.chemistry_claim_stage(uuid,text,text,integer),public.chemistry_recover_infrastructure_failure(uuid,text) from public,anon,authenticated;
grant execute on function public.chemistry_claim_stage(uuid,text,text,integer),public.chemistry_recover_infrastructure_failure(uuid,text) to service_role;

comment on function public.chemistry_recover_infrastructure_failure(uuid,text) is
'Opens one fresh bounded attempt generation after a proven allowlisted Cyborg infrastructure failure. Preserves all failed attempts and denies content-quality or receipt-bearing recovery.';

commit;
