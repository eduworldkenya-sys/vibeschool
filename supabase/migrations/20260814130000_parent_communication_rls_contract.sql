begin;

-- Preserve the existing browser UX while moving the actual authorization boundary
-- into RLS. A parent may create a direct thread only for a school serving one of
-- their linked children.
drop policy if exists parent_vc_thread_insert on public.vc_threads;
create policy parent_vc_thread_insert
on public.vc_threads
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and type = 'direct'
  and exists (
    select 1
    from public.parent_student_links psl
    join public.students s on s.id=psl.student_id
    left join public.student_classes sc on sc.student_id=s.id and sc.is_current=true
    join public.classes c on c.id=coalesce(sc.class_id,s.class_id)
    where psl.parent_id=(select auth.uid())
      and coalesce(psl.access_level,'full')<>'none'
      and c.school_id=vc_threads.school_id
      and s.deleted_at is null
  )
);

-- The second participant may be the child's assigned teacher or a school
-- administrator for the same school. The parent cannot add arbitrary users.
drop policy if exists parent_vc_participant_insert on public.vc_participants;
create policy parent_vc_participant_insert
on public.vc_participants
for insert
to authenticated
with check (
  exists (
    select 1 from public.vc_threads vt
    where vt.id=vc_participants.thread_id
      and vt.created_by=(select auth.uid())
      and vt.type='direct'
      and vt.school_id=vc_participants.school_id
  )
  and (
    vc_participants.profile_id=(select auth.uid())
    or exists (
      select 1
      from public.parent_student_links psl
      join public.students s on s.id=psl.student_id
      left join public.student_classes sc on sc.student_id=s.id and sc.is_current=true
      join public.classes c on c.id=coalesce(sc.class_id,s.class_id)
      join public.teacher_classes tc on tc.class_id=c.id and tc.teacher_id=vc_participants.profile_id
      where psl.parent_id=(select auth.uid())
        and coalesce(psl.access_level,'full')<>'none'
        and c.school_id=vc_participants.school_id
        and s.deleted_at is null
    )
    or exists (
      select 1
      from public.parent_student_links psl
      join public.students s on s.id=psl.student_id
      left join public.student_classes sc on sc.student_id=s.id and sc.is_current=true
      join public.classes c on c.id=coalesce(sc.class_id,s.class_id)
      join public.school_members sm on sm.school_id=c.school_id and sm.profile_id=vc_participants.profile_id
      where psl.parent_id=(select auth.uid())
        and coalesce(psl.access_level,'full')<>'none'
        and sm.role::text in ('owner','admin')
        and c.school_id=vc_participants.school_id
        and s.deleted_at is null
    )
  )
);

commit;
