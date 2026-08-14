begin;

-- Publication-level curriculum provenance. This deliberately separates
-- "aligned to curriculum" from any external KICD approval/endorsement claim.
create table if not exists public.publication_curriculum_provenance (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.vibe_publications(id) on delete cascade,
  curriculum_id uuid references public.curriculum(id) on delete set null,
  curriculum_version text,
  jurisdiction text not null default 'KE',
  framework text not null default 'CBC',
  source_authority text not null,
  source_reference text not null,
  alignment_status text not null default 'draft',
  external_review_status text not null default 'not_submitted',
  external_reference text,
  evidence jsonb not null default '{}'::jsonb,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint publication_curriculum_provenance_source_nonempty check (btrim(source_authority) <> '' and btrim(source_reference) <> ''),
  constraint publication_curriculum_provenance_alignment_check check (alignment_status in ('draft','mapped','reviewed','verified','rejected','superseded')),
  constraint publication_curriculum_provenance_external_check check (external_review_status in ('not_submitted','submitted','under_review','approved','rejected','not_applicable')),
  constraint publication_curriculum_provenance_review_check check (
    alignment_status not in ('reviewed','verified','rejected') or (reviewed_by is not null and reviewed_at is not null)
  ),
  constraint publication_curriculum_provenance_external_reference_check check (
    external_review_status <> 'approved' or (external_reference is not null and btrim(external_reference) <> '')
  )
);

create unique index if not exists publication_curriculum_provenance_active_uidx
  on public.publication_curriculum_provenance(publication_id, framework, jurisdiction)
  where alignment_status <> 'superseded';
create index if not exists publication_curriculum_provenance_publication_idx
  on public.publication_curriculum_provenance(publication_id);
create index if not exists publication_curriculum_provenance_status_idx
  on public.publication_curriculum_provenance(alignment_status, external_review_status);

alter table public.publication_curriculum_provenance enable row level security;
revoke all on public.publication_curriculum_provenance from public, anon, authenticated;
grant select, insert, update, delete on public.publication_curriculum_provenance to authenticated;
grant all on public.publication_curriculum_provenance to service_role;

create policy publication_curriculum_provenance_public_verified_read
  on public.publication_curriculum_provenance for select to authenticated
  using (
    alignment_status = 'verified'
    and exists (
      select 1 from public.vibe_publications p
      where p.id = publication_id and p.status = 'published'
    )
  );

create policy publication_curriculum_provenance_author_manage
  on public.publication_curriculum_provenance for all to authenticated
  using (
    exists (
      select 1 from public.vibe_publications p
      where p.id = publication_id and p.author_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.vibe_publications p
      where p.id = publication_id and p.author_id = (select auth.uid())
    )
    and alignment_status in ('draft','mapped')
    and external_review_status in ('not_submitted','not_applicable')
    and reviewed_by is null
    and reviewed_at is null
    and external_reference is null
  );

-- External approval and verified-alignment states are intentionally service/HQ
-- controlled. Authors cannot self-certify KICD approval or verified alignment.
comment on table public.publication_curriculum_provenance is
  'Evidence-backed curriculum provenance. external_review_status=approved requires a real external reference; author writes cannot self-certify reviewed/verified/approved states.';

commit;
