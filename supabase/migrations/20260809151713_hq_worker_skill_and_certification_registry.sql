-- Recovered verbatim from the production Supabase migration ledger for L0 replay parity.
create table if not exists public.hq_workforce_worker_skills(
 id uuid primary key default gen_random_uuid(), worker_id uuid not null references public.hq_workforce_workers(id) on delete cascade, skill_id uuid not null references public.hq_workforce_skills(id) on delete restrict, status text not null default 'assigned' check(status in ('assigned','probation','certified','suspended','retired')), assigned_at timestamptz not null default now(), certified_at timestamptz, unique(worker_id,skill_id)
);
create table if not exists public.hq_workforce_worker_certifications(
 id uuid primary key default gen_random_uuid(), worker_id uuid not null references public.hq_workforce_workers(id) on delete cascade, lane_key text not null references public.hq_workforce_lanes(lane_key), certification_version integer not null default 1, checks jsonb not null, passed boolean not null, evidence_snapshot_id uuid references public.hq_context_decision_snapshots(id), certified_at timestamptz not null default now()
);
alter table public.hq_workforce_worker_skills enable row level security; alter table public.hq_workforce_worker_certifications enable row level security;
revoke all on public.hq_workforce_worker_skills,public.hq_workforce_worker_certifications from anon,authenticated;
insert into public.hq_workforce_worker_skills(worker_id,skill_id,status)
select w.id,s.id,'probation' from public.hq_workforce_lanes l join public.hq_workforce_workers w on w.id=l.owner_worker_id join public.hq_workforce_skills s on s.lane_key=l.lane_key and s.status='certified'
on conflict(worker_id,skill_id) do update set status='probation';
insert into public.hq_context_scopes(scope_type,scope_owner_key,allowed_fact_keys,denied_fact_keys)
select 'lane',l.lane_key,case l.lane_key when 'operations' then array['work.open.count','work.unverified.count']::text[] when 'product-quality' then array['work.unverified.count']::text[] when 'growth' then array['users.active.count','schools.memberships.count']::text[] else array[]::text[] end,array[]::text[] from public.hq_workforce_lanes l
on conflict(scope_type,scope_owner_key) do update set allowed_fact_keys=excluded.allowed_fact_keys;
insert into public.hq_context_scopes(scope_type,scope_owner_key,allowed_fact_keys,denied_fact_keys)
select 'worker',w.worker_key,coalesce(ls.allowed_fact_keys,array[]::text[]),coalesce(ls.denied_fact_keys,array[]::text[]) from public.hq_workforce_workers w join public.hq_workforce_lanes l on l.owner_worker_id=w.id left join public.hq_context_scopes ls on ls.scope_type='lane' and ls.scope_owner_key=l.lane_key
on conflict(scope_type,scope_owner_key) do update set allowed_fact_keys=excluded.allowed_fact_keys,denied_fact_keys=excluded.denied_fact_keys;
create or replace function public.hq_workforce_certify_probation_workers() returns integer language plpgsql security invoker set search_path=public as $$ declare r record; sid uuid; checks jsonb; ok boolean; n integer:=0; begin
 for r in select w.id worker_id,w.worker_key,w.paid_ai_allowed,w.status,l.lane_key from public.hq_workforce_workers w join public.hq_workforce_lanes l on l.owner_worker_id=w.id where w.status='probation' loop
  ok := (r.paid_ai_allowed=false)
    and exists(select 1 from public.hq_workforce_assignments a where a.worker_key=r.worker_key and a.active)
    and exists(select 1 from public.hq_workforce_worker_skills ws join public.hq_workforce_skills s on s.id=ws.skill_id where ws.worker_id=r.worker_id and s.lane_key=r.lane_key and s.status='certified')
    and exists(select 1 from public.hq_context_scopes sc where sc.scope_type='worker' and sc.scope_owner_key=r.worker_key);
  checks:=jsonb_build_object('paid_ai_disabled',r.paid_ai_allowed=false,'role_assignment',exists(select 1 from public.hq_workforce_assignments a where a.worker_key=r.worker_key and a.active),'certified_lane_skill',exists(select 1 from public.hq_workforce_worker_skills ws join public.hq_workforce_skills s on s.id=ws.skill_id where ws.worker_id=r.worker_id and s.lane_key=r.lane_key and s.status='certified'),'context_scope',exists(select 1 from public.hq_context_scopes sc where sc.scope_type='worker' and sc.scope_owner_key=r.worker_key));
  sid:=public.hq_context_capture_company_snapshot('worker-cert:'||r.worker_key||':'||extract(epoch from now())::bigint,'worker_certification','Probation worker certification against deterministic workforce controls.');
  insert into public.hq_workforce_worker_certifications(worker_id,lane_key,checks,passed,evidence_snapshot_id) values(r.worker_id,r.lane_key,checks,ok,sid);
  if ok then update public.hq_workforce_workers set status='active',updated_at=now() where id=r.worker_id; update public.hq_workforce_worker_skills set status='certified',certified_at=now() where worker_id=r.worker_id and status='probation'; n:=n+1; end if;
 end loop; return n; end $$;
revoke all on function public.hq_workforce_certify_probation_workers() from public,anon,authenticated;
