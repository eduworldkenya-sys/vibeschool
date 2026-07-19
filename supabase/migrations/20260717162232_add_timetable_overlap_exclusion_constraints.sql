-- RECONSTRUCTED 2026-07-19: this migration was applied to the live DB on
-- 2026-07-17 but its file was lost from the repo. Reconstructed from live
-- history so a clean deployment reproduces the schema. Original form created
-- the three overlap exclusion constraints WITHOUT date-range awareness;
-- 20260717215951 upgrades them to the date-aware form (the live definition).

create extension if not exists btree_gist;

alter table public.timetable_slots
  add constraint excl_teacher_overlap
  exclude using gist (
    teacher_id with =,
    day_of_week with =,
    tsrange(('2000-01-01'::date + start_time), ('2000-01-01'::date + end_time)) with &&
  );

alter table public.timetable_slots
  add constraint excl_class_overlap
  exclude using gist (
    class_id with =,
    day_of_week with =,
    tsrange(('2000-01-01'::date + start_time), ('2000-01-01'::date + end_time)) with &&
  );

alter table public.timetable_slots
  add constraint excl_room_overlap
  exclude using gist (
    school_id with =,
    room with =,
    day_of_week with =,
    tsrange(('2000-01-01'::date + start_time), ('2000-01-01'::date + end_time)) with &&
  )
  where (room is not null);
