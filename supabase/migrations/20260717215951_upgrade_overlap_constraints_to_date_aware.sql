-- RECONSTRUCTED 2026-07-19: upgrades the three overlap constraints to the
-- date-aware form. The constraint bodies below match the live database
-- verbatim (pg_get_constraintdef, verified 2026-07-19) — slots only conflict
-- when their effective date windows overlap, so expired or future revisions
-- of a slot never clash with the active one.

alter table public.timetable_slots drop constraint if exists excl_teacher_overlap;
alter table public.timetable_slots
  add constraint excl_teacher_overlap
  exclude using gist (
    teacher_id with =,
    day_of_week with =,
    tsrange(('2000-01-01'::date + start_time), ('2000-01-01'::date + end_time)) with &&,
    daterange(effective_from, effective_until, '[]') with &&
  );

alter table public.timetable_slots drop constraint if exists excl_class_overlap;
alter table public.timetable_slots
  add constraint excl_class_overlap
  exclude using gist (
    class_id with =,
    day_of_week with =,
    tsrange(('2000-01-01'::date + start_time), ('2000-01-01'::date + end_time)) with &&,
    daterange(effective_from, effective_until, '[]') with &&
  );

alter table public.timetable_slots drop constraint if exists excl_room_overlap;
alter table public.timetable_slots
  add constraint excl_room_overlap
  exclude using gist (
    school_id with =,
    room with =,
    day_of_week with =,
    tsrange(('2000-01-01'::date + start_time), ('2000-01-01'::date + end_time)) with &&,
    daterange(effective_from, effective_until, '[]') with &&
  )
  where (room is not null);
