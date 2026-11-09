-- Limit immediate learner score disclosure to fully marked practice assessments.
-- Formal assessments must pass the canonical authorised result release policy.
CREATE OR REPLACE FUNCTION public.exq_list_my_assignments()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  caller uuid:=auth.uid();
  learner public.students%rowtype;
  payload jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select s.* into learner from public.students s where s.profile_id=caller limit 1;
  if not found then raise exception 'learner_identity_not_found'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignment_id',aa.id,
    'assessment_id',ad.id,
    'title',ad.title,
    'assessment_type',ad.assessment_type,
    'instructions',ad.instructions,
    'assignment_status',aa.status,
    'opens_at',aa.opens_at,
    'closes_at',aa.closes_at,
    'time_limit_minutes',aa.time_limit_minutes,
    'max_attempts',aa.max_attempts,
    'show_score_policy',aa.show_score_policy,
    'attempt_id',at.id,
    'attempt_number',at.attempt_number,
    'attempt_status',at.status,
    'attempt_expires_at',at.expires_at,
    'result_status',at.result_status,
    'score',case when at.result_status='released' or (ad.assessment_type='practice' and aa.show_score_policy='immediate' and at.result_status='marked') then at.score else null end,
    'max_score',case when at.result_status='released' or (ad.assessment_type='practice' and aa.show_score_policy='immediate' and at.result_status='marked') then at.max_score else null end,
    'percentage',case when at.result_status='released' or (ad.assessment_type='practice' and aa.show_score_policy='immediate' and at.result_status='marked') then at.percentage else null end,
    'submitted_at',at.submitted_at,
    'can_start',(
      aa.status in ('assigned','open')
      and (aa.opens_at is null or aa.opens_at<=now())
      and (aa.closes_at is null or aa.closes_at>now())
      and (
        at.id is null
        or at.status='in_progress'
        or at.attempt_number<aa.max_attempts
      )
    ),
    'availability',case
      when aa.opens_at is not null and aa.opens_at>now() then 'upcoming'
      when aa.closes_at is not null and aa.closes_at<=now() then 'closed'
      when aa.status='closed' then 'closed'
      when at.status='in_progress' then 'in_progress'
      when at.id is not null and at.attempt_number>=aa.max_attempts then 'attempts_exhausted'
      else 'available'
    end
  ) order by
    case when aa.closes_at is null then 1 else 0 end,
    aa.closes_at asc nulls last,
    aa.created_at desc),'[]'::jsonb)
  into payload
  from public.assessment_assignments aa
  join public.assessment_definitions ad on ad.id=aa.assessment_id
  join public.student_classes sc on sc.class_id=aa.class_id and sc.student_id=learner.id and sc.is_current=true and sc.school_id=aa.school_id
  left join lateral (
    select a.* from public.assessment_attempts a
    where a.assignment_id=aa.id and a.student_id=learner.id
    order by a.attempt_number desc limit 1
  ) at on true
  where aa.status in ('assigned','open','closed')
    and (aa.target_group_id is null or exists (
      select 1 from public.class_group_members cgm
      where cgm.group_id=aa.target_group_id and cgm.student_id=learner.id
    ));

  return jsonb_build_object('ok',true,'assignments',payload);
end;
$function$
;
