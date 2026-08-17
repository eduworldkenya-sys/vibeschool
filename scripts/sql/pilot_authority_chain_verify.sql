\set ON_ERROR_STOP on

-- Semantic certification of the reconstructed production pilot-authority chain.
do $$
declare missing text[];
begin
  select array_agg(v) into missing from unnest(array['20260817131454','20260817131939','20260817132001','20260817145640','20260817150023','20260817160156','20260817160629']) v
  where not exists(select 1 from supabase_migrations.schema_migrations m where m.version::text=v);
  if missing is not null then raise exception 'pilot authority migration reconstruction missing: %',array_to_string(missing,', '); end if;
end $$;

-- Prove the student_id domains instead of inferring them from column names.
do $$
declare r record; actual text;
begin
  for r in
    select * from (values
      ('class_join_requests','public.students'),
      ('exam_results','public.students'),
      ('student_exam_readiness_state','auth.users'),
      ('student_mistake_notebook','public.profiles'),
      ('vibelearn_content_views','auth.users'),
      ('vibelearn_searches','public.profiles')
    ) as x(table_name, expected_target)
  loop
    select rn.nspname||'.'||rc.relname into actual
    from pg_constraint con
    join pg_class c on c.oid=con.conrelid
    join pg_namespace n on n.oid=c.relnamespace
    join pg_class rc on rc.oid=con.confrelid
    join pg_namespace rn on rn.oid=rc.relnamespace
    join unnest(con.conkey) with ordinality ck(attnum,ord) on true
    join pg_attribute a on a.attrelid=c.oid and a.attnum=ck.attnum
    where con.contype='f' and n.nspname='public' and c.relname=r.table_name and a.attname='student_id'
    limit 1;
    if actual is distinct from r.expected_target then
      raise exception '% student_id domain mismatch: expected %, got %',r.table_name,r.expected_target,coalesce(actual,'none');
    end if;
  end loop;
end $$;

-- Sensitive learner/family/result tables must not expose direct anonymous table access.
do $$
declare t text;
begin
  foreach t in array array['class_join_requests','exam_results','student_exam_readiness_state','student_mistake_notebook','student_kcse_error_classifications','vibelearn_content_views','vibelearn_searches'] loop
    if exists(select 1 from information_schema.role_table_grants where table_schema='public' and table_name=t and grantee='anon') then
      raise exception 'anonymous table privilege remains on %',t;
    end if;
  end loop;
end $$;

do $$
declare q text; wc text;
begin
  if not (select relrowsecurity from pg_class where oid='public.teacher_classes'::regclass) then raise exception 'teacher_classes RLS disabled'; end if;
  if exists(select 1 from information_schema.role_table_grants where table_schema='public' and table_name='teacher_classes' and grantee='authenticated' and privilege_type in ('INSERT','UPDATE','DELETE')) then raise exception 'authenticated retains direct teacher_classes mutation'; end if;
  select with_check into wc from pg_policies where schemaname='public' and tablename='teacher_classes' and policyname='pol_teacher_classes_insert';
  if wc is null or wc not ilike '%school_members%' or wc not ilike '%teacher_id%' then raise exception 'teacher assignment insert is not membership-bound'; end if;

  select with_check into wc from pg_policies where schemaname='public' and tablename='exercise_submissions' and policyname='exercise_submissions_student_insert';
  if wc is null or wc not ilike '%students%' or wc not ilike '%profile_id%' or wc not ilike '%student_classes%' then raise exception 'exercise submission student authority is not identity+enrollment bound'; end if;

  -- public.students(id)-keyed learner requests must resolve the signed-in profile.
  select with_check into wc from pg_policies where schemaname='public' and tablename='class_join_requests' and policyname='join_requests_student_insert';
  if wc is null or wc not ilike '%students%' or wc not ilike '%profile_id%' or wc not ilike '%student_id%' then raise exception 'class join learner insert is not canonical-student/profile bound'; end if;
  select qual into q from pg_policies where schemaname='public' and tablename='class_join_requests' and policyname='join_requests_student_read';
  if q is null or q not ilike '%students%' or q not ilike '%profile_id%' then raise exception 'class join learner read is not canonical-student/profile bound'; end if;
  select qual into q from pg_policies where schemaname='public' and tablename='class_join_requests' and policyname='join_requests_parent_read';
  if q is null or q not ilike '%parent_id%' or q not ilike '%auth.uid%' then raise exception 'class join family read scope weakened'; end if;
  select qual into q from pg_policies where schemaname='public' and tablename='class_join_requests' and policyname='join_requests_teacher';
  if q is null or q not ilike '%classes%' or q not ilike '%teacher_id%' then raise exception 'class join teacher scope weakened'; end if;

  -- auth.users/profile-keyed learner tables must remain direct self ownership;
  -- joining public.students(id) here would be the opposite identity-domain bug.
  select qual into q from pg_policies where schemaname='public' and tablename='student_exam_readiness_state' and policyname='student_exam_readiness_select_own';
  if q is null or q not ilike '%auth.uid%' or q ilike '%students%' then raise exception 'exam readiness owner identity domain invalid'; end if;
  select qual into q from pg_policies where schemaname='public' and tablename='student_mistake_notebook' and policyname='student_mistakes_select_own';
  if q is null or q not ilike '%auth.uid%' or q ilike '%students%' then raise exception 'mistake notebook owner identity domain invalid'; end if;
  select qual into q from pg_policies where schemaname='public' and tablename='vibelearn_content_views' and policyname='vibelearn_content_views_student_read';
  if q is null or q not ilike '%auth.uid%' or q ilike '%students%' then raise exception 'content view owner identity domain invalid'; end if;
  select qual into q from pg_policies where schemaname='public' and tablename='vibelearn_searches' and policyname='vibelearn_searches_owner';
  if q is null or q not ilike '%auth.uid%' or q ilike '%students%' then raise exception 'search history owner identity domain invalid'; end if;

  -- No ambiguous bare student_id/auth.uid comparison may survive the recovered closure.
  if exists(select 1 from pg_policies p where p.schemaname='public' and p.tablename<>'vibelearn_content_saves' and (coalesce(p.qual,'') ilike '%student_id = auth.uid()%' or coalesce(p.with_check,'') ilike '%student_id = auth.uid()%')) then raise exception 'student/profile identity-domain mismatch remains'; end if;

  -- Exam-result authority must bind the complete teacher/class/subject/student/exam/school scope.
  select with_check into wc from pg_policies where schemaname='public' and tablename='exam_results' and policyname='exam_results_teacher_insert';
  if wc is null or wc not ilike '%teacher_classes%' or wc not ilike '%student_classes%' or wc not ilike '%exams%' or wc not ilike '%class_id%' or wc not ilike '%subject_id%' or wc not ilike '%school_id%' then raise exception 'exam result consequential scope weakened'; end if;
  select qual into q from pg_policies where schemaname='public' and tablename='exam_results' and policyname='exam_results_student_read';
  if q is null or q not ilike '%students%' or q not ilike '%profile_id%' then raise exception 'exam result learner read scope weakened'; end if;
  select qual into q from pg_policies where schemaname='public' and tablename='exam_results' and policyname='exam_results_parent_read';
  if q is null or q not ilike '%parent_student_links%' or q not ilike '%parent_id%' then raise exception 'exam result family read scope weakened'; end if;
  select qual into q from pg_policies where schemaname='public' and tablename='exam_results' and policyname='exam_results_admin';
  if q is null or q not ilike '%is_school_admin%' then raise exception 'exam result school-admin scope weakened'; end if;

  select qual into q from pg_policies where schemaname='public' and tablename='exercises' and policyname='teachers manage own exercises';
  if q is null or q not ilike '%teacher_classes%' or q not ilike '%school_members%' or q not ilike '%class_id%' or q not ilike '%school_id%' then raise exception 'exercise teacher/class authority weakened'; end if;
end $$;

do $$
declare secdef boolean; cfg text[];
begin
  select prosecdef,proconfig into secdef,cfg from pg_proc where oid='public.pilot_authority_audit_trigger()'::regprocedure;
  if not secdef or not ('search_path=public, pg_temp'=any(cfg)) then raise exception 'pilot audit function privilege/search_path invariant failed'; end if;
  if has_function_privilege('anon','public.pilot_authority_audit_trigger()','EXECUTE') or has_function_privilege('authenticated','public.pilot_authority_audit_trigger()','EXECUTE') then raise exception 'pilot audit function client execution exposed'; end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.student_claim_codes'::regclass and tgname='trg_pilot_authority_claim_audit' and not tgisinternal) or not exists(select 1 from pg_trigger where tgrelid='public.assessment_responses'::regclass and tgname='trg_pilot_authority_response_audit' and not tgisinternal) or not exists(select 1 from pg_trigger where tgrelid='public.exam_results'::regclass and tgname='trg_pilot_authority_exam_result_audit' and not tgisinternal) then raise exception 'consequential authority audit trigger missing'; end if;
end $$;

do $$
declare secdef boolean; cfg text[];
begin
  select prosecdef,proconfig into secdef,cfg from pg_proc where oid='public.guard_admin_authority_state()'::regprocedure;
  if not secdef or not ('search_path=public, pg_temp'=any(cfg)) then raise exception 'admin authority guard privilege/search_path invariant failed'; end if;
  if has_function_privilege('anon','public.guard_admin_authority_state()','EXECUTE') or has_function_privilege('authenticated','public.guard_admin_authority_state()','EXECUTE') then raise exception 'admin authority guard client execution exposed'; end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.profiles'::regclass and tgname='trg_guard_admin_authority_state' and not tgisinternal) then raise exception 'admin authority guard trigger missing'; end if;
  if exists(select 1 from public.profiles p where p.role='admin' and p.account_status='active' and not exists(select 1 from public.school_members sm where sm.profile_id=p.id and sm.role::text in ('admin','owner'))) then raise exception 'active admin without authoritative school membership'; end if;
end $$;

select 'PILOT AUTHORITY CHAIN SEMANTIC CERTIFICATION PASSED' as result;
