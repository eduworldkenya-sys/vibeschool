-- Student = 1 runtime identity guard and health instrumentation
-- Canonical rule: one authenticated student profile may resolve to at most one active public.students row.

-- 1. Structural prevention: an active claimed learner identity is one-to-one with profile/account identity.
create unique index if not exists students_one_active_profile_uidx
  on public.students(profile_id)
  where profile_id is not null and deleted_at is null;

-- 2. Resolver must never silently choose between duplicate learner rows.
create or replace function public.current_student_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
  v_student_id uuid;
begin
  if v_uid is null then
    return null;
  end if;

  select count(*), min(s.id)
    into v_count, v_student_id
  from public.students s
  where s.profile_id = v_uid
    and s.deleted_at is null;

  if v_count = 0 then
    return null;
  end if;
  if v_count > 1 then
    raise exception 'ambiguous_learner_identity';
  end if;

  return v_student_id;
end;
$$;

revoke all on function public.current_student_id() from public, anon;
grant execute on function public.current_student_id() to authenticated, service_role;

-- 3. Permanent production instrumentation. Service-only: this is operational identity telemetry,
-- not learner-facing product data.
create table if not exists public.student_identity_health_runs (
  id uuid primary key default gen_random_uuid(),
  checked_at timestamptz not null default now(),
  wrong_student_fk_domains integer not null default 0,
  missing_student_fk_constraints integer not null default 0,
  duplicate_active_profile_mappings integer not null default 0,
  active_profile_role_mismatches integer not null default 0,
  active_student_profiles_without_learner integer not null default 0,
  claimed_active_learners integer not null default 0,
  unclaimed_active_learners integer not null default 0,
  status text not null check (status in ('healthy','attention','blocked')),
  details jsonb not null default '{}'::jsonb
);

alter table public.student_identity_health_runs enable row level security;
revoke all privileges on table public.student_identity_health_runs from public, anon, authenticated;
grant all privileges on table public.student_identity_health_runs to service_role;

create index if not exists student_identity_health_runs_checked_at_idx
  on public.student_identity_health_runs(checked_at desc);

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

  with student_cols as (
    select c.table_name, c.column_name
    from information_schema.columns c
    where c.table_schema = 'public' and c.column_name = 'student_id'
  ), student_fks as (
    select kcu.table_name, kcu.column_name,
           ccu.table_schema as foreign_schema,
           ccu.table_name as foreign_table,
           ccu.column_name as foreign_column
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name
     and kcu.constraint_schema = tc.constraint_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
     and ccu.constraint_schema = tc.constraint_schema
    where tc.table_schema = 'public'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'student_id'
  )
  select
    count(*) filter (
      where f.table_name is not null
        and not (f.foreign_schema = 'public' and f.foreign_table = 'students' and f.foreign_column = 'id')
    ),
    count(*) filter (where f.table_name is null)
  into v_wrong_fk, v_missing_fk
  from student_cols c
  left join student_fks f using (table_name, column_name);

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

-- 4. Fail the migration itself if production/rebuild state violates the hard canonical boundary.
do $$
declare
  v_bad integer;
begin
  select count(*) into v_bad
  from (
    select s.profile_id
    from public.students s
    where s.profile_id is not null and s.deleted_at is null
    group by s.profile_id
    having count(*) > 1
  ) x;
  if v_bad > 0 then
    raise exception 'student_one_duplicate_active_profile_mapping:%', v_bad;
  end if;

  select count(*) into v_bad
  from public.students s
  join public.profiles p on p.id = s.profile_id
  where s.deleted_at is null and s.profile_id is not null and p.role::text <> 'student';
  if v_bad > 0 then
    raise exception 'student_one_profile_role_mismatch:%', v_bad;
  end if;
end;
$$;
