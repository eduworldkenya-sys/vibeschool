begin;

-- Keep repository migration truth aligned with the production repair. The prior
-- summary referenced alias aa outside its FROM scope, causing PostgreSQL 42P01.
CREATE OR REPLACE FUNCTION public.exq_get_marking_centre_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_teacher uuid := auth.uid();
  v_payload jsonb;
begin
  if v_teacher is null then raise exception 'Authentication required'; end if;

  with owned_assignments as (
    select a.id, a.assessment_id, a.class_id
    from public.assessment_assignments a
    where a.teacher_id = v_teacher
  ),
  owned_attempts as (
    select att.*
    from public.assessment_attempts att
    join owned_assignments oa on oa.id = att.assignment_id
  ),
  counts as (
    select
      count(*) filter (where status in ('submitted','teacher_review'))::int as submitted_attempts,
      count(*) filter (where result_status = 'partially_marked')::int as partially_marked_attempts,
      count(*) filter (where status = 'marked' and result_status <> 'released')::int as marked_attempts,
      count(*) filter (where result_status = 'released')::int as released_attempts
    from owned_attempts
  ),
  moderation_counts as (
    select count(*)::int as pending_moderations
    from public.assessment_moderation_requests mr
    join owned_attempts oa on oa.id = mr.attempt_id
    where mr.status = 'pending'
  ),
  workload as (
    select
      a.id as assignment_id, d.id as assessment_id, d.title as assessment_title,
      d.assessment_type, a.class_id, c.name as class_name, c.stream as class_stream,
      count(att.id) filter (where att.status in ('submitted','teacher_review','marked','released'))::int as submitted_count,
      count(att.id) filter (where att.status in ('submitted','teacher_review') or att.result_status = 'partially_marked')::int as unresolved_attempts,
      count(att.id) filter (where att.status = 'marked' and att.result_status <> 'released')::int as marked_count,
      count(att.id) filter (where att.result_status = 'released')::int as released_count,
      round(avg(extract(epoch from (att.teacher_reviewed_at - att.submitted_at)) / 3600.0)
        filter (where att.teacher_reviewed_at is not null and att.submitted_at is not null), 2) as average_turnaround_hours,
      min(att.submitted_at) filter (where att.status in ('submitted','teacher_review') or att.result_status = 'partially_marked') as oldest_unmarked_at
    from public.assessment_assignments a
    join public.assessment_definitions d on d.id = a.assessment_id
    join public.classes c on c.id = a.class_id
    left join public.assessment_attempts att on att.assignment_id = a.id
    where a.teacher_id = v_teacher
    group by a.id, d.id, d.title, d.assessment_type, a.class_id, c.name, c.stream
  )
  select jsonb_build_object(
    'counts', jsonb_build_object(
      'submitted_attempts', coalesce(ct.submitted_attempts,0),
      'partially_marked_attempts', coalesce(ct.partially_marked_attempts,0),
      'marked_attempts', coalesce(ct.marked_attempts,0),
      'released_attempts', coalesce(ct.released_attempts,0),
      'pending_moderations', coalesce(mc.pending_moderations,0)
    ),
    'workload', coalesce((select jsonb_agg(jsonb_build_object(
      'assignment_id', w.assignment_id,'assessment_id',w.assessment_id,'assessment_title',w.assessment_title,
      'assessment_type',w.assessment_type,'class_id',w.class_id,'class_name',w.class_name,'class_stream',w.class_stream,
      'submitted_count',w.submitted_count,'unresolved_attempts',w.unresolved_attempts,'marked_count',w.marked_count,
      'released_count',w.released_count,'average_turnaround_hours',w.average_turnaround_hours,'oldest_unmarked_at',w.oldest_unmarked_at
    ) order by w.unresolved_attempts desc, w.oldest_unmarked_at nulls last) from workload w), '[]'::jsonb)
  ) into v_payload
  from counts ct cross join moderation_counts mc;

  return coalesce(v_payload, jsonb_build_object('counts',jsonb_build_object(),'workload','[]'::jsonb));
end;
$function$;

revoke all on function public.exq_get_marking_centre_summary() from public;
revoke all on function public.exq_get_marking_centre_summary() from anon;
grant execute on function public.exq_get_marking_centre_summary() to authenticated;

notify pgrst,'reload schema';
commit;
