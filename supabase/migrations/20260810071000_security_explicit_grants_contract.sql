-- Vibeschool explicit object-grant contract.
--
-- Safe corrective path:
--   * this migration only narrows Data API privileges;
--   * service_role retains ordinary CRUD where server-side processing needs it;
--   * owner-visible tables retain only the operations allowed by their RLS policies;
--   * rollback requires an explicitly reviewed forward migration restoring only a
--     demonstrated application privilege. Do not restore automatic blanket grants.

-- New public objects must be private until their creating migration opts roles in.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables
  from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions
  from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke usage, select on sequences
  from anon, authenticated, service_role;

-- These two tables were protected in production by later live changes, but their
-- repository creation migration omitted the complete RLS contract. Make a clean
-- rebuild and the current database converge on the same owner-only read policy.
alter table public.hq_goals enable row level security;
alter table public.hq_certification_results enable row level security;

drop policy if exists hq_goals_owner_read on public.hq_goals;
create policy hq_goals_owner_read
on public.hq_goals
for select
to authenticated
using ((select public.is_platform_owner()));

drop policy if exists hq_cert_results_owner_read
  on public.hq_certification_results;
create policy hq_cert_results_owner_read
on public.hq_certification_results
for select
to authenticated
using ((select public.is_platform_owner()));

-- Revoke inherited/default reachability before declaring the exact API surface.
-- PUBLIC is included because privileges inherited through PUBLIC otherwise remain.
do $contract$
declare
  table_name text;
  audited_tables constant text[] := array[
    'curriculum_intelligence_runs',
    'curriculum_intelligence_regeneration_jobs',
    'publication_release_checks',
    'curriculum_content_health_signals',
    'curriculum_content_rights',
    'curriculum_editorial_actions',
    'curriculum_editorial_effectiveness',
    'content_learning_events',
    'content_engine_cycle_metrics',
    'hq_goals',
    'hq_certification_results',
    'platform_events',
    'hq_notifications',
    'hq_incidents',
    'hq_decisions',
    'hq_decision_versions',
    'hq_product_configs',
    'hq_propagation_targets',
    'hq_decision_audit',
    'hq_departments',
    'hq_work_items',
    'hq_policy_registry',
    'hq_product_policy_state',
    'hq_policy_evaluations',
    'hq_worker_templates',
    'hq_workers',
    'hq_worker_messages',
    'hq_worker_runs',
    'hq_worker_kpis',
    'hq_worker_certifications',
    'hq_worker_activation_approvals',
    'hq_content_domains'
  ];
begin
  foreach table_name in array audited_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format(
        'revoke all privileges on table public.%I from public, anon, authenticated, service_role',
        table_name
      );
      execute format(
        'grant select, insert, update, delete on table public.%I to service_role',
        table_name
      );
    end if;
  end loop;
end
$contract$;

-- Owner-managed content operations. RLS remains the row-authority boundary.
grant select, insert, update, delete on table
  public.curriculum_intelligence_regeneration_jobs,
  public.publication_release_checks,
  public.curriculum_content_health_signals,
  public.curriculum_content_rights,
  public.curriculum_editorial_actions,
  public.curriculum_editorial_effectiveness
to authenticated;

-- A learner may append and read only their own learning events under RLS.
grant select, insert on table public.content_learning_events to authenticated;

-- Owner dashboards are read-only through the Data API. Mutations remain RPC- or
-- service-mediated so authenticated users never receive direct write privileges.
grant select on table
  public.curriculum_intelligence_runs,
  public.hq_goals,
  public.hq_certification_results,
  public.hq_content_domains
to authenticated;

-- Identity-backed sequences used by server-only inserts remain explicit as well.
do $sequences$
declare
  sequence_record record;
begin
  for sequence_record in
    select distinct sequence_ns.nspname as schema_name,
           sequence_class.relname as sequence_name
    from pg_class table_class
    join pg_namespace table_ns on table_ns.oid = table_class.relnamespace
    join pg_depend dependency
      on dependency.refobjid = table_class.oid
     and dependency.deptype in ('a', 'i')
    join pg_class sequence_class
      on sequence_class.oid = dependency.objid
     and sequence_class.relkind = 'S'
    join pg_namespace sequence_ns
      on sequence_ns.oid = sequence_class.relnamespace
    where table_ns.nspname = 'public'
      and table_class.relname = any (array[
        'curriculum_intelligence_runs',
        'curriculum_intelligence_regeneration_jobs',
        'publication_release_checks',
        'curriculum_content_health_signals',
        'curriculum_content_rights',
        'curriculum_editorial_actions',
        'curriculum_editorial_effectiveness',
        'content_learning_events',
        'content_engine_cycle_metrics',
        'hq_goals',
        'hq_certification_results',
        'platform_events',
        'hq_notifications',
        'hq_incidents',
        'hq_decisions',
        'hq_decision_versions',
        'hq_product_configs',
        'hq_propagation_targets',
        'hq_decision_audit',
        'hq_departments',
        'hq_work_items',
        'hq_policy_registry',
        'hq_product_policy_state',
        'hq_policy_evaluations',
        'hq_worker_templates',
        'hq_workers',
        'hq_worker_messages',
        'hq_worker_runs',
        'hq_worker_kpis',
        'hq_worker_certifications',
        'hq_worker_activation_approvals',
        'hq_content_domains'
      ])
  loop
    execute format(
      'revoke all privileges on sequence %I.%I from public, anon, authenticated, service_role',
      sequence_record.schema_name,
      sequence_record.sequence_name
    );
    execute format(
      'grant usage, select on sequence %I.%I to service_role',
      sequence_record.schema_name,
      sequence_record.sequence_name
    );
  end loop;
end
$sequences$;

