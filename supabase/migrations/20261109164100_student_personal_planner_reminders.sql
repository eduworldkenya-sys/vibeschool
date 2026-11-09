alter table public.student_personal_planner
  add column if not exists reminder_minutes integer
    check (reminder_minutes in (0,5,15,30,60,1440)),
  add column if not exists reminder_seen_occurrence_at timestamptz;
comment on column public.student_personal_planner.reminder_minutes is
'Optional reminder offset before the start time, or deadline when no start exists. Null disables reminders.';
comment on column public.student_personal_planner.reminder_seen_occurrence_at is
'Last scheduled occurrence acknowledged by learner; recurring occurrences remain eligible.';