create table if not exists public.student_home_state (
  student_id uuid primary key references public.students(id) on delete cascade,
  last_opened_at timestamptz,
  changes_seen_through timestamptz,
  kcse_target_grade text,
  weekly_study_minutes integer not null default 300 check (weekly_study_minutes between 30 and 4200),
  preferred_session_minutes integer not null default 25 check (preferred_session_minutes between 10 and 180),
  preferred_study_time text not null default 'evening' check (preferred_study_time in ('morning','afternoon','evening','flexible')),
  subject_targets jsonb not null default '{}'::jsonb check (jsonb_typeof(subject_targets) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_home_state enable row level security;

create policy "student_home_state_select_own"
on public.student_home_state for select
to authenticated
using (exists (
  select 1 from public.students s
  where s.id = student_home_state.student_id
    and s.profile_id = auth.uid()
    and s.deleted_at is null
));

create policy "student_home_state_insert_own"
on public.student_home_state for insert
to authenticated
with check (exists (
  select 1 from public.students s
  where s.id = student_home_state.student_id
    and s.profile_id = auth.uid()
    and s.deleted_at is null
));

create policy "student_home_state_update_own"
on public.student_home_state for update
to authenticated
using (exists (
  select 1 from public.students s
  where s.id = student_home_state.student_id
    and s.profile_id = auth.uid()
    and s.deleted_at is null
))
with check (exists (
  select 1 from public.students s
  where s.id = student_home_state.student_id
    and s.profile_id = auth.uid()
    and s.deleted_at is null
));

-- Production function bodies are applied under migration
-- student_home_006_state_goals_and_recovery_plan.
-- Keep this file aligned with the live definitions when modifying the contract.

revoke all on function public.student_get_home_os_brief() from public, anon;
revoke all on function public.student_mark_home_opened() from public, anon;
revoke all on function public.student_acknowledge_home_changes() from public, anon;
revoke all on function public.student_update_home_preferences(text,integer,integer,text,jsonb) from public, anon;
grant execute on function public.student_get_home_os_brief() to authenticated;
grant execute on function public.student_mark_home_opened() to authenticated;
grant execute on function public.student_acknowledge_home_changes() to authenticated;
grant execute on function public.student_update_home_preferences(text,integer,integer,text,jsonb) to authenticated;
