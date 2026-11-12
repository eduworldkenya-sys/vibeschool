-- TBL-013: read-only preflight for the original pending 20261112150000 migration.
-- Never expose participant identifiers or silently repair existing bookings.
-- Any conflict blocks deployment; rerun against production immediately before approval.
with tuition_pairs as (
  select a.id as a_id, b.id as b_id
  from public.vibetutor_lessons a
  join public.vibetutor_lessons b
    on a.id < b.id
   and a.status = 'scheduled'
   and b.status = 'scheduled'
   and (a.tutor_id = b.tutor_id or a.student_id = b.student_id)
   and a.starts_at < b.ends_at and a.ends_at > b.starts_at
),
cross_pairs as (
  select l.id as tuition_id, s.id as school_slot_id
  from public.vibetutor_lessons l
  join public.timetable_slots s
    on (s.teacher_id = l.tutor_id or exists (
      select 1 from public.student_classes sc
      where sc.student_id = l.student_id
        and sc.class_id = s.class_id
        and sc.school_id = s.school_id
        and sc.is_current and sc.left_at is null
    ))
  where l.status = 'scheduled'
    and exists (
      select 1
      from pg_catalog.generate_series(
        ((l.starts_at at time zone 'Africa/Nairobi')::date - 1)::timestamp,
        ((l.ends_at at time zone 'Africa/Nairobi')::date)::timestamp,
        interval '1 day'
      ) as d(local_day)
      where extract(isodow from d.local_day)::int = s.day_of_week
        and d.local_day::date >= s.effective_from
        and (s.effective_until is null or d.local_day::date <= s.effective_until)
        and s.start_time < s.end_time
        and l.starts_at < ((d.local_day::date + s.end_time) at time zone 'Africa/Nairobi')
        and l.ends_at > ((d.local_day::date + s.start_time) at time zone 'Africa/Nairobi')
        and not exists (
          select 1 from public.school_calendar_exceptions ce
          where ce.school_id = s.school_id
            and ce.exception_date = d.local_day::date
            and ce.suppress_ordinary_teaching = true
        )
    )
)
select (select count(*) from tuition_pairs)::bigint as tuition_tuition_conflicts,
       (select count(*) from cross_pairs)::bigint as school_tuition_conflicts;
