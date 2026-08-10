-- HQ Company Library storage integrity.
-- Atomically register a private upload as a version + provenance record and
-- extend certification with database<->Storage consistency checks.

create or replace function public.hq_library_register_upload(
  p_artifact_id uuid,
  p_storage_path text,
  p_original_name text,
  p_mime_type text default 'application/octet-stream',
  p_byte_size bigint default null,
  p_content_hash text default null,
  p_change_summary text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_version_id uuid;
begin
  perform public.hq_assert_owner();

  if p_artifact_id is null then
    raise exception 'artifact_id is required';
  end if;
  if nullif(btrim(p_storage_path),'') is null then
    raise exception 'storage_path is required';
  end if;
  if p_storage_path !~ ('^' || p_artifact_id::text || '/[^/]+') then
    raise exception 'storage_path must be scoped beneath the artifact id';
  end if;
  if nullif(btrim(p_original_name),'') is null then
    raise exception 'original_name is required';
  end if;
  if p_byte_size is not null and p_byte_size < 0 then
    raise exception 'byte_size cannot be negative';
  end if;

  v_version_id := public.hq_library_add_version(
    p_artifact_id,
    null,
    'hq-company-library',
    p_storage_path,
    coalesce(nullif(btrim(p_mime_type),''),'application/octet-stream'),
    p_byte_size,
    p_content_hash,
    coalesce(nullif(btrim(p_change_summary),''),'Uploaded ' || p_original_name),
    null,
    null,
    true
  );

  perform public.hq_library_add_provenance(
    p_artifact_id,
    v_version_id,
    'owner_upload',
    'storage.objects',
    p_storage_path,
    null,
    'Private HQ upload: ' || p_original_name,
    p_content_hash,
    jsonb_build_object(
      'bucket','hq-company-library',
      'path',p_storage_path,
      'original_name',p_original_name,
      'mime_type',coalesce(nullif(btrim(p_mime_type),''),'application/octet-stream'),
      'byte_size',p_byte_size
    )
  );

  return v_version_id;
end;
$$;

revoke all on function public.hq_library_register_upload(uuid,text,text,text,bigint,text,text) from public,anon;
grant execute on function public.hq_library_register_upload(uuid,text,text,text,bigint,text,text) to authenticated;

create or replace function public.hq_library_certification_report()
returns jsonb
language sql
security definer
set search_path = public, pg_catalog, storage
as $$
with library_tables(table_name) as (
  values ('hq_artifacts'::text),('hq_artifact_versions'),('hq_artifact_provenance'),('hq_artifact_approvals'),('hq_artifact_links')
),
table_state as (
  select t.table_name,coalesce(c.relrowsecurity,false) as rls_enabled,count(p.policyname)::integer as policy_count
  from library_tables t
  left join pg_namespace n on n.nspname='public'
  left join pg_class c on c.relnamespace=n.oid and c.relname=t.table_name and c.relkind='r'
  left join pg_policies p on p.schemaname='public' and p.tablename=t.table_name
  group by t.table_name,c.relrowsecurity
),
function_state as (
  select p.proname as function_name,pg_get_function_identity_arguments(p.oid) as identity_arguments,p.prosecdef as security_definer,
    has_function_privilege('public',p.oid,'EXECUTE') as public_exec,
    has_function_privilege('anon',p.oid,'EXECUTE') as anon_exec,
    has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_exec,
    has_function_privilege('service_role',p.oid,'EXECUTE') as service_role_exec
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in (
    'hq_library_list','hq_library_get','hq_library_create_artifact','hq_library_add_version',
    'hq_library_add_provenance','hq_library_request_approval','hq_library_decide_approval',
    'hq_library_set_lifecycle','hq_library_register_upload',
    'hq_library_worker_publish_artifact','hq_library_worker_request_review',
    'hq_library_resolve_department'
  )
),
table_privilege_state as (
  select
    count(*) filter (where grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'))::integer as client_write_grants,
    count(*) filter (where grantee='anon')::integer as anon_any_grants,
    count(*) filter (where grantee='authenticated' and privilege_type='SELECT')::integer as authenticated_select_grants
  from information_schema.role_table_grants g
  where g.table_schema='public'
    and g.table_name in ('hq_artifacts','hq_artifact_versions','hq_artifact_provenance','hq_artifact_approvals','hq_artifact_links')
),
fk_state as (
  select exists(
    select 1 from pg_constraint c where c.conrelid='public.hq_artifacts'::regclass and c.contype='f'
      and pg_get_constraintdef(c.oid) like '%worker_id%hq_workforce_workers%'
  ) as worker_fk,
  exists(
    select 1 from pg_constraint c where c.conrelid='public.hq_artifact_versions'::regclass and c.contype='f'
      and pg_get_constraintdef(c.oid) like '%source_run_id%hq_workforce_runs%'
  ) as source_run_fk
),
approval_guard as (
  select exists(
    select 1 from pg_indexes where schemaname='public' and tablename='hq_artifact_approvals'
      and indexname='hq_artifact_approvals_one_pending_per_version'
  ) as one_pending_index
),
storage_policy_state as (
  select
    count(*) filter (where cmd='SELECT')::integer as select_policies,
    count(*) filter (where cmd='INSERT')::integer as insert_policies,
    count(*) filter (where cmd='UPDATE')::integer as update_policies,
    count(*) filter (where cmd='DELETE')::integer as delete_policies
  from pg_policies
  where schemaname='storage' and tablename='objects'
    and (coalesce(qual,'') like '%hq-company-library%' or coalesce(with_check,'') like '%hq-company-library%')
),
worker_departments as (
  select distinct w.department_key as workforce_department,
    public.hq_library_resolve_department(w.department_key,null) as library_department
  from public.hq_workforce_workers w where w.status='active'
),
worker_department_state as (
  select count(*) filter (where d.key is null)::integer as unmapped_active_worker_departments
  from worker_departments wd left join public.hq_departments d on d.key=wd.library_department
),
storage_integrity as (
  select
    (select count(*)::integer
       from storage.objects o
      where o.bucket_id='hq-company-library'
        and not exists (
          select 1 from public.hq_artifact_versions v
          where v.storage_bucket='hq-company-library' and v.storage_path=o.name
        )) as orphan_storage_objects,
    (select count(*)::integer
       from public.hq_artifact_versions v
      where v.storage_bucket='hq-company-library'
        and v.storage_path is not null
        and not exists (
          select 1 from storage.objects o
          where o.bucket_id='hq-company-library' and o.name=v.storage_path
        )) as missing_storage_objects,
    (select count(*)::integer
       from public.hq_artifact_versions v
      where v.storage_bucket='hq-company-library'
        and v.storage_path is not null
        and not exists (
          select 1 from public.hq_artifact_provenance p
          where p.version_id=v.id
        )) as file_versions_without_provenance
),
integrity as (
  select
    (select count(*)::integer from public.hq_artifacts a left join public.hq_artifact_versions v on v.id=a.current_version_id where a.current_version_id is not null and (v.id is null or v.artifact_id<>a.id)) as orphan_current_versions,
    (select count(*)::integer from public.hq_artifact_approvals ap join public.hq_artifact_versions v on v.id=ap.version_id where v.artifact_id<>ap.artifact_id) as cross_artifact_approvals,
    (select count(*)::integer from public.hq_artifact_provenance pr join public.hq_artifact_versions v on v.id=pr.version_id where pr.version_id is not null and v.artifact_id<>pr.artifact_id) as cross_artifact_provenance,
    (select count(*)::integer from public.hq_artifact_approvals ap join public.hq_artifacts a on a.id=ap.artifact_id where ap.status='pending' and ap.version_id is distinct from a.current_version_id) as stale_pending_approvals,
    (select count(*)::integer from public.hq_artifacts a where a.lifecycle_state='published' and (a.approval_state<>'approved' or a.current_version_id is null)) as published_without_approved_current,
    (select count(*)::integer from (select artifact_id,version_id,count(*) from public.hq_artifact_approvals where status='pending' group by artifact_id,version_id having count(*)>1) d) as duplicate_pending_approvals
)
select jsonb_build_object(
  'generated_at',now(),
  'tables',coalesce((select jsonb_agg(to_jsonb(ts) order by ts.table_name) from table_state ts),'[]'::jsonb),
  'table_privileges',(select to_jsonb(tps) from table_privilege_state tps),
  'storage',coalesce((select jsonb_build_object('bucket_name',b.id,'public',b.public) from storage.buckets b where b.id='hq-company-library'),'{}'::jsonb),
  'storage_policies',(select to_jsonb(sps) from storage_policy_state sps),
  'storage_integrity',(select to_jsonb(si) from storage_integrity si),
  'functions',coalesce((select jsonb_agg(to_jsonb(fs) order by fs.function_name) from function_state fs),'[]'::jsonb),
  'foreign_keys',(select to_jsonb(fk) from fk_state fk),
  'approval_guard',(select to_jsonb(ag) from approval_guard ag),
  'worker_department_state',(select to_jsonb(wds) from worker_department_state wds),
  'worker_department_mappings',coalesce((select jsonb_agg(to_jsonb(wd) order by wd.workforce_department) from worker_departments wd),'[]'::jsonb),
  'integrity',(select to_jsonb(i) from integrity i)
);
$$;

revoke all on function public.hq_library_certification_report() from public,anon,authenticated;
grant execute on function public.hq_library_certification_report() to service_role;
