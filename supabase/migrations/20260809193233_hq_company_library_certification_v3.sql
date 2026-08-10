-- Company Library certification v3: certify workforce department vocabulary bridging.

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
    'hq_library_set_lifecycle','hq_library_worker_publish_artifact','hq_library_worker_request_review',
    'hq_library_resolve_department'
  )
),
fk_state as (
  select exists(
    select 1 from pg_constraint c
    where c.conrelid='public.hq_artifacts'::regclass and c.contype='f'
      and pg_get_constraintdef(c.oid) like '%worker_id%hq_workforce_workers%'
  ) as worker_fk,
  exists(
    select 1 from pg_constraint c
    where c.conrelid='public.hq_artifact_versions'::regclass and c.contype='f'
      and pg_get_constraintdef(c.oid) like '%source_run_id%hq_workforce_runs%'
  ) as source_run_fk
),
approval_guard as (
  select exists(
    select 1 from pg_indexes
    where schemaname='public' and tablename='hq_artifact_approvals'
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
  from public.hq_workforce_workers w
  where w.status='active'
),
worker_department_state as (
  select count(*) filter (where d.key is null)::integer as unmapped_active_worker_departments
  from worker_departments wd
  left join public.hq_departments d on d.key=wd.library_department
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
  'storage',coalesce((select jsonb_build_object('bucket_name',b.id,'public',b.public) from storage.buckets b where b.id='hq-company-library'),'{}'::jsonb),
  'storage_policies',(select to_jsonb(sps) from storage_policy_state sps),
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
