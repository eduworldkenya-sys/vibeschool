-- L0 recovery prerequisite derived from repository live-schema evidence (2026-06-20)
-- and current production catalog inspection.
--
-- EXQ-002A references public.exam_question_bank, but no tracked CREATE TABLE
-- exists before 20260805024000 in the repository. Restore only the pre-tracked
-- question-bank contract required by the later canonical migrations.

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'exam_subject'
  ) then
    create type public.exam_subject as enum (
      'Mathematics','English','Biology','Chemistry','History',
      'Physics','Geography','Kiswahili','CRE','Business Studies'
    );
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'exam_form'
  ) then
    create type public.exam_form as enum ('Form 1','Form 2','Form 3','Form 4');
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'exam_difficulty'
  ) then
    create type public.exam_difficulty as enum ('easy','medium','hard');
  end if;
end
$$;

create table if not exists public.exam_question_bank (
  id uuid primary key default gen_random_uuid(),
  subject public.exam_subject not null,
  form public.exam_form not null,
  topic text not null,
  difficulty public.exam_difficulty not null,
  question text not null,
  options jsonb not null,
  correct_index integer not null,
  explanation text not null,
  teaching_note text not null,
  hint text,
  status text not null default 'active',
  times_served integer not null default 0,
  times_flagged integer not null default 0,
  source text not null default 'ai_generated',
  created_at timestamptz not null default now(),
  constraint exam_question_bank_correct_index_check
    check (correct_index >= 0 and correct_index <= 3),
  constraint exam_question_bank_status_check
    check (status in ('active','dismissed','under_review')),
  constraint exam_question_bank_source_check
    check (source in ('ai_generated','daily_drill_seed','manual'))
);

create index if not exists exam_bank_combo_idx
  on public.exam_question_bank(subject, form, topic, difficulty, status);

create index if not exists exam_bank_status_idx
  on public.exam_question_bank(status);
