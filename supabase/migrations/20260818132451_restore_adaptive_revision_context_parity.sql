-- Restore repository <-> production parity for adaptive revision context.
--
-- Production contains this function, while a clean replay of migration history
-- does not recreate it. The immediately following canonical student identity
-- migration patches its legacy profile-keyed academic predicates.

do $$
begin
  if to_regprocedure('public.student_get_adaptive_revision_context()') is null then
    execute $fn$
      create function public.student_get_adaptive_revision_context()
      returns jsonb
      language plpgsql
      security definer
      set search_path = 'public','pg_temp'
      as $body$
      declare
        v_uid uuid:=auth.uid();
        v_student_id uuid;
        v_class_id uuid;
        v_class_name text;
        v_opt_in boolean:=false;
        v_exam_name text;
        v_exam_date date;
        v_daily integer:=60;
        v_exam_valid boolean:=false;
        v_days integer;
        v_mode text:='steady_revision';
        v_teacher jsonb;
        v_mastery jsonb;
        v_prediction jsonb;
        v_open_mistakes integer:=0;
        v_due_retests integer:=0;
        v_safe_mistake_ids jsonb:='[]'::jsonb;
        v_safe_weak_topics jsonb:='[]'::jsonb;
      begin
        if v_uid is null then raise exception 'not_authenticated'; end if;
        select s.id,coalesce(sc.class_id,s.class_id),c.name
          into v_student_id,v_class_id,v_class_name
        from public.students s
        left join public.student_classes sc on sc.student_id=s.id and sc.is_current=true
        left join public.classes c on c.id=coalesce(sc.class_id,s.class_id)
        where s.profile_id=v_uid and s.deleted_at is null
        order by sc.joined_at desc nulls last limit 1;
        if v_student_id is null then raise exception 'learner_identity_not_found'; end if;

        select coalesce(r.kcse_candidate_opt_in,false),r.exam_name,r.exam_date,coalesce(r.daily_revision_minutes,60)
          into v_opt_in,v_exam_name,v_exam_date,v_daily
        from public.student_exam_readiness_state r where r.student_id=v_uid;
        v_daily:=greatest(15,least(coalesce(v_daily,60),240));
        v_exam_valid:=coalesce(v_opt_in,false) and lower(regexp_replace(coalesce(v_class_name,''),'\s+','','g'))='form4';
        if v_exam_valid and v_exam_date is not null then
          v_days:=greatest(v_exam_date-current_date,0);
          v_mode:=case when v_days<=7 then 'final_week' when v_days<=21 then 'final_sprint' when v_days<=60 then 'exam_revision' else 'steady_revision' end;
        else
          v_days:=null;
          v_mode:='steady_revision';
        end if;

        v_teacher:=public.student_get_teacher_sync_context();
        v_mastery:=public.student_get_twin_mastery();
        v_prediction:=public.student_get_twin_prediction();

        select coalesce(jsonb_agg(m.id),'[]'::jsonb),count(*)
          into v_safe_mistake_ids,v_open_mistakes
        from public.student_mistake_notebook m
        left join public.exam_question_bank q on q.id=m.exam_question_id
        where m.student_id in (v_student_id,v_uid) and m.status<>'resolved'
          and coalesce(m.topic,'') !~* '^TWIN-SEED-'
          and coalesce(m.prompt_snapshot,'') not ilike '%SYNTHETIC TWIN TEST%'
          and (v_exam_valid or q.id is null or q.form::text<>'Form 4');

        select coalesce(jsonb_agg(jsonb_build_object('subject',x.subject,'topic',x.topic,'misses',x.misses,'attempts',x.attempts,'accuracy',x.accuracy) order by x.misses desc,x.accuracy asc),'[]'::jsonb)
          into v_safe_weak_topics
        from (
          select pa.subject,pa.topic,count(*) filter(where not pa.is_correct) misses,count(*) attempts,
            round(100.0*avg(case when pa.is_correct then 1 else 0 end),0) accuracy
          from public.student_practice_attempts pa
          left join public.exam_question_bank q on q.id=pa.exam_question_id
          where pa.student_id in (v_student_id,v_uid)
            and (v_exam_valid or q.id is null or q.form::text<>'Form 4')
            and coalesce(pa.topic,'') !~* '^TWIN-SEED-'
          group by pa.subject,pa.topic
          having count(*) filter(where not pa.is_correct)>0
          order by count(*) filter(where not pa.is_correct) desc,round(100.0*avg(case when pa.is_correct then 1 else 0 end),0) asc
          limit 12
        ) x;

        select count(*) into v_due_retests
        from public.student_kcse_retest_schedule
        where v_exam_valid
          and student_id in (v_student_id,v_uid)
          and mastery_state<>'mastered'
          and due_date<=current_date+7;

        return jsonb_build_object(
          'student_id',v_student_id,'profile_id',v_uid,'class_id',v_class_id,'class_name',v_class_name,
          'mode',v_mode,'exam_context_valid',v_exam_valid,
          'exam_name',case when v_exam_valid then v_exam_name else null end,
          'exam_date',case when v_exam_valid then v_exam_date else null end,
          'days_remaining',v_days,'daily_revision_minutes',v_daily,
          'teacher_context',v_teacher,'mastery',v_mastery,'prediction',v_prediction,
          'open_mistakes',v_open_mistakes,'due_retests_7d',v_due_retests,
          'safe_mistake_ids',v_safe_mistake_ids,'safe_weak_topics',v_safe_weak_topics,
          'message',case
            when not v_exam_valid and coalesce(v_opt_in,false) then 'Exam metadata is not being used because the learner is not in a verified Form 4 KCSE context.'
            when not v_exam_valid then 'Revision is paced from your teacher context, mistakes, forgetting risk and real practice evidence.'
            when v_mode='final_week' then 'Final week: protect sleep, accuracy and high-yield recall. Revise evidence-backed gaps, not everything.'
            when v_mode='final_sprint' then 'Final sprint: prioritise due retests, repeated mistakes and timed exam practice.'
            when v_mode='exam_revision' then 'Exam revision: balance weak-topic recovery, forgetting protection and timed practice.'
            else 'Build durable mastery steadily while keeping up with your teacher and current curriculum.' end,
          'authority','student_generate_adaptive_revision_plan',
          'signals',jsonb_build_array('teacher_context','verified_mastery','forgetting_risk','stage_safe_mistakes','stage_safe_retests','stage_safe_practice_history',case when v_exam_valid then 'verified_kcse_context' else 'stage_safe_non_kcse' end)
        );
      end;
      $body$;
    $fn$;
  end if;
end $$;

revoke all on function public.student_get_adaptive_revision_context() from public;
revoke all on function public.student_get_adaptive_revision_context() from anon;
grant execute on function public.student_get_adaptive_revision_context() to authenticated;
grant execute on function public.student_get_adaptive_revision_context() to service_role;
