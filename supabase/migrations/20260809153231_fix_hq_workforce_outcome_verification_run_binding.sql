-- Recovered verbatim from the production Supabase migration ledger for L0 replay parity.
alter table public.hq_workforce_outcome_verifications add column if not exists run_id uuid references public.hq_workforce_runs(id) on delete cascade;
create unique index if not exists hq_workforce_outcome_one_per_run_uq on public.hq_workforce_outcome_verifications(run_id) where run_id is not null;
create or replace function public.hq_workforce_verify_run(p_run_id uuid,p_expected jsonb,p_actual jsonb,p_execution_certified boolean,p_method text,p_evidence jsonb,p_verifier_ref text default null) returns uuid language plpgsql security invoker set search_path=public as $$
declare r public.hq_workforce_runs%rowtype; vid uuid; ok boolean;
begin
 select * into r from public.hq_workforce_runs where id=p_run_id for update;
 if not found then raise exception 'Run not found'; end if;
 if r.status <> 'completed' then raise exception 'Only completed runs may be outcome-verified'; end if;
 if r.authority_result <> 'allow' then raise exception 'Run was not authorized for execution'; end if;
 if p_expected is null or p_actual is null then raise exception 'Expected and actual outcomes required'; end if;
 if p_method is null or btrim(p_method)='' then raise exception 'Verification method required'; end if;
 if p_evidence is null or p_evidence='{}'::jsonb then raise exception 'Independent verification evidence required'; end if;
 ok := p_execution_certified and p_expected=p_actual;
 insert into public.hq_workforce_outcome_verifications(run_id,assignment_id,expected_outcome,actual_outcome,execution_certified,outcome_verified,verification_method,evidence,verified_at,verifier_kind,verifier_ref,verification_version)
 values(p_run_id,null,p_expected,p_actual,p_execution_certified,ok,p_method,p_evidence,now(),'independent_rule',p_verifier_ref,1)
 on conflict(run_id) where run_id is not null do update set expected_outcome=excluded.expected_outcome,actual_outcome=excluded.actual_outcome,execution_certified=excluded.execution_certified,outcome_verified=excluded.outcome_verified,verification_method=excluded.verification_method,evidence=excluded.evidence,verified_at=excluded.verified_at,verifier_kind=excluded.verifier_kind,verifier_ref=excluded.verifier_ref,verification_version=excluded.verification_version
 returning id into vid;
 if ok then update public.hq_workforce_runs set status='verified',completed_at=coalesce(completed_at,now()) where id=p_run_id; end if;
 return vid;
end $$;
create or replace view public.hq_workforce_worker_performance as
select w.id worker_id,w.worker_key,w.title,w.status,
 count(distinct r.id) total_runs,
 count(distinct r.id) filter(where r.status in ('completed','verified')) completed_runs,
 count(distinct r.id) filter(where r.status='failed') failed_runs,
 count(distinct r.id) filter(where r.status='decision_required') decision_required_runs,
 count(distinct v.id) filter(where v.execution_certified) execution_certified_count,
 count(distinct v.id) filter(where v.outcome_verified) outcome_verified_count,
 case when count(distinct v.id)>0 then round((count(distinct v.id) filter(where v.outcome_verified))::numeric/count(distinct v.id),4) else null end outcome_verification_rate
from public.hq_workforce_workers w
left join public.hq_workforce_runs r on r.worker_id=w.id
left join public.hq_workforce_outcome_verifications v on v.run_id=r.id
group by w.id,w.worker_key,w.title,w.status;
revoke all on function public.hq_workforce_verify_run(uuid,jsonb,jsonb,boolean,text,jsonb,text) from public,anon,authenticated;
