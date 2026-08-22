begin;

do $$
declare
  v_def text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='hq_workforce_capability_authority_grants'
      and column_name='max_runtime_ms'
  ) then
    raise exception 'missing max_runtime_ms';
  end if;

  if not exists (
    select 1
    from pg_constraint c
    join pg_class r on r.oid=c.conrelid
    join pg_namespace n on n.oid=r.relnamespace
    where n.nspname='public'
      and r.relname='hq_workforce_capability_authority_grants'
      and c.conname='hq_workforce_capability_authority_grants_max_runtime_ms_check'
  ) then
    raise exception 'missing max_runtime_ms constraint';
  end if;

  if has_function_privilege(
      'anon',
      'public.hq_workforce_shadow_review_decision(uuid,text,text)'::regprocedure,
      'EXECUTE'
     )
     or has_function_privilege(
      'authenticated',
      'public.hq_workforce_shadow_review_decision(uuid,text,text)'::regprocedure,
      'EXECUTE'
     )
  then
    raise exception 'legacy shadow reviewer exposed to client roles';
  end if;

  if not has_function_privilege(
      'service_role',
      'public.hq_workforce_shadow_review_decision(uuid,text,text)'::regprocedure,
      'EXECUTE'
     )
  then
    raise exception 'service role cannot reject/revise legacy shadow decisions';
  end if;

  if has_function_privilege(
      'anon',
      'public.hq_workforce_owner_review_shadow_decision(uuid,text,text)'::regprocedure,
      'EXECUTE'
     )
     or has_function_privilege(
      'service_role',
      'public.hq_workforce_owner_review_shadow_decision(uuid,text,text)'::regprocedure,
      'EXECUTE'
     )
  then
    raise exception 'owner shadow reviewer exposed to non-owner execution roles';
  end if;

  if not has_function_privilege(
      'authenticated',
      'public.hq_workforce_owner_review_shadow_decision(uuid,text,text)'::regprocedure,
      'EXECUTE'
     )
  then
    raise exception 'authenticated owner review route missing';
  end if;

  select pg_get_functiondef(
    'public.hq_workforce_shadow_review_decision(uuid,text,text)'::regprocedure
  ) into v_def;

  if position('owner_review_required_for_shadow_approval' in v_def) = 0 then
    raise exception 'legacy shadow approval block missing';
  end if;

  select pg_get_functiondef(
    'public.hq_workforce_owner_review_shadow_decision(uuid,text,text)'::regprocedure
  ) into v_def;

  if position('is_platform_owner()' in v_def) = 0
     or position('shadow_approval_requires_recommended_candidate_lineage' in v_def) = 0
     or position('shadow_approval_blocked_by_unresolved_anomaly' in v_def) = 0
     or position('shadow_approval_requires_no_consequential_execution' in v_def) = 0
     or position('shadow_approval_requires_recorded_authority_allow' in v_def) = 0
  then
    raise exception 'owner shadow approval guards incomplete';
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname in (
        'hq_workforce_workers',
        'hq_workforce_assignments',
        'hq_workforce_decisions',
        'hq_workforce_capability_authority_grants',
        'hq_workforce_shadow_decisions'
      )
      and not c.relrowsecurity
  ) then
    raise exception 'critical workforce table missing RLS';
  end if;

  if exists (
    select 1
    from (values
      ('hq_workforce_workers'),
      ('hq_workforce_assignments'),
      ('hq_workforce_decisions'),
      ('hq_workforce_capability_authority_grants'),
      ('hq_workforce_shadow_decisions')
    ) as v(table_name)
    where has_table_privilege('authenticated', format('%I.%I','public',v.table_name), 'INSERT')
       or has_table_privilege('authenticated', format('%I.%I','public',v.table_name), 'UPDATE')
       or has_table_privilege('authenticated', format('%I.%I','public',v.table_name), 'DELETE')
  ) then
    raise exception 'authenticated direct mutation privilege exists on critical workforce table';
  end if;
end $$;

rollback;
