-- L0 recovery: restore pretracked homework feedback release timestamp.
-- Production proves this nullable timestamptz column exists on homework_submissions,
-- while no tracked migration before STUDENT-TASK-004BCD creates it.

alter table public.homework_submissions
  add column if not exists feedback_released_at timestamptz;
