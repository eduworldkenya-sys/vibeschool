\set ON_ERROR_STOP on

-- The reconstruction package must leave exactly one new forward migration.
-- Replay-only helper versions would become future production-push debt.
do $$
declare bad text;
begin
  select string_agg(version::text,', ' order by version::text)
  into bad
  from supabase_migrations.schema_migrations
  where version::text in (
    '20260812082408',
    '20260817131452',
    '20260817131453',
    '20260817131999',
    '20260818012998',
    '20260818012999'
  );
  if bad is not null then
    raise exception 'replay-only migration debt remains: %',bad;
  end if;

  if not exists (
    select 1 from supabase_migrations.schema_migrations
    where version::text='20260818013000'
  ) then
    raise exception 'forward pilot authorization semantic repair missing';
  end if;
end $$;

-- Sensitive pilot tables are authenticated-only at the table privilege layer.
do $$
declare t text;
begin
  foreach t in array array['class_join_requests','exam_results'] loop
    if exists (
      select 1 from information_schema.role_table_grants
      where table_schema='public' and table_name=t and grantee='anon'
    ) then
      raise exception 'anonymous table privilege remains on %',t;
    end if;
  end loop;
end $$;

-- No PUBLIC-role policy may recreate an unauthenticated ambiguity on these
-- pilot-sensitive tables after the forward repair.
do $$
declare offender text;
begin
  select string_agg(tablename||'.'||policyname,', ' order by tablename,policyname)
  into offender
  from pg_policies
  where schemaname='public'
    and tablename in ('class_join_requests','exam_results')
    and roles::text ilike '%public%';
  if offender is not null then
    raise exception 'PUBLIC-role pilot policy remains: %',offender;
  end if;
end $$;

-- Permissive RLS policies OR together; the legacy school-member read therefore
-- bypassed teacher class scope and family/learner relationship scope.
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='exam_results'
      and policyname='exam_results_member_read'
  ) then
    raise exception 'broad exam_results_member_read bypass remains';
  end if;
end $$;

-- Join-request teacher authority may temporarily use legacy classes.teacher_id
-- until canonical class-teacher assignment backfill is complete, but it must
-- also prove school membership. Admin/family/learner policies remain explicit.
do $$
declare q text; wc text;
begin
  select qual,with_check into q,wc
  from pg_policies
  where schemaname='public'
    and tablename='class_join_requests'
    and policyname='join_requests_teacher';
  if q is null or wc is null
     or q not ilike '%teacher_id%'
     or q not ilike '%school_members%'
     or q not ilike '%school_id%'
     or q not ilike '%profile_id%'
     or wc not ilike '%teacher_id%'
     or wc not ilike '%school_members%'
  then
    raise exception 'join-request teacher authority is not class-teacher + school-membership bound';
  end if;

  select qual into q from pg_policies
  where schemaname='public' and tablename='class_join_requests' and policyname='join_requests_parent_read';
  if q is null or q not ilike '%parent_id%' or q not ilike '%auth.uid%' then
    raise exception 'join-request family read scope weakened';
  end if;

  select qual into q from pg_policies
  where schemaname='public' and tablename='class_join_requests' and policyname='join_requests_student_read';
  if q is null or q not ilike '%students%' or q not ilike '%profile_id%' then
    raise exception 'join-request learner identity scope weakened';
  end if;
end $$;

-- Exam result reads must be one of: school admin, assigned teacher, linked
-- family, or the canonical learner. The policy semantics are checked directly.
do $$
declare q text;
begin
  select qual into q from pg_policies
  where schemaname='public' and tablename='exam_results' and policyname='exam_results_admin';
  if q is null or q not ilike '%is_school_admin%' then
    raise exception 'exam-result school-admin scope missing';
  end if;

  select qual into q from pg_policies
  where schemaname='public' and tablename='exam_results' and policyname='Teachers view exam results for their classes';
  if q is null or q not ilike '%teacher_classes%' or q not ilike '%student_classes%'
     or q not ilike '%subject_id%' or q not ilike '%class_id%' then
    raise exception 'exam-result assigned-teacher read scope weakened';
  end if;

  select qual into q from pg_policies
  where schemaname='public' and tablename='exam_results' and policyname='exam_results_parent_read';
  if q is null or q not ilike '%parent_student_links%' or q not ilike '%parent_id%' then
    raise exception 'exam-result family read scope weakened';
  end if;

  select qual into q from pg_policies
  where schemaname='public' and tablename='exam_results' and policyname='exam_results_student_read';
  if q is null or q not ilike '%students%' or q not ilike '%profile_id%' then
    raise exception 'exam-result learner read scope weakened';
  end if;
end $$;

select 'PILOT AUTHORIZATION BYPASS CERTIFICATION PASSED' as result;
