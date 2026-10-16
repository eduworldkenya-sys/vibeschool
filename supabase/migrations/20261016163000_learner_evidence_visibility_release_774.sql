-- #774 Learner evidence visibility. Additive policies; no learner data rewrite.
-- Class teachers may read class-wide evidence for *currently enrolled* learners;
-- subject-only teachers retain existing subject-scoped policies.
-- Parent and learner access to gradebook summaries must require release.

alter policy assessment_gradebook_parent_read
  on public.assessment_gradebook_entries
  using (
    released_at is not null
    and exists (
      select 1 from public.parent_student_links psl
      where psl.parent_id = (select auth.uid())
        and psl.student_id = assessment_gradebook_entries.student_id
        and coalesce(psl.access_level, 'full') <> 'none'
    )
  );

alter policy assessment_gradebook_student_read
  on public.assessment_gradebook_entries
  using (
    released_at is not null
    and exists (
      select 1 from public.students s
      where s.id = assessment_gradebook_entries.student_id
        and s.profile_id = (select auth.uid())
        and s.deleted_at is null
    )
  );

drop policy if exists assessment_gradebook_class_teacher_read
  on public.assessment_gradebook_entries;
create policy assessment_gradebook_class_teacher_read
  on public.assessment_gradebook_entries
  for select to authenticated
  using (
    public.teacher_can_access_class(class_id, null::uuid, true)
    and exists (
      select 1
      from public.student_classes sc
      join public.classes c on c.id = sc.class_id and c.school_id = sc.school_id
      where sc.school_id = assessment_gradebook_entries.school_id
        and sc.class_id = assessment_gradebook_entries.class_id
        and sc.student_id = assessment_gradebook_entries.student_id
        and sc.is_current is true
    )
  );

drop policy if exists cbc_assessments_class_teacher_read on public.cbc_assessments;
create policy cbc_assessments_class_teacher_read on public.cbc_assessments
  for select to authenticated
  using (
    public.teacher_can_access_class(class_id, null::uuid, true)
    and exists (
      select 1
      from public.student_classes sc
      join public.classes c on c.id = sc.class_id and c.school_id = sc.school_id
      where sc.school_id = cbc_assessments.school_id
        and sc.class_id = cbc_assessments.class_id
        and sc.student_id = cbc_assessments.student_id
        and sc.is_current is true
    )
  );

create index if not exists idx_assessment_gradebook_school_class_student_release
  on public.assessment_gradebook_entries (school_id, class_id, student_id, released_at desc);

-- Authorship is provenance, not permanent permission after a teacher leaves.
-- Subject teachers read their assigned subject; class teachers use the policy above.
alter policy assessment_gradebook_teacher_read on public.assessment_gradebook_entries
using (
  (
    public.teacher_can_access_class(class_id, subject_id, false)
    and exists (
      select 1 from public.student_classes sc
      join public.classes c on c.id = sc.class_id and c.school_id = sc.school_id
      where sc.school_id = assessment_gradebook_entries.school_id
        and sc.class_id = assessment_gradebook_entries.class_id
        and sc.student_id = assessment_gradebook_entries.student_id and sc.is_current is true
    )
  ) or exists (
    select 1 from public.school_members sm
    join public.profiles p on p.id = sm.profile_id
    join public.schools s on s.id = sm.school_id
    where sm.profile_id = (select auth.uid())
      and sm.school_id = assessment_gradebook_entries.school_id
      and sm.role::text in ('admin','owner','headteacher')
      and p.account_status::text = 'active' and not coalesce(p.is_anonymized,false)
      and s.deleted_at is null and s.status::text = 'active'
  )
);

alter policy cbc_teacher_read on public.cbc_assessments
using (
  public.teacher_can_access_class(class_id, subject_id, false)
  and exists (
    select 1 from public.student_classes sc
    join public.classes c on c.id = sc.class_id and c.school_id = sc.school_id
    where sc.school_id = cbc_assessments.school_id
      and sc.class_id = cbc_assessments.class_id
      and sc.student_id = cbc_assessments.student_id and sc.is_current is true
  )
);
