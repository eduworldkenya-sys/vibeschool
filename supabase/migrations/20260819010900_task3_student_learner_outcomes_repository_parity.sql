begin;

-- Task 3 clean-reconstruction parity for a production learner-domain relation
-- that existed outside the repository migration chain. The subsequent Task 3
-- boundary migration hardens its teacher policy, so the relation must be
-- reconstructible before that policy is addressed.
create table if not exists public.learner_outcomes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id),
  subject_id uuid,
  strand text,
  outcome_text text,
  status text check (status in ('not_started','assessed','mastered')),
  score integer,
  assessed_at timestamptz,
  school_id uuid,
  grade text,
  curriculum_type text default 'CBC',
  constraint uq_learner_outcome unique (student_id, subject_id, strand, outcome_text)
);

alter table public.learner_outcomes enable row level security;

-- Private learner evidence is never anonymous API surface.
revoke all privileges on table public.learner_outcomes from public, anon;
revoke all privileges on table public.learner_outcomes from authenticated;
grant select, insert, update, delete on table public.learner_outcomes to authenticated;
grant all privileges on table public.learner_outcomes to service_role;

drop policy if exists learner_outcomes_student_read on public.learner_outcomes;
create policy learner_outcomes_student_read on public.learner_outcomes
for select to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = learner_outcomes.student_id
      and s.profile_id = auth.uid()
      and s.deleted_at is null
  )
);

drop policy if exists "admin can view school outcomes" on public.learner_outcomes;
create policy "admin can view school outcomes" on public.learner_outcomes
for select to authenticated
using (public.is_school_admin(school_id));

commit;
