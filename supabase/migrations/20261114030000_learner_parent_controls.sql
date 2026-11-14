-- Parent-managed learner preferences. Settings are guidance, not an account activation gate.
create table if not exists public.learner_parent_controls (
  student_id uuid primary key references public.students(id) on delete cascade,
  updated_by uuid not null references auth.users(id),
  age_band text not null default 'primary' check(age_band in ('junior','primary','teen')),
  focus_recommended boolean not null default false,
  quiet_hours_enabled boolean not null default false,
  quiet_start time not null default '21:00',
  quiet_end time not null default '07:00',
  study_target_minutes integer not null default 60 check(study_target_minutes between 15 and 240),
  community_allowed boolean not null default false,
  messages_allowed boolean not null default false,
  purchase_approval_required boolean not null default true,
  progress_summary_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.learner_parent_controls enable row level security;
revoke all on public.learner_parent_controls from anon;
grant select,insert,update on public.learner_parent_controls to authenticated;
drop policy if exists learner_parent_controls_guardian_read on public.learner_parent_controls;
create policy learner_parent_controls_guardian_read on public.learner_parent_controls for select to authenticated
using (exists(select 1 from public.parent_student_links l where l.parent_id=auth.uid() and l.student_id=learner_parent_controls.student_id and coalesce(l.access_level,'full')<>'none'));
drop policy if exists learner_parent_controls_guardian_insert on public.learner_parent_controls;
create policy learner_parent_controls_guardian_insert on public.learner_parent_controls for insert to authenticated
with check(updated_by=auth.uid() and exists(select 1 from public.parent_student_links l where l.parent_id=auth.uid() and l.student_id=learner_parent_controls.student_id and coalesce(l.access_level,'full')<>'none'));
drop policy if exists learner_parent_controls_guardian_update on public.learner_parent_controls;
create policy learner_parent_controls_guardian_update on public.learner_parent_controls for update to authenticated
using (exists(select 1 from public.parent_student_links l where l.parent_id=auth.uid() and l.student_id=learner_parent_controls.student_id and coalesce(l.access_level,'full')<>'none'))
with check(updated_by=auth.uid() and exists(select 1 from public.parent_student_links l where l.parent_id=auth.uid() and l.student_id=learner_parent_controls.student_id and coalesce(l.access_level,'full')<>'none'));
-- Student may read parent guidance for their own linked identity only, never edit it.
-- Learner identity is not always auth.uid(); use canonical student.user_id when present in deployment.
comment on table public.learner_parent_controls is 'Parent preferences; not device-wide blocking, paid transaction enforcement, or a replacement for guardian consent.';
