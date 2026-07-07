-- Closes the Teacher OS graph gaps: Lesson Plan -> Homework -> Assessment/Exercise/Project
-- All additive + idempotent. Safe to run even if some columns already exist.

-- ─── 1. homework.lesson_plan_id (real FK, replaces fuzzy class+subject match) ──
alter table homework add column if not exists lesson_plan_id uuid references lesson_plans(id) on delete set null;
create index if not exists idx_homework_lesson_plan_id on homework(lesson_plan_id);

-- Best-effort backfill for existing rows saved before this column existed —
-- matches the same class_id + subject the old trigger was guessing with.
update homework h
set lesson_plan_id = lp.id
from lesson_plans lp
join subjects s on s.id = lp.subject_id
where h.lesson_plan_id is null
  and h.class_id = lp.class_id
  and s.name = h.subject
  and lp.created_at = (
    select max(lp2.created_at) from lesson_plans lp2
    join subjects s2 on s2.id = lp2.subject_id
    where lp2.class_id = h.class_id and s2.name = h.subject and lp2.created_at <= h.created_at
  );

-- ─── 2. lesson_plans.curriculum_id (Curriculum -> Lesson Plan, direct) ──────────
alter table lesson_plans add column if not exists curriculum_id uuid references curriculum(id) on delete set null;
create index if not exists idx_lesson_plans_curriculum_id on lesson_plans(curriculum_id);

-- scheme_of_work is superseded by lesson_plans.curriculum_id above.
-- Not dropping it (existing rows may still be read somewhere) — just no
-- longer part of the active write path. Do not add new features against it.
comment on table scheme_of_work is 'DEPRECATED 2026-07-05: superseded by lesson_plans.curriculum_id. Do not write new data here.';

-- ─── 3. Fix sync_homework_evidence(): use the real FK, drop the guess ───────────
create or replace function sync_homework_evidence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id   uuid;
  v_teacher_id uuid;
  v_title      text;
  v_lesson_id  uuid;
begin
  if NEW.status = 'marked' and (OLD.status is distinct from 'marked') then
    select class_id, teacher_id, title, lesson_plan_id
      into v_class_id, v_teacher_id, v_title, v_lesson_id
      from homework where id = NEW.homework_id;

    insert into lesson_evidence (
      lesson_id, class_id, teacher_id, student_id,
      evidence_type, title, description, media_url, score,
      submission_id, homework_id
    ) values (
      v_lesson_id, v_class_id, v_teacher_id, NEW.student_id,
      'homework', v_title, NEW.feedback, NEW.photo_url, NEW.mark,
      NEW.id, NEW.homework_id
    )
    on conflict (submission_id) do update set
      score       = excluded.score,
      description = excluded.description,
      media_url   = excluded.media_url,
      lesson_id   = excluded.lesson_id;
  end if;
  return NEW;
end;
$$;
-- trigger itself (trg_sync_homework_evidence on homework_submissions) is untouched —
-- this just replaces the function body it calls.

-- ─── 4. assessments (Homework -> Assessment) ────────────────────────────────────
create table if not exists assessments (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid references schools(id) on delete set null,
  class_id       uuid references classes(id) on delete set null,
  subject_id     uuid references subjects(id) on delete set null,
  teacher_id     uuid references profiles(id) on delete set null,
  lesson_plan_id uuid references lesson_plans(id) on delete set null,
  homework_id    uuid references homework(id) on delete set null,
  title          text not null,
  type           text not null default 'formative' check (type in ('formative', 'summative', 'cbc_rubric')),
  term           integer,
  week           integer,
  status         text not null default 'draft' check (status in ('draft', 'published', 'graded')),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);
create index if not exists idx_assessments_lesson_plan_id on assessments(lesson_plan_id);
create index if not exists idx_assessments_homework_id on assessments(homework_id);
create index if not exists idx_assessments_class_id on assessments(class_id);

create table if not exists assessment_scores (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessments(id) on delete cascade,
  student_id    uuid references students(id) on delete cascade,
  rubric_level  text check (rubric_level in ('EE', 'ME', 'AE', 'BE')),
  score         numeric,
  remarks       text,
  created_at    timestamptz default now(),
  unique (assessment_id, student_id)
);
create index if not exists idx_assessment_scores_assessment_id on assessment_scores(assessment_id);
create index if not exists idx_assessment_scores_student_id on assessment_scores(student_id);

-- ─── 5. exercises (Lesson Plan -> in-class practice, distinct from take-home hw) ─
create table if not exists exercises (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid references schools(id) on delete set null,
  class_id         uuid references classes(id) on delete set null,
  subject_id       uuid references subjects(id) on delete set null,
  teacher_id       uuid references profiles(id) on delete set null,
  lesson_plan_id   uuid references lesson_plans(id) on delete set null,
  title            text not null,
  instructions     text,
  duration_minutes integer,
  status           text not null default 'draft' check (status in ('draft', 'active', 'completed')),
  created_at       timestamptz default now()
);
create index if not exists idx_exercises_lesson_plan_id on exercises(lesson_plan_id);
create index if not exists idx_exercises_class_id on exercises(class_id);

-- ─── 6. projects (Curriculum / Lesson Plan -> multi-week project work) ──────────
create table if not exists projects (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid references schools(id) on delete set null,
  class_id       uuid references classes(id) on delete set null,
  subject_id     uuid references subjects(id) on delete set null,
  teacher_id     uuid references profiles(id) on delete set null,
  curriculum_id  uuid references curriculum(id) on delete set null,
  lesson_plan_id uuid references lesson_plans(id) on delete set null,
  title          text not null,
  description    text,
  start_date     date,
  due_date       date,
  status         text not null default 'draft' check (status in ('draft', 'active', 'submitted', 'graded')),
  created_at     timestamptz default now()
);
create index if not exists idx_projects_curriculum_id on projects(curriculum_id);
create index if not exists idx_projects_class_id on projects(class_id);

create table if not exists project_submissions (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  student_id   uuid references students(id) on delete cascade,
  photo_url    text,
  notes        text,
  mark         numeric,
  feedback     text,
  status       text not null default 'pending' check (status in ('pending', 'submitted', 'marked')),
  submitted_at timestamptz,
  created_at   timestamptz default now(),
  unique (project_id, student_id)
);
create index if not exists idx_project_submissions_project_id on project_submissions(project_id);

-- ─── 7. RLS — teacher-owns-row only for now. Extend to parent/student read once
--     you decide what each portal should see (matches unknowns flagged in review).
alter table assessments enable row level security;
alter table assessment_scores enable row level security;
alter table exercises enable row level security;
alter table projects enable row level security;
alter table project_submissions enable row level security;

create policy "teacher manages own assessments" on assessments
  for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

create policy "teacher manages own assessment_scores" on assessment_scores
  for all using (exists (select 1 from assessments a where a.id = assessment_id and a.teacher_id = auth.uid()))
  with check (exists (select 1 from assessments a where a.id = assessment_id and a.teacher_id = auth.uid()));

create policy "teacher manages own exercises" on exercises
  for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

create policy "teacher manages own projects" on projects
  for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

create policy "teacher manages own project_submissions" on project_submissions
  for all using (exists (select 1 from projects p where p.id = project_id and p.teacher_id = auth.uid()))
  with check (exists (select 1 from projects p where p.id = project_id and p.teacher_id = auth.uid()));
