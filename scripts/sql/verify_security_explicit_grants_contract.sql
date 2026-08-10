-- Postflight verification for 20260810071000_security_explicit_grants_contract.sql.
-- Read-only: returns no rows on success; any row is a failed security assertion.

with audited_tables(table_name) as (
  values
    ('curriculum_intelligence_runs'),
    ('curriculum_intelligence_regeneration_jobs'),
    ('publication_release_checks'),
    ('curriculum_content_health_signals'),
    ('curriculum_content_rights'),
    ('curriculum_editorial_actions'),
    ('curriculum_editorial_effectiveness'),
    ('content_learning_events'),
    ('content_engine_cycle_metrics'),
    ('hq_goals'),
    ('hq_certification_results'),
    ('platform_events'),
    ('hq_notifications'),
    ('hq_incidents'),
    ('hq_decisions'),
    ('hq_decision_versions'),
    ('hq_product_configs'),
    ('hq_propagation_targets'),
    ('hq_decision_audit'),
    ('hq_departments'),
    ('hq_work_items'),
    ('hq_policy_registry'),
    ('hq_product_policy_state'),
    ('hq_policy_evaluations'),
    ('hq_worker_templates'),
    ('hq_workers'),
    ('hq_worker_messages'),
    ('hq_worker_runs'),
    ('hq_worker_kpis'),
    ('hq_worker_certifications'),
    ('hq_worker_activation_approvals'),
    ('hq_content_domains')
), existing_tables as (
  select audited.table_name, class.oid, class.relrowsecurity
  from audited_tables audited
  join pg_class class
    on class.relname = audited.table_name
   and class.relnamespace = 'public'::regnamespace
   and class.relkind in ('r', 'p')
)
select table_name, 'anonymous privilege remains' as failure
from existing_tables
where has_any_column_privilege('anon', format('public.%I', table_name), 'SELECT,INSERT,UPDATE,REFERENCES')
   or has_table_privilege('anon', format('public.%I', table_name), 'DELETE,TRUNCATE,TRIGGER')
union all
select table_name, 'RLS disabled' as failure
from existing_tables
where not relrowsecurity
union all
select table_name, 'authenticated has forbidden TRUNCATE' as failure
from existing_tables
where has_table_privilege('authenticated', format('public.%I', table_name), 'TRUNCATE')
union all
select table_name, 'authenticated has forbidden direct access' as failure
from existing_tables
where table_name in (
  'content_engine_cycle_metrics', 'platform_events', 'hq_notifications',
  'hq_incidents', 'hq_decisions', 'hq_decision_versions', 'hq_product_configs',
  'hq_propagation_targets', 'hq_decision_audit', 'hq_departments',
  'hq_work_items', 'hq_policy_registry', 'hq_product_policy_state',
  'hq_policy_evaluations', 'hq_worker_templates', 'hq_workers',
  'hq_worker_messages', 'hq_worker_runs', 'hq_worker_kpis',
  'hq_worker_certifications', 'hq_worker_activation_approvals'
)
and has_table_privilege(
  'authenticated', format('public.%I', table_name),
  'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
);
