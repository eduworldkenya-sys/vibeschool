-- Student = 1 health-check catalog performance closure.
-- Production postflight showed the information_schema FK scan exceeded statement_timeout.
-- Replace only the operational scan; identity constraints/resolver remain unchanged.

create or replace function public.run_student_identity_health_check()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  v_wrong_fk integer := 0;
  v_missing_fk integer := 0;
  v_duplicates integer := 0;
  v_role_mismatch integer := 0;
  v_profile_without_learner integer := 0;
  v_claimed integer := 0;
  v_unclaimed integer := 0;
  v_status text;
  v_id uuid;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'service_role_required';
  end if;

  -- Direct pg_catalog inspection avoids information_schema expansion on the large
  -- production schema. A student_id column is canonical only when at least one FK
  -- on that exact attribute targets public.students(id); any non-canonical FK on
  -- the same attribute is also reported as wrong rather than hidden.
  with student_cols as (
    select c.oid as relid, c.relname as table_name, a.attnum
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public'
      and c.relkind in ('r','p')
      and a.attname = 'student_id'
      and a.attnum > 0
      and not a.attisdropped
  ), classified as (
    select sc.*,
      exists (
        select 1
        from pg_catalog.pg_constraint con
        where con.contype = 'f'
          and con.conrelid = sc.relid
          and sc.attnum = any(con.conkey)
      ) as has_fk,
      exists (
        select 1
        from pg_catalog.pg_constraint con
        join pg_catalog.pg_attribute target_attr
          on target_attr.attrelid = con.confrelid
         and target_attr.attnum = con.confkey[array_position(con.conkey, sc.attnum)]
        where con.contype = 'f'
          and con.conrelid = sc.relid
          and sc.attnum = any(con.conkey)
          and con.confrelid = 'public.students'::regclass
          and target_attr.attname = 'id'
      ) as has_canonical_fk,
      exists (
        select 1
        from pg_catalog.pg_constraint con
        where con.contype = 'f'
          and con.conrelid = sc.relid
          and sc.attnum = any(con.conkey)
          and not (
            con.confrelid = 'public.students'::regclass
            and con.confkey[array_position(con.conkey, sc.attnum)] = (
              select a2.attnum
              from pg_catalog.pg_attribute a2
              where a2.attrelid = 'public.students'::regclass
                and a2.attname = 'id'
                and a2.attnum > 0
                and not a2.attisdropped
            )
          )
      ) as has_wrong_fk
    from student_cols sc
  )
  select
    count(*) filter (where has_wrong_fk or (has_fk and not has_canonical_fk)),
    count(*) filter (where not has_fk)
    into v_wrong_fk, v_missing_fk
  from classified;

  select count(*) into v_duplicates
  from (
    select profile_id
    from public.students
    where profile_id is not null and deleted_at is null
    group by profile_id
    having count(*) > 1
  ) d;

  select count(*) into v_role_mismatch
  from public.students s
  join public.profiles p on p.id = s.profile_id
  where s.deleted_at is null
    and s.profile_id is not null
    and p.role::text <> 'student';

  select count(*) into v_profile_without_learner
  from public.profiles p
  where p.role::text = 'student'
    and p.account_status::text = 'active'
    and not p.is_anonymized
    and not exists (
      select 1 from public.students s
      where s.profile_id = p.id and s.deleted_at is null
    );

  select count(*) filter (where profile_id is not null),
         count(*) filter (where profile_id is null)
    into v_claimed, v_unclaimed
  from public.students
  where deleted_at is null;

  v_status := case
    when v_wrong_fk > 0 or v_missing_fk > 0 or v_duplicates > 0 or v_role_mismatch > 0 then 'blocked'
    when v_profile_without_learner > 0 then 'attention'
    else 'healthy'
  end;

  insert into public.student_identity_health_runs(
    wrong_student_fk_domains,
    missing_student_fk_constraints,
    duplicate_active_profile_mappings,
    active_profile_role_mismatches,
    active_student_profiles_without_learner,
    claimed_active_learners,
    unclaimed_active_learners,
    status,
    details
  ) values (
    v_wrong_fk,
    v_missing_fk,
    v_duplicates,
    v_role_mismatch,
    v_profile_without_learner,
    v_claimed,
    v_unclaimed,
    v_status,
    jsonb_build_object(
      'canonical_rule','public student_id columns must FK to public.students(id)',
      'resolver_rule','one active learner row per claimed student profile; ambiguity fails closed',
      'catalog_scan','pg_catalog',
      'historical_policy','unclaimed roster learners and incomplete legacy accounts are observed, never guessed or auto-linked'
    )
  ) returning id into v_id;

  return jsonb_build_object(
    'run_id', v_id,
    'status', v_status,
    'wrong_student_fk_domains', v_wrong_fk,
    'missing_student_fk_constraints', v_missing_fk,
    'duplicate_active_profile_mappings', v_duplicates,
    'active_profile_role_mismatches', v_role_mismatch,
    'active_student_profiles_without_learner', v_profile_without_learner,
    'claimed_active_learners', v_claimed,
    'unclaimed_active_learners', v_unclaimed
  );
end;
$$;

revoke all on function public.run_student_identity_health_check() from public, anon, authenticated;
grant execute on function public.run_student_identity_health_check() to service_role;
