-- Recovered verbatim from the production Supabase migration ledger for L0 replay parity.
create table if not exists public.hq_workforce_recovery_actions (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null references public.hq_workforce_runs(id) on delete cascade,
 recovery_type text not null check(recovery_type in ('retry','rollback','reassign','escalate','reopen')),
 status text not null default 'planned' check(status in ('planned','executed','verified','failed','cancelled')),
 reason text not null,
 before_state jsonb not null default '{}'::jsonb,
 after_state jsonb not null default '{}'::jsonb,
 evidence jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), executed_at timestamptz, verified_at timestamptz
);
create unique index if not exists hq_workforce_recovery_one_active_uq on public.hq_workforce_recovery_actions(run_id,recovery_type) where status in ('planned','executed');
alter table public.hq_workforce_recovery_actions enable row level security;
create or replace function public.hq_workforce_plan_recovery(p_run_id uuid,p_type text,p_reason text,p_before jsonb default '{}'::jsonb) returns uuid language plpgsql security invoker set search_path=public as $$ declare r public.hq_workforce_runs%rowtype; rid uuid; begin
 select * into r from public.hq_workforce_runs where id=p_run_id; if not found then raise exception 'Run not found'; end if;
 if r.status not in ('failed','blocked','completed') then raise exception 'Recovery may only be planned for failed, blocked, or completed-unverified runs'; end if;
 if p_type not in ('retry','rollback','reassign','escalate','reopen') then raise exception 'Invalid recovery type'; end if;
 insert into public.hq_workforce_recovery_actions(run_id,recovery_type,reason,before_state) values(p_run_id,p_type,p_reason,coalesce(p_before,'{}'::jsonb)) returning id into rid; return rid; end $$;
create or replace view public.hq_workforce_worker_performance as
select w.id worker_id,w.worker_key,w.title,w.status,
 count(r.id) total_runs,
 count(r.id) filter(where r.status in ('completed','verified')) completed_runs,
 count(r.id) filter(where r.status='failed') failed_runs,
 count(r.id) filter(where r.status='decision_required') decision_required_runs,
 count(v.id) filter(where v.execution_certified) execution_certified_count,
 count(v.id) filter(where v.outcome_verified) outcome_verified_count,
 case when count(v.id)>0 then round((count(v.id) filter(where v.outcome_verified))::numeric/count(v.id),4) else null end outcome_verification_rate
from public.hq_workforce_workers w
left join public.hq_workforce_runs r on r.worker_id=w.id
left join public.hq_workforce_outcome_verifications v on v.assignment_id in (select a.id from public.hq_workforce_assignments a where a.worker_key=w.worker_key)
group by w.id,w.worker_key,w.title,w.status;
revoke all on function public.hq_workforce_plan_recovery(uuid,text,text,jsonb) from public,anon,authenticated;
