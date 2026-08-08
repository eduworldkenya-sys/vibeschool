create or replace function public.student_update_revision_item_status(p_item_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_item public.student_revision_plan_items%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_status not in ('in_progress','completed','skipped') then raise exception 'unsupported_revision_status'; end if;

  select * into v_item
  from public.student_revision_plan_items
  where id=p_item_id and student_id=v_uid
  for update;

  if not found then raise exception 'revision_item_not_found'; end if;
  if v_item.status='completed' and p_status<>'completed' then raise exception 'completed_revision_item_is_final'; end if;

  update public.student_revision_plan_items
     set status=p_status,
         updated_at=now(),
         source=coalesce(source,'{}'::jsonb)||jsonb_build_object(
           'learner_status_updated_at',now(),
           'learner_status',p_status,
           'completion_authority','student_update_revision_item_status'
         )
   where id=p_item_id
   returning * into v_item;

  return jsonb_build_object(
    'id',v_item.id,'status',v_item.status,'plan_date',v_item.plan_date,
    'subject',v_item.subject,'topic',v_item.topic,'activity_type',v_item.activity_type,
    'target_minutes',v_item.target_minutes,'priority',v_item.priority,
    'source',v_item.source,'mastery_write_allowed',false
  );
end;
$$;

revoke all on function public.student_update_revision_item_status(uuid,text) from public;
revoke all on function public.student_update_revision_item_status(uuid,text) from anon;
grant execute on function public.student_update_revision_item_status(uuid,text) to authenticated;

create or replace function public.student_generate_adaptive_revision_plan_v1(p_start_date date default current_date, p_days integer default 7)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_student_id uuid;
  v_context jsonb;
  v_teacher jsonb;
  v_exam_valid boolean:=false;
  v_daily integer:=60;
  v_days integer:=greatest(1,least(coalesce(p_days,7),31));
  v_slots integer;
  v_target integer;
  v_added integer:=0;
  v_idx integer:=0;
  v_date date;
  r record;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select id into v_student_id from public.students where profile_id=v_uid and deleted_at is null limit 1;
  if v_student_id is null then raise exception 'learner_identity_not_found'; end if;
  v_context:=public.student_get_adaptive_revision_context();
  v_teacher:=v_context->'teacher_context';
  v_exam_valid:=coalesce((v_context->>'exam_context_valid')::boolean,false);
  v_daily:=greatest(15,least(coalesce((v_context->>'daily_revision_minutes')::integer,60),240));
  v_slots:=greatest(1,least(4,floor(v_daily/20.0)::integer));
  v_target:=greatest(10,floor(v_daily::numeric/v_slots)::integer);

  delete from public.student_revision_plan_items p
   where p.student_id=v_uid and p.status='planned'
     and p.plan_date between p_start_date and p_start_date+v_days-1
     and (p.source->>'generated_by' in ('student_generate_revision_plan','student_generate_kcse_revision_plan','student_generate_adaptive_revision_plan')
          or p.source->>'source'='twin_forgetting_engine');

  for r in
    with recent_completed as (
      select lower(subject) subject_key, lower(topic) topic_key, activity_type,
             max(coalesce(nullif(source->>'learner_status_updated_at','')::timestamptz,updated_at)) completed_at
      from public.student_revision_plan_items
      where student_id=v_uid and status='completed'
        and coalesce(nullif(source->>'learner_status_updated_at','')::timestamptz,updated_at)>=now()-interval '48 hours'
      group by lower(subject),lower(topic),activity_type
    ),
    teacher_candidate as (
      select 1 lane_priority,'teacher_alignment'::text lane,
        coalesce(v_teacher #>> '{scheme_focus,subject}',v_teacher #>> '{next_class,subject}','Current class')::text subject,
        coalesce(v_teacher #>> '{scheme_focus,topic}',v_teacher #>> '{scheme_focus,sub_strand}','Teacher lesson')::text topic,
        'read'::text activity_type,120::numeric score,
        'Stay aligned with your teacher and the class scheme before adding unrelated optional revision.'::text reason,
        '/student/twin?layer=learn'::text action_url,
        'teacher:'||coalesce(v_teacher #>> '{scheme_focus,scheme_id}',v_teacher #>> '{next_class,slot_id}','current') evidence_key
      where coalesce((v_teacher->>'alignment_required')::boolean,false)
    ),
    retest_candidates as (
      select 2,'spaced_retest',coalesce(rt.subject,'General'),coalesce(rt.topic,'Review topic'),'practice',
        110::numeric + case when rt.due_date<=current_date then 15 else 0 end,
        case when rt.due_date<=current_date then 'This spaced retest is due now. Prove the topic still holds before memory weakens further.' else format('This spaced retest is due on %s to protect retention.',rt.due_date) end,
        '/student/vibelearn/practice?subject='||replace(coalesce(rt.subject,'General'),' ','%20')||'&topic='||replace(coalesce(rt.topic,'Review topic'),' ','%20'),
        'retest:'||rt.id::text
      from public.student_kcse_retest_schedule rt
      where rt.student_id in (v_student_id,v_uid) and rt.mastery_state<>'mastered' and rt.due_date<=p_start_date+v_days-1
    ),
    mistake_candidates as (
      select 3,'mistake_recovery',coalesce(m.subject,'General'),coalesce(m.topic,'Review mistake'),'review_mistakes',
        95::numeric + least(20,greatest(0,coalesce(m.repeat_count,1)-1)*5),
        format('Recover this unresolved mistake%s before adding harder work.',case when coalesce(m.repeat_count,1)>1 then format(' after %s repeats',m.repeat_count) else '' end),
        '/student/vibelearn/practice?subject='||replace(coalesce(m.subject,'General'),' ','%20')||'&topic='||replace(coalesce(m.topic,'Review mistake'),' ','%20'),
        'mistake:'||m.id::text
      from public.student_mistake_notebook m
      where m.student_id in (v_student_id,v_uid) and m.status<>'resolved'
        and coalesce(m.last_correct_at,'epoch'::timestamptz)<coalesce(m.last_missed_at,m.first_missed_at,now())
    ),
    mastery_candidates as (
      select 4,'forgetting_risk',coalesce(c.subject,'General'),coalesce(x->>'outcome_text','Learning outcome'),'practice',
        80::numeric + coalesce((x->>'forgetting_risk')::numeric,0)*20 + case when coalesce((x->>'effective_mastery')::numeric,100)<55 then 10 else 0 end,
        format('Protect this verified skill: forgetting risk is %s%% and effective mastery is %s%%.',round(coalesce((x->>'forgetting_risk')::numeric,0)*100),round(coalesce((x->>'effective_mastery')::numeric,0))),
        '/student/vibelearn/revision','outcome:'||coalesce(x->>'outcome_id','unknown')
      from jsonb_array_elements(coalesce(public.student_get_twin_mastery()->'outcomes','[]'::jsonb)) x
      left join public.curriculum_learning_outcomes o on o.id=nullif(x->>'outcome_id','')::uuid
      left join public.curriculum c on c.id=o.curriculum_id
      where coalesce((x->>'forgetting_risk')::numeric,0)>=0.25 or coalesce((x->>'effective_mastery')::numeric,100)<65
    ),
    practice_candidates as (
      select 5,'practice_history',coalesce(pa.subject,'General'),coalesce(pa.topic,'Practice topic'),
        case when count(*) filter(where not pa.is_correct)>0 then 'review_mistakes' else 'practice' end,
        60::numeric + least(20,count(*) filter(where not pa.is_correct)*3) + greatest(0,15-coalesce(round(100*avg(case when pa.is_correct then 1 else 0 end)),0))/10,
        case when count(*) filter(where not pa.is_correct)>0 then 'Your own practice history shows misses here, so this topic deserves another focused pass.' else 'Keep this practised topic active with short retrieval practice.' end,
        '/student/vibelearn/practice?subject='||replace(coalesce(pa.subject,'General'),' ','%20')||'&topic='||replace(coalesce(pa.topic,'Practice topic'),' ','%20'),
        'practice:'||lower(coalesce(pa.subject,'general'))||':'||lower(coalesce(pa.topic,'topic'))
      from public.student_practice_attempts pa
      where pa.student_id in (v_student_id,v_uid)
      group by pa.subject,pa.topic
    ),
    kcse_candidates as (
      select 6,'kcse_coverage',q.subject::text,coalesce(q.topic,'Mixed practice'),'practice',55::numeric,
        'Verified Form 4 practice is available here and this topic has little or no learner practice evidence.',
        '/student/vibelearn/practice?subject='||replace(q.subject::text,' ','%20')||'&topic='||replace(coalesce(q.topic,'Mixed practice'),' ','%20'),
        'kcse:'||lower(q.subject::text)||':'||lower(coalesce(q.topic,'mixed'))
      from public.exam_question_bank q
      where v_exam_valid and q.form::text='Form 4' and q.status::text in ('active','published')
        and not exists(select 1 from public.student_practice_attempts pa where pa.student_id in (v_student_id,v_uid) and lower(pa.subject)=lower(q.subject::text) and lower(coalesce(pa.topic,''))=lower(coalesce(q.topic,'')))
      group by q.subject,q.topic
    ), all_candidates as (
      select * from teacher_candidate union all select * from retest_candidates union all select * from mistake_candidates
      union all select * from mastery_candidates union all select * from practice_candidates union all select * from kcse_candidates
    ), deduped as (
      select distinct on(lower(a.subject),lower(a.topic)) a.*
      from all_candidates a
      where nullif(btrim(a.subject),'') is not null and nullif(btrim(a.topic),'') is not null
        and not exists(
          select 1 from recent_completed rc
          where rc.subject_key=lower(a.subject) and rc.topic_key=lower(a.topic) and rc.activity_type=a.activity_type
        )
      order by lower(a.subject),lower(a.topic),a.lane_priority,a.score desc
    )
    select * from deduped order by score desc,lane_priority,subject,topic limit (v_days*v_slots)
  loop
    v_idx:=v_idx+1;
    v_date:=p_start_date+floor((v_idx-1)::numeric/v_slots)::integer;
    insert into public.student_revision_plan_items(student_id,plan_date,subject,topic,activity_type,target_minutes,priority,reason,action_url,status,source)
    values(v_uid,v_date,r.subject,r.topic,r.activity_type,v_target,
      case when r.score>=105 then 1 when r.score>=90 then 2 when r.score>=75 then 3 when r.score>=60 then 4 else 5 end,
      r.reason,r.action_url,'planned',jsonb_build_object('generated_by','student_generate_adaptive_revision_plan','lane',r.lane,'evidence_key',r.evidence_key,'score',round(r.score,2),'daily_cap_minutes',v_daily,'session_slots',v_slots,'exam_context_valid',v_exam_valid,'authority_version','p10'))
    on conflict(student_id,plan_date,subject,topic,activity_type) do update
      set target_minutes=excluded.target_minutes,priority=excluded.priority,reason=excluded.reason,action_url=excluded.action_url,source=excluded.source,updated_at=now()
      where public.student_revision_plan_items.status='planned';
    if found then v_added:=v_added+1; end if;
  end loop;

  return jsonb_build_object('ok',true,'authority','student_generate_adaptive_revision_plan','added_or_refreshed',v_added,'days',v_days,'daily_cap_minutes',v_daily,'sessions_per_day',v_slots,'target_minutes_per_session',v_target,'exam_context_valid',v_exam_valid,'context',v_context,'recent_completion_suppression_hours',48);
end;
$$;

revoke all on function public.student_generate_adaptive_revision_plan_v1(date,integer) from public;
revoke all on function public.student_generate_adaptive_revision_plan_v1(date,integer) from anon;
