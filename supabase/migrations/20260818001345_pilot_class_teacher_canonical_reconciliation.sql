-- Canonicalize legacy class-teacher assignments only when current authority and
-- subject identity are unambiguous. This version is already recorded in
-- production via the Supabase migration ledger.
--
-- Important replay ordering note: this migration version sorts before
-- 20260818013000_pilot_identity_domain_semantic_repair.sql. The later migration
-- must therefore preserve the same final join_requests_teacher policy semantics.

-- 1. Promote an existing exact teacher/class/subject assignment when one exists.
with legacy as (
  select c.id as class_id, c.school_id, c.teacher_id, c.subject
  from public.classes c
  where c.teacher_id is not null
    and not exists (
      select 1
      from public.teacher_classes existing_class_teacher
      where existing_class_teacher.class_id = c.id
        and existing_class_teacher.school_id = c.school_id
        and existing_class_teacher.is_class_teacher = true
    )
), eligible as (
  select l.*
  from legacy l
  where exists (
    select 1
    from public.school_members sm
    where sm.school_id = l.school_id
      and sm.profile_id = l.teacher_id
      and sm.role = 'teacher'
  )
), resolved as (
  select e.*,
    case
      when (
        select count(*)
        from public.subjects s
        where s.school_id = e.school_id
          and lower(trim(s.name)) = lower(trim(e.subject))
      ) = 1
      then (
        select s.id
        from public.subjects s
        where s.school_id = e.school_id
          and lower(trim(s.name)) = lower(trim(e.subject))
        limit 1
      )
      when (
        select count(*)
        from public.subjects s
        where s.school_id = e.school_id
          and lower(trim(s.name)) = lower(trim(e.subject))
      ) = 0
      and (
        select count(*)
        from public.subjects s
        where s.school_id is null
          and lower(trim(s.name)) = lower(trim(e.subject))
      ) = 1
      then (
        select s.id
        from public.subjects s
        where s.school_id is null
          and lower(trim(s.name)) = lower(trim(e.subject))
        limit 1
      )
      else null
    end as resolved_subject_id
  from eligible e
)
update public.teacher_classes tc
set is_class_teacher = true
from resolved r
where r.resolved_subject_id is not null
  and tc.school_id = r.school_id
  and tc.class_id = r.class_id
  and tc.teacher_id = r.teacher_id
  and tc.subject_id = r.resolved_subject_id
  and tc.is_class_teacher = false;

-- 2. Insert the exact canonical assignment only when no matching assignment exists.
with legacy as (
  select c.id as class_id, c.school_id, c.teacher_id, c.subject
  from public.classes c
  where c.teacher_id is not null
    and not exists (
      select 1
      from public.teacher_classes existing_class_teacher
      where existing_class_teacher.class_id = c.id
        and existing_class_teacher.school_id = c.school_id
        and existing_class_teacher.is_class_teacher = true
    )
), eligible as (
  select l.*
  from legacy l
  where exists (
    select 1
    from public.school_members sm
    where sm.school_id = l.school_id
      and sm.profile_id = l.teacher_id
      and sm.role = 'teacher'
  )
), resolved as (
  select e.*,
    case
      when (
        select count(*)
        from public.subjects s
        where s.school_id = e.school_id
          and lower(trim(s.name)) = lower(trim(e.subject))
      ) = 1
      then (
        select s.id
        from public.subjects s
        where s.school_id = e.school_id
          and lower(trim(s.name)) = lower(trim(e.subject))
        limit 1
      )
      when (
        select count(*)
        from public.subjects s
        where s.school_id = e.school_id
          and lower(trim(s.name)) = lower(trim(e.subject))
      ) = 0
      and (
        select count(*)
        from public.subjects s
        where s.school_id is null
          and lower(trim(s.name)) = lower(trim(e.subject))
      ) = 1
      then (
        select s.id
        from public.subjects s
        where s.school_id is null
          and lower(trim(s.name)) = lower(trim(e.subject))
        limit 1
      )
      else null
    end as resolved_subject_id
  from eligible e
)
insert into public.teacher_classes (
  school_id,
  teacher_id,
  class_id,
  subject_id,
  is_class_teacher
)
select
  r.school_id,
  r.teacher_id,
  r.class_id,
  r.resolved_subject_id,
  true
from resolved r
where r.resolved_subject_id is not null
  and not exists (
    select 1
    from public.teacher_classes tc
    where tc.teacher_id = r.teacher_id
      and tc.class_id = r.class_id
      and tc.subject_id = r.resolved_subject_id
  );

-- 3. Make teacher_classes the canonical class-teacher path. The only legacy
-- fallback is a currently-authorized teacher when the class has no canonical
-- class teacher at all. Owner/admin access remains governed independently by
-- join_requests_admin; stale parent/owner/no-membership teacher_id values do not
-- confer teacher-specific authority.
drop policy if exists join_requests_teacher on public.class_join_requests;
create policy join_requests_teacher
on public.class_join_requests
for all to authenticated
using (
  exists (
    select 1
    from public.classes c
    where c.id = class_join_requests.class_id
      and exists (
        select 1
        from public.school_members sm
        where sm.school_id = c.school_id
          and sm.profile_id = (select auth.uid())
          and sm.role = 'teacher'
      )
      and (
        exists (
          select 1
          from public.teacher_classes tc
          where tc.school_id = c.school_id
            and tc.class_id = c.id
            and tc.teacher_id = (select auth.uid())
            and tc.is_class_teacher = true
        )
        or (
          c.teacher_id = (select auth.uid())
          and not exists (
            select 1
            from public.teacher_classes canonical
            where canonical.school_id = c.school_id
              and canonical.class_id = c.id
              and canonical.is_class_teacher = true
          )
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.classes c
    where c.id = class_join_requests.class_id
      and exists (
        select 1
        from public.school_members sm
        where sm.school_id = c.school_id
          and sm.profile_id = (select auth.uid())
          and sm.role = 'teacher'
      )
      and (
        exists (
          select 1
          from public.teacher_classes tc
          where tc.school_id = c.school_id
            and tc.class_id = c.id
            and tc.teacher_id = (select auth.uid())
            and tc.is_class_teacher = true
        )
        or (
          c.teacher_id = (select auth.uid())
          and not exists (
            select 1
            from public.teacher_classes canonical
            where canonical.school_id = c.school_id
              and canonical.class_id = c.id
              and canonical.is_class_teacher = true
          )
        )
      )
  )
);