begin;

-- Canonical final Home projection. A usable parent-child relationship is the
-- only source of child visibility; duplicate historical links are collapsed.
create or replace function public.get_parent_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  payload jsonb;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = caller and p.role = 'parent'
  ) then
    raise exception 'Parent access required';
  end if;

  select jsonb_build_object(
    'children', coalesce((
      select jsonb_agg(child_row order by child_name)
      from (
        select distinct on (s.id)
          s.id as child_id,
          s.name as child_name,
          coalesce(c.name || case when c.stream is not null then ' ' || c.stream else '' end, 'Class not assigned') as class_name,
          coalesce(sc.name, 'School not assigned') as school_name,
          coalesce(att.recorded_count, 0) as attendance_recorded,
          att.attendance_pct,
          case
            when s.deleted_at is not null then 'unavailable'
            when s.class_id is null then 'waiting'
            when coalesce(att.recorded_count, 0) < 5 then 'insufficient_data'
            when att.attendance_pct < 80 then 'needs_attention'
            else 'attendance_on_track'
          end as status,
          case
            when s.deleted_at is not null then 'No longer available'
            when s.class_id is null then 'Waiting for school'
            when coalesce(att.recorded_count, 0) < 5 then 'Not enough recent data'
            when att.attendance_pct < 80 then 'Attendance needs attention'
            else 'Attendance on track'
          end as status_label
        from public.parent_student_links psl
        join public.students s on s.id = psl.student_id
        left join public.classes c on c.id = s.class_id
        left join public.schools sc on sc.id = c.school_id
        left join lateral (
          select count(*)::int as recorded_count,
            round(100.0 * count(*) filter (where a.status = 'present') / nullif(count(*), 0))::int as attendance_pct
          from public.attendance a
          where a.student_id = s.id and a.date >= current_date - 30
        ) att on true
        where psl.parent_id = caller
          and coalesce(psl.access_level, 'full') <> 'none'
        order by s.id, psl.is_primary desc nulls last, psl.updated_at desc nulls last, psl.created_at desc nulls last
      ) child_row
    ), '[]'::jsonb),
    'attention', coalesce((
      select jsonb_agg(item order by priority, child_name)
      from (
        select distinct on (s.id)
          1 as priority,
          s.name as child_name,
          jsonb_build_object(
            'type', 'attendance',
            'student_id', s.id,
            'title', s.name || '''s attendance needs attention',
            'detail', att.attendance_pct || '% attendance recorded in the last 30 days'
          ) as item
        from public.parent_student_links psl
        join public.students s on s.id = psl.student_id
        cross join lateral (
          select count(*)::int as recorded_count,
            round(100.0 * count(*) filter (where a.status = 'present') / nullif(count(*), 0))::int as attendance_pct
          from public.attendance a
          where a.student_id = s.id and a.date >= current_date - 30
        ) att
        where psl.parent_id = caller
          and coalesce(psl.access_level, 'full') <> 'none'
          and s.deleted_at is null
          and s.class_id is not null
          and att.recorded_count >= 5
          and att.attendance_pct < 80
        order by s.id, psl.is_primary desc nulls last, psl.updated_at desc nulls last, psl.created_at desc nulls last
      ) attention_row
    ), '[]'::jsonb)
  ) into payload;

  return payload;
end;
$$;

revoke all on function public.get_parent_dashboard() from public, anon;
grant execute on function public.get_parent_dashboard() to authenticated;

comment on function public.get_parent_dashboard() is
'Parent-scoped dashboard summary. Only usable parent-child links are included; duplicate historical links are collapsed; deleted children do not generate attention; missing evidence is never treated as positive evidence.';

commit;
