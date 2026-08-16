-- Authoritative Pathways observation staging.
-- Official source records land here before canonical promotion.

begin;

create table public.pathway_source_observations (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.pathway_sources(id),
  observation_kind text not null check (observation_kind in ('pathway','track','subject_combination','career_link','school_offering')),
  external_record_id text not null,
  external_parent_id text,
  observed_label text not null,
  observed_payload jsonb not null default '{}'::jsonb,
  evidence_url text,
  observed_at timestamptz not null default now(),
  content_hash text not null,
  reconciliation_status text not null default 'pending' check (reconciliation_status in ('pending','matched','ambiguous','rejected','superseded')),
  canonical_pathway_id uuid references public.pathways(id),
  canonical_track_id uuid references public.pathway_tracks(id),
  canonical_combination_id uuid references public.pathway_subject_combinations(id),
  canonical_school_id uuid references public.schools(id),
  reconciled_at timestamptz,
  reconciliation_note text,
  created_at timestamptz not null default now(),
  unique(source_id,observation_kind,external_record_id,content_hash)
);
alter table public.pathway_source_observations enable row level security;
revoke all on table public.pathway_source_observations from public, anon, authenticated;
grant select, insert, update, delete on table public.pathway_source_observations to service_role;
-- access: service-only public.pathway_source_observations
-- authorization-test: public.pathway_source_observations anon/authenticated have no table privileges or policy; only service ingestion/reconciliation is allowed.

create index pathway_source_observations_pending_idx
on public.pathway_source_observations(reconciliation_status,observation_kind,observed_at desc);
create index pathway_source_observations_school_idx
on public.pathway_source_observations(canonical_school_id,reconciliation_status)
where canonical_school_id is not null;
create index pathway_source_observations_combination_idx
on public.pathway_source_observations(canonical_combination_id,reconciliation_status)
where canonical_combination_id is not null;

commit;
