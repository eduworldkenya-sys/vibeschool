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
