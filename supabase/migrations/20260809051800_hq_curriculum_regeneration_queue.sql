create table if not exists public.curriculum_intelligence_regeneration_jobs (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.curriculum_intelligence_proposals(id) on delete cascade,
  chapter_id uuid not null references public.vibe_chapters(id) on delete cascade,
  job_type text not null,
  status text not null default 'queued',
  attempt_count int not null default 0,
  last_error text,
  result jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(proposal_id,job_type)
);
alter table public.curriculum_intelligence_regeneration_jobs enable row level security;
revoke all on public.curriculum_intelligence_regeneration_jobs from anon;
grant select,insert,update on public.curriculum_intelligence_regeneration_jobs to authenticated;
drop policy if exists hq_regeneration_owner_all on public.curriculum_intelligence_regeneration_jobs;
create policy hq_regeneration_owner_all on public.curriculum_intelligence_regeneration_jobs for all to authenticated using (public.is_platform_owner()) with check (public.is_platform_owner());

do $$ begin
 alter table public.curriculum_intelligence_regeneration_jobs add constraint curriculum_intelligence_regeneration_job_type_check check(job_type in ('teacher_notes','assessment','project_brief','vibelab_review','qa'));
exception when duplicate_object then null; end $$;
do $$ begin
 alter table public.curriculum_intelligence_regeneration_jobs add constraint curriculum_intelligence_regeneration_status_check check(status in ('queued','running','completed','failed','skipped'));
exception when duplicate_object then null; end $$;

create or replace function public.hq_enqueue_curriculum_intelligence_regeneration(p_proposal_id uuid)
returns int language plpgsql security definer set search_path='public','pg_temp' as $$
declare p public.curriculum_intelligence_proposals%rowtype; n int:=0; jt text;
begin
 if not public.is_platform_owner() then raise exception 'HQ platform owner required'; end if;
 select * into p from public.curriculum_intelligence_proposals where id=p_proposal_id;
 if not found then raise exception 'Proposal not found'; end if;
 if p.status <> 'applied' then raise exception 'Proposal must be applied before regeneration'; end if;
 foreach jt in array array['teacher_notes','assessment','project_brief','vibelab_review','qa'] loop
   insert into public.curriculum_intelligence_regeneration_jobs(proposal_id,chapter_id,job_type)
   values(p.id,p.chapter_id,jt) on conflict(proposal_id,job_type) do nothing;
   if found then n:=n+1; end if;
 end loop;
 return n;
end $$;
revoke all on function public.hq_enqueue_curriculum_intelligence_regeneration(uuid) from public,anon;
grant execute on function public.hq_enqueue_curriculum_intelligence_regeneration(uuid) to authenticated;
