-- Canonical Student RPC Identity Completion
--
-- Production promotion of PR #240 initially applied the canonical row/FK/RLS
-- portion but did not apply the asserted runtime function rewrites. This
-- migration makes that completion durable and replay-safe.
--
-- On a clean rebuild, 20260818132500_canonical_student_academic_identity.sql
-- has already applied these replacements, so this migration accepts the
-- canonical fragment as an idempotent no-op. In a partially promoted database,
-- it replaces the exact certified legacy fragment. Any third state fails closed.

create temporary table student_identity_runtime_completion (
  signature text not null,
  ordinal integer not null,
  old_text text not null,
  new_text text not null,
  primary key (signature, ordinal)
) on commit drop;

insert into student_identity_runtime_completion(signature,ordinal,old_text,new_text) values
('student_classify_kcse_mistake(uuid,text,text)',1,'v_user uuid:=auth.uid()','v_user uuid:=public.current_student_id()'),
('student_create_kcse_mock(text,text,uuid)',1,'v_user uuid:=auth.uid()','v_user uuid:=public.current_student_id()'),
('student_get_kcse_adaptive_practice(text,text,integer)',1,'v_user uuid:=auth.uid()','v_user uuid:=public.current_student_id()'),
('student_get_kcse_mastery_map()',1,'v_user uuid:=auth.uid()','v_user uuid:=public.current_student_id()'),
('student_get_kcse_mock(uuid)',1,'v_user uuid:=auth.uid()','v_user uuid:=public.current_student_id()'),
('student_get_revision_workspace(text,text)',1,'v_student uuid:=auth.uid()','v_student uuid:=public.current_student_id()'),
('student_resolve_mistake(uuid)',1,'v_user uuid:=auth.uid()','v_user uuid:=public.current_student_id()'),
('student_save_kcse_mock_answer(uuid,uuid,integer,text,integer,uuid)',1,'v_user uuid:=auth.uid()','v_user uuid:=public.current_student_id()'),
('student_search_kcse(text)',1,'v_user uuid:=auth.uid()','v_user uuid:=public.current_student_id()'),
('student_update_kcse_profile(date,integer,integer,jsonb,boolean)',1,'v_user uuid:=auth.uid()','v_user uuid:=public.current_student_id()'),
('student_update_revision_item_status(uuid,text)',1,'v_uid uuid := auth.uid()','v_uid uuid := public.current_student_id()'),
('student_update_exam_readiness(date,integer,integer)',1,'values(auth.uid(), p_exam_date','values(public.current_student_id(), p_exam_date'),
('student_generate_adaptive_revision_plan_v1(date,integer)',1,'student_id in (v_student_id,v_uid)','student_id=v_student_id'),
('student_generate_adaptive_revision_plan_v1(date,integer)',2,'student_id=v_uid','student_id=v_student_id'),
('student_generate_adaptive_revision_plan_v1(date,integer)',3,'values(v_uid,v_date','values(v_student_id,v_date'),
('student_generate_adaptive_revision_plan(date,integer)',1,'student_id in (v_student_id,v_uid)','student_id=v_student_id'),
('student_generate_adaptive_revision_plan(date,integer)',2,'p.student_id=v_uid','p.student_id=v_student_id'),
('student_get_adaptive_revision_context()',1,'student_id in (v_student_id,v_uid)','student_id=v_student_id'),
('student_get_adaptive_revision_context()',2,'r.student_id=v_uid','r.student_id=v_student_id'),
('student_get_exam_readiness_brief()',1,'values (v_user)','values (v_student)'),
('student_get_exam_readiness_brief()',2,'r.student_id = v_user','r.student_id = v_student'),
('student_get_kcse_candidate_os()',1,'student_id in (v_user,v_student)','student_id=v_student'),
('student_get_kcse_candidate_os()',2,'student_id=v_user','student_id=v_student'),
('student_get_kcse_candidate_os()',3,'values(v_user)','values(v_student)'),
('student_get_kcse_progress_history()',1,'student_id=v_user','student_id=v_student'),
('student_get_twin_state_internal()',1,'r.student_id in (v_student.id,v_uid)','r.student_id=v_student.id'),
('student_record_grounded_practice_answer(uuid,text,integer,uuid)',1,'m.student_id=v_profile_id','m.student_id=v_student_id'),
('student_record_grounded_practice_answer(uuid,text,integer,uuid)',2,'values(v_profile_id,null','values(v_student_id,null'),
('student_record_vibelearn_practice_answer(uuid,integer,integer,uuid)',1,'student_id=v_user','student_id=v_student'),
('student_record_vibelearn_practice_answer(uuid,integer,integer,uuid)',2,'values(v_user,','values(v_student,'),
('student_refresh_twin_memory()',1,'student_id=v_uid','student_id=v_student_id'),
('parent_get_student_kcse_brief(uuid)',1,'student_id=v_profile','student_id=p_student_id'),
('parent_get_student_kcse_brief(uuid)',2,'student_id in (v_profile,p_student_id)','student_id=p_student_id'),
('teacher_get_student_kcse_brief(uuid)',1,'student_id=v_profile','student_id=p_student_id');

do $$
declare
  r record;
  p record;
  v_oid oid;
  v_def text;
  v_before text;
begin
  for r in
    select signature
    from student_identity_runtime_completion
    group by signature
    order by signature
  loop
    v_oid := to_regprocedure(r.signature);
    if v_oid is null then
      raise exception 'student_identity_function_missing: %', r.signature;
    end if;

    v_def := pg_get_functiondef(v_oid);

    for p in
      select old_text,new_text
      from student_identity_runtime_completion
      where signature=r.signature
      order by ordinal
    loop
      if position(p.old_text in v_def)>0 then
        v_before := v_def;
        v_def := replace(v_def,p.old_text,p.new_text);
        if v_def=v_before then
          raise exception 'student_identity_runtime_completion_failed: %', r.signature;
        end if;
      elsif position(p.new_text in v_def)=0 then
        raise exception 'student_identity_runtime_drift: % has neither legacy nor canonical fragment for %', r.signature,p.old_text;
      end if;
    end loop;

    execute v_def;
  end loop;
end $$;

revoke all on function public.current_student_id() from public;
revoke all on function public.current_student_id() from anon;
grant execute on function public.current_student_id() to authenticated;
grant execute on function public.current_student_id() to service_role;

-- Final structural and runtime certification.
do $$
declare
  r record;
  v_table text;
  v_bad bigint;
  v_fk_count integer;
  v_def text;
begin
  foreach v_table in array array[
    'student_exam_readiness_state',
    'student_mistake_notebook',
    'student_practice_attempts',
    'student_revision_plan_items',
    'student_kcse_subject_confidence',
    'student_kcse_error_classifications',
    'student_kcse_retest_schedule',
    'student_kcse_mock_sessions'
  ]
  loop
    execute format(
      'select count(*) from public.%I t where not exists (select 1 from public.students s where s.id=t.student_id)',
      v_table
    ) into v_bad;
    if v_bad<>0 then
      raise exception 'student_identity_noncanonical_rows: table %, count %',v_table,v_bad;
    end if;

    select count(*) into v_fk_count
    from pg_constraint
    where contype='f'
      and conrelid=('public.'||v_table)::regclass
      and confrelid='public.students'::regclass
      and pg_get_constraintdef(oid) like 'FOREIGN KEY (student_id)%';
    if v_fk_count<>1 then
      raise exception 'student_identity_fk_certification_failed: table %, count %',v_table,v_fk_count;
    end if;
  end loop;

  for r in select * from student_identity_runtime_completion order by signature,ordinal loop
    v_def:=pg_get_functiondef(to_regprocedure(r.signature));
    if position(r.old_text in v_def)>0 or position(r.new_text in v_def)=0 then
      raise exception 'student_identity_runtime_certification_failed: %',r.signature;
    end if;
  end loop;
end $$;