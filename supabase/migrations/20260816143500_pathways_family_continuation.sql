-- Safe acquisition bridge for a family arriving through public Pathways.
-- Adult-owned only. Never creates a learner or writes a learner Pathway Passport.

begin;

create table public.parent_pathway_drafts (
  id uuid primary key default gen_random_uuid(),
  parent_profile_id uuid not null references public.profiles(id) on delete cascade,
  pathway_id uuid not null references public.pathways(id),
  evidence_snapshot jsonb not null default '{}'::jsonb,
  rule_version text not null,
  input_fingerprint text not null,
  idempotency_key text not null,
  status text not null default 'active' check (status in ('active','adopted_by_learner','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(parent_profile_id,idempotency_key)
);
alter table public.parent_pathway_drafts enable row level security;
revoke all on table public.parent_pathway_drafts from public, anon, authenticated;
grant select on table public.parent_pathway_drafts to authenticated;
grant select, insert, update, delete on table public.parent_pathway_drafts to service_role;
create policy parent_pathway_drafts_own_read on public.parent_pathway_drafts
for select to authenticated using (parent_profile_id=(select auth.uid()));
-- authorization-test: public.parent_pathway_drafts authenticated parent reads only own adult-owned drafts; direct client writes denied.

create index parent_pathway_drafts_parent_status_idx
on public.parent_pathway_drafts(parent_profile_id,status,updated_at desc);

commit;
