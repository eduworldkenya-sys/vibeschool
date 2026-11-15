-- Additive study-path preference; never a new auth identity or school membership.
-- authorization-test: public.learner_education_paths
-- This is not an authorization grant to published content, exams or adult-only features.
create table if not exists public.learner_education_paths (
  user_id uuid primary key references auth.users(id) on delete cascade,
  education_stage text not null check (education_stage = 'post_secondary'),
  programme_family text not null check (programme_family in ('professional_studies','college','university','tvet')),
  qualification_code text not null check (length(btrim(qualification_code)) between 2 and 40),
  examining_body text check (examining_body is null or length(examining_body) <= 80),
  qualification_level text check (qualification_level is null or length(qualification_level) <= 80),
  paper_code text check (paper_code is null or length(paper_code) <= 40),
  institution_name text check (institution_name is null or length(institution_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.learner_education_paths is
  'One auth identity with an optional post-secondary study preference; never overrides age safeguards or course publication permissions.';
alter table public.learner_education_paths enable row level security;
revoke all on public.learner_education_paths from public, anon;
grant select, insert, update on public.learner_education_paths to authenticated;
drop policy if exists "learner reads own education path" on public.learner_education_paths;
create policy "learner reads own education path" on public.learner_education_paths
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "learner creates own education path" on public.learner_education_paths;
create policy "learner creates own education path" on public.learner_education_paths
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "learner updates own education path" on public.learner_education_paths;
create policy "learner updates own education path" on public.learner_education_paths
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
