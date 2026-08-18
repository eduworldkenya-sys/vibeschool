-- Content Factory R2 prerequisite: restore production research queue into repository truth.
--
-- CI exposed that production contains curriculum_research_jobs + its queue RPCs but a clean
-- repository rebuild does not. This migration captures that existing production contract so
-- future migrations can be reproduced from source control. It is non-activating and service-only.

create table if not exists public.curriculum_research_jobs (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.curriculum_intelligence_proposals(id) on delete cascade,
  watch_target_id uuid references public.curriculum_intelligence_watch_targets(id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued','running','evidence_ready','needs_human','failed','cancelled')),
  priority integer not null default 50 check (priority between 0 and 100),
  research_question text not null check (btrim(research_question)<>''),
  required_source_count smallint not null default 2 check (required_source_count between 1 and 10),
  require_primary_source boolean not null default true,
  allowed_domains text[],
  claimed_at timestamptz,
  claimed_by text,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  last_error text,
  evidence_score numeric,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists curriculum_research_jobs_active_uq
  on public.curriculum_research_jobs(proposal_id)
  where status in ('queued','running','evidence_ready','needs_human');
create index if not exists curriculum_research_jobs_queue_idx
  on public.curriculum_research_jobs(status,priority desc,created_at);

alter table public.curriculum_research_jobs enable row level security;
revoke all on table public.curriculum_research_jobs from public,anon,authenticated;
grant all on table public.curriculum_research_jobs to service_role;

create or replace function public.enqueue_proposal_research(p_proposal_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  p public.curriculum_intelligence_proposals%rowtype;
  w public.curriculum_intelligence_watch_targets%rowtype;
  j uuid;
begin
  select * into p from public.curriculum_intelligence_proposals where id=p_proposal_id;
  if not found then raise exception 'proposal_not_found'; end if;
  if p.status<>'pending_review' then raise exception 'proposal_not_pending_review'; end if;
  if p.watch_target_id is not null then
    select * into w from public.curriculum_intelligence_watch_targets where id=p.watch_target_id;
  end if;
  insert into public.curriculum_research_jobs(
    proposal_id,watch_target_id,research_question,allowed_domains,priority,
    required_source_count,require_primary_source
  ) values(
    p.id,p.watch_target_id,coalesce(nullif(p.claim,''),p.title),w.preferred_domains,
    case when p.curriculum_relevance in ('C4','C5') then 90 when p.volatility='high' then 80 else 60 end,
    case when p.curriculum_relevance in ('C4','C5') or p.volatility='high' then 3 else 2 end,
    true
  )
  on conflict(proposal_id) where status in ('queued','running','evidence_ready','needs_human')
  do update set priority=greatest(public.curriculum_research_jobs.priority,excluded.priority),updated_at=now()
  returning id into j;
  return j;
end $$;

create or replace function public.claim_next_research_job(p_worker text)
returns public.curriculum_research_jobs
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare j public.curriculum_research_jobs%rowtype;
begin
  if nullif(btrim(p_worker),'') is null then raise exception 'research_worker_required'; end if;
  select * into j
    from public.curriculum_research_jobs
   where status='queued' and attempt_count<max_attempts
   order by priority desc,created_at
   for update skip locked
   limit 1;
  if not found then return null; end if;
  update public.curriculum_research_jobs
     set status='running',claimed_at=now(),claimed_by=p_worker,
         attempt_count=attempt_count+1,updated_at=now()
   where id=j.id
   returning * into j;
  return j;
end $$;

-- Production parity baseline. R2.1 immediately replaces this finalizer with the stronger
-- semantic evidence trust gate in subsequent migrations.
create or replace function public.finalize_research_job(p_job_id uuid,p_result jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  j public.curriculum_research_jobs%rowtype;
  n int;
  primary_n int;
  contradict_n int;
  avg_auth numeric;
  score numeric;
  verdict text;
begin
  select * into j from public.curriculum_research_jobs where id=p_job_id for update;
  if not found then raise exception 'research_job_not_found'; end if;
  select count(*),
         count(*) filter(where source_tier=1 or source_type in ('official','primary_research','government')),
         count(*) filter(where contradicts_claim),
         coalesce(avg(authority_score),0)
    into n,primary_n,contradict_n,avg_auth
    from public.curriculum_intelligence_sources
   where proposal_id=j.proposal_id;
  score:=least(1,greatest(0,
    (least(n,j.required_source_count)::numeric/j.required_source_count)*0.45
    + least(avg_auth,1)*0.35
    + (case when not j.require_primary_source or primary_n>0 then .20 else 0 end)
    - least(contradict_n*.20,.40)
  ));
  verdict:=case
    when n<j.required_source_count then 'needs_human'
    when j.require_primary_source and primary_n=0 then 'needs_human'
    when contradict_n>0 then 'needs_human'
    when score>=.80 then 'evidence_ready'
    else 'needs_human'
  end;
  update public.curriculum_research_jobs
     set status=verdict,evidence_score=score,
         result=coalesce(p_result,'{}'::jsonb)||jsonb_build_object(
           'source_count',n,'primary_source_count',primary_n,
           'contradiction_count',contradict_n,'authority_average',avg_auth),
         completed_at=now(),updated_at=now()
   where id=j.id;
  update public.curriculum_intelligence_proposals
     set verification_status=case when verdict='evidence_ready' then 'verified' else 'insufficient_evidence' end,
         confidence=case when verdict='evidence_ready' then greatest(confidence,score) else least(confidence,score) end,
         editorial_status=case when verdict='evidence_ready' then editorial_status else 'needs_review' end,
         updated_at=now()
   where id=j.proposal_id;
  return jsonb_build_object(
    'status',verdict,'evidence_score',score,'source_count',n,
    'primary_source_count',primary_n,'contradictions',contradict_n
  );
end $$;

create or replace function public.fail_research_job(p_job_id uuid,p_error text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  j public.curriculum_research_jobs%rowtype;
  next_status text;
begin
  select * into j from public.curriculum_research_jobs where id=p_job_id for update;
  if not found then raise exception 'research_job_not_found'; end if;
  next_status:=case when j.attempt_count<j.max_attempts then 'queued' else 'failed' end;
  update public.curriculum_research_jobs
     set status=next_status,
         last_error=left(coalesce(p_error,'unknown_error'),2000),
         claimed_at=null,claimed_by=null,updated_at=now(),
         completed_at=case when next_status='failed' then now() else null end
   where id=p_job_id;
  return jsonb_build_object('status',next_status,'attempt_count',j.attempt_count,'max_attempts',j.max_attempts);
end $$;

create or replace function public.curriculum_proposal_research_gate(p_proposal_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=public,pg_temp
as $$
select jsonb_build_object(
  'proposal_id',p_proposal_id,
  'research_status',coalesce((select status from public.curriculum_research_jobs where proposal_id=p_proposal_id order by created_at desc limit 1),'missing'),
  'evidence_score',coalesce((select evidence_score from public.curriculum_research_jobs where proposal_id=p_proposal_id order by created_at desc limit 1),0),
  'sources',(select count(*) from public.curriculum_intelligence_sources where proposal_id=p_proposal_id),
  'primary_sources',(select count(*) from public.curriculum_intelligence_sources where proposal_id=p_proposal_id and (source_tier=1 or source_type in ('official','primary_research','government'))),
  'contradictions',(select count(*) from public.curriculum_intelligence_sources where proposal_id=p_proposal_id and contradicts_claim),
  'release_ready',coalesce((select status='evidence_ready' and evidence_score>=.80 from public.curriculum_research_jobs where proposal_id=p_proposal_id order by created_at desc limit 1),false)
);
$$;

revoke all on function public.enqueue_proposal_research(uuid) from public,anon,authenticated;
revoke all on function public.claim_next_research_job(text) from public,anon,authenticated;
revoke all on function public.finalize_research_job(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.fail_research_job(uuid,text) from public,anon,authenticated;
revoke all on function public.curriculum_proposal_research_gate(uuid) from public,anon,authenticated;
grant execute on function public.enqueue_proposal_research(uuid) to service_role;
grant execute on function public.claim_next_research_job(text) to service_role;
grant execute on function public.finalize_research_job(uuid,jsonb) to service_role;
grant execute on function public.fail_research_job(uuid,text) to service_role;
grant execute on function public.curriculum_proposal_research_gate(uuid) to service_role;
