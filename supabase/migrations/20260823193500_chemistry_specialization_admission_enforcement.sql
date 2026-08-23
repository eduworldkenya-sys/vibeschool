begin;

-- Fail closed on Grade 10 Chemistry subject qualification at both mission readiness
-- and exact stage admission. Professional worker certification alone is insufficient.
-- NON-ACTIVATING: runtime/schedulers/publishing/payments/authority remain unchanged.
-- authorization-test: hq_start_chemistry_worker_mission remains owner-gated; stage
-- claim remains service-only through the existing governed Laban/Chemistry path.

create or replace function public.chemistry_required_specialization_stage(p_worker_key text)
returns text
language sql
immutable
set search_path=public,pg_temp
as $$
  select case p_worker_key
    when 'content-factory-r2-canary-01' then 'AUTHOR'
    when 'quality-worker-01' then 'QUALITY'
    when 'content-critic-chemistry-v1' then 'CRITIC'
    when 'content-repair-chemistry-v1' then 'REPAIR'
    else null
  end
$$;

create or replace function public.hq_start_chemistry_worker_mission(p_publication_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  p public.vibe_publications%rowtype;
  ec public.hq_workforce_engine_contract%rowtype;
  v_key text;
  v_id uuid;
  v_ready boolean:=true;
  v_findings jsonb:='[]';
  v_versions jsonb:='{}';
  v_worker_key text;
  v_spec_stage text;
  a jsonb;
  s jsonb;
begin
  perform public.hq_assert_owner();

  select * into p from public.vibe_publications where id=p_publication_id;
  if not found then raise exception 'CHEMISTRY_PUBLICATION_NOT_FOUND'; end if;
  if lower(coalesce(p.cbc_subject,''))<>'chemistry'
     and lower(coalesce(p.title,'')) not like '%chemistry%' then
    raise exception 'CHEMISTRY_PUBLICATION_REQUIRED';
  end if;

  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'MISSION_REQUIRES_RUNTIME_OFF_GLOBAL_STOP_ON';
  end if;

  foreach v_worker_key in array array[
    'content-factory-r2-canary-01',
    'quality-worker-01',
    'content-critic-chemistry-v1',
    'content-repair-chemistry-v1'
  ] loop
    begin
      a:=public.content_convergence_assert_certified_worker(v_worker_key,null);
      v_spec_stage:=public.chemistry_required_specialization_stage(v_worker_key);
      if v_spec_stage is null then raise exception 'CHEMISTRY_SPECIALIZATION_STAGE_UNMAPPED'; end if;
      s:=public.hq_workforce_assert_worker_specialization(
        v_worker_key,'curriculum_content',v_spec_stage,'chemistry.grade10'
      );
      v_versions:=v_versions||jsonb_build_object(
        v_worker_key,a||jsonb_build_object('specialization',s)
      );
    exception when others then
      v_ready:=false;
      v_findings:=v_findings||jsonb_build_array(
        jsonb_build_object('worker_key',v_worker_key,'code',sqlerrm)
      );
    end;
  end loop;

  if not exists(select 1 from public.vibe_chapters c where c.publication_id=p_publication_id) then
    v_ready:=false;
    v_findings:=v_findings||jsonb_build_array(jsonb_build_object('code','NO_CHAPTERS_FOUND'));
  end if;

  v_key:='chemistry-repair:'||p_publication_id::text||':v1';
  insert into public.chemistry_worker_missions(
    mission_key,publication_id,state,worker_versions,curriculum_scope,
    runtime_posture,readiness_findings,started_by
  ) values(
    v_key,p_publication_id,
    case when v_ready then 'READY' else 'BLOCKED_READINESS' end,
    v_versions,
    jsonb_build_object('subject','Chemistry','grade',p.cbc_grade,'publication_id',p.id,'all_artifact_types',true,'blast_radius_scan',true),
    jsonb_build_object('runtime_execution_enabled',ec.runtime_execution_enabled,'shadow_enabled',ec.shadow_enabled,'scheduler_enabled',ec.shadow_scheduler_enabled,'global_stop',ec.shadow_global_stop),
    v_findings,auth.uid()
  )
  on conflict(mission_key) do update set
    worker_versions=excluded.worker_versions,
    runtime_posture=excluded.runtime_posture,
    readiness_findings=excluded.readiness_findings,
    state=case when chemistry_worker_missions.state in ('COMPLETED','RUNNING','WAITING_HUMAN_REVIEW') then chemistry_worker_missions.state else excluded.state end,
    updated_at=clock_timestamp()
  returning id into v_id;

  insert into public.chemistry_worker_mission_items(
    mission_id,chapter_id,source_version,source_hash,stage,blocker_codes,next_action,evidence
  )
  select v_id,c.id,concat('chapter:',c.id,':updated:',c.updated_at),
    pg_catalog.encode(extensions.digest(coalesce(c.blocks,'[]'::jsonb)::text,'sha256'::text),'hex'::text),
    case when v_ready then 'AUTHOR_QUEUED' else 'BLOCKED_READINESS' end,
    case when v_ready then '{}'::text[] else array(select x->>'code' from jsonb_array_elements(v_findings) x where x ? 'code') end,
    case when v_ready then 'Create a fresh immutable certified-author draft from locked curriculum and evidence.' else 'Complete fresh independent certification and Chemistry specialization qualification for every required worker.' end,
    jsonb_build_object('chapter_title',c.title,'learning_outcomes',c.learning_outcomes,'strand',c.cbc_strand,'negative_control_hash',pg_catalog.encode(extensions.digest(coalesce(c.blocks,'[]'::jsonb)::text,'sha256'::text),'hex'::text),'publication_state',p.status)
  from public.vibe_chapters c
  where c.publication_id=p_publication_id
  on conflict(mission_id,chapter_id) do nothing;

  if v_ready then
    update public.chemistry_worker_mission_items i
    set stage='AUTHOR_QUEUED',blocker_codes='{}'::text[],next_action='Create a fresh immutable certified-author draft from locked curriculum and evidence.',updated_at=clock_timestamp()
    where i.mission_id=v_id and i.stage='BLOCKED_READINESS'
      and not exists(select 1 from public.chemistry_worker_stage_attempts a where a.item_id=i.id);
  else
    update public.chemistry_worker_mission_items i
    set blocker_codes=array(select distinct x->>'code' from jsonb_array_elements(v_findings) x where x ? 'code'),
        next_action='Complete fresh independent certification and Chemistry specialization qualification for every required worker.',
        updated_at=clock_timestamp()
    where i.mission_id=v_id and i.stage='BLOCKED_READINESS'
      and not exists(select 1 from public.chemistry_worker_stage_attempts a where a.item_id=i.id);
  end if;

  return public.hq_get_chemistry_worker_mission(v_id);
end $$;

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
  if i.stage<>p_expected_queued_stage and not (i.stage=v_stage and exists(select 1 from public.chemistry_worker_stage_attempts x where x.item_id=i.id and x.stage=v_stage and x.iteration=i.iteration and x.state='CLAIMED' and x.lease_expires_at<=clock_timestamp())) then raise exception 'STALE_CHEMISTRY_ITEM_STAGE'; end if;

  v_worker:=public.chemistry_stage_worker(v_stage);
  v_cert:=public.content_convergence_assert_certified_worker(v_worker,case when v_stage='AUTHORING' then 'author' when v_stage='REPAIRING' then 'repair' else 'critic' end);
  v_spec_stage:=case v_stage
    when 'AUTHORING' then 'AUTHOR'
    when 'P2_REVIEW' then 'QUALITY'
    when 'FRESH_P2_REVIEW' then 'QUALITY'
    when 'P3_REVIEW' then 'CRITIC'
    when 'FRESH_P3_REVIEW' then 'RECRITIC'
    when 'REPAIRING' then 'REPAIR'
    else null end;
  if v_spec_stage is null then raise exception 'CHEMISTRY_SPECIALIZATION_STAGE_UNMAPPED'; end if;
  v_spec:=public.hq_workforce_assert_worker_specialization(v_worker,'curriculum_content',v_spec_stage,'chemistry.grade10');

  select * into v_existing from public.chemistry_worker_stage_attempts where item_id=i.id and stage=v_stage and iteration=i.iteration and state='CLAIMED' order by attempt desc limit 1;
  if found and v_existing.lease_expires_at>clock_timestamp() then
    return jsonb_build_object('attempt_id',v_existing.id,'lease_token',v_existing.lease_token,'idempotent_replay',true,'stage',v_stage,'worker_key',v_worker,'specialization',v_spec,'input_packet',v_existing.input_packet);
  end if;
  if found then
    update public.chemistry_worker_stage_attempts set state='TIMED_OUT',evidence_refs=array['lease:'||v_existing.id::text],error_code='LEASE_EXPIRED',completed_at=clock_timestamp() where id=v_existing.id;
    insert into public.chemistry_worker_stage_events(attempt_id,event_type,actor_key,evidence_refs,payload) values(v_existing.id,'TIMED_OUT',p_executor_key,array['lease:'||v_existing.id::text],jsonb_build_object('expired_at',v_existing.lease_expires_at));
  end if;
  select coalesce(max(attempt),0)+1 into v_attempt from public.chemistry_worker_stage_attempts where item_id=i.id and stage=v_stage and iteration=i.iteration;
  if v_attempt>3 then
    update public.chemistry_worker_mission_items set stage='ESCALATED',blocker_codes=array_append(blocker_codes,'STAGE_RETRY_LIMIT'),next_action='Human investigation required after three failed attempts.',updated_at=clock_timestamp() where id=i.id;
    raise exception 'CHEMISTRY_STAGE_RETRY_LIMIT';
  end if;

  v_key:=concat(m.mission_key,':',i.chapter_id,':',v_stage,':',i.iteration,':',v_attempt);
  insert into public.chemistry_worker_stage_attempts(item_id,stage,iteration,attempt,idempotency_key,claimed_by,worker_key,worker_version,source_version,source_hash,input_packet,lease_expires_at)
  values(i.id,v_stage,i.iteration,v_attempt,v_key,p_executor_key,v_worker,v_cert->>'worker_version',i.source_version,i.source_hash,
    jsonb_build_object('mission_id',m.id,'item_id',i.id,'chapter_id',i.chapter_id,'artifact_version_id',i.artifact_version_id,'convergence_run_id',i.convergence_run_id,'source_version',i.source_version,'source_hash',i.source_hash,'iteration',i.iteration,'mode','shadow','side_effects_allowed',false,'publication_allowed',false,'worker_identity',v_cert,'worker_specialization',v_spec,'prior_evidence',i.evidence),
    clock_timestamp()+make_interval(secs=>p_lease_seconds)) returning id,lease_token into v_id,v_token;
  update public.chemistry_worker_mission_items set stage=v_stage,next_action='Complete the exact leased stage and submit immutable evidence.',updated_at=clock_timestamp() where id=i.id;
  update public.chemistry_worker_missions set state='RUNNING',updated_at=clock_timestamp() where id=m.id and state='READY';
  insert into public.chemistry_worker_stage_events(attempt_id,event_type,actor_key,evidence_refs,payload) values(v_id,'CLAIMED',p_executor_key,array['idempotency:'||v_key],jsonb_build_object('stage',v_stage,'source_hash',i.source_hash,'specialization',v_spec));
  return jsonb_build_object('attempt_id',v_id,'lease_token',v_token,'idempotency_key',v_key,'stage',v_stage,'worker_key',v_worker,'worker_version',v_cert->>'worker_version','specialization',v_spec,'source_version',i.source_version,'source_hash',i.source_hash,'side_effects_allowed',false);
end $$;

revoke all on function public.hq_start_chemistry_worker_mission(uuid) from public,anon,authenticated;
grant execute on function public.hq_start_chemistry_worker_mission(uuid) to service_role;
revoke all on function public.chemistry_claim_stage(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.chemistry_claim_stage(uuid,text,text,integer) to service_role;

comment on function public.chemistry_claim_stage(uuid,text,text,integer) is
'Claims a Chemistry shadow stage only after current professional certification and current chemistry.grade10 specialization qualification both pass. No runtime or publishing authority is granted.';

commit;
