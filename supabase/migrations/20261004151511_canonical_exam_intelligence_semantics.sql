-- Canonical exam intelligence semantics.
-- Applied to production as migration 20261004151511.
CREATE OR REPLACE FUNCTION public.teacher_get_assessment_intelligence(p_exam_id uuid, p_class_id uuid, p_subject_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_teacher uuid := auth.uid();
  v_school uuid;
  v_exam_name text;
  v_raw_pass_mark numeric;
  v_max_marks numeric;
  v_pass_percentage numeric;
  v_exam_created_at timestamptz;
  v_class_name text;
  v_class_stream text;
  v_subject_name text;
  v_roster_count integer := 0;
  v_recorded_count integer := 0;
  v_resolved_count integer := 0;
  v_scored_count integer := 0;
  v_absent_count integer := 0;
  v_mean numeric;
  v_median numeric;
  v_highest numeric;
  v_lowest numeric;
  v_passed integer := 0;
  v_previous_exam_id uuid;
  v_previous_exam_name text;
  v_previous_mean numeric;
  v_delta numeric;
  v_outcome_count integer := 0;
  v_policy jsonb;
  v_result jsonb;
begin
  if v_teacher is null then raise exception 'authentication_required'; end if;

  select e.school_id,e.name,e.created_at
  into v_school,v_exam_name,v_exam_created_at
  from public.exams e
  where e.id=p_exam_id;
  if v_school is null then raise exception 'exam_not_found'; end if;

  -- This canonical policy resolver also enforces active-school + live class/subject authority.
  v_policy:=public.teacher_get_exam_subject_policy(p_exam_id,v_school,p_class_id,p_subject_id);
  v_raw_pass_mark:=(v_policy->>'pass_mark')::numeric;
  v_max_marks:=(v_policy->>'max_marks')::numeric;
  v_pass_percentage:=(v_policy->>'pass_percentage')::numeric;

  select c.name,c.stream into v_class_name,v_class_stream
  from public.classes c where c.id=p_class_id and c.school_id=v_school;
  if v_class_name is null then raise exception 'class_not_found'; end if;

  select s.name into v_subject_name
  from public.subjects s where s.id=p_subject_id and s.school_id=v_school;
  if v_subject_name is null then raise exception 'subject_not_found'; end if;

  select count(*)::int into v_roster_count
  from public.student_classes sc
  where sc.school_id=v_school and sc.class_id=p_class_id and sc.is_current=true;

  select
    count(*)::int,
    count(*) filter (where er.result_state in ('entered','absent','not_assessed','exempt','transferred'))::int,
    count(*) filter (where er.result_state='entered')::int,
    count(*) filter (where er.result_state='absent')::int,
    round(avg(er.percentage) filter (where er.result_state='entered'),2),
    round(percentile_cont(0.5) within group (order by er.percentage) filter (where er.result_state='entered')::numeric,2),
    max(er.percentage) filter (where er.result_state='entered'),
    min(er.percentage) filter (where er.result_state='entered'),
    count(*) filter (where er.result_state='entered' and er.percentage>=v_pass_percentage)::int
  into v_recorded_count,v_resolved_count,v_scored_count,v_absent_count,v_mean,v_median,v_highest,v_lowest,v_passed
  from public.exam_results er
  where er.exam_id=p_exam_id and er.school_id=v_school and er.class_id=p_class_id and er.subject_id=p_subject_id;

  select e.id,e.name,round(avg(er.percentage) filter (where er.result_state='entered'),2)
  into v_previous_exam_id,v_previous_exam_name,v_previous_mean
  from public.exam_results er
  join public.exams e on e.id=er.exam_id
  where er.school_id=v_school and er.class_id=p_class_id and er.subject_id=p_subject_id
    and er.exam_id<>p_exam_id and e.created_at<v_exam_created_at
    and er.result_state='entered'
  group by e.id,e.name,e.created_at
  having count(*) filter (where er.result_state='entered')>0
  order by e.created_at desc
  limit 1;

  if v_mean is not null and v_previous_mean is not null then v_delta:=round(v_mean-v_previous_mean,2); end if;

  select count(*)::int into v_outcome_count
  from public.assessment_interventions ai
  where ai.school_id=v_school and ai.class_id=p_class_id and ai.subject_id=p_subject_id
    and ai.teacher_id=v_teacher and ai.outcome_id is not null;

  with current_rows as (
    select er.student_id,st.name,er.percentage as marks,er.result_state
    from public.exam_results er
    join public.students st on st.id=er.student_id
    where er.exam_id=p_exam_id and er.school_id=v_school and er.class_id=p_class_id and er.subject_id=p_subject_id
  ), previous_rows as (
    select er.student_id,er.percentage as marks
    from public.exam_results er
    where er.exam_id=v_previous_exam_id and er.school_id=v_school and er.class_id=p_class_id and er.subject_id=p_subject_id
      and er.result_state='entered'
  ), movements as (
    select c.student_id,c.name,c.marks,p.marks as previous_marks,
      case when p.marks is null then null else round(c.marks-p.marks,2) end as change,
      case
        when p.marks is null then case when c.marks>=v_pass_percentage then 'meeting' else 'needs_support' end
        when c.marks>=v_pass_percentage and c.marks-p.marks>2 then 'strong_improving'
        when c.marks>=v_pass_percentage and c.marks-p.marks<(-2) then 'strong_declining'
        when c.marks>=v_pass_percentage then 'strong_steady'
        when c.marks<v_pass_percentage and c.marks-p.marks>2 then 'recovering'
        when c.marks<v_pass_percentage and c.marks-p.marks<(-2) then 'at_risk_declining'
        else 'needs_support'
      end as segment
    from current_rows c
    left join previous_rows p on p.student_id=c.student_id
    where c.result_state='entered'
  ), history as (
    select e.id,e.name,e.exam_type,e.created_at,
      round(avg(er.percentage) filter (where er.result_state='entered'),2) as mean,
      count(*) filter (where er.result_state='entered')::int as learners
    from public.exam_results er
    join public.exams e on e.id=er.exam_id
    where er.school_id=v_school and er.class_id=p_class_id and er.subject_id=p_subject_id
      and e.created_at<=v_exam_created_at
    group by e.id,e.name,e.exam_type,e.created_at
    having count(*) filter (where er.result_state='entered')>0
    order by e.created_at asc
    limit 8
  ), outcome_rows as (
    select ai.outcome_id,clo.outcome_text,
      round(avg(ai.mastery_score),2) as mastery_score,
      sum(coalesce(ai.evidence_count,0))::int as evidence_count,
      max(coalesce(ai.repeated_weakness_count,0))::int as repeated_weakness_count,
      count(distinct ai.student_id)::int as learners_affected,
      round(avg(ai.confidence_score),2) as confidence_score
    from public.assessment_interventions ai
    join public.curriculum_learning_outcomes clo on clo.id=ai.outcome_id
    where ai.school_id=v_school and ai.class_id=p_class_id and ai.subject_id=p_subject_id
      and ai.teacher_id=v_teacher and ai.outcome_id is not null
    group by ai.outcome_id,clo.outcome_text
  ), intervention_effects as (
    select ai.id,ai.student_id,st.name as student_name,ai.recommendation,
      ai.baseline_mastery_score,ai.followup_mastery_score,ai.mastery_change,
      ai.status,ai.evaluated_at
    from public.assessment_interventions ai
    left join public.students st on st.id=ai.student_id
    where ai.school_id=v_school and ai.class_id=p_class_id and ai.subject_id=p_subject_id
      and ai.teacher_id=v_teacher
      and ai.baseline_mastery_score is not null and ai.followup_mastery_score is not null
    order by ai.evaluated_at desc nulls last
    limit 8
  )
  select jsonb_build_object(
    'context',jsonb_build_object(
      'exam_id',p_exam_id,'exam_name',v_exam_name,
      'class_id',p_class_id,'class_name',v_class_name,'class_stream',v_class_stream,
      'subject_id',p_subject_id,'subject_name',v_subject_name,
      'pass_mark',v_pass_percentage,'raw_pass_mark',v_raw_pass_mark,'max_marks',v_max_marks
    ),
    'evidence_quality',jsonb_build_object(
      'exam_scope','aggregate',
      'has_previous_exam',v_previous_exam_id is not null,
      'has_outcome_evidence',v_outcome_count>0,
      'outcome_scope',case when v_outcome_count>0 then 'longitudinal_subject' else 'none' end,
      'score_note','Class comparisons use normalized percentages derived from each raw score and its recorded maximum marks.',
      'outcome_note',case when v_outcome_count>0
        then 'Outcome findings use longitudinal subject intervention evidence and are not attributed to this exam unless item-level evidence is linked.'
        else 'This exam currently supports subject-level performance intelligence only. Outcome claims are withheld until linked evidence exists.' end
    ),
    'completion',jsonb_build_object(
      'roster',v_roster_count,'recorded',v_recorded_count,'resolved',v_resolved_count,'scored',v_scored_count,'absent',v_absent_count,
      'remaining',greatest(v_roster_count-v_resolved_count,0),
      'percent',case when v_roster_count=0 then 0 else round((v_resolved_count::numeric/v_roster_count)*100,1) end
    ),
    'result_states',jsonb_build_object(
      'not_entered',greatest(v_roster_count-v_recorded_count,0),
      'entered',(select count(*) from current_rows where result_state='entered'),
      'absent',(select count(*) from current_rows where result_state='absent'),
      'not_assessed',(select count(*) from current_rows where result_state='not_assessed'),
      'exempt',(select count(*) from current_rows where result_state='exempt'),
      'pending',(select count(*) from current_rows where result_state='pending'),
      'incomplete',(select count(*) from current_rows where result_state='incomplete'),
      'late',(select count(*) from current_rows where result_state='late'),
      'transferred',(select count(*) from current_rows where result_state='transferred'),
      'awaiting_marking',(select count(*) from current_rows where result_state='awaiting_marking')
    ),
    'headline_metrics',jsonb_build_object(
      'mean',v_mean,'median',v_median,'highest',v_highest,'lowest',v_lowest,
      'passed',v_passed,'below',greatest(v_scored_count-v_passed,0),
      'meeting_percent',case when v_scored_count<=0 then null else round((v_passed::numeric/v_scored_count)*100,1) end,
      'previous_mean',v_previous_mean,'mean_change',v_delta,'previous_exam_name',v_previous_exam_name
    ),
    'performance_distribution',jsonb_build_object(
      'at_or_above_target',(select count(*) from current_rows where result_state='entered' and marks>=v_pass_percentage),
      'below_target',(select count(*) from current_rows where result_state='entered' and marks<v_pass_percentage),
      'not_scored',greatest(v_roster_count-v_scored_count,0)
    ),
    'historical_trajectory',coalesce((select jsonb_agg(jsonb_build_object('exam_id',id,'name',name,'type',exam_type,'mean',mean,'learners',learners) order by created_at) from history),'[]'::jsonb),
    'learner_rankings',coalesce((select jsonb_agg(x) from (
      select jsonb_build_object('student_id',student_id,'name',name,'marks',marks) x
      from current_rows where result_state='entered' order by marks desc,name asc limit 5
    ) q),'[]'::jsonb),
    'learner_movements',coalesce((select jsonb_agg(jsonb_build_object('student_id',student_id,'name',name,'marks',marks,'previous_marks',previous_marks,'change',change,'segment',segment) order by abs(coalesce(change,0)) desc,name) from movements),'[]'::jsonb),
    'performance_segments',jsonb_build_object(
      'strong_improving',(select count(*) from movements where segment='strong_improving'),
      'strong_steady',(select count(*) from movements where segment='strong_steady'),
      'strong_declining',(select count(*) from movements where segment='strong_declining'),
      'recovering',(select count(*) from movements where segment='recovering'),
      'needs_support',(select count(*) from movements where segment='needs_support'),
      'at_risk_declining',(select count(*) from movements where segment='at_risk_declining')
    ),
    'outcome_weaknesses',coalesce((select jsonb_agg(jsonb_build_object(
      'outcome_id',outcome_id,'outcome_text',outcome_text,'mastery_score',mastery_score,'evidence_count',evidence_count,
      'repeated_weakness_count',repeated_weakness_count,'learners_affected',learners_affected,'confidence_score',confidence_score
    ) order by mastery_score asc nulls last) from (select * from outcome_rows order by mastery_score asc nulls last limit 6) z),'[]'::jsonb),
    'intervention_effects',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'student_id',student_id,'student_name',student_name,'recommendation',recommendation,
      'baseline',baseline_mastery_score,'followup',followup_mastery_score,'change',mastery_change,'status',status,'evaluated_at',evaluated_at
    )) from intervention_effects),'[]'::jsonb),
    'attention_items',(
      select coalesce(jsonb_agg(item),'[]'::jsonb) from (
        select jsonb_build_object('severity','completion','title','Results incomplete','detail',greatest(v_roster_count-v_resolved_count,0)||' learner(s) still need a final result.','action','markbook') item where v_resolved_count<v_roster_count
        union all
        select jsonb_build_object('severity','critical','title','Learners declining','detail',count(*)||' learner(s) are below the pass mark and declining.','action','learners') from movements where segment='at_risk_declining' having count(*)>0
        union all
        select jsonb_build_object('severity','support','title','Learners need support','detail',count(*)||' learner(s) are currently below the pass mark.','action','learners') from movements where segment in ('needs_support','at_risk_declining','recovering') having count(*)>0
        union all
        select jsonb_build_object('severity','opportunity','title','Strong improvement','detail',count(*)||' learner(s) are strong and improving.','action','learners') from movements where segment='strong_improving' having count(*)>0
        union all
        select jsonb_build_object('severity','teaching','title','Outcome evidence available','detail',v_outcome_count||' longitudinal outcome signal(s) are available for this subject.','action','outcomes') where v_outcome_count>0
      ) items
    ),
    'recommended_actions',jsonb_build_array(
      jsonb_build_object('id','complete_marks','label','Complete results','enabled',v_resolved_count<v_roster_count,'action','markbook'),
      jsonb_build_object('id','review_support','label','Review learners needing support','enabled',greatest(v_scored_count-v_passed,0)>0,'action','learners'),
      jsonb_build_object('id','plan_reteach','label','Plan reteaching','enabled',v_outcome_count>0,'action','lessonplan'),
      jsonb_build_object('id','review_reports','label','Review reports','enabled',v_resolved_count>0,'action','reports')
    )
  ) into v_result;

  return v_result;
end;
$function$;

revoke all on function public.teacher_get_assessment_intelligence(uuid,uuid,uuid) from public;
revoke all on function public.teacher_get_assessment_intelligence(uuid,uuid,uuid) from anon;
grant execute on function public.teacher_get_assessment_intelligence(uuid,uuid,uuid) to authenticated;

comment on function public.teacher_get_assessment_intelligence(uuid,uuid,uuid) is
  'Teacher-authorized assessment intelligence using canonical result states and normalized score percentages; no hard-coded grade-band inference.';
