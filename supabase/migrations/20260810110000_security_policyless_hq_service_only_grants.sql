-- Close legacy object-layer reachability for policyless internal HQ tables.
--
-- These tables are intentionally service-only: RLS is enabled and no client
-- policies exist. Removing Data API role grants therefore preserves the current
-- fail-closed row behavior while making the object privilege contract explicit.
--
-- Safe corrective path: if a future reviewed client workflow needs one of these
-- objects, add the minimum operation grant and its matching owner-scoped RLS
-- policy together in a new forward migration.

do $contract$
declare
  table_name text;
  service_only_tables constant text[] := array[
    'hq_context_decision_snapshots',
    'hq_context_fact_definitions',
    'hq_context_facts_cache',
    'hq_context_provenance',
    'hq_context_scopes',
    'hq_context_sources',
    'hq_workforce_certification_results',
    'hq_workforce_contract_clauses',
    'hq_workforce_decisions',
    'hq_workforce_gap_evaluations',
    'hq_workforce_gap_signals',
    'hq_workforce_lanes',
    'hq_workforce_learning_candidates',
    'hq_workforce_outcome_verifications',
    'hq_workforce_recovery_actions',
    'hq_workforce_skills'
  ];
begin
  foreach table_name in array service_only_tables loop
    if to_regclass(format('public.%I', table_name)) is null then
      continue;
    end if;

    if not (
      select class.relrowsecurity
      from pg_class class
      where class.oid = to_regclass(format('public.%I', table_name))
    ) then
      raise exception 'Refusing to classify %.% as service-only: RLS is disabled',
        'public', table_name;
    end if;

    if exists (
      select 1
      from pg_policy policy
      where policy.polrelid = to_regclass(format('public.%I', table_name))
    ) then
      raise exception 'Refusing to classify %.% as service-only: client policy exists',
        'public', table_name;
    end if;

    execute format(
      'revoke all privileges on table public.%I from public, anon, authenticated, service_role',
      table_name
    );
    execute format(
      'grant select, insert, update, delete on table public.%I to service_role',
      table_name
    );
  end loop;
end
$contract$;

-- authorization-test: the 16 declared tables deny anon/authenticated direct
-- access; service_role retains CRUD; every table keeps RLS and no client policy.
