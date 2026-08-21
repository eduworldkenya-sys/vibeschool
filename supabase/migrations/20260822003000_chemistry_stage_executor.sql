begin;

-- Governed, no-side-effect stage executor for the Chemistry repair mission.
-- This is a control-plane handoff ledger only: it cannot publish, mutate a
-- canonical chapter, enable runtime/schedulers, or release Global Stop.
-- access: service-only public.chemistry_worker_stage_attempts
-- authorization-test: public.chemistry_worker_stage_attempts denies anon/authenticated writes; service_role reads and RPC-only writes
-- access: service-only public.chemistry_worker_stage_events
-- authorization-test: public.chemistry_worker_stage_events denies anon/authenticated writes; service_role reads and RPC-only writes
create table public.chemistry_worker_stage_attempts (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.chemistry_worker_mission_items(id) on delete restrict,
  stage text not null check(stage in ('AUTHORING','P2_REVIEW','P3_REVIEW','REPAIRING','FRESH_P2_REVIEW','FRESH_P3_REVIEW')),
  iteration integer not null check(iteration between 0 and 3),
  attempt integer not null check(attempt between 1 and 3),
  idempotency_key text not null unique,
  lease_token uuid not null default gen_random_uuid() unique,
  claimed_by text not null,
  worker_key text not null references public.hq_workforce_workers(worker_key) on delete restrict,
  worker_version text not null,
  source_version text not null,
  source_hash text not null,
  state text not null default 'CLAIMED' check(state in ('CLAIMED','SUCCEEDED','FAILED','TIMED_OUT','DENIED','PAUSED')),
  input_packet jsonb not null,
  output_packet jsonb,
  evidence_refs text[] not null default '{}',
  error_code text,
  claimed_at timestamptz not null default clock_timestamp(),
  lease_expires_at timestamptz not null,
  completed_at timestamptz,
  check(cardinality(evidence_refs)>0 or state='CLAIMED'),
  unique(item_id,stage,iteration,attempt)
);

alter table public.chemistry_worker_stage_attempts enable row level security;
revoke all on public.chemistry_worker_stage_attempts from public,anon,authenticated,service_role;
grant select on public.chemistry_worker_stage_attempts to service_role;

create table public.chemistry_worker_stage_events (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.chemistry_worker_stage_attempts(id) on delete restrict,
  event_type text not null check(event_type in ('CLAIMED','SUCCEEDED','FAILED','TIMED_OUT','DENIED','PAUSED')),
  actor_key text not null,
  evidence_refs text[] not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default clock_timestamp(),
  check(cardinality(evidence_refs)>0)
);
alter table public.chemistry_worker_stage_events enable row level security;
revoke all on public.chemistry_worker_stage_events from public,anon,authenticated,service_role;
grant select on public.chemistry_worker_stage_events to service_role;
create trigger chemistry_worker_stage_events_append_only before update or delete on public.chemistry_worker_stage_events
for each row execute function public.hq_workforce_reject_evidence_mutation();

create or replace function public.chemistry_stage_worker(p_stage text)
returns text language sql immutable parallel safe as $$
  select case p_stage
    when 'AUTHORING' then 'content-factory-r2-canary-01'
    when 'P2_REVIEW' then 'quality-worker-01'
    when 'FRESH_P2_REVIEW' then 'quality-worker-01'
    when 'P3_REVIEW' then 'content-critic-chemistry-v1'
    when 'FRESH_P3_REVIEW' then 'content-critic-chemistry-v1'
    when 'REPAIRING' then 'content-repair-chemistry-v1'
  end
$$;

create or replace function public.chemistry_claim_stage(
  p_item_id uuid,p_expected_queued_stage text,p_executor_key text,p_lease_seconds integer default 120
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.chemistry_worker_mission_items%rowtype; m public.chemistry_worker_missions%rowtype;
  ec public.hq_workforce_engine_contract%rowtype; v_stage text; v_worker text; v_cert jsonb;
  v_attempt integer; v_id uuid; v_token uuid; v_key text; v_existing public.chemistry_worker_stage_attempts%rowtype;
begin
  if nullif(trim(p_executor_key),'') is null then raise exception 'CHEMISTRY_EXECUTOR_ID_REQUIRED'; end if;
  if p_lease_seconds not between 15 and 300 then raise exception 'CHEMISTRY_LEASE_BOUNDS'; end if;
  select * into i from public.chemistry_worker_mission_items where id=p_item_id for update;
  if not found then raise exception 'CHEMISTRY_ITEM_NOT_FOUND'; end if;
  select * into m from public.chemistry_worker_missions where id=i.mission_id for update;
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.shadow_enabled,false) or
     coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'CHEMISTRY_SHADOW_REQUIRES_RUNTIME_OFF_GLOBAL_STOP_ON';
  end if;
  if m.mode<>'shadow' or m.state in ('COMPLETED','ESCALATED','PAUSED','BLOCKED_READINESS') then
    raise exception 'CHEMISTRY_MISSION_NOT_CLAIMABLE';
  end if;
  v_stage:=case p_expected_queued_stage
    when 'AUTHOR_QUEUED' then 'AUTHORING' when 'P2_QUEUED' then 'P2_REVIEW'
    when 'P3_QUEUED' then 'P3_REVIEW' when 'REPAIR_QUEUED' then 'REPAIRING'
    when 'FRESH_P2_QUEUED' then 'FRESH_P2_REVIEW' when 'FRESH_P3_QUEUED' then 'FRESH_P3_REVIEW'
    else null end;
  if v_stage is null then raise exception 'CHEMISTRY_STAGE_NOT_CLAIMABLE'; end if;
  if i.stage<>p_expected_queued_stage and not (i.stage=v_stage and exists(
    select 1 from public.chemistry_worker_stage_attempts x where x.item_id=i.id and x.stage=v_stage and x.iteration=i.iteration and x.state='CLAIMED' and x.lease_expires_at<=clock_timestamp()
  )) then raise exception 'STALE_CHEMISTRY_ITEM_STAGE'; end if;
  v_worker:=public.chemistry_stage_worker(v_stage);
  v_cert:=public.content_convergence_assert_certified_worker(v_worker,case when v_stage='AUTHORING' then 'author' when v_stage='REPAIRING' then 'repair' else 'critic' end);
  select * into v_existing from public.chemistry_worker_stage_attempts
   where item_id=i.id and stage=v_stage and iteration=i.iteration and state='CLAIMED'
   order by attempt desc limit 1;
  if found and v_existing.lease_expires_at>clock_timestamp() then
    return jsonb_build_object('attempt_id',v_existing.id,'lease_token',v_existing.lease_token,'idempotent_replay',true,'stage',v_stage,'worker_key',v_worker,'input_packet',v_existing.input_packet);
  end if;
  if found then
    update public.chemistry_worker_stage_attempts set state='TIMED_OUT',evidence_refs=array['lease:'||v_existing.id::text],error_code='LEASE_EXPIRED',completed_at=clock_timestamp() where id=v_existing.id;
    insert into public.chemistry_worker_stage_events(attempt_id,event_type,actor_key,evidence_refs,payload)
    values(v_existing.id,'TIMED_OUT',p_executor_key,array['lease:'||v_existing.id::text],jsonb_build_object('expired_at',v_existing.lease_expires_at));
  end if;
  select coalesce(max(attempt),0)+1 into v_attempt from public.chemistry_worker_stage_attempts where item_id=i.id and stage=v_stage and iteration=i.iteration;
  if v_attempt>3 then
    update public.chemistry_worker_mission_items set stage='ESCALATED',blocker_codes=array_append(blocker_codes,'STAGE_RETRY_LIMIT'),next_action='Human investigation required after three failed attempts.',updated_at=clock_timestamp() where id=i.id;
    raise exception 'CHEMISTRY_STAGE_RETRY_LIMIT';
  end if;
  v_key:=concat(m.mission_key,':',i.chapter_id,':',v_stage,':',i.iteration,':',v_attempt);
  insert into public.chemistry_worker_stage_attempts(item_id,stage,iteration,attempt,idempotency_key,claimed_by,worker_key,worker_version,source_version,source_hash,input_packet,lease_expires_at)
  values(i.id,v_stage,i.iteration,v_attempt,v_key,p_executor_key,v_worker,v_cert->>'worker_version',i.source_version,i.source_hash,
    jsonb_build_object('mission_id',m.id,'item_id',i.id,'chapter_id',i.chapter_id,'artifact_version_id',i.artifact_version_id,'convergence_run_id',i.convergence_run_id,'source_version',i.source_version,'source_hash',i.source_hash,'iteration',i.iteration,'mode','shadow','side_effects_allowed',false,'publication_allowed',false,'worker_identity',v_cert,'prior_evidence',i.evidence),
    clock_timestamp()+make_interval(secs=>p_lease_seconds)) returning id,lease_token into v_id,v_token;
  update public.chemistry_worker_mission_items set stage=v_stage,next_action='Complete the exact leased stage and submit immutable evidence.',updated_at=clock_timestamp() where id=i.id;
  update public.chemistry_worker_missions set state='RUNNING',updated_at=clock_timestamp() where id=m.id and state='READY';
  insert into public.chemistry_worker_stage_events(attempt_id,event_type,actor_key,evidence_refs,payload)
  values(v_id,'CLAIMED',p_executor_key,array['idempotency:'||v_key],jsonb_build_object('stage',v_stage,'source_hash',i.source_hash));
  return jsonb_build_object('attempt_id',v_id,'lease_token',v_token,'idempotency_key',v_key,'stage',v_stage,'worker_key',v_worker,'worker_version',v_cert->>'worker_version','source_version',i.source_version,'source_hash',i.source_hash,'side_effects_allowed',false);
end $$;

create or replace function public.chemistry_complete_stage(
  p_attempt_id uuid,p_lease_token uuid,p_expected_source_version text,p_expected_source_hash text,
  p_disposition text,p_output_packet jsonb,p_evidence_refs text[],p_error_code text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.chemistry_worker_stage_attempts%rowtype; i public.chemistry_worker_mission_items%rowtype;
  m public.chemistry_worker_missions%rowtype; ec public.hq_workforce_engine_contract%rowtype;
  v_next text; v_success boolean; v_all_done boolean;
begin
  if p_disposition not in ('PASS','REPAIR_REQUIRED','ESCALATE','ERROR','DENIED','PAUSED') then raise exception 'CHEMISTRY_DISPOSITION_INVALID'; end if;
  if cardinality(coalesce(p_evidence_refs,'{}'))=0 then raise exception 'CHEMISTRY_EVIDENCE_REQUIRED'; end if;
  select * into a from public.chemistry_worker_stage_attempts where id=p_attempt_id;
  if not found or a.lease_token<>p_lease_token then raise exception 'CHEMISTRY_LEASE_INVALID'; end if;
  if a.state<>'CLAIMED' then return jsonb_build_object('attempt_id',a.id,'state',a.state,'idempotent_replay',true); end if;
  if a.lease_expires_at<=clock_timestamp() then raise exception 'CHEMISTRY_LEASE_EXPIRED'; end if;
  select * into i from public.chemistry_worker_mission_items where id=a.item_id for update;
  select * into m from public.chemistry_worker_missions where id=i.mission_id for update;
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.runtime_execution_enabled,false) or coalesce(ec.shadow_enabled,false) or
     coalesce(ec.shadow_scheduler_enabled,false) or not coalesce(ec.shadow_global_stop,true) then
    update public.chemistry_worker_stage_attempts set state='DENIED',evidence_refs=p_evidence_refs,error_code='GLOBAL_STOP_OR_RUNTIME_POSTURE_DRIFT',completed_at=clock_timestamp() where id=a.id;
    insert into public.chemistry_worker_stage_events(attempt_id,event_type,actor_key,evidence_refs,payload)
    values(a.id,'DENIED',a.claimed_by,p_evidence_refs,jsonb_build_object('code','GLOBAL_STOP_OR_RUNTIME_POSTURE_DRIFT'));
    update public.chemistry_worker_mission_items set stage='PAUSED',blocker_codes=array_append(blocker_codes,'GLOBAL_STOP_OR_RUNTIME_POSTURE_DRIFT'),next_action='Restore fail-closed posture and issue a fresh claim.',updated_at=clock_timestamp() where id=i.id;
    update public.chemistry_worker_missions set state='PAUSED',updated_at=clock_timestamp() where id=m.id;
    return jsonb_build_object('attempt_id',a.id,'state','DENIED','next_stage','PAUSED','reason','GLOBAL_STOP_OR_RUNTIME_POSTURE_DRIFT');
  end if;
  if i.source_version<>p_expected_source_version or i.source_hash<>p_expected_source_hash or a.source_version<>p_expected_source_version or a.source_hash<>p_expected_source_hash then raise exception 'STALE_CHEMISTRY_SOURCE'; end if;
  if coalesce((p_output_packet->>'side_effects_applied')::boolean,false) then raise exception 'CHEMISTRY_SHADOW_SIDE_EFFECT_FORBIDDEN'; end if;
  if coalesce((p_output_packet->>'published')::boolean,false) then raise exception 'CHEMISTRY_PUBLICATION_FORBIDDEN'; end if;
  if a.stage in ('P3_REVIEW','FRESH_P3_REVIEW') and p_disposition='PASS' and not exists(
    select 1 from public.chemistry_worker_stage_attempts q
    where q.item_id=a.item_id and q.iteration=a.iteration
      and q.stage=case when a.stage='P3_REVIEW' then 'P2_REVIEW' else 'FRESH_P2_REVIEW' end
      and q.state='SUCCEEDED' and q.output_packet->>'disposition'='PASS'
  ) then raise exception 'CHEMISTRY_P2_BLOCKER_PRESERVED'; end if;
  v_success:=p_disposition in ('PASS','REPAIR_REQUIRED');
  v_next:=case
    when p_disposition='ESCALATE' or (p_disposition='ERROR' and a.attempt>=3) then 'ESCALATED'
    when p_disposition='ERROR' then case a.stage when 'AUTHORING' then 'AUTHOR_QUEUED' when 'P2_REVIEW' then 'P2_QUEUED' when 'P3_REVIEW' then 'P3_QUEUED' when 'REPAIRING' then 'REPAIR_QUEUED' when 'FRESH_P2_REVIEW' then 'FRESH_P2_QUEUED' when 'FRESH_P3_REVIEW' then 'FRESH_P3_QUEUED' end
    when p_disposition='DENIED' then 'PAUSED'
    when p_disposition='PAUSED' then 'PAUSED'
    when a.stage='AUTHORING' and p_disposition='PASS' then 'P2_QUEUED'
    when a.stage='P2_REVIEW' then 'P3_QUEUED'
    when a.stage='P3_REVIEW' and p_disposition='PASS' then 'HUMAN_REVIEW'
    when a.stage='P3_REVIEW' and p_disposition='REPAIR_REQUIRED' then 'REPAIR_QUEUED'
    when a.stage='REPAIRING' and p_disposition='PASS' then 'FRESH_P2_QUEUED'
    when a.stage='FRESH_P2_REVIEW' then 'FRESH_P3_QUEUED'
    when a.stage='FRESH_P3_REVIEW' and p_disposition='PASS' then 'HUMAN_REVIEW'
    when a.stage='FRESH_P3_REVIEW' and p_disposition='REPAIR_REQUIRED' and i.iteration<3 then 'REPAIR_QUEUED'
    else 'ESCALATED' end;
  update public.chemistry_worker_stage_attempts set
    state=case when p_disposition='DENIED' then 'DENIED' when p_disposition='PAUSED' then 'PAUSED' when v_success then 'SUCCEEDED' else 'FAILED' end,
    output_packet=coalesce(p_output_packet,'{}')||jsonb_build_object('disposition',p_disposition),evidence_refs=p_evidence_refs,error_code=p_error_code,completed_at=clock_timestamp()
  where id=a.id;
  insert into public.chemistry_worker_stage_events(attempt_id,event_type,actor_key,evidence_refs,payload)
  values(a.id,case when p_disposition='DENIED' then 'DENIED' when p_disposition='PAUSED' then 'PAUSED' when v_success then 'SUCCEEDED' else 'FAILED' end,
    a.claimed_by,p_evidence_refs,jsonb_build_object('disposition',p_disposition,'next_stage',v_next,'error_code',p_error_code));
  update public.chemistry_worker_mission_items set stage=v_next,
    iteration=case when a.stage='REPAIRING' and p_disposition='PASS' then iteration+1 else iteration end,
    artifact_version_id=coalesce(nullif(p_output_packet->>'artifact_version_id','')::uuid,artifact_version_id),
    convergence_run_id=coalesce(nullif(p_output_packet->>'convergence_run_id','')::uuid,convergence_run_id),
    source_version=coalesce(nullif(p_output_packet->>'source_version',''),source_version),
    source_hash=coalesce(nullif(p_output_packet->>'source_hash',''),source_hash),
    blocker_codes=case when v_next in ('ESCALATED','PAUSED') then array_append(blocker_codes,coalesce(p_error_code,p_disposition)) else blocker_codes end,
    next_action=case v_next when 'HUMAN_REVIEW' then 'Inspect exact rendered artifact in HQ; approve, request changes, or reject.' when 'ESCALATED' then 'Human investigation required.' when 'PAUSED' then 'Resume only after the blocking safety condition is cleared.' else 'Claim the next governed stage.' end,
    evidence=evidence||jsonb_build_object(a.stage,jsonb_build_object('attempt_id',a.id,'worker_key',a.worker_key,'worker_version',a.worker_version,'disposition',p_disposition,'evidence_refs',p_evidence_refs,'output',coalesce(p_output_packet,'{}'))),updated_at=clock_timestamp()
  where id=i.id;
  select not exists(select 1 from public.chemistry_worker_mission_items where mission_id=m.id and stage not in ('HUMAN_REVIEW','CONVERGED','ESCALATED')) into v_all_done;
  if v_all_done then update public.chemistry_worker_missions set state='WAITING_HUMAN_REVIEW',updated_at=clock_timestamp() where id=m.id and state='RUNNING'; end if;
  return jsonb_build_object('attempt_id',a.id,'disposition',p_disposition,'next_stage',v_next,'mission_state',case when v_all_done then 'WAITING_HUMAN_REVIEW' else 'RUNNING' end);
end $$;

revoke all on function public.chemistry_stage_worker(text),public.chemistry_claim_stage(uuid,text,text,integer),public.chemistry_complete_stage(uuid,uuid,text,text,text,jsonb,text[],text) from public,anon,authenticated;
grant execute on function public.chemistry_stage_worker(text),public.chemistry_claim_stage(uuid,text,text,integer),public.chemistry_complete_stage(uuid,uuid,text,text,text,jsonb,text[],text) to service_role;

commit;
