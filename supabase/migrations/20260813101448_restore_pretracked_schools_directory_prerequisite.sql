-- access: authenticated=select; service_role=all; anon=none
-- authorization-test: public.schools_directory authenticated can read directory rows; anon cannot access the table; direct authenticated writes remain denied by grants/RLS.
--
-- TBL-011 prerequisite reconstruction.
-- Production contains public.schools_directory before the tracked unified school
-- discovery migrations, but the repository never tracked its original relation
-- creation. Restore only the canonical pre-tracked shape required by the later chain.

create table if not exists public.schools_directory (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  county text,
  sub_county text,
  type text,
  status text,
  latitude double precision,
  longitude double precision,
  is_verified boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_schools_directory_county
  on public.schools_directory (county);
create index if not exists idx_schools_directory_name
  on public.schools_directory using gin (to_tsvector('english', name));
create index if not exists idx_schools_directory_name_trgm
  on public.schools_directory using gin (name extensions.gin_trgm_ops);
create index if not exists idx_sd_sub_county
  on public.schools_directory (county, sub_county);

alter table public.schools_directory enable row level security;

drop policy if exists schools_directory_select on public.schools_directory;
create policy schools_directory_select
  on public.schools_directory
  for select
  to authenticated
  using (true);

revoke all on table public.schools_directory from public, anon, authenticated;
grant select on table public.schools_directory to authenticated;
grant all on table public.schools_directory to service_role;
