-- TBL-011 reconstruction prerequisite.
--
-- The live schema already contained homework_questions and homework_answers before
-- EXQ-002A (20260805024000) began referencing homework_questions. The tracked
-- migration chain had no CREATE TABLE for either object, so a blank rebuild could
-- not reproduce the live state. Keep this compatibility migration idempotent: on
-- an existing/live database it is a schema no-op; on a blank replay it restores
-- only the historical shape required by later canonical migrations.

create table if not exists public.homework_questions (
  id uuid primary key default gen_random_uuid(),
  homework_id uuid not null references public.homework(id) on delete cascade,
  question text not null,
  order_num integer not null,
  model_answer text,
  created_at timestamptz not null default now()
);

create index if not exists idx_homework_questions_homework
  on public.homework_questions(homework_id);

create table if not exists public.homework_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.homework_submissions(id) on delete cascade,
  question_id uuid not null references public.homework_questions(id) on delete cascade,
  answer_text text,
  created_at timestamptz not null default now()
);

create index if not exists idx_homework_answers_submission
  on public.homework_answers(submission_id);

create index if not exists idx_homework_answers_question
  on public.homework_answers(question_id);
