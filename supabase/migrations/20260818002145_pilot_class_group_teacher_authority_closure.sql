-- Close the remaining legacy classes.teacher_id authority path on class groups.
-- Teacher authority is derived from current same-school teacher membership plus
-- canonical teacher_classes assignment. Group membership additionally requires
-- the learner to be currently enrolled in that exact class and school.

alter table public.class_groups enable row level security;
alter table public.class_group_members enable row level security;

revoke all privileges on table public.class_groups from anon, authenticated;
revoke all privileges on table public.class_group_members from anon, authenticated;
grant select, insert, update, delete on table public.class_groups to authenticated;
grant select, insert, update, delete on table public.class_group_members to authenticated;
grant all privileges on table public.class_groups to service_role;
grant all privileges on table public.class_group_members to service_role;

drop policy if exists "Teachers manage their class groups" on public.class_groups;
create policy "Teachers manage their class groups"
on public.class_groups
for all to authenticated
using (
  exists (
    select 1
    from public.classes c
    join public.teacher_classes tc
      on tc.class_id = c.id
     and tc.school_id = c.school_id
    join public.school_members sm
      on sm.school_id = c.school_id
     and sm.profile_id = tc.teacher_id
     and sm.role = 'teacher'
    where c.id = class_groups.class_id
      and tc.teacher_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.classes c
    join public.teacher_classes tc
      on tc.class_id = c.id
     and tc.school_id = c.school_id
    join public.school_members sm
      on sm.school_id = c.school_id
     and sm.profile_id = tc.teacher_id
     and sm.role = 'teacher'
    where c.id = class_groups.class_id
      and tc.teacher_id = (select auth.uid())
  )
);

drop policy if exists "Teachers manage group members" on public.class_group_members;
create policy "Teachers manage group members"
on public.class_group_members
for all to authenticated
using (
  exists (
    select 1
    from public.class_groups g
    join public.classes c on c.id = g.class_id
    join public.teacher_classes tc
      on tc.class_id = c.id
     and tc.school_id = c.school_id
    join public.school_members sm
      on sm.school_id = c.school_id
     and sm.profile_id = tc.teacher_id
     and sm.role = 'teacher'
    join public.student_classes sc
      on sc.student_id = class_group_members.student_id
     and sc.class_id = c.id
     and sc.school_id = c.school_id
     and sc.is_current = true
    where g.id = class_group_members.group_id
      and tc.teacher_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.class_groups g
    join public.classes c on c.id = g.class_id
    join public.teacher_classes tc
      on tc.class_id = c.id
     and tc.school_id = c.school_id
    join public.school_members sm
      on sm.school_id = c.school_id
     and sm.profile_id = tc.teacher_id
     and sm.role = 'teacher'
    join public.student_classes sc
      on sc.student_id = class_group_members.student_id
     and sc.class_id = c.id
     and sc.school_id = c.school_id
     and sc.is_current = true
    where g.id = class_group_members.group_id
      and tc.teacher_id = (select auth.uid())
  )
);