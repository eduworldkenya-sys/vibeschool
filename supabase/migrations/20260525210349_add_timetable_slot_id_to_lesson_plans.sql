alter table lesson_plans
  add column if not exists timetable_slot_id uuid references timetable_slots(id) on delete set null;

create index if not exists lesson_plans_timetable_slot_id_idx
  on lesson_plans(timetable_slot_id);
