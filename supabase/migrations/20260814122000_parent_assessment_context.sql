begin;

create or replace function public.exq_get_parent_assessment_summary(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_child_name text;
begin
  select s.name into v_child_name
  from public.parent_student_links psl
  join public.students s on s.id = psl.student_id
  where psl.parent_id = auth.uid()
    and psl.student_id = p_student_id
    and coalesce(psl.access_level, 'full') <> 'none'
  limit 1;

  if v_child_name is null then raise exception 'Not authorized'; end if;

  return jsonb_build_object(
    'child_name', v_child_name,
    'results', coalesce((
      select jsonb_agg(jsonb_build_object(
        'attempt_id',g.attempt_id,
        'assessment_title',g.assessment_title,
        'assessment_type',g.assessment_type,
        'score',g.score,
        'max_score',g.max_score,
        'percentage',g.percentage,
        'released_at',g.released_at,
        'teacher_feedback',a.feedback,
        'subject_id',g.subject_id
      ) order by g.released_at desc)
      from public.assessment_gradebook_entries g
      join public.assessment_attempts a on a.id=g.attempt_id
      where g.student_id=p_student_id
    ),'[]'::jsonb),
    'progress', coalesce((
      select jsonb_agg(to_jsonb(sp))
      from public.student_subject_progress sp
      where sp.student_id=p_student_id
    ),'[]'::jsonb),
    'interventions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',i.id,'priority',i.priority,'recommendation',i.recommendation,
        'status',i.status,'due_at',i.due_at
      ))
      from public.assessment_interventions i
      where i.student_id=p_student_id and i.status<>'completed'
    ),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.exq_get_parent_assessment_summary(uuid) from public,anon;
grant execute on function public.exq_get_parent_assessment_summary(uuid) to authenticated;

commit;
