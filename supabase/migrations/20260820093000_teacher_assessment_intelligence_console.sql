-- Teacher Assessment Intelligence Console
-- One teacher-authorized projection for trustworthy exam intelligence.
-- Aggregate exam evidence is always kept distinct from longitudinal subject/outcome evidence.

create index if not exists exam_results_teacher_intelligence_idx
  on public.exam_results (teacher_id, school_id, class_id, subject_id, exam_id);

create or replace function public.teacher_get_assessment_intelligence(
  p_exam_id uuid,
  p_class_id uuid,
  p_subject_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_teacher uuid := auth.uid();
  v_school uuid;
  v_exam_name text;
  v_pass_mark numeric;
  v_exam_created_at timestamptz;
  v_class_name text;
  v_class_stream text;
  v_subject_name text;
  v_roster_count integer := 0;
  v_recorded_count integer := 0;
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
  v_result jsonb;
begin
  if v_teacher is null then
    raise exception 'authentication_required';
  end if;

  select e.school_id, e.name, e.pass_mark, e.created_at
    into v_school, v_exam_name, v_pass_mark, v_exam_created_at
  from public.exams e
  where e.id = p_exam_id;

  if v_school is null then
    raise exception 'exam_not_found';
  end if;

  if not exists (
    select 1
    from public.teacher_classes tc
    join public.classes c on c.id = tc.class_id
    join public.subjects s on s.id = tc.subject_id
    where tc.teacher_id = v_teacher
      and tc.class_id = p_class_id
      and tc.subject_id = p_subject_id
      and c.school_id = v_school
      and s.school_id = v_school
  ) then
    raise exception 'teacher_assignment_required';
  end if;

  select c.name, c.stream into v_class_name, v_class_stream
  from public.classes c where c.id = p_class_id and c.school_id = v_school;

  select s.name into v_subject_name
  from public.subjects s where s.id = p_subject_id and s.school_id = v_school;

  select count(*)::int into v_roster_count
  from public.student_classes sc
  where sc.school_id = v_school
    and sc.class_id = p_class_id
    and sc.is_current = true;

  select
    count(*)::int,
    count(*) filter (where er.is_absent)::int,
    round(avg(er.marks) filter (where not er.is_absent), 2),
    round(percentile_cont(0.5) within group (order by er.marks) filter (where not er.is_absent)::numeric, 2),
    max(er.marks) filter (where not er.is_absent),
    min(er.marks) filter (where not er.is_absent),
    count(*) filter (where not er.is_absent and er.marks >= v_pass_mark)::int
  into v_recorded_count, v_absent_count, v_mean, v_median, v_highest, v_lowest, v_passed
  from public.exam_results er
  where er.exam_id = p_exam_id
    and er.school_id = v_school
    and er.class_id = p_class_id
    and er.subject_id = p_subject_id;

  select e.id, e.name, round(avg(er.marks) filter (where not er.is_absent), 2)
    into v_previous_exam_id, v_previous_exam_name, v_previous_mean
  from public.exam_results er
  join public.exams e on e.id = er.exam_id
  where er.school_id = v_school
    and er.class_id = p_class_id
    and er.subject_id = p_subject_id
    and er.exam_id <> p_exam_id
    and e.created_at < v_exam_created_at
  group by e.id, e.name, e.created_at
  order by e.created_at desc
  limit 1;

  if v_mean is not null and v_previous_mean is not null then
    v_delta := round(v_mean - v_previous_mean, 2);
  end if;

  select count(*)::int into v_outcome_count
  from public.assessment_interventions ai
  where ai.school_id = v_school
    and ai.class_id = p_class_id
    and ai.subject_id = p_subject_id
    and ai.teacher_id = v_teacher
    and ai.outcome_id is not null;

  with current_rows as (
    select er.student_id, st.name, er.marks, er.is_absent
    from public.exam_results er
    join public.students st on st.id = er.student_id
    where er.exam_id = p_exam_id
      and er.school_id = v_school
      and er.class_id = p_class_id
      and er.subject_id = p_subject_id
  ), previous_rows as (
    select er.student_id, er.marks, er.is_absent
    from public.exam_results er
    where er.exam_id = v_previous_exam_id
      and er.school_id = v_school
      and er.class_id = p_class_id
      and er.subject_id = p_subject_id
  ), movements as (
    select c.student_id, c.name, c.marks,
      p.marks as previous_marks,
      case when p.marks is null or p.is_absent or c.is_absent then null else round(c.marks - p.marks, 2) end as change,
      case
        when c.is_absent then 'absent'
        when p.marks is null or p.is_absent then case when c.marks >= v_pass_mark then 'meeting' else 'needs_support' end
        when c.marks >= v_pass_mark and c.marks - p.marks > 2 then 'strong_improving'
        when c.marks >= v_pass_mark and c.marks - p.marks < -2 then 'strong_declining'
        when c.marks >= v_pass_mark then 'strong_steady'
        when c.marks < v_pass_mark and c.marks - p.marks > 2 then 'recovering'
        when c.marks < v_pass_mark and c.marks - p.marks < -2 then 'at_risk_declining'
        else 'needs_support'
      end as segment
    from current_rows c
    left join previous_rows p on p.student_id = c.student_id
  ), history as (
    select e.id, e.name, e.exam_type, e.created_at,
      round(avg(er.marks) filter (where not er.is_absent), 2) as mean,
      count(*) filter (where not er.is_absent)::int as learners
    from public.exam_results er
    join public.exams e on e.id = er.exam_id
    where er.school_id = v_school
      and er.class_id = p_class_id
      and er.subject_id = p_subject_id
      and e.created_at <= v_exam_created_at
    group by e.id, e.name, e.exam_type, e.created_at
    order by e.created_at asc
    limit 8
  ), outcome_rows as (
    select ai.outcome_id, clo.outcome_text,
      round(avg(ai.mastery_score), 2) as mastery_score,
      sum(coalesce(ai.evidence_count,0))::int as evidence_count,
      max(coalesce(ai.repeated_weakness_count,0))::int as repeated_weakness_count,
      count(distinct ai.student_id)::int as learners_affected,
      round(avg(ai.confidence_score), 2) as confidence_score
    from public.assessment_interventions ai
    join public.curriculum_learning_outcomes clo on clo.id = ai.outcome_id
    where ai.school_id = v_school
      and ai.class_id = p_class_id
      and ai.subject_id = p_subject_id
      and ai.teacher_id = v_teacher
      and ai.outcome_id is not null
    group by ai.outcome_id, clo.outcome_text
  ), intervention_effects as (
    select ai.id, ai.student_id, st.name as student_name, ai.recommendation,
      ai.baseline_mastery_score, ai.followup_mastery_score, ai.mastery_change,
      ai.status, ai.evaluated_at
    from public.assessment_interventions ai
    left join public.students st on st.id = ai.student_id
    where ai.school_id = v_school
      and ai.class_id = p_class_id
      and ai.subject_id = p_subject_id
      and ai.teacher_id = v_teacher
      and ai.baseline_mastery_score is not null
      and ai.followup_mastery_score is not null
    order by ai.evaluated_at desc nulls last
    limit 8
  )
  select jsonb_build_object(
    'context', jsonb_build_object(
      'exam_id', p_exam_id, 'exam_name', v_exam_name,
      'class_id', p_class_id, 'class_name', v_class_name, 'class_stream', v_class_stream,
      'subject_id', p_subject_id, 'subject_name', v_subject_name,
      'pass_mark', v_pass_mark
    ),
    'evidence_quality', jsonb_build_object(
      'exam_scope', 'aggregate',
      'has_previous_exam', v_previous_exam_id is not null,
      'has_outcome_evidence', v_outcome_count > 0,
      'outcome_scope', case when v_outcome_count > 0 then 'longitudinal_subject' else 'none' end,
      'outcome_note', case when v_outcome_count > 0
        then 'Outcome findings use longitudinal subject intervention evidence and are not attributed to this exam unless item-level evidence is linked.'
        else 'This exam currently supports subject-level performance intelligence only. Outcome claims are withheld until linked evidence exists.' end
    ),
    'completion', jsonb_build_object(
      'roster', v_roster_count, 'recorded', v_recorded_count, 'absent', v_absent_count,
      'remaining', greatest(v_roster_count - v_recorded_count, 0),
      'percent', case when v_roster_count = 0 then 0 else round((v_recorded_count::numeric / v_roster_count) * 100, 1) end
    ),
    'headline_metrics', jsonb_build_object(
      'mean', v_mean, 'median', v_median, 'highest', v_highest, 'lowest', v_lowest,
      'passed', v_passed, 'below', greatest(v_recorded_count - v_absent_count - v_passed, 0),
      'meeting_percent', case when (v_recorded_count-v_absent_count) <= 0 then null else round((v_passed::numeric/(v_recorded_count-v_absent_count))*100,1) end,
      'previous_mean', v_previous_mean, 'mean_change', v_delta, 'previous_exam_name', v_previous_exam_name
    ),
    'performance_distribution', jsonb_build_object(
      'EE', (select count(*) from current_rows where not is_absent and marks >= 80),
      'ME', (select count(*) from current_rows where not is_absent and marks >= 60 and marks < 80),
      'AE', (select count(*) from current_rows where not is_absent and marks >= 40 and marks < 60),
      'BE', (select count(*) from current_rows where not is_absent and marks < 40)
    ),
    'historical_trajectory', coalesce((select jsonb_agg(jsonb_build_object('exam_id',id,'name',name,'type',exam_type,'mean',mean,'learners',learners) order by created_at) from history), '[]'::jsonb),
    'learner_rankings', coalesce((select jsonb_agg(x) from (
      select jsonb_build_object('student_id',student_id,'name',name,'marks',marks) x
      from current_rows where not is_absent order by marks desc, name asc limit 5
    ) q), '[]'::jsonb),
    'learner_movements', coalesce((select jsonb_agg(jsonb_build_object('student_id',student_id,'name',name,'marks',marks,'previous_marks',previous_marks,'change',change,'segment',segment) order by abs(coalesce(change,0)) desc, name) from movements), '[]'::jsonb),
    'performance_segments', jsonb_build_object(
      'strong_improving', (select count(*) from movements where segment='strong_improving'),
      'strong_steady', (select count(*) from movements where segment='strong_steady'),
      'strong_declining', (select count(*) from movements where segment='strong_declining'),
      'recovering', (select count(*) from movements where segment='recovering'),
      'needs_support', (select count(*) from movements where segment='needs_support'),
      'at_risk_declining', (select count(*) from movements where segment='at_risk_declining')
    ),
    'outcome_weaknesses', coalesce((select jsonb_agg(jsonb_build_object('outcome_id',outcome_id,'outcome_text',outcome_text,'mastery_score',mastery_score,'evidence_count',evidence_count,'repeated_weakness_count',repeated_weakness_count,'learners_affected',learners_affected,'confidence_score',confidence_score) order by mastery_score asc nulls last) from (select * from outcome_rows order by mastery_score asc nulls last limit 6) z), '[]'::jsonb),
    'intervention_effects', coalesce((select jsonb_agg(jsonb_build_object('id',id,'student_id',student_id,'student_name',student_name,'recommendation',recommendation,'baseline',baseline_mastery_score,'followup',followup_mastery_score,'change',mastery_change,'status',status,'evaluated_at',evaluated_at)) from intervention_effects), '[]'::jsonb),
    'attention_items', (
      select coalesce(jsonb_agg(item), '[]'::jsonb) from (
        select jsonb_build_object('severity','completion','title','Results incomplete','detail',greatest(v_roster_count-v_recorded_count,0)||' learner(s) still need a result.','action','markbook') item where v_recorded_count < v_roster_count
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
    'recommended_actions', jsonb_build_array(
      jsonb_build_object('id','complete_marks','label','Complete marks','enabled',v_recorded_count < v_roster_count,'action','markbook'),
      jsonb_build_object('id','review_support','label','Review learners needing support','enabled',greatest(v_recorded_count-v_absent_count-v_passed,0)>0,'action','learners'),
      jsonb_build_object('id','plan_reteach','label','Plan reteaching','enabled',v_outcome_count>0,'action','lessonplan'),
      jsonb_build_object('id','review_reports','label','Review report cards','enabled',v_recorded_count>0,'action','reports')
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.teacher_get_assessment_intelligence(uuid,uuid,uuid) from public;
revoke all on function public.teacher_get_assessment_intelligence(uuid,uuid,uuid) from anon;
grant execute on function public.teacher_get_assessment_intelligence(uuid,uuid,uuid) to authenticated;

comment on function public.teacher_get_assessment_intelligence(uuid,uuid,uuid) is
  'Teacher-authorized assessment intelligence snapshot. Aggregate exam evidence is never promoted into outcome-level claims.';
