begin;

create or replace function public.get_parent_homework_detail(p_homework_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  caller uuid := auth.uid();
  result jsonb;
begin
  if caller is null then raise exception 'Authentication required'; end if;

  select jsonb_build_object(
    'homework', jsonb_build_object(
      'id', h.id,
      'title', h.title,
      'subject', coalesce(h.subject, 'Subject'),
      'instructions', h.instructions,
      'due_date', h.due_date,
      'type', h.type,
      'teacher_name', coalesce(p.full_name, 'Teacher')
    ),
    'children', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_id', s.id,
        'student_name', s.name,
        'submission', case when hs.id is null then null else jsonb_build_object(
          'status', hs.status, 'mark', hs.mark, 'feedback', hs.feedback, 'photo_url', hs.photo_url
        ) end
      ) order by s.name)
      from public.parent_student_links psl
      join public.students s on s.id = psl.student_id
      left join public.student_classes sc on sc.student_id = s.id and sc.class_id = h.class_id and sc.is_current = true
      left join public.homework_submissions hs on hs.homework_id = h.id and hs.student_id = s.id
      where psl.parent_id = caller
        and coalesce(psl.access_level, 'full') <> 'none'
        and s.deleted_at is null
        and (sc.student_id is not null or s.class_id = h.class_id)
    ), '[]'::jsonb)
  ) into result
  from public.homework h
  left join public.profiles p on p.id = h.teacher_id
  where h.id = p_homework_id
    and exists (
      select 1
      from public.parent_student_links psl
      join public.students s on s.id = psl.student_id
      left join public.student_classes sc on sc.student_id = s.id and sc.class_id = h.class_id and sc.is_current = true
      where psl.parent_id = caller
        and coalesce(psl.access_level, 'full') <> 'none'
        and s.deleted_at is null
        and (sc.student_id is not null or s.class_id = h.class_id)
    );

  if result is null then raise exception 'Homework not found or not authorized'; end if;
  return result;
end;
$$;

revoke all on function public.get_parent_homework_detail(uuid) from public,anon;
grant execute on function public.get_parent_homework_detail(uuid) to authenticated;

commit;
