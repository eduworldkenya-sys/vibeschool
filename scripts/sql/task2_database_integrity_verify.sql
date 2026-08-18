\set ON_ERROR_STOP on

-- VibeSchool Task 2: database migration / reconstruction contract.
-- This file is intentionally read-only and is executed only after a blank local
-- Supabase database has been rebuilt from the repository migration chain.

-- 1) Critical application relations must reconstruct. Legacy public.assessments
-- must remain retired; the replacement assessment engine must be present.
do $$
declare
  missing text[];
  required text[] := array[
    'schools','profiles','school_members','students','classes','student_classes',
    'subjects','academic_terms','teacher_classes','timetable_slots','lesson_plans',
    'attendance','homework','homework_submissions','class_join_requests',
    'exam_results','content_learning_events','notifications',
    'assessment_definitions','assessment_assignments','assessment_attempts',
    'assessment_items','assessment_responses'
  ];
begin
  select array_agg(x order by x) into missing
  from unnest(required) x
  where to_regclass('public.' || x) is null;
  if missing is not null then
    raise exception 'TASK2 missing critical reconstructed relations: %', array_to_string(missing, ', ');
  end if;
  if to_regclass('public.assessments') is not null then
    raise exception 'TASK2 retired legacy relation public.assessments unexpectedly reconstructed';
  end if;
end $$;

-- 2) All critical non-public application tables reconstruct with RLS.
do $$
declare
  unprotected text[];
begin
  select array_agg(c.relname order by c.relname) into unprotected
  from pg_class c
  where c.relnamespace='public'::regnamespace
    and c.relkind in ('r','p')
    and c.relname = any(array[
      'profiles','school_members','students','classes','student_classes',
      'academic_terms','teacher_classes','timetable_slots','lesson_plans',
      'attendance','homework','homework_submissions','class_join_requests',
      'exam_results','content_learning_events','notifications',
      'assessment_definitions','assessment_assignments','assessment_attempts',
      'assessment_items','assessment_responses'
    ])
    and not c.relrowsecurity;
  if unprotected is not null then
    raise exception 'TASK2 RLS missing on critical relations: %', array_to_string(unprotected, ', ');
  end if;
end $$;

-- 3) class_join_requests must reconstruct with canonical domain identities.
do $$
declare
  bad integer;
begin
  select count(*) into bad
  from (values
    ('class_join_requests_student_id_fkey','FOREIGN KEY (student_id) REFERENCES students(id)'),
    ('class_join_requests_class_id_fkey','FOREIGN KEY (class_id) REFERENCES classes(id)'),
    ('class_join_requests_parent_id_fkey','FOREIGN KEY (parent_id) REFERENCES profiles(id)')
  ) expected(name, definition)
  where not exists (
    select 1 from pg_constraint c
    where c.conrelid='public.class_join_requests'::regclass
      and c.conname=expected.name
      and pg_get_constraintdef(c.oid,true)=expected.definition
  );
  if bad<>0 then raise exception 'TASK2 class_join_requests FK contract mismatch: % missing/mismatched', bad; end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='class_join_requests' and policyname='join_requests_student_insert')
     or not exists (select 1 from pg_policies where schemaname='public' and tablename='class_join_requests' and policyname='join_requests_student_read')
     or not exists (select 1 from pg_policies where schemaname='public' and tablename='class_join_requests' and policyname='join_requests_parent_insert')
     or not exists (select 1 from pg_policies where schemaname='public' and tablename='class_join_requests' and policyname='join_requests_parent_read') then
    raise exception 'TASK2 class_join_requests identity policies incomplete';
  end if;
end $$;

-- 4) exam_results must reconstruct with canonical student identity and uniqueness.
do $$
begin
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid='public.exam_results'::regclass
      and c.conname='exam_results_student_id_fkey'
      and pg_get_constraintdef(c.oid,true)='FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE'
  ) then raise exception 'TASK2 exam_results student FK contract mismatch'; end if;

  if not exists (
    select 1 from pg_constraint c
    where c.conrelid='public.exam_results'::regclass
      and c.conname='exam_results_exam_id_student_id_subject_id_key'
      and c.contype='u'
  ) then raise exception 'TASK2 exam_results canonical result uniqueness missing'; end if;

  if not exists (
    select 1 from pg_constraint c
    where c.conrelid='public.exam_results'::regclass
      and c.conname='exam_results_marks_check'
      and c.contype='c'
  ) then raise exception 'TASK2 exam_results marks constraint missing'; end if;
end $$;

-- 5) Core authentication/onboarding RPC contracts must reconstruct.
do $$
declare missing text[];
begin
  select array_agg(x order by x) into missing
  from unnest(array[
    'get_my_role','get_my_onboarding_state','get_my_auth_access_state',
    'get_my_auth_journey_state','current_student_id'
  ]) x
  where not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=x
  );
  if missing is not null then
    raise exception 'TASK2 missing auth/identity RPC contracts: %', array_to_string(missing, ', ');
  end if;
end $$;

-- 6) SECURITY DEFINER functions must have an explicit search_path. HQ functions
-- may be callable by authenticated users because they self-authorize, but never anon.
do $$
declare
  unpinned text[];
  anon_hq text[];
begin
  select array_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' order by p.proname)
  into unpinned
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig,array[]::text[])) cfg where cfg like 'search_path=%');
  if unpinned is not null then
    raise exception 'TASK2 SECURITY DEFINER functions without pinned search_path: %', array_to_string(unpinned, ', ');
  end if;

  select array_agg(p.proname order by p.proname) into anon_hq
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef and p.proname like 'hq\_%' escape '\'
    and has_function_privilege('anon',p.oid,'EXECUTE');
  if anon_hq is not null then
    raise exception 'TASK2 anonymous execute on HQ SECURITY DEFINER functions: %', array_to_string(anon_hq, ', ');
  end if;
end $$;

-- 7) Critical private tables must not expose anonymous table privileges.
do $$
declare exposed text[];
begin
  select array_agg(distinct table_name order by table_name) into exposed
  from information_schema.role_table_grants
  where table_schema='public' and grantee='anon'
    and table_name = any(array[
      'profiles','school_members','students','student_classes','teacher_classes',
      'attendance','homework_submissions','class_join_requests','exam_results',
      'content_learning_events','notifications','assessment_attempts','assessment_responses'
    ]);
  if exposed is not null then
    raise exception 'TASK2 anon privileges on critical private tables: %', array_to_string(exposed, ', ');
  end if;
end $$;

-- 8) All reconstructed FKs must be validated; a clean build must never end with
-- NOT VALID referential constraints hiding incomplete reconstruction.
do $$
declare invalid_fks text[];
begin
  select array_agg(conrelid::regclass::text || '.' || conname order by conrelid::regclass::text, conname)
  into invalid_fks
  from pg_constraint
  where connamespace='public'::regnamespace and contype='f' and not convalidated;
  if invalid_fks is not null then
    raise exception 'TASK2 unvalidated foreign keys after clean rebuild: %', array_to_string(invalid_fks, ', ');
  end if;
end $$;

select 'TASK2 DATABASE RECONSTRUCTION CONTRACT PASSED' as result,
       current_database() as database_name,
       current_setting('server_version') as postgres_version;
