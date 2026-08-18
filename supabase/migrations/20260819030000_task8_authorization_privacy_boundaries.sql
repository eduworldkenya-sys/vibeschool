-- Task 8 — Production RLS, authorization and privacy boundary hardening
-- Security must reconstruct from repository migrations; do not apply production-only fixes.

-- School-admin pending actions must be tenant-bound.
drop policy if exists pending_actions_admin on public.pending_actions;
create policy pending_actions_admin_select on public.pending_actions
  for select to authenticated
  using (public.is_school_admin(school_id));
create policy pending_actions_admin_insert on public.pending_actions
  for insert to authenticated
  with check (public.is_school_admin(school_id) and requester_id = auth.uid());
create policy pending_actions_admin_update on public.pending_actions
  for update to authenticated
  using (public.is_school_admin(school_id))
  with check (public.is_school_admin(school_id));
create policy pending_actions_admin_delete on public.pending_actions
  for delete to authenticated
  using (public.is_school_admin(school_id));

-- Global audit/internal platform metadata are HQ/internal surfaces, not school-admin data.
drop policy if exists audit_logs_admin_read on public.audit_logs;
create policy audit_logs_hq_owner_read on public.audit_logs
  for select to authenticated
  using (public.is_platform_owner());

drop policy if exists schema_migrations_admin on public.schema_migrations;
create policy schema_migrations_hq_owner_read on public.schema_migrations
  for select to authenticated
  using (public.is_platform_owner());

drop policy if exists system_health_logs_admin on public.system_health_logs;
create policy system_health_logs_hq_owner_read on public.system_health_logs
  for select to authenticated
  using (public.is_platform_owner());

-- Teacher evidence authority follows the learner's current canonical class assignment.
drop policy if exists competency_teacher_manage on public.competency_evidence_ledger;
create policy competency_teacher_manage on public.competency_evidence_ledger
  for all to authenticated
  using (
    observed_by = auth.uid()
    and exists (
      select 1
      from public.student_classes sc
      join public.teacher_classes tc
        on tc.school_id = sc.school_id
       and tc.class_id = sc.class_id
      where sc.student_id = competency_evidence_ledger.student_id
        and sc.is_current = true
        and tc.teacher_id = auth.uid()
        and (competency_evidence_ledger.school_id is null or competency_evidence_ledger.school_id = sc.school_id)
        and (competency_evidence_ledger.class_id is null or competency_evidence_ledger.class_id = sc.class_id)
        and (competency_evidence_ledger.subject_id is null or competency_evidence_ledger.subject_id = tc.subject_id)
    )
  )
  with check (
    observed_by = auth.uid()
    and exists (
      select 1
      from public.student_classes sc
      join public.teacher_classes tc
        on tc.school_id = sc.school_id
       and tc.class_id = sc.class_id
      where sc.student_id = competency_evidence_ledger.student_id
        and sc.is_current = true
        and tc.teacher_id = auth.uid()
        and (competency_evidence_ledger.school_id is null or competency_evidence_ledger.school_id = sc.school_id)
        and (competency_evidence_ledger.class_id is null or competency_evidence_ledger.class_id = sc.class_id)
        and (competency_evidence_ledger.subject_id is null or competency_evidence_ledger.subject_id = tc.subject_id)
    )
  );

-- Traditional grades require current teacher/learner/class/subject authority.
drop policy if exists pol_trad_grades_insert on public.traditional_grades;
create policy pol_trad_grades_insert on public.traditional_grades
  for insert to authenticated
  with check (
    teacher_id = auth.uid()
    and exists (
      select 1
      from public.student_classes sc
      join public.teacher_classes tc
        on tc.school_id = sc.school_id
       and tc.class_id = sc.class_id
      where sc.student_id = traditional_grades.student_id
        and sc.is_current = true
        and tc.teacher_id = auth.uid()
        and traditional_grades.school_id = sc.school_id
        and traditional_grades.class_id = sc.class_id
        and traditional_grades.subject_id = tc.subject_id
    )
  );

drop policy if exists pol_trad_grades_update on public.traditional_grades;
create policy pol_trad_grades_update on public.traditional_grades
  for update to authenticated
  using (
    public.is_school_admin(school_id)
    or (
      teacher_id = auth.uid()
      and exists (
        select 1
        from public.student_classes sc
        join public.teacher_classes tc
          on tc.school_id = sc.school_id
         and tc.class_id = sc.class_id
        where sc.student_id = traditional_grades.student_id
          and sc.is_current = true
          and tc.teacher_id = auth.uid()
          and traditional_grades.school_id = sc.school_id
          and traditional_grades.class_id = sc.class_id
          and traditional_grades.subject_id = tc.subject_id
      )
    )
  )
  with check (
    public.is_school_admin(school_id)
    or (
      teacher_id = auth.uid()
      and exists (
        select 1
        from public.student_classes sc
        join public.teacher_classes tc
          on tc.school_id = sc.school_id
         and tc.class_id = sc.class_id
        where sc.student_id = traditional_grades.student_id
          and sc.is_current = true
          and tc.teacher_id = auth.uid()
          and traditional_grades.school_id = sc.school_id
          and traditional_grades.class_id = sc.class_id
          and traditional_grades.subject_id = tc.subject_id
      )
    )
  );

drop policy if exists trad_grades_teacher_read on public.traditional_grades;
create policy trad_grades_teacher_read on public.traditional_grades
  for select to authenticated
  using (public.is_teacher_of_student(student_id));

-- A removed teacher must lose access to learner submissions even if they authored the homework.
drop policy if exists homework_submissions_teacher on public.homework_submissions;
create policy homework_submissions_teacher on public.homework_submissions
  for all to authenticated
  using (
    exists (
      select 1
      from public.homework h
      join public.student_classes sc
        on sc.student_id = homework_submissions.student_id
       and sc.is_current = true
       and sc.school_id = h.school_id
       and sc.class_id = h.class_id
      join public.teacher_classes tc
        on tc.school_id = sc.school_id
       and tc.class_id = sc.class_id
      where h.id = homework_submissions.homework_id
        and h.teacher_id = auth.uid()
        and tc.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.homework h
      join public.student_classes sc
        on sc.student_id = homework_submissions.student_id
       and sc.is_current = true
       and sc.school_id = h.school_id
       and sc.class_id = h.class_id
      join public.teacher_classes tc
        on tc.school_id = sc.school_id
       and tc.class_id = sc.class_id
      where h.id = homework_submissions.homework_id
        and h.teacher_id = auth.uid()
        and tc.teacher_id = auth.uid()
    )
  );

-- Marking authority is current learner authority, not marker_id alone.
drop policy if exists marks_teacher_manage on public.submission_marks;
create policy marks_teacher_manage on public.submission_marks
  for all to authenticated
  using (
    marker_id = auth.uid()
    and exists (
      select 1
      from public.content_submission_evidence e
      join public.content_assignment_learners al
        on al.id = e.assignment_learner_id
      where e.id = submission_marks.evidence_id
        and public.is_teacher_of_student(al.student_id)
    )
  )
  with check (
    marker_id = auth.uid()
    and exists (
      select 1
      from public.content_submission_evidence e
      join public.content_assignment_learners al
        on al.id = e.assignment_learner_id
      where e.id = submission_marks.evidence_id
        and public.is_teacher_of_student(al.student_id)
    )
  );

-- Capability links may not be enumerated anonymously. Public sharing must use a token-verifying server/RPC boundary.
drop policy if exists "Anonymous can view active shared links" on public.child_share_links;

-- Parent RPCs are authenticated-only.
revoke execute on function public.get_parent_child_dashboard(uuid) from public, anon;
revoke execute on function public.get_parent_dashboard() from public, anon;
revoke execute on function public.parent_start_conversation(uuid, uuid, text) from public, anon;
grant execute on function public.get_parent_child_dashboard(uuid) to authenticated, service_role;
grant execute on function public.get_parent_dashboard() to authenticated, service_role;
grant execute on function public.parent_start_conversation(uuid, uuid, text) to authenticated, service_role;

-- Private homework evidence storage follows current teacher/class, school-admin, or HQ authority.
drop policy if exists homework_photos_staff_read on storage.objects;
drop policy if exists homework_photos_staff_read_v2 on storage.objects;
create policy homework_photos_staff_read_v2 on storage.objects
  for select to authenticated
  using (
    bucket_id = 'homework-photos'
    and exists (
      select 1
      from public.student_classes sc
      where sc.is_current = true
        and split_part(storage.objects.name, '/', 1) = sc.student_id::text
        and (
          public.is_teacher_of_student(sc.student_id)
          or public.is_school_admin(sc.school_id)
          or public.is_platform_owner()
        )
    )
  );

-- Minimum table privileges for the hardened private surfaces. RLS remains the row boundary.
revoke all privileges on table
  public.audit_logs,
  public.pending_actions,
  public.competency_evidence_ledger,
  public.traditional_grades,
  public.homework_submissions,
  public.submission_marks,
  public.schema_migrations,
  public.system_health_logs,
  public.child_share_links
from anon;

revoke all privileges on table
  public.audit_logs,
  public.pending_actions,
  public.competency_evidence_ledger,
  public.traditional_grades,
  public.homework_submissions,
  public.submission_marks,
  public.schema_migrations,
  public.system_health_logs,
  public.child_share_links
from authenticated;

grant select on table
  public.audit_logs,
  public.schema_migrations,
  public.system_health_logs
  to authenticated;

grant select, insert, update, delete on table
  public.pending_actions,
  public.competency_evidence_ledger,
  public.homework_submissions,
  public.submission_marks,
  public.child_share_links
  to authenticated;

grant select, insert, update on table public.traditional_grades to authenticated;
