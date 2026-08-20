-- P0 pre-pilot exam authority hardening.
-- Exams are consequential school records. A teacher may manage only exams they
-- created inside an active school where they are an active school member and
-- their canonical Auth journey role is teacher.
-- School administrators retain school-scoped authority; other active members read only.
-- Anonymous clients have no table privileges.
-- access: school-scoped public.exams
-- authorization-test: public.exams

alter table public.exams enable row level security;

revoke all on table public.exams from anon;
revoke all on table public.exams from authenticated;
grant select, insert, update, delete on table public.exams to authenticated;

-- Retire overlapping historical policies whose OR-combination widened teacher
-- writes to any school_id when created_by matched auth.uid().
drop policy if exists "Admins manage exams" on public.exams;
drop policy if exists "School members view exams" on public.exams;
drop policy if exists exams_admin on public.exams;
drop policy if exists exams_member_read on public.exams;
drop policy if exists exams_teacher on public.exams;
drop policy if exists exams_admin_manage on public.exams;
drop policy if exists exams_teacher_insert on public.exams;
drop policy if exists exams_teacher_update on public.exams;
drop policy if exists exams_teacher_delete on public.exams;

-- Do not query school_members directly from RLS policy expressions. The table is
-- intentionally not readable by ordinary authenticated clients. Reuse the
-- canonical SECURITY DEFINER predicates that expose only boolean authorization
-- truth and already fail closed for anonymous callers.
create policy exams_member_read
on public.exams
for select
to authenticated
using (
  public.is_active_school_member(exams.school_id)
);

create policy exams_admin_manage
on public.exams
for all
to authenticated
using (
  public.is_school_admin(exams.school_id)
)
with check (
  public.is_school_admin(exams.school_id)
);

create policy exams_teacher_insert
on public.exams
for insert
to authenticated
with check (
  exams.created_by = (select auth.uid())
  and public.get_my_role() = 'teacher'
  and public.is_active_school_member(exams.school_id)
);

create policy exams_teacher_update
on public.exams
for update
to authenticated
using (
  exams.created_by = (select auth.uid())
  and public.get_my_role() = 'teacher'
  and public.is_active_school_member(exams.school_id)
)
with check (
  exams.created_by = (select auth.uid())
  and public.get_my_role() = 'teacher'
  and public.is_active_school_member(exams.school_id)
);

create policy exams_teacher_delete
on public.exams
for delete
to authenticated
using (
  exams.created_by = (select auth.uid())
  and public.get_my_role() = 'teacher'
  and public.is_active_school_member(exams.school_id)
);
