-- HQ Company Library capabilities.
-- Adds controlled owner-facing RPCs for artifact lifecycle, provenance, approvals,
-- search and version promotion. These functions intentionally validate HQ owner
-- authority and revoke default PUBLIC/anon execution.

create or replace function public.hq_library_list(
  p_department text default null,
  p_state text default null,
  p_search text default null,
  p_limit integer default 100
)
returns table(
  id uuid,
  artifact_key text,
  title text,
  artifact_type text,
  department_key text,
  lifecycle_state text,
  approval_state text,
  confidentiality text,
  purpose text,
  current_version_id uuid,
  current_version_number integer,
  worker_id uuid,
  work_item_id uuid,
  decision_id uuid,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.hq_assert_owner();

  return query
  select
    a.id,
    a.artifact_key,
    a.title,
    a.artifact_type,
    a.department_key,
    a.lifecycle_state,
    a.approval_state,
    a.confidentiality,
    a.purpose,
    a.current_version_id,
    v.version_number,
    a.worker_id,
    a.work_item_id,
    a.decision_id,
    a.updated_at
  from public.hq_artifacts a
  left join public.hq_artifact_versions v on v.id = a.current_version_id
  where (p_department is null or a.department_key = p_department)
    and (p_state is null or a.lifecycle_state = p_state)
    and (
      p_search is null
      or btrim(p_search) = ''
      or a.title ilike '%' || p_search || '%'
      or a.artifact_key ilike '%' || p_search || '%'
      or coalesce(a.purpose, '') ilike '%' || p_search || '%'
      or a.artifact_type ilike '%' || p_search || '%'
    )
  order by a.updated_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

create or replace function public.hq_library_get(p_artifact_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  perform public.hq_assert_owner();

  select jsonb_build_object(
    'artifact', to_jsonb(a),
    'versions', coalesce((
      select jsonb_agg(to_jsonb(v) order by v.version_number desc)
      from public.hq_artifact_versions v
      where v.artifact_id = a.id
    ), '[]'::jsonb),
    'provenance', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.recorded_at desc)
      from public.hq_artifact_provenance p
      where p.artifact_id = a.id
    ), '[]'::jsonb),
    'approvals', coalesce((
      select jsonb_agg(to_jsonb(ap) order by ap.created_at desc)
      from public.hq_artifact_approvals ap
      where ap.artifact_id = a.id
    ), '[]'::jsonb),
    'links', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.created_at desc)
      from public.hq_artifact_links l
      where l.artifact_id = a.id
    ), '[]'::jsonb)
  )
  into result
  from public.hq_artifacts a
  where a.id = p_artifact_id;

  if result is null then
    raise exception 'Artifact not found';
  end if;

  return result;
end;
$$;

create or replace function public.hq_library_create_artifact(
  p_artifact_key text,
  p_title text,
  p_artifact_type text,
  p_department_key text default null,
  p_purpose text default null,
  p_confidentiality text default 'internal',
  p_work_item_id uuid default null,
  p_decision_id uuid default null,
  p_worker_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  perform public.hq_assert_owner();

  if p_artifact_key is null or btrim(p_artifact_key) = '' then
    raise exception 'artifact_key is required';
  end if;
  if p_title is null or btrim(p_title) = '' then
    raise exception 'title is required';
  end if;
  if p_artifact_type is null or btrim(p_artifact_type) = '' then
    raise exception 'artifact_type is required';
  end if;

  insert into public.hq_artifacts(
    artifact_key, title, artifact_type, department_key, work_item_id,
    decision_id, worker_id, created_by, confidentiality, purpose, metadata
  ) values (
    btrim(p_artifact_key), btrim(p_title), btrim(p_artifact_type), p_department_key,
    p_work_item_id, p_decision_id, p_worker_id, auth.uid(),
    coalesce(p_confidentiality, 'internal'), p_purpose, coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into new_id;

  return new_id;
end;
$$;

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
  if not found then
    raise exception 'Artifact not found';
  end if;

  select coalesce(max(version_number), 0) + 1
    into next_version
  from public.hq_artifact_versions
  where artifact_id = p_artifact_id;

  insert into public.hq_artifact_versions(
    artifact_id, version_number, storage_bucket, storage_path, mime_type,
    byte_size, content_hash, structured_content, change_summary,
    created_by, worker_id, source_run_id
  ) values (
    p_artifact_id, next_version, p_storage_bucket, p_storage_path, p_mime_type,
    p_byte_size, p_content_hash, p_structured_content, p_change_summary,
    auth.uid(), p_worker_id, p_source_run_id
  )
  returning id into new_version_id;

  if p_promote then
    update public.hq_artifacts
    set current_version_id = new_version_id,
        updated_at = now()
    where id = p_artifact_id;
  end if;

  return new_version_id;
end;
$$;

create or replace function public.hq_library_add_provenance(
  p_artifact_id uuid,
  p_version_id uuid default null,
  p_source_type text default 'internal',
  p_source_table text default null,
  p_source_id text default null,
  p_source_uri text default null,
  p_evidence_summary text default null,
  p_source_hash text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  perform public.hq_assert_owner();

  if p_source_type is null or btrim(p_source_type) = '' then
    raise exception 'source_type is required';
  end if;

  if p_version_id is not null and not exists (
    select 1 from public.hq_artifact_versions v
    where v.id = p_version_id and v.artifact_id = p_artifact_id
  ) then
    raise exception 'Version does not belong to artifact';
  end if;

  insert into public.hq_artifact_provenance(
    artifact_id, version_id, source_type, source_table, source_id,
    source_uri, evidence_summary, source_hash, metadata
  ) values (
    p_artifact_id, p_version_id, btrim(p_source_type), p_source_table, p_source_id,
    p_source_uri, p_evidence_summary, p_source_hash, coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into new_id;

  return new_id;
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
  approval_id uuid;
begin
  perform public.hq_assert_owner();

  select coalesce(p_version_id, current_version_id)
    into target_version
  from public.hq_artifacts
  where id = p_artifact_id
  for update;

  if not found then
    raise exception 'Artifact not found';
  end if;
  if target_version is null then
    raise exception 'Artifact has no version to approve';
  end if;
  if not exists (
    select 1 from public.hq_artifact_versions v
    where v.id = target_version and v.artifact_id = p_artifact_id
  ) then
    raise exception 'Version does not belong to artifact';
  end if;

  insert into public.hq_artifact_approvals(
    artifact_id, version_id, decision_id, status, notes
  ) values (
    p_artifact_id, target_version, p_decision_id, 'pending', p_notes
  )
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

  if not found then
    raise exception 'Approval not found';
  end if;
  if approval.status <> 'pending' then
    raise exception 'Approval already resolved';
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
      current_version_id = case when p_status = 'approved' then approval.version_id else current_version_id end,
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
begin
  perform public.hq_assert_owner();

  if p_state not in ('draft','in_review','approved','published','archived','superseded') then
    raise exception 'Invalid lifecycle state';
  end if;

  update public.hq_artifacts
  set lifecycle_state = p_state, updated_at = now()
  where id = p_artifact_id;

  if not found then
    raise exception 'Artifact not found';
  end if;
end;
$$;

revoke all on function public.hq_library_list(text,text,text,integer) from public, anon;
revoke all on function public.hq_library_get(uuid) from public, anon;
revoke all on function public.hq_library_create_artifact(text,text,text,text,text,text,uuid,uuid,uuid,jsonb) from public, anon;
revoke all on function public.hq_library_add_version(uuid,jsonb,text,text,text,bigint,text,text,uuid,uuid,boolean) from public, anon;
revoke all on function public.hq_library_add_provenance(uuid,uuid,text,text,text,text,text,text,jsonb) from public, anon;
revoke all on function public.hq_library_request_approval(uuid,uuid,uuid,text) from public, anon;
revoke all on function public.hq_library_decide_approval(uuid,text,text,boolean) from public, anon;
revoke all on function public.hq_library_set_lifecycle(uuid,text) from public, anon;

grant execute on function public.hq_library_list(text,text,text,integer) to authenticated;
grant execute on function public.hq_library_get(uuid) to authenticated;
grant execute on function public.hq_library_create_artifact(text,text,text,text,text,text,uuid,uuid,uuid,jsonb) to authenticated;
grant execute on function public.hq_library_add_version(uuid,jsonb,text,text,text,bigint,text,text,uuid,uuid,boolean) to authenticated;
grant execute on function public.hq_library_add_provenance(uuid,uuid,text,text,text,text,text,text,jsonb) to authenticated;
grant execute on function public.hq_library_request_approval(uuid,uuid,uuid,text) to authenticated;
grant execute on function public.hq_library_decide_approval(uuid,text,text,boolean) to authenticated;
grant execute on function public.hq_library_set_lifecycle(uuid,text) to authenticated;
