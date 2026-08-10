create table if not exists lesson_reflections (
  id              uuid primary key default gen_random_uuid(),
  lesson_id       uuid not null references lesson_plans(id) on delete cascade,
  lesson_plan_id  uuid not null references lesson_plans(id) on delete cascade,
  teacher_id      uuid references profiles(id) on delete set null,
  class_id        uuid references classes(id) on delete set null,
  subject_id      uuid references subjects(id) on delete set null,
  school_id       uuid references schools(id) on delete set null,
  reflection_text text,
  engagement      text check (engagement in ('low', 'medium', 'high')),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (lesson_plan_id)
);
create index if not exists idx_lesson_reflections_lesson_plan_id on lesson_reflections(lesson_plan_id);

alter table lesson_reflections enable row level security;
create policy "teacher manages own reflections" on lesson_reflections
  for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

alter table lesson_plans add column if not exists previous_lesson_plan_id uuid references lesson_plans(id) on delete set null;
create index if not exists idx_lesson_plans_previous_lesson_plan_id on lesson_plans(previous_lesson_plan_id);
