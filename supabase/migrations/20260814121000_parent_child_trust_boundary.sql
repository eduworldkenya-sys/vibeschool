begin;

create or replace function public.get_parent_child_dashboard(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  result jsonb;
begin
  if caller is null then raise exception 'Authentication required'; end if;

  if not exists (
    select 1 from public.parent_student_links psl
    where psl.parent_id = caller
      and psl.student_id = p_student_id
      and coalesce(psl.access_level, 'full') <> 'none'
  ) then
    raise exception 'Child access not authorized';
  end if;

  select jsonb_build_object(
    'child', jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'class_name', coalesce(c.name || case when c.stream is not null then ' ' || c.stream else '' end, 'Class not assigned'),
      'school_name', coalesce(sc.name, 'School not assigned')
    ),
    'today_attendance', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'status', a.status, 'date', a.date) order by a.id)
      from public.attendance a
      where a.student_id = s.id and a.date = current_date
    ), '[]'::jsonb),
    'attendance', (
      select jsonb_build_object(
        'recorded', count(*)::int,
        'present', count(*) filter (where a.status = 'present')::int,
        'percentage', case when count(*) = 0 then null else round(100.0 * count(*) filter (where a.status = 'present') / count(*))::int end
      )
      from public.attendance a
      where a.student_id = s.id and a.date >= current_date - 30
    ),
    'mastery', coalesce((
      select jsonb_agg(jsonb_build_object('subject_id', x.subject_id, 'subject', coalesce(sub.name, 'Subject'), 'mastered', x.mastered, 'assessed', x.assessed, 'total', x.total) order by sub.name)
      from (
        select lo.subject_id,
          count(*)::int as total,
          count(*) filter (where lo.status = 'mastered')::int as mastered,
          count(*) filter (where lo.status in ('mastered','assessed'))::int as assessed
        from public.learner_outcomes lo
        where lo.student_id = s.id and lo.subject_id is not null
        group by lo.subject_id
      ) x
      left join public.subjects sub on sub.id = x.subject_id
    ), '[]'::jsonb)
  ) into result
  from public.students s
  left join public.classes c on c.id = s.class_id
  left join public.schools sc on sc.id = c.school_id
  where s.id = p_student_id;

  if result is null then raise exception 'Child not found'; end if;
  return result;
end;
$$;

revoke all on function public.get_parent_child_dashboard(uuid) from public, anon;
grant execute on function public.get_parent_child_dashboard(uuid) to authenticated;

comment on function public.get_parent_child_dashboard(uuid) is
'Parent-scoped child dashboard. Authorization is enforced inside the function before any child data is returned.';

commit;
