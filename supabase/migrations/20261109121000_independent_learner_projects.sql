-- Independent learner projects reuse public.projects without creating another learning engine.
-- School projects and their teacher-controlled submissions are unchanged.
alter table public.projects
  add column if not exists independent_owner_profile_id uuid references auth.users(id) on delete cascade,
  add column if not exists independent_notes text,
  add column if not exists independent_completed_at timestamptz;

create index if not exists projects_independent_owner_idx
  on public.projects (independent_owner_profile_id, created_at desc)
  where independent_owner_profile_id is not null;

alter table public.projects
  add constraint projects_independent_owner_scope
  check (
    independent_owner_profile_id is null
    or (school_id is null and class_id is null and teacher_id is null)
  );

create policy projects_independent_learner_select
  on public.projects for select to authenticated
  using (independent_owner_profile_id = (select auth.uid()));

create policy projects_independent_learner_insert
  on public.projects for insert to authenticated
  with check (
    independent_owner_profile_id = (select auth.uid())
    and school_id is null and class_id is null and teacher_id is null
    and status = 'active'
    and length(trim(title)) between 3 and 160
    and length(coalesce(description,'')) <= 3000
    and length(coalesce(independent_notes,'')) <= 8000
  );

create policy projects_independent_learner_update
  on public.projects for update to authenticated
  using (independent_owner_profile_id = (select auth.uid()))
  with check (
    independent_owner_profile_id = (select auth.uid())
    and school_id is null and class_id is null and teacher_id is null
    and status in ('active','submitted')
    and length(trim(title)) between 3 and 160
    and length(coalesce(description,'')) <= 3000
    and length(coalesce(independent_notes,'')) <= 8000
  );
