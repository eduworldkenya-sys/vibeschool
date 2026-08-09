-- Reserve workforce identity and run provenance for the trusted workforce bridge.

create or replace function public.hq_library_create_artifact(
  p_artifact_key text,p_title text,p_artifact_type text,p_department_key text default null,p_purpose text default null,p_confidentiality text default 'internal',p_work_item_id uuid default null,p_decision_id uuid default null,p_worker_id uuid default null,p_metadata jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  perform public.hq_assert_owner();
  if p_worker_id is not null then raise exception 'Worker identity is reserved for the trusted workforce Library bridge'; end if;
  if p_artifact_key is null or btrim(p_artifact_key)='' then raise exception 'artifact_key is required'; end if;
  if p_title is null or btrim(p_title)='' then raise exception 'title is required'; end if;
  if p_artifact_type is null or btrim(p_artifact_type)='' then raise exception 'artifact_type is required'; end if;
  if p_department_key is not null and not exists(select 1 from public.hq_departments d where d.key=p_department_key) then raise exception 'Unknown HQ department %',p_department_key; end if;
  insert into public.hq_artifacts(artifact_key,title,artifact_type,department_key,work_item_id,decision_id,worker_id,created_by,confidentiality,purpose,metadata)
  values(btrim(p_artifact_key),btrim(p_title),btrim(p_artifact_type),p_department_key,p_work_item_id,p_decision_id,null,auth.uid(),coalesce(p_confidentiality,'internal'),p_purpose,coalesce(p_metadata,'{}'::jsonb))
  returning id into new_id;
  return new_id;
end;$$;

create or replace function public.hq_library_add_version(
  p_artifact_id uuid,p_structured_content jsonb default null,p_storage_bucket text default null,p_storage_path text default null,p_mime_type text default null,p_byte_size bigint default null,p_content_hash text default null,p_change_summary text default null,p_worker_id uuid default null,p_source_run_id uuid default null,p_promote boolean default true
)
returns uuid language plpgsql security definer set search_path = public as $$
declare next_version integer; new_version_id uuid;
begin
  perform public.hq_assert_owner();
  if p_worker_id is not null or p_source_run_id is not null then raise exception 'Worker/run lineage is reserved for the trusted workforce Library bridge'; end if;
  if p_structured_content is null and p_storage_path is null then raise exception 'A version requires structured_content or storage_path'; end if;
  if p_storage_path is not null and coalesce(p_storage_bucket,'')<>'hq-company-library' then raise exception 'Owner file versions must use the private HQ Company Library bucket'; end if;
  perform 1 from public.hq_artifacts where id=p_artifact_id for update;
  if not found then raise exception 'Artifact not found'; end if;
  select coalesce(max(version_number),0)+1 into next_version from public.hq_artifact_versions where artifact_id=p_artifact_id;
  insert into public.hq_artifact_versions(artifact_id,version_number,storage_bucket,storage_path,mime_type,byte_size,content_hash,structured_content,change_summary,created_by,worker_id,source_run_id)
  values(p_artifact_id,next_version,p_storage_bucket,p_storage_path,p_mime_type,p_byte_size,p_content_hash,p_structured_content,p_change_summary,auth.uid(),null,null) returning id into new_version_id;
  if p_promote then
    update public.hq_artifact_approvals set status='rejected',decided_at=now(),notes=concat_ws(E'\n',nullif(notes,''),'Superseded automatically by a newer promoted version.') where artifact_id=p_artifact_id and status='pending' and version_id<>new_version_id;
    update public.hq_artifacts set current_version_id=new_version_id,approval_state='not_required',lifecycle_state='draft',updated_at=now() where id=p_artifact_id;
  end if;
  return new_version_id;
end;$$;

create or replace function public.hq_library_add_provenance(
  p_artifact_id uuid,p_version_id uuid default null,p_source_type text default 'internal',p_source_table text default null,p_source_id text default null,p_source_uri text default null,p_evidence_summary text default null,p_source_hash text default null,p_metadata jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  perform public.hq_assert_owner();
  if p_source_type is null or btrim(p_source_type)='' then raise exception 'source_type is required'; end if;
  if lower(btrim(p_source_type))='workforce_run' then raise exception 'workforce_run provenance is reserved for the trusted workforce Library bridge'; end if;
  if p_version_id is not null and not exists(select 1 from public.hq_artifact_versions v where v.id=p_version_id and v.artifact_id=p_artifact_id) then raise exception 'Version does not belong to artifact'; end if;
  if not exists(select 1 from public.hq_artifacts a where a.id=p_artifact_id) then raise exception 'Artifact not found'; end if;
  insert into public.hq_artifact_provenance(artifact_id,version_id,source_type,source_table,source_id,source_uri,evidence_summary,source_hash,metadata)
  values(p_artifact_id,p_version_id,btrim(p_source_type),p_source_table,p_source_id,p_source_uri,p_evidence_summary,p_source_hash,coalesce(p_metadata,'{}'::jsonb)) returning id into new_id;
  return new_id;
end;$$;

revoke all on function public.hq_library_create_artifact(text,text,text,text,text,text,uuid,uuid,uuid,jsonb) from public,anon;
revoke all on function public.hq_library_add_version(uuid,jsonb,text,text,text,bigint,text,text,uuid,uuid,boolean) from public,anon;
revoke all on function public.hq_library_add_provenance(uuid,uuid,text,text,text,text,text,text,jsonb) from public,anon;
grant execute on function public.hq_library_create_artifact(text,text,text,text,text,text,uuid,uuid,uuid,jsonb) to authenticated;
grant execute on function public.hq_library_add_version(uuid,jsonb,text,text,text,bigint,text,text,uuid,uuid,boolean) to authenticated;
grant execute on function public.hq_library_add_provenance(uuid,uuid,text,text,text,text,text,text,jsonb) to authenticated;
