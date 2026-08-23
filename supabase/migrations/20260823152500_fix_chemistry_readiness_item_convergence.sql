begin;

-- When a previously BLOCKED_READINESS Chemistry mission is re-started after all
-- required workers become freshly certified, converge untouched chapter items to
-- AUTHOR_QUEUED. Never rewrite progressed items or any item with execution attempts.
-- NON-ACTIVATING: runtime/schedulers/publishing/payments remain unchanged.
-- authorization-test: hq_start_chemistry_worker_mission remains owner-gated and
-- this convergence is restricted to stale BLOCKED_READINESS items with zero attempts.

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
  a jsonb;
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
      v_versions:=v_versions||jsonb_build_object(v_worker_key,a);
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
    v_key,
    p_publication_id,
    case when v_ready then 'READY' else 'BLOCKED_READINESS' end,
    v_versions,
    jsonb_build_object(
      'subject','Chemistry','grade',p.cbc_grade,'publication_id',p.id,
      'all_artifact_types',true,'blast_radius_scan',true
    ),
    jsonb_build_object(
      'runtime_execution_enabled',ec.runtime_execution_enabled,
      'shadow_enabled',ec.shadow_enabled,
      'scheduler_enabled',ec.shadow_scheduler_enabled,
      'global_stop',ec.shadow_global_stop
    ),
    v_findings,
    auth.uid()
  )
  on conflict(mission_key) do update set
    worker_versions=excluded.worker_versions,
    runtime_posture=excluded.runtime_posture,
    readiness_findings=excluded.readiness_findings,
    state=case
      when chemistry_worker_missions.state in ('COMPLETED','RUNNING','WAITING_HUMAN_REVIEW')
        then chemistry_worker_missions.state
      else excluded.state
    end,
    updated_at=clock_timestamp()
  returning id into v_id;

  insert into public.chemistry_worker_mission_items(
    mission_id,chapter_id,source_version,source_hash,stage,blocker_codes,next_action,evidence
  )
  select
    v_id,
    c.id,
    concat('chapter:',c.id,':updated:',c.updated_at),
    pg_catalog.encode(extensions.digest(coalesce(c.blocks,'[]'::jsonb)::text,'sha256'::text),'hex'::text),
    case when v_ready then 'AUTHOR_QUEUED' else 'BLOCKED_READINESS' end,
    case when v_ready then '{}'::text[] else array(
      select x->>'code' from jsonb_array_elements(v_findings) x where x ? 'code'
    ) end,
    case
      when v_ready then 'Create a fresh immutable certified-author draft from locked curriculum and evidence.'
      else 'Complete fresh independent certification for every required worker.'
    end,
    jsonb_build_object(
      'chapter_title',c.title,
      'learning_outcomes',c.learning_outcomes,
      'strand',c.cbc_strand,
      'negative_control_hash',pg_catalog.encode(extensions.digest(coalesce(c.blocks,'[]'::jsonb)::text,'sha256'::text),'hex'::text),
      'publication_state',p.status
    )
  from public.vibe_chapters c
  where c.publication_id=p_publication_id
  on conflict(mission_id,chapter_id) do nothing;

  if v_ready then
    update public.chemistry_worker_mission_items i
    set stage='AUTHOR_QUEUED',
        blocker_codes='{}'::text[],
        next_action='Create a fresh immutable certified-author draft from locked curriculum and evidence.',
        updated_at=clock_timestamp()
    where i.mission_id=v_id
      and i.stage='BLOCKED_READINESS'
      and not exists(
        select 1 from public.chemistry_worker_stage_attempts a where a.item_id=i.id
      );
  end if;

  return public.hq_get_chemistry_worker_mission(v_id);
end $$;

revoke all on function public.hq_start_chemistry_worker_mission(uuid) from public,anon,authenticated;
grant execute on function public.hq_start_chemistry_worker_mission(uuid) to service_role;

comment on function public.hq_start_chemistry_worker_mission(uuid) is
'Owner-gated non-activating Chemistry mission starter. Fresh readiness clears only untouched BLOCKED_READINESS items to AUTHOR_QUEUED; progressed or attempted items are never rewritten.';

commit;
