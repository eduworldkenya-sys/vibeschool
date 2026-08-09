-- HQ Company Library foundation v2.
-- Mirrors the production foundation migration history.

create table if not exists public.hq_artifacts (
  id uuid primary key default gen_random_uuid(),
  artifact_key text not null unique,
  title text not null,
  artifact_type text not null,
  department_key text references public.hq_departments(key) on delete set null,
  work_item_id uuid references public.hq_work_items(id) on delete set null,
  decision_id uuid references public.hq_decisions(id) on delete set null,
  worker_id uuid references public.hq_workforce_workers(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  current_version_id uuid,
  lifecycle_state text not null default 'draft' check (lifecycle_state in ('draft','in_review','approved','published','archived','superseded')),
  approval_state text not null default 'not_required' check (approval_state in ('not_required','pending','approved','rejected')),
  confidentiality text not null default 'internal' check (confidentiality in ('internal','restricted','public')),
  purpose text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hq_artifact_versions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.hq_artifacts(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  storage_bucket text,
  storage_path text,
  mime_type text,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  content_hash text,
  structured_content jsonb,
  change_summary text,
  created_by uuid references auth.users(id) on delete set null,
  worker_id uuid references public.hq_workforce_workers(id) on delete set null,
  source_run_id uuid references public.hq_workforce_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (artifact_id, version_number),
  check (storage_path is not null or structured_content is not null)
);

alter table public.hq_artifacts drop constraint if exists hq_artifacts_current_version_id_fkey;
alter table public.hq_artifacts add constraint hq_artifacts_current_version_id_fkey foreign key (current_version_id) references public.hq_artifact_versions(id) on delete set null;

create table if not exists public.hq_artifact_provenance (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.hq_artifacts(id) on delete cascade,
  version_id uuid references public.hq_artifact_versions(id) on delete cascade,
  source_type text not null,
  source_table text,
  source_id text,
  source_uri text,
  evidence_summary text,
  source_hash text,
  metadata jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

create table if not exists public.hq_artifact_links (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.hq_artifacts(id) on delete cascade,
  related_artifact_id uuid references public.hq_artifacts(id) on delete cascade,
  relation_type text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (related_artifact_id is not null or (target_type is not null and target_id is not null))
);

create table if not exists public.hq_artifact_approvals (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.hq_artifacts(id) on delete cascade,
  version_id uuid references public.hq_artifact_versions(id) on delete cascade,
  decision_id uuid references public.hq_decisions(id) on delete set null,
  reviewer_id uuid references auth.users(id) on delete set null,
  status text not null check (status in ('pending','approved','rejected')),
  notes text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists hq_artifacts_department_idx on public.hq_artifacts(department_key);
create index if not exists hq_artifacts_work_item_idx on public.hq_artifacts(work_item_id);
create index if not exists hq_artifacts_worker_idx on public.hq_artifacts(worker_id);
create index if not exists hq_artifacts_state_idx on public.hq_artifacts(lifecycle_state, approval_state);
create index if not exists hq_artifact_versions_artifact_idx on public.hq_artifact_versions(artifact_id, version_number desc);
create index if not exists hq_artifact_provenance_artifact_idx on public.hq_artifact_provenance(artifact_id, version_id);
create index if not exists hq_artifact_links_artifact_idx on public.hq_artifact_links(artifact_id);

alter table public.hq_artifacts enable row level security;
alter table public.hq_artifact_versions enable row level security;
alter table public.hq_artifact_provenance enable row level security;
alter table public.hq_artifact_links enable row level security;
alter table public.hq_artifact_approvals enable row level security;

revoke all on public.hq_artifacts, public.hq_artifact_versions, public.hq_artifact_provenance, public.hq_artifact_links, public.hq_artifact_approvals from anon, authenticated;
grant select, insert, update on public.hq_artifacts to authenticated;
grant select, insert on public.hq_artifact_versions to authenticated;
grant select, insert on public.hq_artifact_provenance to authenticated;
grant select, insert, delete on public.hq_artifact_links to authenticated;
grant select, insert, update on public.hq_artifact_approvals to authenticated;

create policy "hq owners read artifacts" on public.hq_artifacts for select to authenticated using (exists (select 1 from public.platform_owners po where po.profile_id = (select auth.uid())));
create policy "hq owners create artifacts" on public.hq_artifacts for insert to authenticated with check (exists (select 1 from public.platform_owners po where po.profile_id = (select auth.uid())));
create policy "hq owners update artifacts" on public.hq_artifacts for update to authenticated using (exists (select 1 from public.platform_owners po where po.profile_id = (select auth.uid()))) with check (exists (select 1 from public.platform_owners po where po.profile_id = (select auth.uid())));
create policy "hq owners read artifact versions" on public.hq_artifact_versions for select to authenticated using (exists (select 1 from public.platform_owners po where po.profile_id = (select auth.uid())));
create policy "hq owners create artifact versions" on public.hq_artifact_versions for insert to authenticated with check (exists (select 1 from public.platform_owners po where po.profile_id = (select auth.uid())));
create policy "hq owners read artifact provenance" on public.hq_artifact_provenance for select to authenticated using (exists (select 1 from public.platform_owners po where po.profile_id = (select auth.uid())));
create policy "hq owners create artifact provenance" on public.hq_artifact_provenance for insert to authenticated with check (exists (select 1 from public.platform_owners po where po.profile_id = (select auth.uid())));
create policy "hq owners manage artifact links" on public.hq_artifact_links for all to authenticated using (exists (select 1 from public.platform_owners po where po.profile_id = (select auth.uid()))) with check (exists (select 1 from public.platform_owners po where po.profile_id = (select auth.uid())));
create policy "hq owners manage artifact approvals" on public.hq_artifact_approvals for all to authenticated using (exists (select 1 from public.platform_owners po where po.profile_id = (select auth.uid()))) with check (exists (select 1 from public.platform_owners po where po.profile_id = (select auth.uid())));
