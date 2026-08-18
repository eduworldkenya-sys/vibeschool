-- Content Factory R2 prerequisite: restore the production curriculum-intelligence
-- evidence-source relation into repository truth.
--
-- Clean rebuild certification proved that production contains this relation while the
-- tracked migration chain did not create it. Older repository migrations and the HQ
-- Curriculum Intelligence screen already depend on it.
--
-- Access: owner-read public.curriculum_intelligence_sources
-- Authorization-test: authenticated platform owners may SELECT through RLS; anon is denied;
-- authenticated clients cannot INSERT/UPDATE/DELETE; service_role owns machine writes.

create table if not exists public.curriculum_intelligence_sources (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.curriculum_intelligence_proposals(id) on delete cascade,
  url text not null check (btrim(url)<>''),
  title text,
  publisher text,
  source_type text not null default 'web'
    check (source_type in ('official','primary_research','government','academic','institutional','web','publisher')),
  authority_score numeric not null default 0 check (authority_score>=0 and authority_score<=1),
  supports_claim boolean,
  published_at timestamptz,
  accessed_at timestamptz not null default now(),
  evidence_summary text,
  retrieved_at timestamptz not null default now(),
  content_hash text,
  source_tier smallint check (source_tier between 1 and 5),
  verification_method text,
  claim_excerpt text,
  contradicts_claim boolean not null default false,
  unique(proposal_id,url)
);

create index if not exists ci_sources_proposal_idx
  on public.curriculum_intelligence_sources(proposal_id);
create index if not exists curriculum_intelligence_sources_proposal_tier_idx
  on public.curriculum_intelligence_sources(proposal_id,source_tier,authority_score desc);

alter table public.curriculum_intelligence_sources enable row level security;

drop policy if exists hq_owner_sources_all on public.curriculum_intelligence_sources;
drop policy if exists hq_owner_sources_select on public.curriculum_intelligence_sources;
create policy hq_owner_sources_select
  on public.curriculum_intelligence_sources
  for select
  to authenticated
  using ((select public.is_platform_owner()));

revoke all on table public.curriculum_intelligence_sources from public,anon,authenticated;
grant select on table public.curriculum_intelligence_sources to authenticated;
grant all on table public.curriculum_intelligence_sources to service_role;

-- Parity/security assertions: installation itself must not widen the product-client write plane.
do $$
begin
  if has_table_privilege('anon','public.curriculum_intelligence_sources','SELECT')
     or has_table_privilege('anon','public.curriculum_intelligence_sources','INSERT')
     or has_table_privilege('authenticated','public.curriculum_intelligence_sources','INSERT')
     or has_table_privilege('authenticated','public.curriculum_intelligence_sources','UPDATE')
     or has_table_privilege('authenticated','public.curriculum_intelligence_sources','DELETE') then
    raise exception 'curriculum_intelligence_sources_client_write_boundary_open';
  end if;
  if not has_table_privilege('authenticated','public.curriculum_intelligence_sources','SELECT') then
    raise exception 'curriculum_intelligence_sources_owner_read_grant_missing';
  end if;
end $$;
