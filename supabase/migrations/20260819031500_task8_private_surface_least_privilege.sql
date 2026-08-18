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
revoke select on
  public.v_approvals_queue,
  public.v_budget_vs_actual,
  public.v_invoice_aging,
  public.v_project_summary,
  public.v_trial_balance,
  public.teacher_content_engine_summary,
  public.teacher_resource_usage_analytics,
  public.lesson_evidence_resource_lineage,
  public.hq_workforce_worker_performance,
  public.school_identity_gap_report
from anon;

-- Trigger functions are privileged implementation details, not callable APIs.
revoke execute on function public.guard_parent_child_record_write() from public, anon, authenticated;
revoke execute on function public.guard_parent_student_link_identity() from public, anon, authenticated;
revoke execute on function public.guard_parent_thread_update() from public, anon, authenticated;
