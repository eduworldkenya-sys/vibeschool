\set ON_ERROR_STOP on

-- Semantic certification of the reconstructed production pilot-authority chain.
do $$
declare missing text[];
begin
  select array_agg(v) into missing from unnest(array['20260817131454','20260817131939','20260817132001','20260817145640','20260817150023','20260817160156','20260817160629']) v
  where not exists(select 1 from supabase_migrations.schema_migrations m where m.version::text=v);
  if missing is not null then raise exception 'pilot authority migration reconstruction missing: %',array_to_string(missing,', '); end if;
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

  if exists(select 1 from pg_policies p where p.schemaname='public' and p.tablename<>'vibelearn_content_saves' and (coalesce(p.qual,'') ilike '%student_id = auth.uid()%' or coalesce(p.with_check,'') ilike '%student_id = auth.uid()%')) then raise exception 'student/profile identity-domain mismatch remains'; end if;

  select with_check into wc from pg_policies where schemaname='public' and tablename='exam_results' and policyname='exam_results_teacher_insert';
  if wc is null or wc not ilike '%teacher_classes%' or wc not ilike '%student_classes%' or wc not ilike '%exams%' or wc not ilike '%class_id%' or wc not ilike '%subject_id%' or wc not ilike '%school_id%' then raise exception 'exam result consequential scope weakened'; end if;

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
