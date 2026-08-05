begin;

create or replace function public.exq_link_item_outcome(
  p_assessment_item_id uuid,
  p_outcome_id uuid,
  p_weight numeric default 1
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); teacher_id uuid;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  if p_weight<=0 then raise exception 'invalid_weight'; end if;
  select ad.teacher_id into teacher_id
  from public.assessment_items ai
  join public.assessment_definitions ad on ad.id=ai.assessment_id
  where ai.id=p_assessment_item_id;
  if teacher_id is null then raise exception 'assessment_item_not_found'; end if;
  if teacher_id is distinct from caller then raise exception 'assessment_item_not_owned'; end if;
  if not exists(select 1 from public.curriculum_learning_outcomes clo where clo.id=p_outcome_id and clo.status<>'retired') then
    raise exception 'outcome_not_found';
  end if;
  insert into public.assessment_item_outcomes(assessment_item_id,outcome_id,weight)
  values(p_assessment_item_id,p_outcome_id,p_weight)
  on conflict(assessment_item_id,outcome_id) do update set weight=excluded.weight;
  return jsonb_build_object('ok',true,'assessment_item_id',p_assessment_item_id,'outcome_id',p_outcome_id,'weight',p_weight);
end;
$$;

create or replace function public.exq_sync_attempt_outcome_evidence(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); at public.assessment_attempts%rowtype; aa public.assessment_assignments%rowtype; rows_written integer:=0;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into at from public.assessment_attempts where id=p_attempt_id;
  if not found then raise exception 'attempt_not_found'; end if;
  select * into aa from public.assessment_assignments where id=at.assignment_id;
  if aa.teacher_id is distinct from caller then raise exception 'attempt_not_owned'; end if;
  if at.status not in ('marked','released') then raise exception 'attempt_not_finalized'; end if;

  insert into public.competency_evidence_ledger(
    student_id,outcome_id,evidence_source,evidence_id,score,max_score,
    proficiency,observed_by,observed_at,weight,school_id,class_id,subject_id
  )
  select at.student_id,aio.outcome_id,'assessment_response',ar.id,
    ar.final_score*aio.weight,ar.max_score*aio.weight,
    case
      when ar.max_score<=0 then 'not_assessed'
      when (ar.final_score/ar.max_score)*100>=80 then 'mastered'
      when (ar.final_score/ar.max_score)*100>=60 then 'proficient'
      when (ar.final_score/ar.max_score)*100>=40 then 'developing'
      else 'beginning'
    end,
    caller,coalesce(at.teacher_reviewed_at,now()),aio.weight,
    at.school_id,at.class_id,ad.subject_id
  from public.assessment_responses ar
  join public.assessment_item_outcomes aio on aio.assessment_item_id=ar.assessment_item_id
  join public.assessment_definitions ad on ad.id=at.assessment_id
  where ar.attempt_id=at.id and ar.final_score is not null
  on conflict(evidence_source,evidence_id,outcome_id)
  do update set score=excluded.score,max_score=excluded.max_score,
    proficiency=excluded.proficiency,observed_by=excluded.observed_by,
    observed_at=excluded.observed_at,weight=excluded.weight;
  get diagnostics rows_written=row_count;

  insert into public.student_outcome_mastery(
    student_id,outcome_id,mastery_level,mastery_score,evidence_count,last_evidence_at,updated_at
  )
  select cel.student_id,cel.outcome_id,
    case when sum(cel.max_score*cel.weight)<=0 then 'not_assessed'
      when (sum(cel.score*cel.weight)/sum(cel.max_score*cel.weight))*100>=80 then 'mastered'
      when (sum(cel.score*cel.weight)/sum(cel.max_score*cel.weight))*100>=60 then 'proficient'
      when (sum(cel.score*cel.weight)/sum(cel.max_score*cel.weight))*100>=40 then 'developing'
      else 'beginning' end,
    case when sum(cel.max_score*cel.weight)>0 then round((sum(cel.score*cel.weight)/sum(cel.max_score*cel.weight))*100,2) else 0 end,
    count(*),max(cel.observed_at),now()
  from public.competency_evidence_ledger cel
  where cel.student_id=at.student_id
    and cel.outcome_id in (
      select distinct aio.outcome_id
      from public.assessment_responses ar
      join public.assessment_item_outcomes aio on aio.assessment_item_id=ar.assessment_item_id
      where ar.attempt_id=at.id
    )
  group by cel.student_id,cel.outcome_id
  on conflict(student_id,outcome_id)
  do update set mastery_level=excluded.mastery_level,mastery_score=excluded.mastery_score,
    evidence_count=excluded.evidence_count,last_evidence_at=excluded.last_evidence_at,updated_at=now();

  return jsonb_build_object('ok',true,'attempt_id',at.id,'evidence_rows',rows_written);
end;
$$;

create or replace function public.exq_get_curriculum_intelligence(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare caller uuid:=auth.uid(); aa public.assessment_assignments%rowtype; payload jsonb; interventions jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select * into aa from public.assessment_assignments where id=p_assignment_id;
  if not found then raise exception 'assignment_not_found'; end if;
  if aa.teacher_id is distinct from caller then raise exception 'assignment_not_owned'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'outcome_id',clo.id,'outcome_code',clo.outcome_code,'outcome_text',clo.outcome_text,
    'bloom_level',clo.bloom_level,'difficulty',clo.difficulty,'competency_tags',clo.competency_tags,
    'response_count',stats.response_count,'average_percentage',stats.average_percentage,
    'learners_below_50',stats.learners_below_50,
    'mastery_band',case when stats.average_percentage is null then 'not_assessed'
      when stats.average_percentage>=80 then 'mastered'
      when stats.average_percentage>=60 then 'proficient'
      when stats.average_percentage>=40 then 'developing'
      else 'beginning' end
  ) order by clo.outcome_code nulls last,clo.outcome_text),'[]'::jsonb)
  into payload
  from public.curriculum_learning_outcomes clo
  join (
    select distinct aio.outcome_id
    from public.assessment_items ai
    join public.assessment_item_outcomes aio on aio.assessment_item_id=ai.id
    where ai.assessment_id=aa.assessment_id
  ) linked on linked.outcome_id=clo.id
  left join lateral (
    select count(ar.id) response_count,
      round(avg(case when ar.max_score>0 then (ar.final_score/ar.max_score)*100 end),2) average_percentage,
      count(distinct at.student_id) filter(where ar.max_score>0 and (ar.final_score/ar.max_score)*100<50) learners_below_50
    from public.assessment_responses ar
    join public.assessment_attempts at on at.id=ar.attempt_id
    join public.assessment_item_outcomes aio on aio.assessment_item_id=ar.assessment_item_id and aio.outcome_id=clo.id
    where at.assignment_id=aa.id and ar.final_score is not null
  ) stats on true;

  select coalesce(jsonb_agg(jsonb_build_object(
    'student_id',s.id,'student_name',s.name,'outcome_id',clo.id,
    'outcome_code',clo.outcome_code,'outcome_text',clo.outcome_text,
    'mastery_score',som.mastery_score,'mastery_level',som.mastery_level,
    'recommended_action',case
      when som.mastery_score<40 then 'reteach_and_assign_remedial_practice'
      when som.mastery_score<60 then 'guided_practice'
      when som.mastery_score<80 then 'targeted_revision'
      else 'extension_challenge' end
  ) order by som.mastery_score,s.name),'[]'::jsonb)
  into interventions
  from public.student_outcome_mastery som
  join public.students s on s.id=som.student_id
  join public.curriculum_learning_outcomes clo on clo.id=som.outcome_id
  where som.student_id in (
    select distinct at.student_id from public.assessment_attempts at where at.assignment_id=aa.id
  )
    and som.outcome_id in (
      select distinct aio.outcome_id
      from public.assessment_items ai
      join public.assessment_item_outcomes aio on aio.assessment_item_id=ai.id
      where ai.assessment_id=aa.assessment_id
    )
    and som.mastery_score<60;

  return jsonb_build_object('ok',true,'assignment_id',aa.id,'outcomes',payload,'interventions',interventions);
end;
$$;

revoke all on function public.exq_link_item_outcome(uuid,uuid,numeric) from public,anon;
revoke all on function public.exq_sync_attempt_outcome_evidence(uuid) from public,anon;
revoke all on function public.exq_get_curriculum_intelligence(uuid) from public,anon;
grant execute on function public.exq_link_item_outcome(uuid,uuid,numeric) to authenticated,service_role;
grant execute on function public.exq_sync_attempt_outcome_evidence(uuid) to authenticated,service_role;
grant execute on function public.exq_get_curriculum_intelligence(uuid) to authenticated,service_role;

commit;
