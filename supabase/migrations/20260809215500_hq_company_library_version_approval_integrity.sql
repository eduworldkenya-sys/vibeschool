-- HQ Company Library version/approval integrity hardening.
-- Prevent duplicate pending reviews and ensure approvals always refer to the current version.

create unique index if not exists hq_artifact_approvals_one_pending_per_version
  on public.hq_artifact_approvals (artifact_id, version_id)
  where status = 'pending';

create or replace function public.hq_library_add_version(
  p_artifact_id uuid,
  p_structured_content jsonb default null,
  p_storage_bucket text default null,
  p_storage_path text default null,
  p_mime_type text default null,
  p_byte_size bigint default null,
  p_content_hash text default null,
  p_change_summary text default null,
  p_worker_id uuid default null,
  p_source_run_id uuid default null,
  p_promote boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version integer;
  new_version_id uuid;
begin
  perform public.hq_assert_owner();

  if p_structured_content is null and p_storage_path is null then
    raise exception 'A version requires structured_content or storage_path';
  end if;

  perform 1 from public.hq_artifacts where id = p_artifact_id for update;
  if not found then raise exception 'Artifact not found'; end if;

  select coalesce(max(version_number), 0) + 1
  into next_version
  from public.hq_artifact_versions
  where artifact_id = p_artifact_id;

  insert into public.hq_artifact_versions(
    artifact_id, version_number, storage_bucket, storage_path, mime_type,
    byte_size, content_hash, structured_content, change_summary,
    created_by, worker_id, source_run_id
  )
  values(
    p_artifact_id, next_version, p_storage_bucket, p_storage_path, p_mime_type,
    p_byte_size, p_content_hash, p_structured_content, p_change_summary,
    auth.uid(), p_worker_id, p_source_run_id
  )
  returning id into new_version_id;

  if p_promote then
    -- A newer current version invalidates any still-pending review of an older version.
    update public.hq_artifact_approvals
       set status = 'rejected',
           decided_at = now(),
           notes = concat_ws(E'\n', nullif(notes, ''), 'Superseded automatically by a newer promoted version.')
     where artifact_id = p_artifact_id
       and status = 'pending'
       and version_id <> new_version_id;

    -- Never let a fresh version inherit approval/publication state from its predecessor.
    update public.hq_artifacts
       set current_version_id = new_version_id,
           approval_state = 'not_required',
           lifecycle_state = 'draft',
           updated_at = now()
     where id = p_artifact_id;
  end if;

  return new_version_id;
end;
$$;

create or replace function public.hq_library_request_approval(
  p_artifact_id uuid,
  p_version_id uuid default null,
  p_decision_id uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_version uuid;
  current_version uuid;
  approval_id uuid;
begin
  perform public.hq_assert_owner();

  select current_version_id
    into current_version
    from public.hq_artifacts
   where id = p_artifact_id
   for update;
  if not found then raise exception 'Artifact not found'; end if;

  target_version := coalesce(p_version_id, current_version);
  if target_version is null then raise exception 'Artifact has no version to approve'; end if;
  if target_version <> current_version then
    raise exception 'Only the current artifact version can be submitted for approval';
  end if;
  if not exists(
    select 1 from public.hq_artifact_versions v
     where v.id = target_version and v.artifact_id = p_artifact_id
  ) then
    raise exception 'Version does not belong to artifact';
  end if;
  if exists(
    select 1 from public.hq_artifact_approvals ap
     where ap.artifact_id = p_artifact_id
       and ap.version_id = target_version
       and ap.status = 'pending'
  ) then
    raise exception 'Current version already has a pending approval';
  end if;

  insert into public.hq_artifact_approvals(artifact_id, version_id, decision_id, status, notes)
  values(p_artifact_id, target_version, p_decision_id, 'pending', p_notes)
  returning id into approval_id;

  update public.hq_artifacts
     set approval_state = 'pending', lifecycle_state = 'in_review', updated_at = now()
   where id = p_artifact_id;

  return approval_id;
end;
$$;

create or replace function public.hq_library_decide_approval(
  p_approval_id uuid,
  p_status text,
  p_notes text default null,
  p_publish boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  approval public.hq_artifact_approvals%rowtype;
  artifact public.hq_artifacts%rowtype;
  next_lifecycle text;
begin
  perform public.hq_assert_owner();

  if p_status not in ('approved', 'rejected') then
    raise exception 'status must be approved or rejected';
  end if;

  select * into approval
    from public.hq_artifact_approvals
   where id = p_approval_id
   for update;
  if not found then raise exception 'Approval not found'; end if;
  if approval.status <> 'pending' then raise exception 'Approval already resolved'; end if;

  select * into artifact
    from public.hq_artifacts
   where id = approval.artifact_id
   for update;
  if not found then raise exception 'Artifact not found'; end if;
  if artifact.current_version_id is distinct from approval.version_id then
    raise exception 'Approval is stale because a newer current version exists';
  end if;

  update public.hq_artifact_approvals
     set status = p_status,
         reviewer_id = auth.uid(),
         notes = coalesce(p_notes, notes),
         decided_at = now()
   where id = p_approval_id;

  next_lifecycle := case
    when p_status = 'approved' and p_publish then 'published'
    when p_status = 'approved' then 'approved'
    else 'draft'
  end;

  update public.hq_artifacts
     set approval_state = p_status,
         lifecycle_state = next_lifecycle,
         updated_at = now()
   where id = approval.artifact_id;

  return jsonb_build_object(
    'approval_id', p_approval_id,
    'artifact_id', approval.artifact_id,
    'version_id', approval.version_id,
    'status', p_status,
    'lifecycle_state', next_lifecycle
  );
end;
$$;

create or replace function public.hq_library_set_lifecycle(
  p_artifact_id uuid,
  p_state text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  artifact public.hq_artifacts%rowtype;
begin
  perform public.hq_assert_owner();

  if p_state not in ('draft','in_review','approved','published','archived','superseded') then
    raise exception 'Invalid lifecycle state';
  end if;

  select * into artifact from public.hq_artifacts where id = p_artifact_id for update;
  if not found then raise exception 'Artifact not found'; end if;

  if p_state = 'published' and (
    artifact.current_version_id is null or artifact.approval_state <> 'approved'
  ) then
    raise exception 'Publishing requires an approved current version';
  end if;

  update public.hq_artifacts
     set lifecycle_state = p_state, updated_at = now()
   where id = p_artifact_id;
end;
$$;

revoke all on function public.hq_library_add_version(uuid,jsonb,text,text,text,bigint,text,text,uuid,uuid,boolean) from public, anon;
revoke all on function public.hq_library_request_approval(uuid,uuid,uuid,text) from public, anon;
revoke all on function public.hq_library_decide_approval(uuid,text,text,boolean) from public, anon;
revoke all on function public.hq_library_set_lifecycle(uuid,text) from public, anon;

grant execute on function public.hq_library_add_version(uuid,jsonb,text,text,text,bigint,text,text,uuid,uuid,boolean) to authenticated;
grant execute on function public.hq_library_request_approval(uuid,uuid,uuid,text) to authenticated;
grant execute on function public.hq_library_decide_approval(uuid,text,text,boolean) to authenticated;
grant execute on function public.hq_library_set_lifecycle(uuid,text) to authenticated;
