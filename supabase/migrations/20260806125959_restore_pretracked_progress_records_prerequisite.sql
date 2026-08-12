-- L0 prerequisite recovery: public.progress_records existed in production before
-- 20260806130000_teacher_execution_progress_authority.sql. Restore only the
-- pre-August-6 shape; that later migration still owns teaching_occurrence_id,
-- teacher_remarks, next_steps, their FK, and the new indexes.

create table if not exists public.progress_records (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid null,
  lesson_plan_id uuid null,
  class_id uuid null,
  subject_id uuid null,
  taught_date date not null default current_date,
  what_was_taught text not null,
  participation_score integer null,
  challenges text null,
  homework_set text null,
  created_at timestamptz null default now(),
  updated_at timestamptz null default now(),
  school_id uuid null,
  constraint lesson_notes_participation_score_check
    check (participation_score >= 1 and participation_score <= 5),
  constraint lesson_notes_teacher_id_fkey
    foreign key (teacher_id) references public.profiles(id) on delete cascade,
  constraint lesson_notes_lesson_plan_id_fkey
    foreign key (lesson_plan_id) references public.lesson_plans(id) on delete set null,
  constraint lesson_notes_class_id_fkey
    foreign key (class_id) references public.classes(id) on delete set null,
  constraint lesson_notes_school_id_fkey
    foreign key (school_id) references public.schools(id)
);
