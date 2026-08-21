-- Repository parity prerequisite for Priority 5 content convergence.
-- Production already contains this relation; clean reconstruction must create it
-- before content_convergence_versions binds optional revision lineage.
-- authorization-test: public.publication_revisions author-scoped SELECT only; direct writes denied to authenticated/anon

create table if not exists public.publication_revisions (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.vibe_publications(id) on delete cascade,
  revision_number integer not null,
  snapshot jsonb not null,
  created_by uuid not null references auth.users(id),
  reason text,
  created_at timestamptz not null default now(),
  unique (publication_id, revision_number)
);

alter table public.publication_revisions enable row level security;

-- Fail closed at the relation privilege boundary. Authenticated authors receive
-- only SELECT; revision writes remain governed by the existing server-side flow.
revoke all on table public.publication_revisions from public, anon, authenticated;
grant select on table public.publication_revisions to authenticated;
grant all on table public.publication_revisions to service_role;

drop policy if exists publication_revisions_owner_read on public.publication_revisions;
create policy publication_revisions_owner_read
on public.publication_revisions
for select
to authenticated
using (
  exists (
    select 1
    from public.vibe_publications p
    where p.id = publication_revisions.publication_id
      and p.author_id = (select auth.uid())
  )
);
