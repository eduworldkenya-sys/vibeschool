begin;

create or replace function public.exq_list_my_assignments()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  learner public.students%rowtype;
  payload jsonb;
begin
  if caller is null then
    raise exception 'not_authenticated';
  end if;

  select s.* into learner
  from public.students s
  where s.profile_id = caller
  limit 1;

  if not found then
    raise exception 'learner_identity_not_found';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'assignment_id', aa.id,
        'assessment_id', ad.id,
        'title', ad.title,
        'assessment_type', ad.assessment_type,
        'instructions', ad.instructions,
        'opens_at', aa.opens_at,
        'closes_at', aa.closes_at,
        'time_limit_minutes', aa.time_limit_minutes,
        'max_attempts', aa.max_attempts,
        'show_score_policy', aa.show_score_policy,
        'attempt_id', at.id,
        'attempt_status', at.status,
        'result_status', at.result_status,
        'score', at.score,
        'max_score', at.max_score,
        'percentage', at.percentage,
        'submitted_at', at.submitted_at
      )
      order by
        case when aa.closes_at is null then 1 else 0 end,
        aa.closes_at asc nulls last,
        aa.created_at desc
    ),
    '[]'::jsonb
  ) into payload
  from public.assessment_assignments aa
  join public.assessment_definitions ad
    on ad.id = aa.assessment_id
  join public.student_classes sc
    on sc.class_id = aa.class_id
   and sc.student_id = learner.id
   and sc.is_current = true
   and sc.school_id = aa.school_id
  left join lateral (
    select a.*
    from public.assessment_attempts a
    where a.assignment_id = aa.id
      and a.student_id = learner.id
    order by a.attempt_number desc
    limit 1
  ) at on true
  where aa.status in ('assigned','open','closed')
    and (aa.opens_at is null or aa.opens_at <= now())
    and (
      aa.target_group_id is null
      or exists (
        select 1
        from public.class_group_members cgm
        where cgm.group_id = aa.target_group_id
          and cgm.student_id = learner.id
      )
    );

  return jsonb_build_object('ok', true, 'assignments', payload);
end;
$$;

revoke all on function public.exq_list_my_assignments() from public, anon;
grant execute on function public.exq_list_my_assignments() to authenticated, service_role;

comment on function public.exq_list_my_assignments() is
  'Returns only assessment assignments visible to the authenticated learner, including their latest attempt state.';

commit;
