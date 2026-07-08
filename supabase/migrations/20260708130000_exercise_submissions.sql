create table if not exists exercise_submissions (
  id           uuid primary key default gen_random_uuid(),
  exercise_id  uuid not null references exercises(id) on delete cascade,
  student_id   uuid references students(id) on delete cascade,
  photo_url    text,
  notes        text,
  mark         numeric,
  feedback     text,
  status       text not null default 'pending' check (status in ('pending', 'submitted', 'marked')),
  submitted_at timestamptz,
  created_at   timestamptz default now(),
  unique (exercise_id, student_id)
);
create index if not exists idx_exercise_submissions_exercise_id on exercise_submissions(exercise_id);

alter table exercise_submissions enable row level security;

create policy "teacher manages own exercise_submissions" on exercise_submissions
  for all using (exists (select 1 from exercises e where e.id = exercise_id and e.teacher_id = auth.uid()))
  with check (exists (select 1 from exercises e where e.id = exercise_id and e.teacher_id = auth.uid()));

create policy "exercise_submissions_student_read" on exercise_submissions
  for select using (student_id = auth.uid());
create policy "exercise_submissions_student_insert" on exercise_submissions
  for insert with check (student_id = auth.uid());
create policy "exercise_submissions_parent_read" on exercise_submissions
  for select using (
    exists (select 1 from parent_student_links psl where psl.student_id = exercise_submissions.student_id and psl.parent_id = auth.uid())
  );
