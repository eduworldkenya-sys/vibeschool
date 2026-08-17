-- Restored from production Supabase migration version 20260812082409.
--
-- Blank-rebuild prelude: production already had public.meetings when this
-- migration originally ran, but its CREATE TABLE was never tracked. Keeping the
-- prerequisite inside this already-applied production version makes local
-- replay reproducible without inventing a migration version that a future
-- production push could try to apply.
-- authorization-test: public.meetings

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  title text not null,
  description text,
  meeting_type text default 'staff' check (meeting_type = any (array['staff'::text,'department'::text,'parents'::text,'board'::text,'emergency'::text])),
  status text default 'scheduled' check (status = any (array['scheduled'::text,'live'::text,'completed'::text,'cancelled'::text])),
  chair_id uuid references public.profiles(id),
  secretary_id uuid references public.profiles(id),
  venue text,
  meeting_link text,
  scheduled_at timestamptz not null,
  duration_mins integer default 60,
  started_at timestamptz,
  ended_at timestamptz,
  confidentiality text default 'staff_only' check (confidentiality = any (array['public'::text,'staff_only'::text,'board_only'::text])),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.meetings enable row level security;
revoke all privileges on table public.meetings from anon, authenticated;
grant select, insert, update, delete on table public.meetings to authenticated;
grant all privileges on table public.meetings to service_role;

-- The statements below are the recovered production security body. Historical
-- learner-domain mistakes are intentionally corrected only by the forward
-- 20260818013000 repair; rewriting the recovered body would hide provenance.
drop policy if exists mastery_teacher_read on public.student_outcome_mastery;
create policy mastery_teacher_read on public.student_outcome_mastery
for select to authenticated
using (
  exists (
    select 1
    from public.student_classes sc
    join public.teacher_classes tc
      on tc.class_id = sc.class_id
     and tc.school_id = sc.school_id
    where sc.student_id = student_outcome_mastery.student_id
      and sc.is_current = true
      and tc.teacher_id = auth.uid()
  )
);

drop policy if exists school_members_insert_self on public.school_members;
revoke insert on public.school_members from anon, authenticated;

drop policy if exists allow_delete_meetings on public.meetings;
drop policy if exists allow_select_meetings on public.meetings;
drop policy if exists allow_update_meetings on public.meetings;
drop policy if exists "authenticated users can insert meetings" on public.meetings;
drop policy if exists meetings_select_authorized on public.meetings;
drop policy if exists meetings_insert_member on public.meetings;
drop policy if exists meetings_update_authorized on public.meetings;
drop policy if exists meetings_delete_authorized on public.meetings;
create policy meetings_select_authorized on public.meetings
for select to authenticated
using (
  created_by = auth.uid()
  or chair_id = auth.uid()
  or secretary_id = auth.uid()
  or (school_id is not null and exists (
    select 1 from public.school_members sm
    where sm.school_id = meetings.school_id and sm.profile_id = auth.uid()
  ))
);
create policy meetings_insert_member on public.meetings
for insert to authenticated
with check (
  created_by = auth.uid() and school_id is not null and exists (
    select 1 from public.school_members sm
    where sm.school_id = meetings.school_id and sm.profile_id = auth.uid()
  )
);
create policy meetings_update_authorized on public.meetings
for update to authenticated
using (
  created_by = auth.uid()
  or (school_id is not null and exists (
    select 1 from public.school_members sm
    where sm.school_id = meetings.school_id and sm.profile_id = auth.uid()
      and sm.role in ('owner','admin')
  ))
)
with check (
  created_by = auth.uid()
  or (school_id is not null and exists (
    select 1 from public.school_members sm
    where sm.school_id = meetings.school_id and sm.profile_id = auth.uid()
      and sm.role in ('owner','admin')
  ))
);
create policy meetings_delete_authorized on public.meetings
for delete to authenticated
using (
  created_by = auth.uid()
  or (school_id is not null and exists (
    select 1 from public.school_members sm
    where sm.school_id = meetings.school_id and sm.profile_id = auth.uid()
      and sm.role in ('owner','admin')
  ))
);

drop policy if exists student_exam_readiness_insert_own on public.student_exam_readiness_state;
drop policy if exists student_exam_readiness_select_own on public.student_exam_readiness_state;
drop policy if exists student_exam_readiness_update_own on public.student_exam_readiness_state;
create policy student_exam_readiness_insert_own on public.student_exam_readiness_state for insert to authenticated with check (exists (select 1 from public.students s where s.id=student_exam_readiness_state.student_id and s.profile_id=auth.uid() and s.deleted_at is null));
create policy student_exam_readiness_select_own on public.student_exam_readiness_state for select to authenticated using (exists (select 1 from public.students s where s.id=student_exam_readiness_state.student_id and s.profile_id=auth.uid() and s.deleted_at is null));
create policy student_exam_readiness_update_own on public.student_exam_readiness_state for update to authenticated using (exists (select 1 from public.students s where s.id=student_exam_readiness_state.student_id and s.profile_id=auth.uid() and s.deleted_at is null)) with check (exists (select 1 from public.students s where s.id=student_exam_readiness_state.student_id and s.profile_id=auth.uid() and s.deleted_at is null));

drop policy if exists student_kcse_error_classifications_insert on public.student_kcse_error_classifications;
drop policy if exists student_kcse_error_classifications_select on public.student_kcse_error_classifications;
drop policy if exists student_kcse_error_classifications_update on public.student_kcse_error_classifications;
create policy student_kcse_error_classifications_insert on public.student_kcse_error_classifications for insert to authenticated with check (exists (select 1 from public.students s where s.id=student_kcse_error_classifications.student_id and s.profile_id=auth.uid() and s.deleted_at is null));
create policy student_kcse_error_classifications_select on public.student_kcse_error_classifications for select to authenticated using (exists (select 1 from public.students s where s.id=student_kcse_error_classifications.student_id and s.profile_id=auth.uid() and s.deleted_at is null));
create policy student_kcse_error_classifications_update on public.student_kcse_error_classifications for update to authenticated using (exists (select 1 from public.students s where s.id=student_kcse_error_classifications.student_id and s.profile_id=auth.uid() and s.deleted_at is null)) with check (exists (select 1 from public.students s where s.id=student_kcse_error_classifications.student_id and s.profile_id=auth.uid() and s.deleted_at is null));

drop policy if exists student_mistakes_select_own on public.student_mistake_notebook;
create policy student_mistakes_select_own on public.student_mistake_notebook for select to authenticated using (exists (select 1 from public.students s where s.id=student_mistake_notebook.student_id and s.profile_id=auth.uid() and s.deleted_at is null));
