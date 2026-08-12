-- Recovered verbatim from the production Supabase migration ledger for L0 replay parity.
create table if not exists public.hq_workforce_certification_results (
 id uuid primary key default gen_random_uuid(), certification_key text not null, subject_type text not null, subject_key text not null, check_key text not null, passed boolean not null, evidence jsonb not null default '{}'::jsonb, checked_at timestamptz not null default now(), unique(certification_key,subject_type,subject_key,check_key)
);
alter table public.hq_workforce_certification_results enable row level security;
create or replace function public.hq_context_scope_allows(p_scope_id uuid,p_fact_key text) returns boolean language sql stable security invoker set search_path=public as $$
 select exists(select 1 from public.hq_context_scopes s where s.id=p_scope_id and (cardinality(s.allowed_fact_keys)=0 or p_fact_key=any(s.allowed_fact_keys)) and not p_fact_key=any(s.denied_fact_keys));
$$;
create or replace function public.hq_workforce_diagnose_gap(p_gap_id uuid) returns uuid language plpgsql security invoker set search_path=public as $$
declare g public.hq_workforce_gap_signals%rowtype; d text; decision text; reason text; eid uuid;
begin
 select * into g from public.hq_workforce_gap_signals where id=p_gap_id;
 if not found then raise exception 'Gap not found'; end if;
 if g.signal_type='capacity_gap' and g.gap_key like 'lane-unowned:%' then d:='missing_ownership'; decision:='assign_existing_or_create_worker'; reason:='Active lane has no accountable owner.';
 elsif g.signal_type in ('skill_gap','missing_skill') then d:='missing_skill'; decision:='train_existing_worker'; reason:='Required capability is absent; training precedes hiring.';
 elsif g.signal_type in ('automation_failure','tool_failure') then d:='tool_or_automation_failure'; decision:='repair_system'; reason:='Repair the system before adding workforce capacity.';
 elsif g.signal_type in ('routing_failure','misroute') then d:='routing_defect'; decision:='repair_routing'; reason:='Work is reaching the wrong lane or owner.';
 elsif g.signal_type in ('backlog_growth','capacity_pressure') then d:='capacity_pressure'; decision:='rebalance_then_capacity'; reason:='Rebalance existing capacity before creating a worker.';
 elsif g.signal_type in ('policy_failure','policy_gap') then d:='policy_or_enforcement_gap'; decision:='repair_policy_or_enforcement'; reason:='Policy or enforcement should be corrected before staffing.';
 else d:='unknown'; decision:='human_diagnosis'; reason:='No certified deterministic diagnosis matched; do not auto-hire.'; end if;
 insert into public.hq_workforce_gap_evaluations(gap_id,diagnosis,decision,reason,execution_method) values(g.id,d,decision,reason,'local_algorithm') returning id into eid;
 update public.hq_workforce_gap_signals set status='evaluating' where id=g.id and status='candidate';
 return eid;
end $$;
revoke all on function public.hq_context_scope_allows(uuid,text) from public,anon,authenticated;
revoke all on function public.hq_workforce_diagnose_gap(uuid) from public,anon,authenticated;
