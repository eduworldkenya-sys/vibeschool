-- L0 prerequisite reconstruction for the pre-existing learner Twin memory table.
-- Derived from production catalog, subtracting the columns/checks/indexes owned by
-- 20260807102949_twin_universal_memory_engine.sql.

create table if not exists public.student_twin_memory_claims (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  outcome_id uuid references public.curriculum_learning_outcomes(id) on delete set null,
  memory_type text not null,
  claim_key text not null,
  claim_text text not null,
  confidence numeric not null default 0,
  evidence_count integer not null default 0,
  first_observed_at timestamptz not null default now(),
  last_confirmed_at timestamptz not null default now(),
  expires_at timestamptz,
  status text not null default 'active',
  source_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_twin_memory_claims_confidence_check check (confidence >= 0 and confidence <= 1),
  constraint student_twin_memory_claims_evidence_count_check check (evidence_count >= 0),
  constraint student_twin_memory_claims_status_check check (status in ('active','weakening','retired')),
  constraint student_twin_memory_claims_student_id_memory_type_claim_key_key unique (student_id,memory_type,claim_key)
);
