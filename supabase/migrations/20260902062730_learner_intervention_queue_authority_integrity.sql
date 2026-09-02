-- Repair the canonical learner intervention queue against current production authority.
-- teacher_classes has no is_active column; a row is the assignment authority.
-- Only create subject interventions when subject-specific outcome evidence exists.
-- Escalated interventions remain active and unique until explicitly resolved.

drop index if exists public.assessment_interventions_open_uidx;
create unique index assessment_interventions_open_uidx
  on public.assessment_interventions(teacher_id,class_id,student_id,outcome_id)
  where status in ('open','in_progress','escalated');

create or replace function public.exq_refresh_intervention_queue(p_class_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); rows_written integer:=0;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  insert into public.assessment_interventions(
    school_id,class_id,subject_id,teacher_id,student_id,outcome_id,
    priority,recommendation_type,recommendation,mastery_score,evidence_count,
    confidence_score,repeated_weakness_count,evidence_snapshot,status,due_at,updated_at
  )
  select tc.school_id,tc.class_id,tc.subject_id,caller,som.student_id,som.outcome_id,
    case when som.mastery_score<30 and stats.recent_below_50>=2 then 'urgent'
      when som.mastery_score<40 then 'high' when som.mastery_score<60 then 'medium' else 'extension' end,
    case when som.mastery_score<30 and stats.recent_below_50>=2 then 'reteach'
      when som.mastery_score<40 then 'remedial_practice' when som.mastery_score<60 then 'guided_practice'
      when som.mastery_score<80 then 'targeted_revision' else 'extension_challenge' end,
    case when som.mastery_score<30 and stats.recent_below_50>=2 then 'Reteach this outcome using a different representation, then assign short remedial practice.'
      when som.mastery_score<40 then 'Assign focused remedial practice and check understanding in a small group.'
      when som.mastery_score<60 then 'Provide guided practice with worked examples and immediate feedback.'
      when som.mastery_score<80 then 'Schedule targeted revision and one follow-up check.'
      else 'Provide an extension challenge that applies the outcome in a new context.' end,
    coalesce(som.mastery_score,0),som.evidence_count,
    least(100,round((least(som.evidence_count,5)::numeric/5)*70 + case when som.last_evidence_at>=now()-interval '30 days' then 30 when som.last_evidence_at>=now()-interval '90 days' then 20 else 10 end,2)),
    stats.recent_below_50,
    jsonb_build_object('mastery_level',som.mastery_level,'last_evidence_at',som.last_evidence_at,
      'recent_evidence_count',stats.recent_count,'recent_below_50',stats.recent_below_50,
      'latest_percentage',stats.latest_percentage,'evidence_sources',stats.evidence_sources),
    'open',case when som.mastery_score<40 then now()+interval '7 days' when som.mastery_score<80 then now()+interval '14 days' else now()+interval '21 days' end,now()
  from public.student_outcome_mastery som
  join public.students s on s.id=som.student_id
  join public.student_classes sc on sc.student_id=s.id and sc.is_current=true
  join public.teacher_classes tc on tc.class_id=sc.class_id and tc.teacher_id=caller
  join lateral (
    select count(*) filter(where ranked.rn<=5) recent_count,
      count(*) filter(where ranked.rn<=3 and ranked.percentage<50) recent_below_50,
      max(ranked.percentage) filter(where ranked.rn=1) latest_percentage,
      coalesce(jsonb_agg(distinct ranked.evidence_source) filter(where ranked.rn<=5),'[]'::jsonb) evidence_sources
    from (
      select cel.evidence_source,
        case when cel.max_score>0 then round((cel.score/cel.max_score)*100,2) else null end percentage,
        row_number() over(order by cel.observed_at desc,cel.created_at desc) rn
      from public.competency_evidence_ledger cel
      where cel.student_id=som.student_id and cel.outcome_id=som.outcome_id and cel.subject_id=tc.subject_id
    ) ranked
  ) stats on true
  where (p_class_id is null or tc.class_id=p_class_id)
    and som.evidence_count>0
    and stats.recent_count>0
  on conflict (teacher_id,class_id,student_id,outcome_id) where status in ('open','in_progress','escalated')
  do update set school_id=excluded.school_id,subject_id=excluded.subject_id,priority=excluded.priority,
    recommendation_type=excluded.recommendation_type,recommendation=excluded.recommendation,
    mastery_score=excluded.mastery_score,evidence_count=excluded.evidence_count,
    confidence_score=excluded.confidence_score,repeated_weakness_count=excluded.repeated_weakness_count,
    evidence_snapshot=excluded.evidence_snapshot,due_at=excluded.due_at,updated_at=now();
  get diagnostics rows_written=row_count;
  return jsonb_build_object('ok',true,'rows_refreshed',rows_written);
end;
$$;

create or replace function public.exq_list_intervention_queue(p_class_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); payload jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  perform public.exq_refresh_intervention_queue(p_class_id);
  select coalesce(jsonb_agg(jsonb_build_object(
    'intervention_id',i.id,'student_id',i.student_id,'student_name',s.name,'admission_number',s.admission_number,
    'class_id',i.class_id,'class_name',c.name,'class_stream',c.stream,'subject_id',i.subject_id,'subject_name',sub.name,
    'outcome_id',i.outcome_id,'outcome_code',clo.outcome_code,'outcome_text',clo.outcome_text,
    'priority',i.priority,'recommendation_type',i.recommendation_type,'recommendation',i.recommendation,
    'mastery_score',i.mastery_score,'evidence_count',i.evidence_count,'confidence_score',i.confidence_score,
    'repeated_weakness_count',i.repeated_weakness_count,'evidence_snapshot',i.evidence_snapshot,
    'status',i.status,'due_at',i.due_at,'updated_at',i.updated_at,
    'remedial_assessment_id',i.remedial_assessment_id,'remedial_assignment_id',i.remedial_assignment_id,
    'baseline_mastery_score',i.baseline_mastery_score,'followup_mastery_score',i.followup_mastery_score,
    'mastery_change',i.mastery_change,'evaluated_at',i.evaluated_at
  ) order by case i.priority when 'urgent' then 0 when 'high' then 1 when 'medium' then 2 else 3 end,i.due_at asc nulls last,s.name),'[]'::jsonb)
  into payload
  from public.assessment_interventions i
  join public.students s on s.id=i.student_id
  join public.classes c on c.id=i.class_id
  join public.subjects sub on sub.id=i.subject_id
  join public.curriculum_learning_outcomes clo on clo.id=i.outcome_id
  where i.teacher_id=caller and i.status in ('open','in_progress','escalated') and (p_class_id is null or i.class_id=p_class_id);
  return jsonb_build_object('ok',true,'interventions',payload);
end;
$$;

revoke all on function public.exq_refresh_intervention_queue(uuid) from public,anon;
revoke all on function public.exq_list_intervention_queue(uuid) from public,anon;
grant execute on function public.exq_refresh_intervention_queue(uuid) to authenticated,service_role;
grant execute on function public.exq_list_intervention_queue(uuid) to authenticated,service_role;
