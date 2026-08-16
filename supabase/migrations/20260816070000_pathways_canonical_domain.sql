-- VibeSchool Pathways P0.1 — canonical decision knowledge domain
--
-- This migration is intentionally additive and non-activating. It creates the
-- missing Pathways knowledge graph while reusing canonical public.subjects and
-- public.schools identities. It does not alter learner identity, auth routing,
-- Twin authority, formal assessment semantics, or production school identity.

create table public.pathway_sources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('official_portal','official_document','institution_verified','professional_body','vibeschool_editorial')),
  source_name text not null,
  source_url text,
  source_reference text,
  observed_at timestamptz not null default now(),
  effective_from date,
  effective_to date,
  status text not null default 'active' check (status in ('active','superseded','withdrawn')),
  is_public boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pathway_sources enable row level security;
revoke all on table public.pathway_sources from public, anon, authenticated;
grant select on table public.pathway_sources to anon, authenticated;
grant select, insert, update, delete on table public.pathway_sources to service_role;
create policy pathway_sources_public_read on public.pathway_sources
  for select to anon, authenticated using (is_public and status <> 'withdrawn');
-- authorization-test: public.pathway_sources anon/authenticated may read only public non-withdrawn sources; writes denied; service_role manages provenance

create table public.pathways (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  official_code text,
  name text not null,
  short_name text,
  plain_language_summary text not null default '',
  status text not null default 'draft' check (status in ('draft','published','superseded','retired')),
  source_id uuid not null references public.pathway_sources(id),
  effective_from date,
  effective_to date,
  version integer not null default 1 check (version > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pathways enable row level security;
revoke all on table public.pathways from public, anon, authenticated;
grant select on table public.pathways to anon, authenticated;
grant select, insert, update, delete on table public.pathways to service_role;
create policy pathways_public_read on public.pathways
  for select to anon, authenticated using (status = 'published');
-- authorization-test: public.pathways anon/authenticated may read published pathways only; writes denied; service_role manages canonical records

create table public.pathway_tracks (
  id uuid primary key default gen_random_uuid(),
  pathway_id uuid not null references public.pathways(id) on delete cascade,
  slug text not null,
  official_code text,
  name text not null,
  plain_language_summary text not null default '',
  status text not null default 'draft' check (status in ('draft','published','superseded','retired')),
  source_id uuid not null references public.pathway_sources(id),
  effective_from date,
  effective_to date,
  version integer not null default 1 check (version > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pathway_id, slug, version)
);
alter table public.pathway_tracks enable row level security;
revoke all on table public.pathway_tracks from public, anon, authenticated;
grant select on table public.pathway_tracks to anon, authenticated;
grant select, insert, update, delete on table public.pathway_tracks to service_role;
create policy pathway_tracks_public_read on public.pathway_tracks
  for select to anon, authenticated using (
    status = 'published' and exists (
      select 1 from public.pathways p where p.id = pathway_id and p.status = 'published'
    )
  );
-- authorization-test: public.pathway_tracks anon/authenticated may read published tracks under published pathways only; writes denied

create table public.pathway_subject_combinations (
  id uuid primary key default gen_random_uuid(),
  pathway_id uuid not null references public.pathways(id),
  track_id uuid references public.pathway_tracks(id),
  official_code text,
  slug text not null,
  display_name text not null,
  status text not null default 'draft' check (status in ('draft','published','superseded','retired')),
  source_id uuid not null references public.pathway_sources(id),
  effective_from date,
  effective_to date,
  version integer not null default 1 check (version > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pathway_id, slug, version)
);
alter table public.pathway_subject_combinations enable row level security;
revoke all on table public.pathway_subject_combinations from public, anon, authenticated;
grant select on table public.pathway_subject_combinations to anon, authenticated;
grant select, insert, update, delete on table public.pathway_subject_combinations to service_role;
create policy pathway_combinations_public_read on public.pathway_subject_combinations
  for select to anon, authenticated using (
    status = 'published' and exists (
      select 1 from public.pathways p where p.id = pathway_id and p.status = 'published'
    )
  );
-- authorization-test: public.pathway_subject_combinations anon/authenticated may read published combinations only; writes denied

create table public.pathway_combination_subjects (
  combination_id uuid not null references public.pathway_subject_combinations(id) on delete cascade,
  subject_id uuid not null references public.subjects(id),
  subject_order smallint not null default 1 check (subject_order > 0),
  requirement_role text not null default 'selected' check (requirement_role in ('selected','core','supporting')),
  source_id uuid not null references public.pathway_sources(id),
  created_at timestamptz not null default now(),
  primary key(combination_id, subject_id)
);
alter table public.pathway_combination_subjects enable row level security;
revoke all on table public.pathway_combination_subjects from public, anon, authenticated;
grant select on table public.pathway_combination_subjects to anon, authenticated;
grant select, insert, update, delete on table public.pathway_combination_subjects to service_role;
create policy pathway_combination_subjects_public_read on public.pathway_combination_subjects
  for select to anon, authenticated using (
    exists (
      select 1 from public.pathway_subject_combinations c
      where c.id = combination_id and c.status = 'published'
    )
  );
-- authorization-test: public.pathway_combination_subjects anon/authenticated may read subjects only for published combinations; writes denied

create table public.pathway_careers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  career_family text,
  plain_language_summary text not null default '',
  status text not null default 'draft' check (status in ('draft','published','superseded','retired')),
  source_id uuid not null references public.pathway_sources(id),
  source_basis text not null default 'guidance' check (source_basis in ('official','professional_requirement','guidance')),
  effective_from date,
  effective_to date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pathway_careers enable row level security;
revoke all on table public.pathway_careers from public, anon, authenticated;
grant select on table public.pathway_careers to anon, authenticated;
grant select, insert, update, delete on table public.pathway_careers to service_role;
create policy pathway_careers_public_read on public.pathway_careers
  for select to anon, authenticated using (status = 'published');
-- authorization-test: public.pathway_careers anon/authenticated may read published careers only; writes denied

create table public.pathway_career_links (
  career_id uuid not null references public.pathway_careers(id) on delete cascade,
  pathway_id uuid not null references public.pathways(id) on delete cascade,
  track_id uuid references public.pathway_tracks(id),
  relationship_type text not null default 'relevant' check (relationship_type in ('relevant','common_route','required_by_source')),
  explanation text not null default '',
  source_id uuid not null references public.pathway_sources(id),
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at timestamptz not null default now(),
  primary key(career_id, pathway_id, relationship_type)
);
alter table public.pathway_career_links enable row level security;
revoke all on table public.pathway_career_links from public, anon, authenticated;
grant select on table public.pathway_career_links to anon, authenticated;
grant select, insert, update, delete on table public.pathway_career_links to service_role;
create policy pathway_career_links_public_read on public.pathway_career_links
  for select to anon, authenticated using (
    exists (select 1 from public.pathway_careers c where c.id = career_id and c.status = 'published')
    and exists (select 1 from public.pathways p where p.id = pathway_id and p.status = 'published')
  );
-- authorization-test: public.pathway_career_links anon/authenticated may read links only when career and pathway are published; writes denied

create table public.pathway_school_offerings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id),
  pathway_id uuid not null references public.pathways(id),
  track_id uuid references public.pathway_tracks(id),
  combination_id uuid references public.pathway_subject_combinations(id),
  offering_status text not null default 'observed' check (offering_status in ('observed','verified','superseded','withdrawn')),
  source_id uuid not null references public.pathway_sources(id),
  observed_at timestamptz not null default now(),
  verified_at timestamptz,
  effective_from date,
  effective_to date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id, pathway_id, combination_id, source_id)
);
alter table public.pathway_school_offerings enable row level security;
revoke all on table public.pathway_school_offerings from public, anon, authenticated;
grant select on table public.pathway_school_offerings to anon, authenticated;
grant select, insert, update, delete on table public.pathway_school_offerings to service_role;
create policy pathway_school_offerings_public_read on public.pathway_school_offerings
  for select to anon, authenticated using (
    offering_status = 'verified'
    and verified_at is not null
    and exists (select 1 from public.pathways p where p.id = pathway_id and p.status = 'published')
  );
-- authorization-test: public.pathway_school_offerings anon/authenticated may read only verified offerings under published pathways; writes denied

create index pathway_tracks_pathway_idx on public.pathway_tracks(pathway_id, status);
create index pathway_combinations_pathway_idx on public.pathway_subject_combinations(pathway_id, track_id, status);
create index pathway_combination_subjects_subject_idx on public.pathway_combination_subjects(subject_id);
create index pathway_career_links_pathway_idx on public.pathway_career_links(pathway_id, career_id);
create index pathway_school_offerings_school_idx on public.pathway_school_offerings(school_id, offering_status);
create index pathway_school_offerings_combination_idx on public.pathway_school_offerings(combination_id, offering_status);

-- Initial authoritative high-level pathway registry. These names are seeded only
-- from the Ministry Grade 10 Selection portal; detailed tracks/combinations must
-- be ingested with record-level provenance before publication.
insert into public.pathway_sources (
  id, source_type, source_name, source_url, source_reference,
  observed_at, status, is_public, metadata
) values (
  'bdb736d5-fc4f-4f42-aec8-7cda7f4b0091'::uuid,
  'official_portal',
  'Kenya Ministry of Education Grade 10 School & Pathway Selection System',
  'https://selection.education.go.ke/about',
  'Grade 10 School & Pathway Selection System — About',
  '2026-08-16T00:00:00Z'::timestamptz,
  'active',
  true,
  jsonb_build_object('authority','Ministry of Education','jurisdiction','Kenya','cohort_scope','Grade 9 to Senior School transition')
) on conflict (id) do nothing;

insert into public.pathways (
  id, slug, name, short_name, plain_language_summary, status, source_id, version, metadata
) values
  ('34476b83-1aad-4f94-a958-c2996311079e'::uuid, 'stem', 'STEM', 'STEM', 'Science, technology, engineering and mathematics pathway.', 'published', 'bdb736d5-fc4f-4f42-aec8-7cda7f4b0091'::uuid, 1, jsonb_build_object('fact_type','official_normalized')),
  ('d9a19fd7-4f15-45de-9131-f0de50c376a0'::uuid, 'social-sciences', 'Social Sciences', 'Social Sciences', 'Social sciences pathway.', 'published', 'bdb736d5-fc4f-4f42-aec8-7cda7f4b0091'::uuid, 1, jsonb_build_object('fact_type','official_normalized')),
  ('74d3d667-e0a1-4b48-8904-31203208d139'::uuid, 'arts-and-sports-science', 'Arts & Sports Science', 'Arts & Sports', 'Arts and sports pathway.', 'published', 'bdb736d5-fc4f-4f42-aec8-7cda7f4b0091'::uuid, 1, jsonb_build_object('fact_type','official_normalized'))
on conflict (id) do nothing;
