-- access: private owner-scoped public.school_follows
-- authorization-test: public.school_follows scripts/test-school-follows-contract.mjs
-- School interest is not school membership, staff authorization or a claim.
-- Reference the already-curated public URL identity, never an unverified name.
create table public.school_follows (
  school_slug text not null references public.school_public_urls(slug) on delete restrict,
  follower_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (school_slug, follower_id)
);
create index school_follows_by_follower_idx
  on public.school_follows (follower_id, created_at desc);
alter table public.school_follows enable row level security;
revoke all on public.school_follows from public, anon, authenticated;
grant select, insert, delete on public.school_follows to authenticated;

-- Followers see only their own subscriptions. No publicly readable follower roster.
create policy school_follows_read_own on public.school_follows
  for select to authenticated
  using (follower_id = (select auth.uid()));

-- Fail closed if the target is closed/deleted or if the slug has no active public identity.
-- The existing bounded public resolver is authoritative for active school visibility.
create policy school_follows_insert_own_active on public.school_follows
  for insert to authenticated
  with check (
    follower_id = (select auth.uid())
    and exists (
      select 1 from public.schools_resolve_url_public_v1(school_slug, null, null)
    )
  );

create policy school_follows_delete_own on public.school_follows
  for delete to authenticated
  using (follower_id = (select auth.uid()));

comment on table public.school_follows is
  'Opt-in follows of public school URLs. Never grants school membership, private circular access, claims or admin authority.';
