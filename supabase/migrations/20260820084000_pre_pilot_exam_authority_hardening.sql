-- P0 pre-pilot exam authority hardening.
-- Exams are consequential school records. A teacher may manage only exams they
-- created inside an active school where they are an active teacher member.
-- School administrators retain school-scoped authority; other members read only.
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

create policy exams_member_read
on public.exams
for select
to authenticated
using (
  exists (
    select 1
    from public.school_members sm
    join public.schools s on s.id = sm.school_id
    where sm.school_id = exams.school_id
      and sm.profile_id = (select auth.uid())
      and s.status = 'active'::public.school_status
      and s.deleted_at is null
  )
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
  and exists (
    select 1
    from public.school_members sm
    join public.schools s on s.id = sm.school_id
    where sm.school_id = exams.school_id
      and sm.profile_id = (select auth.uid())
      and sm.role = 'teacher'::public.member_role
      and s.status = 'active'::public.school_status
      and s.deleted_at is null
  )
);

create policy exams_teacher_update
on public.exams
for update
to authenticated
using (
  exams.created_by = (select auth.uid())
  and exists (
    select 1
    from public.school_members sm
    join public.schools s on s.id = sm.school_id
    where sm.school_id = exams.school_id
      and sm.profile_id = (select auth.uid())
      and sm.role = 'teacher'::public.member_role
      and s.status = 'active'::public.school_status
      and s.deleted_at is null
  )
)
with check (
  exams.created_by = (select auth.uid())
  and exists (
    select 1
    from public.school_members sm
    join public.schools s on s.id = sm.school_id
    where sm.school_id = exams.school_id
      and sm.profile_id = (select auth.uid())
      and sm.role = 'teacher'::public.member_role
      and s.status = 'active'::public.school_status
      and s.deleted_at is null
  )
);

create policy exams_teacher_delete
on public.exams
for delete
to authenticated
using (
  exams.created_by = (select auth.uid())
  and exists (
    select 1
    from public.school_members sm
    join public.schools s on s.id = sm.school_id
    where sm.school_id = exams.school_id
      and sm.profile_id = (select auth.uid())
      and sm.role = 'teacher'::public.member_role
      and s.status = 'active'::public.school_status
      and s.deleted_at is null
  )
);
