-- Pilot Authority Chain Certification: close teacher_classes self-assignment authority bypass.
-- teacher_classes is an authority root consumed by downstream classroom RLS.
-- Only school owner/admin authority may create, change, or delete assignments.
-- Teachers retain read access to their own legitimate assignments.

alter table public.teacher_classes enable row level security;

-- Remove direct mutation authority from ordinary clients. RLS is defense in depth,
-- while grants make the table read-only to authenticated users over the Data API.
revoke insert, update, delete, truncate, references, trigger
  on table public.teacher_classes
  from anon, authenticated;
revoke select on table public.teacher_classes from anon;
grant select on table public.teacher_classes to authenticated;
grant select, insert, update, delete on table public.teacher_classes to service_role;

-- Replace policies that allowed teachers to manufacture or mutate their own authority.
drop policy if exists pol_teacher_classes_insert on public.teacher_classes;
drop policy if exists pol_teacher_classes_update on public.teacher_classes;
drop policy if exists pol_teacher_classes_delete on public.teacher_classes;
drop policy if exists pol_teacher_classes_select on public.teacher_classes;

create policy pol_teacher_classes_select
on public.teacher_classes
for select
to authenticated
using (
  teacher_id = (select auth.uid())
  or exists (
    select 1
    from public.school_members sm
    where sm.school_id = teacher_classes.school_id
      and sm.profile_id = (select auth.uid())
      and sm.role in ('owner'::public.member_role, 'admin'::public.member_role)
  )
);

-- These mutation policies intentionally require school owner/admin authority.
-- Direct authenticated mutation grants are revoked above; the policies preserve
-- the invariant for trusted/server paths that explicitly assume authenticated.
create policy pol_teacher_classes_insert
on public.teacher_classes
for insert
to authenticated
with check (
  exists (
    select 1
    from public.school_members actor
    where actor.school_id = teacher_classes.school_id
      and actor.profile_id = (select auth.uid())
      and actor.role in ('owner'::public.member_role, 'admin'::public.member_role)
  )
  and exists (
    select 1
    from public.school_members teacher_member
    where teacher_member.school_id = teacher_classes.school_id
      and teacher_member.profile_id = teacher_classes.teacher_id
      and teacher_member.role = 'teacher'::public.member_role
  )
);

create policy pol_teacher_classes_update
on public.teacher_classes
for update
to authenticated
using (
  exists (
    select 1
    from public.school_members actor
    where actor.school_id = teacher_classes.school_id
      and actor.profile_id = (select auth.uid())
      and actor.role in ('owner'::public.member_role, 'admin'::public.member_role)
  )
)
with check (
  exists (
    select 1
    from public.school_members actor
    where actor.school_id = teacher_classes.school_id
      and actor.profile_id = (select auth.uid())
      and actor.role in ('owner'::public.member_role, 'admin'::public.member_role)
  )
  and exists (
    select 1
    from public.school_members teacher_member
    where teacher_member.school_id = teacher_classes.school_id
      and teacher_member.profile_id = teacher_classes.teacher_id
      and teacher_member.role = 'teacher'::public.member_role
  )
);

create policy pol_teacher_classes_delete
on public.teacher_classes
for delete
to authenticated
using (
  exists (
    select 1
    from public.school_members actor
    where actor.school_id = teacher_classes.school_id
      and actor.profile_id = (select auth.uid())
      and actor.role in ('owner'::public.member_role, 'admin'::public.member_role)
  )
);

-- Existing production assignments must already satisfy teacher school membership.
do $$
begin
  if exists (
    select 1
    from public.teacher_classes tc
    where not exists (
      select 1
      from public.school_members sm
      where sm.school_id = tc.school_id
        and sm.profile_id = tc.teacher_id
        and sm.role = 'teacher'::public.member_role
    )
  ) then
    raise exception 'teacher_classes contains assignments without matching teacher school membership';
  end if;
end
$$;
