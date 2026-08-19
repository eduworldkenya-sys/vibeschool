-- Task 8 — least privilege for private pilot data surfaces.
-- Public catalogue/search RPCs remain available; private child/school data does not rely on broad anon grants.

do $$
declare r record;
begin
  for r in
    select n.nspname,c.relname
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relkind in ('r','p')
      and (
        c.relname ~ '^(assessment_|attendance$|child_|class_|classes$|content_submission_evidence$|exercise_submissions$|generated_assessment|homework|learner_progress$|lesson_evidence|manual_students$|notifications$|parent_|progress_records$|project_submissions$|report_card_|staff_attendance$|student_|submission_|teacher_|teachers$|tpad_evidence$|traditional_grades$|twin_|vc_messages$|vibe_reading_progress$)'
        or c.relname in (
          'students','school_members','pending_actions','audit_logs','schema_migrations',
          'system_health_logs','competency_evidence_ledger'
        )
      )
  loop
    execute format('revoke all privileges on table %I.%I from anon',r.nspname,r.relname);
  end loop;
end $$;

-- Internal/tenant analytics views are not anonymous public catalogue surfaces.
-- Several are production-observed compatibility views that are not part of the
-- replayable blank repository chain. Revoke only when the relation exists; never
-- fabricate a compatibility view solely to make a security migration replay.
do $$
declare
  v_rel text;
begin
  foreach v_rel in array array[
    'v_approvals_queue',
    'v_budget_vs_actual',
    'v_invoice_aging',
    'v_project_summary',
    'v_trial_balance',
    'teacher_content_engine_summary',
    'teacher_resource_usage_analytics',
    'lesson_evidence_resource_lineage',
    'hq_workforce_worker_performance',
    'school_identity_gap_report'
  ] loop
    if to_regclass(format('public.%I', v_rel)) is not null then
      execute format('revoke select on public.%I from anon', v_rel);
    end if;
  end loop;
end $$;

-- Trigger functions are privileged implementation details, not callable APIs.
-- Harden each extant compatibility trigger without making an absent production-only
-- implementation a prerequisite of clean repository reconstruction.
do $$
declare
  v_proc text;
begin
  foreach v_proc in array array[
    'public.guard_parent_child_record_write()',
    'public.guard_parent_student_link_identity()',
    'public.guard_parent_thread_update()'
  ] loop
    if to_regprocedure(v_proc) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', v_proc);
    end if;
  end loop;
end $$;
