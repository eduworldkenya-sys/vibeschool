-- L0 prerequisite reconstruction for the pre-existing learner Twin memory tables.
-- Derived from the production catalog. For student_twin_memory_claims this
-- deliberately subtracts the columns/checks/indexes owned by
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

create table if not exists public.student_twin_intervention_effects (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  outcome_id uuid references public.curriculum_learning_outcomes(id) on delete set null,
  intervention_type text not null,
  intervention_key text not null,
  attempts integer not null default 0 check (attempts >= 0),
  successes integer not null default 0 check (successes >= 0 and successes <= attempts),
  mean_mastery_delta numeric,
  mean_response_ms numeric,
  effectiveness_score numeric not null default 0 check (effectiveness_score >= 0 and effectiveness_score <= 1),
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  last_observed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_twin_intervention_effec_student_id_intervention_key_key unique (student_id, intervention_key)
);

create index if not exists idx_student_twin_intervention_effects_student
  on public.student_twin_intervention_effects(student_id, effectiveness_score desc);

alter table public.student_twin_intervention_effects enable row level security;

drop policy if exists student_twin_intervention_effects_self_read
  on public.student_twin_intervention_effects;
create policy student_twin_intervention_effects_self_read
  on public.student_twin_intervention_effects
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.students s
      where s.id = student_twin_intervention_effects.student_id
        and s.profile_id = (select auth.uid())
        and s.deleted_at is null
    )
  );

revoke all on table public.student_twin_intervention_effects from public, anon;
grant all on table public.student_twin_intervention_effects to authenticated, service_role;
