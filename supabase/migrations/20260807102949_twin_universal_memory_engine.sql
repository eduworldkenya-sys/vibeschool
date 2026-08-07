-- TWIN universal memory engine.
-- Extends existing student_twin_memory_claims; does not create a parallel learner model.

alter table public.student_twin_memory_claims
  add column if not exists importance numeric not null default 0.5,
  add column if not exists learning_impact numeric,
  add column if not exists memory_scope text not null default 'learner',
  add column if not exists permanence text not null default 'adaptive',
  add column if not exists relationship_refs jsonb not null default '{}'::jsonb,
  add column if not exists provenance jsonb not null default '{}'::jsonb;

alter table public.student_twin_memory_claims
  drop constraint if exists student_twin_memory_claims_memory_type_check;
alter table public.student_twin_memory_claims
  add constraint student_twin_memory_claims_memory_type_check
  check (memory_type = any(array[
    'misconception','strength','preference','behavior','intervention_response','study_pattern',
    'learning_fact','attendance_pattern','reading_pattern','task_pattern','assessment_pattern','teacher_feedback','revision_pattern'
  ]::text[]));

alter table public.student_twin_memory_claims
  drop constraint if exists student_twin_memory_claims_importance_check;
alter table public.student_twin_memory_claims
  add constraint student_twin_memory_claims_importance_check check (importance >= 0 and importance <= 1);
alter table public.student_twin_memory_claims
  drop constraint if exists student_twin_memory_claims_learning_impact_check;
alter table public.student_twin_memory_claims
  add constraint student_twin_memory_claims_learning_impact_check check (learning_impact is null or (learning_impact >= -1 and learning_impact <= 1));
alter table public.student_twin_memory_claims
  drop constraint if exists student_twin_memory_claims_permanence_check;
alter table public.student_twin_memory_claims
  add constraint student_twin_memory_claims_permanence_check check (permanence in ('historical','durable','adaptive','ephemeral'));

create index if not exists idx_twin_memory_student_importance on public.student_twin_memory_claims(student_id,importance desc,last_confirmed_at desc);
create index if not exists idx_twin_memory_student_type on public.student_twin_memory_claims(student_id,memory_type,status);

-- The production function body is intentionally maintained in Supabase as the authority.
-- It refreshes weighted memories from the existing evidence sources:
-- student_mistake_notebook, student_outcome_mastery, student_practice_attempts,
-- attendance, vibe_reading_sessions, student_task_execution_receipts,
-- assessment_attempts, homework_submissions, student_learning_events,
-- and student_revision_plan_items.
-- It preserves historical/durable facts while aging adaptive/ephemeral claims.

revoke all on function public.student_refresh_twin_memory() from public,anon;
grant execute on function public.student_refresh_twin_memory() to authenticated;
revoke all on function public.student_get_twin_memory() from public,anon;
grant execute on function public.student_get_twin_memory() to authenticated;
