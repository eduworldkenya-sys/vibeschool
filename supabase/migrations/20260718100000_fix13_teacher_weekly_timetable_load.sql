create or replace function public.get_teacher_weekly_timetable_load()
returns table (
  class_id         uuid,
  subject_id       uuid,
  class_name       text,
  stream           text,
  subject_name     text,
  grade            text,
  lessons_per_week integer,
  scheduled_count  integer,
  status           text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_teacher_id uuid := auth.uid();
  v_today      date := (now() at time zone 'Africa/Nairobi')::date;
begin
  if v_teacher_id is null then
    raise exception 'ASSIGNMENT_NOT_FOUND';
  end if;

  return query
  select
    tc.class_id,
    tc.subject_id,
    c.name as class_name,
    c.stream,
    s.name as subject_name,
    c.name as grade,
    swa.lessons_per_week,
    coalesce(cnt.scheduled_count, 0)::integer as scheduled_count,
    case
      when swa.lessons_per_week is null then 'NO_TARGET'
      when coalesce(cnt.scheduled_count, 0) = 0 then 'ZERO'
      when coalesce(cnt.scheduled_count, 0) < swa.lessons_per_week then 'UNDER'
      when coalesce(cnt.scheduled_count, 0) = swa.lessons_per_week then 'OK'
      else 'OVER'
    end as status
  from public.teacher_classes tc
  join public.classes c on c.id = tc.class_id
  join public.subjects s on s.id = tc.subject_id
  left join public.subject_weekly_allocations swa
    on swa.grade = c.name and swa.subject_label = s.name
  left join (
    select class_id, subject_id, count(*) as scheduled_count
    from public.timetable_slots
    where teacher_id = v_teacher_id
      and effective_from <= v_today
      and (effective_until is null or effective_until >= v_today)
    group by class_id, subject_id
  ) cnt on cnt.class_id = tc.class_id and cnt.subject_id = tc.subject_id
  where tc.teacher_id = v_teacher_id;
end;
$function$;
