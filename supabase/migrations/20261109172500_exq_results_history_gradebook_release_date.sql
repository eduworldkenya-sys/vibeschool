-- Released results history uses canonical gradebook timestamp, not a missing attempt column.
CREATE OR REPLACE FUNCTION public.exq_list_my_results()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  caller uuid:=auth.uid();
  learner_id uuid;
  payload jsonb;
begin
  if caller is null then raise exception 'not_authenticated'; end if;
  select s.id into learner_id from public.students s where s.profile_id=caller limit 1;
  if learner_id is null then raise exception 'learner_identity_not_found'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'attempt_id',at.id,
    'assignment_id',aa.id,
    'assessment_id',ad.id,
    'title',ad.title,
    'assessment_type',ad.assessment_type,
    'score',at.score,
    'max_score',at.max_score,
    'percentage',at.percentage,
    'feedback',at.feedback,
    'submitted_at',at.submitted_at,
    'released_at',gb.released_at,
    'attempt_number',at.attempt_number,
    'max_attempts',aa.max_attempts
  ) order by gb.released_at desc nulls last,at.submitted_at desc),'[]'::jsonb)
  into payload
  from public.assessment_attempts at
  left join public.assessment_gradebook_entries gb on gb.attempt_id=at.id
  join public.assessment_assignments aa on aa.id=at.assignment_id
  join public.assessment_definitions ad on ad.id=at.assessment_id
  where at.student_id=learner_id
    and at.status='released'
    and at.result_status='released';

  return jsonb_build_object('ok',true,'results',payload);
end;
$function$;
