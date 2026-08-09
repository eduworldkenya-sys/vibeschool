-- Connect the existing HQ workforce identity/run authority model to Company Library.
-- These functions are internal database capabilities: they do not grant client roles
-- direct execution. A caller must already be executing inside the trusted workforce
-- operating path and must present a concrete run whose worker/lane authority is valid.

create or replace function public.hq_library_worker_publish_artifact(
  p_run_id uuid,
  p_artifact_key text,
  p_title text,
  p_artifact_type text,
  p_purpose text,
  p_structured_content jsonb,
  p_change_summary text default null,
  p_confidentiality text default 'internal',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.hq_workforce_runs%rowtype;
  v_worker public.hq_workforce_workers%rowtype;
  v_artifact_id uuid;
  v_version_id uuid;
  v_version_number integer;
  v_assignment_ok boolean;
begin
  if auth.role() not in ('service_role') then
    raise exception 'Trusted workforce caller required';
  end if;

  if p_run_id is null then raise exception 'run_id is required'; end if;
  if p_artifact_key is null or btrim(p_artifact_key) = '' then raise exception 'artifact_key is required'; end if;
  if p_title is null or btrim(p_title) = '' then raise exception 'title is required'; end if;
  if p_artifact_type is null or btrim(p_artifact_type) = '' then raise exception 'artifact_type is required'; end if;
  if p_structured_content is null then raise exception 'structured_content is required'; end if;

  select * into v_run
  from public.hq_workforce_runs
  where id = p_run_id
  for update;

  if not found then raise exception 'Workforce run not found'; end if;
  if v_run.status not in ('running','completed','verified') then
    raise exception 'Run status % cannot publish an artifact', v_run.status;
  end if;
  if v_run.authority_result <> 'allow' then
    raise exception 'Run authority does not allow autonomous artifact publication';
  end if;

  select * into v_worker
  from public.hq_workforce_workers
  where id = v_run.worker_id;

  if not found then raise exception 'Worker not found'; end if;
  if v_worker.status not in ('active','probation') then
    raise exception 'Worker status % cannot publish artifacts', v_worker.status;
  end if;

  select exists(
    select 1
    from public.hq_workforce_assignments a
    where a.worker_key = v_worker.worker_key
      and a.department_key = v_worker.department_key
      and a.active = true
  ) into v_assignment_ok;

  if not v_assignment_ok then
    raise exception 'Worker has no active department assignment';
  end if;

  -- Reuse the canonical workforce lane authorization policy.
  if not public.hq_workforce_authorize_worker_lane(v_worker.worker_key, v_run.lane_key) then
    raise exception 'Worker is not authorized for run lane %', v_run.lane_key;
  end if;

  insert into public.hq_artifacts(
    artifact_key,
    title,
    artifact_type,
    department_key,
    work_item_id,
    worker_id,
    created_by,
    confidentiality,
    purpose,
    lifecycle_state,
    approval_state,
    metadata
  ) values (
    btrim(p_artifact_key),
    btrim(p_title),
    btrim(p_artifact_type),
    v_worker.department_key,
    v_run.work_item_id,
    v_worker.id,
    null,
    coalesce(p_confidentiality,'internal'),
    p_purpose,
    'draft',
    'not_required',
    coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object(
      'origin','hq_workforce',
      'worker_key',v_worker.worker_key,
      'lane_key',v_run.lane_key,
      'run_id',v_run.id
    )
  )
  on conflict (artifact_key) do update
    set title = excluded.title,
        artifact_type = excluded.artifact_type,
        department_key = excluded.department_key,
        work_item_id = excluded.work_item_id,
        worker_id = excluded.worker_id,
        purpose = excluded.purpose,
        confidentiality = excluded.confidentiality,
        metadata = public.hq_artifacts.metadata || excluded.metadata,
        updated_at = now()
  returning id into v_artifact_id;

  perform 1 from public.hq_artifacts where id = v_artifact_id for update;

  select coalesce(max(version_number),0) + 1
    into v_version_number
  from public.hq_artifact_versions
  where artifact_id = v_artifact_id;

  insert into public.hq_artifact_versions(
    artifact_id,
    version_number,
    structured_content,
    mime_type,
    change_summary,
    created_by,
    worker_id,
    source_run_id
  ) values (
    v_artifact_id,
    v_version_number,
    p_structured_content,
    'application/json',
    coalesce(p_change_summary,'Workforce-generated version'),
    null,
    v_worker.id,
    v_run.id
  )
  returning id into v_version_id;

  update public.hq_artifacts
  set current_version_id = v_version_id,
      updated_at = now()
  where id = v_artifact_id;

  insert into public.hq_artifact_provenance(
    artifact_id,
    version_id,
    source_type,
    source_table,
    source_id,
    evidence_summary,
    metadata
  ) values (
    v_artifact_id,
    v_version_id,
    'workforce_run',
    'hq_workforce_runs',
    v_run.id::text,
    'Generated by authorized HQ workforce run',
    jsonb_build_object(
      'worker_id',v_worker.id,
      'worker_key',v_worker.worker_key,
      'lane_key',v_run.lane_key,
      'authority_result',v_run.authority_result
    )
  );

  return jsonb_build_object(
    'artifact_id',v_artifact_id,
    'version_id',v_version_id,
    'version_number',v_version_number,
    'worker_id',v_worker.id,
    'worker_key',v_worker.worker_key,
    'run_id',v_run.id,
    'department_key',v_worker.department_key
  );
end;
$$;

create or replace function public.hq_library_worker_request_review(
  p_run_id uuid,
  p_artifact_id uuid,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.hq_workforce_runs%rowtype;
  v_artifact public.hq_artifacts%rowtype;
  v_approval_id uuid;
begin
  if auth.role() not in ('service_role') then
    raise exception 'Trusted workforce caller required';
  end if;

  select * into v_run from public.hq_workforce_runs where id=p_run_id;
  if not found then raise exception 'Workforce run not found'; end if;
  if v_run.authority_result not in ('allow','approval_required') then
    raise exception 'Run is not authorized to request review';
  end if;

  select * into v_artifact from public.hq_artifacts where id=p_artifact_id for update;
  if not found then raise exception 'Artifact not found'; end if;
  if v_artifact.worker_id is distinct from v_run.worker_id then
    raise exception 'Run worker does not own artifact';
  end if;
  if v_artifact.current_version_id is null then
    raise exception 'Artifact has no version to review';
  end if;

  insert into public.hq_artifact_approvals(
    artifact_id, version_id, decision_id, status, notes
  ) values (
    v_artifact.id, v_artifact.current_version_id, v_artifact.decision_id,
    'pending', coalesce(p_notes,'Workforce requested HQ review')
  ) returning id into v_approval_id;

  update public.hq_artifacts
  set approval_state='pending', lifecycle_state='in_review', updated_at=now()
  where id=v_artifact.id;

  return v_approval_id;
end;
$$;

revoke all on function public.hq_library_worker_publish_artifact(uuid,text,text,text,text,jsonb,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.hq_library_worker_request_review(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.hq_library_worker_publish_artifact(uuid,text,text,text,text,jsonb,text,text,jsonb) to service_role;
grant execute on function public.hq_library_worker_request_review(uuid,uuid,text) to service_role;
