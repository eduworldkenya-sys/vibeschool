-- L0 recovery: reconstruct the pre-tracked HQ authority and
-- curriculum-intelligence objects that this migration extends. Definitions are
-- derived read-only from the production catalog; engine-run/editorial columns
-- and vocabulary constraints remain owned by their original later migrations.

create table if not exists public.platform_owners (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  added_by text not null default 'migration',
  note text,
  created_at timestamptz not null default now()
);

create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select auth.uid() is not null
    and exists (
      select 1
      from public.platform_owners
      where profile_id = auth.uid()
    );
$function$;

create table if not exists public.curriculum_intelligence_watch_targets (
  id uuid primary key default gen_random_uuid(),
  label text not null check (btrim(label) <> ''),
  scope_type text not null check (scope_type = any(array['curriculum','subject','publication','chapter','topic','source']::text[])),
  subject text,
  grade text,
  publication_id uuid references public.vibe_publications(id) on delete cascade,
  chapter_id uuid references public.vibe_chapters(id) on delete cascade,
  query text not null check (btrim(query) <> ''),
  preferred_domains text[] not null default '{}'::text[],
  source_priority jsonb not null default '{}'::jsonb,
  cadence text not null default 'weekly' check (cadence = any(array['daily','weekly','monthly','manual']::text[])),
  enabled boolean not null default true,
  last_checked_at timestamptz,
  next_check_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.curriculum_intelligence_proposals (
  id uuid primary key default gen_random_uuid(),
  watch_target_id uuid references public.curriculum_intelligence_watch_targets(id) on delete set null,
  publication_id uuid references public.vibe_publications(id) on delete cascade,
  chapter_id uuid references public.vibe_chapters(id) on delete cascade,
  curriculum_id uuid references public.curriculum(id) on delete set null,
  outcome_id uuid references public.curriculum_learning_outcomes(id) on delete set null,
  proposal_type text not null,
  title text not null check (btrim(title) <> ''),
  claim text,
  current_content text,
  proposed_content text not null check (btrim(proposed_content) <> ''),
  patch jsonb not null default '{}'::jsonb,
  rationale text not null check (btrim(rationale) <> ''),
  curriculum_relevance text not null default 'C3' check (curriculum_relevance = any(array['C0','C1','C2','C3','C4','C5']::text[])),
  confidence numeric not null default 0 check (confidence >= 0 and confidence <= 1),
  verification_status text not null default 'unverified' check (verification_status = any(array['verified','disputed','outdated','unverified','false','insufficient_evidence']::text[])),
  volatility text not null default 'medium' check (volatility = any(array['low','medium','high']::text[])),
  status text not null default 'pending_review' check (status = any(array['pending_review','approved','rejected','applied','superseded']::text[])),
  generated_by text not null default 'curriculum_intelligence_engine',
  generated_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  applied_by uuid references public.profiles(id) on delete set null,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.curriculum_intelligence_audit (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid references public.curriculum_intelligence_proposals(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  before_state jsonb,
  after_state jsonb,
  note text,
  created_at timestamptz not null default now()
);

alter table public.curriculum_intelligence_watch_targets enable row level security;
alter table public.curriculum_intelligence_proposals enable row level security;
alter table public.curriculum_intelligence_audit enable row level security;

drop policy if exists hq_owner_watch_targets_all on public.curriculum_intelligence_watch_targets;
create policy hq_owner_watch_targets_all
  on public.curriculum_intelligence_watch_targets
  for all to public
  using (public.is_platform_owner())
  with check (public.is_platform_owner());

drop policy if exists hq_owner_proposals_all on public.curriculum_intelligence_proposals;
create policy hq_owner_proposals_all
  on public.curriculum_intelligence_proposals
  for all to public
  using (public.is_platform_owner())
  with check (public.is_platform_owner());

drop policy if exists hq_owner_audit_select on public.curriculum_intelligence_audit;
create policy hq_owner_audit_select
  on public.curriculum_intelligence_audit
  for select to public
  using (public.is_platform_owner());

create table if not exists public.curriculum_intelligence_runs (
  id uuid primary key default gen_random_uuid(),
  watch_target_id uuid references public.curriculum_intelligence_watch_targets(id) on delete set null,
  status text not null default 'running' check (status in ('running','completed','failed','no_change','duplicate')),
  trigger_type text not null default 'manual' check (trigger_type in ('manual','scheduled')),
  started_by uuid null references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  model text null,
  search_requests integer not null default 0 check (search_requests >= 0),
  proposals_created integer not null default 0 check (proposals_created >= 0),
  sources_found integer not null default 0 check (sources_found >= 0),
  summary text null,
  error text null,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.curriculum_intelligence_runs enable row level security;

drop policy if exists "platform owners read curriculum intelligence runs" on public.curriculum_intelligence_runs;
create policy "platform owners read curriculum intelligence runs"
on public.curriculum_intelligence_runs for select
to authenticated
using ((select public.is_platform_owner()));

grant select on public.curriculum_intelligence_runs to authenticated;

alter table public.curriculum_intelligence_proposals
  add column if not exists engine_run_id uuid null references public.curriculum_intelligence_runs(id) on delete set null,
  add column if not exists research_fingerprint text null;

create unique index if not exists curriculum_intelligence_proposals_research_fingerprint_uidx
  on public.curriculum_intelligence_proposals(research_fingerprint)
  where research_fingerprint is not null;
create index if not exists curriculum_intelligence_runs_started_at_idx on public.curriculum_intelligence_runs(started_at desc);
create index if not exists curriculum_intelligence_runs_watch_target_idx on public.curriculum_intelligence_runs(watch_target_id, started_at desc);

create or replace function public.hq_mark_curriculum_watch_checked(p_watch_target_id uuid, p_checked_at timestamptz default now())
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cadence text;
  v_next timestamptz;
begin
  if not public.is_platform_owner() then raise exception 'platform_owner_required'; end if;
  select cadence into v_cadence from public.curriculum_intelligence_watch_targets where id = p_watch_target_id;
  if not found then raise exception 'watch_target_not_found'; end if;
  v_next := case v_cadence when 'daily' then p_checked_at + interval '1 day' when 'monthly' then p_checked_at + interval '1 month' else p_checked_at + interval '7 days' end;
  update public.curriculum_intelligence_watch_targets set last_checked_at=p_checked_at,next_check_at=v_next,updated_at=now() where id=p_watch_target_id;
end;
$$;

grant execute on function public.hq_mark_curriculum_watch_checked(uuid,timestamptz) to authenticated;
