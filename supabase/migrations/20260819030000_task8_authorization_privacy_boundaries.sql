-- Task 8 — Production RLS, authorization and privacy boundary hardening
-- Security must reconstruct from repository migrations; do not apply production-only fixes.
--
-- Some production-observed legacy/internal surfaces are intentionally absent from the
-- replayable repository chain. Harden them when they exist, but never fabricate them
-- merely to satisfy a production drift assumption. This keeps blank reconstruction
-- deterministic while preserving fail-closed policy/grant changes on every extant target.

-- School-admin pending actions must be tenant-bound when the legacy surface exists.
do $$
begin
  if to_regclass('public.pending_actions') is not null then
    execute 'drop policy if exists pending_actions_admin on public.pending_actions';
    execute $sql$
      create policy pending_actions_admin_select on public.pending_actions
        for select to authenticated
        using (public.is_school_admin(school_id))
    $sql$;
    execute $sql$
      create policy pending_actions_admin_insert on public.pending_actions
        for insert to authenticated
        with check (public.is_school_admin(school_id) and requester_id = auth.uid())
    $sql$;
    execute $sql$
      create policy pending_actions_admin_update on public.pending_actions
        for update to authenticated
        using (public.is_school_admin(school_id))
        with check (public.is_school_admin(school_id))
    $sql$;
    execute $sql$
      create policy pending_actions_admin_delete on public.pending_actions
        for delete to authenticated
        using (public.is_school_admin(school_id))
    $sql$;
  end if;
end
$$;

-- Global audit/internal platform metadata are HQ/internal surfaces, not school-admin data.
do $$
begin
  if to_regclass('public.audit_logs') is not null then
    execute 'drop policy if exists audit_logs_admin_read on public.audit_logs';
    execute $sql$
      create policy audit_logs_hq_owner_read on public.audit_logs
        for select to authenticated
        using (public.is_platform_owner())
    $sql$;
  end if;

  if to_regclass('public.schema_migrations') is not null then
    execute 'drop policy if exists schema_migrations_admin on public.schema_migrations';
    execute $sql$
      create policy schema_migrations_hq_owner_read on public.schema_migrations
        for select to authenticated
        using (public.is_platform_owner())
    $sql$;
  end if;

  if to_regclass('public.system_health_logs') is not null then
    execute 'drop policy if exists system_health_logs_admin on public.system_health_logs';
    execute $sql$
      create policy system_health_logs_hq_owner_read on public.system_health_logs
        for select to authenticated
        using (public.is_platform_owner())
    $sql$;
  end if;
end
$$;

-- Teacher evidence authority follows the learner's current canonical class assignment.
do $$
begin
  if to_regclass('public.competency_evidence_ledger') is not null then
    execute 'drop policy if exists competency_teacher_manage on public.competency_evidence_ledger';
    execute $sql$
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
        )
    $sql$;
  end if;
end
$$;

-- Traditional grades require current teacher/learner/class/subject authority when present.
do $$
begin
  if to_regclass('public.traditional_grades') is not null then
    execute 'drop policy if exists pol_trad_grades_insert on public.traditional_grades';
    execute $sql$
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
        )
    $sql$;

    execute 'drop policy if exists pol_trad_grades_update on public.traditional_grades';
    execute $sql$
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
        )
    $sql$;

    execute 'drop policy if exists trad_grades_teacher_read on public.traditional_grades';
    execute $sql$
      create policy trad_grades_teacher_read on public.traditional_grades
        for select to authenticated
        using (public.is_teacher_of_student(student_id))
    $sql$;
  end if;
end
$$;

-- A removed teacher must lose access to learner submissions even if they authored the homework.
do $$
begin
  if to_regclass('public.homework_submissions') is not null then
    execute 'drop policy if exists homework_submissions_teacher on public.homework_submissions';
    execute $sql$
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
        )
    $sql$;
  end if;
end
$$;

-- Marking authority is current learner authority, not marker_id alone.
do $$
begin
  if to_regclass('public.submission_marks') is not null then
    execute 'drop policy if exists marks_teacher_manage on public.submission_marks';
    execute $sql$
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
        )
    $sql$;
  end if;
end
$$;

-- Capability links may not be enumerated anonymously. Public sharing must use a token-verifying server/RPC boundary.
do $$
begin
  if to_regclass('public.child_share_links') is not null then
    execute 'drop policy if exists "Anonymous can view active shared links" on public.child_share_links';
  end if;
end
$$;

-- Parent RPCs are authenticated-only when those optional compatibility functions exist.
do $$
begin
  if to_regprocedure('public.get_parent_child_dashboard(uuid)') is not null then
    execute 'revoke execute on function public.get_parent_child_dashboard(uuid) from public, anon';
    execute 'grant execute on function public.get_parent_child_dashboard(uuid) to authenticated, service_role';
  end if;
  if to_regprocedure('public.get_parent_dashboard()') is not null then
    execute 'revoke execute on function public.get_parent_dashboard() from public, anon';
    execute 'grant execute on function public.get_parent_dashboard() to authenticated, service_role';
  end if;
  if to_regprocedure('public.parent_start_conversation(uuid,uuid,text)') is not null then
    execute 'revoke execute on function public.parent_start_conversation(uuid, uuid, text) from public, anon';
    execute 'grant execute on function public.parent_start_conversation(uuid, uuid, text) to authenticated, service_role';
  end if;
end
$$;

-- Private homework evidence storage follows current teacher/class, school-admin, or HQ authority.
do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists homework_photos_staff_read on storage.objects';
    execute 'drop policy if exists homework_photos_staff_read_v2 on storage.objects';
    execute $sql$
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
        )
    $sql$;
  end if;
end
$$;

-- Minimum table privileges for hardened private surfaces. RLS remains the row boundary.
do $$
declare
  v_rel text;
begin
  foreach v_rel in array array[
    'audit_logs', 'pending_actions', 'competency_evidence_ledger', 'traditional_grades',
    'homework_submissions', 'submission_marks', 'schema_migrations', 'system_health_logs',
    'child_share_links'
  ] loop
    if to_regclass(format('public.%I', v_rel)) is not null then
      execute format('revoke all privileges on table public.%I from anon', v_rel);
      execute format('revoke all privileges on table public.%I from authenticated', v_rel);
    end if;
  end loop;

  foreach v_rel in array array['audit_logs', 'schema_migrations', 'system_health_logs'] loop
    if to_regclass(format('public.%I', v_rel)) is not null then
      execute format('grant select on table public.%I to authenticated', v_rel);
    end if;
  end loop;

  foreach v_rel in array array[
    'pending_actions', 'competency_evidence_ledger', 'homework_submissions',
    'submission_marks', 'child_share_links'
  ] loop
    if to_regclass(format('public.%I', v_rel)) is not null then
      execute format('grant select, insert, update, delete on table public.%I to authenticated', v_rel);
    end if;
  end loop;

  if to_regclass('public.traditional_grades') is not null then
    execute 'grant select, insert, update on table public.traditional_grades to authenticated';
  end if;
end
$$;
