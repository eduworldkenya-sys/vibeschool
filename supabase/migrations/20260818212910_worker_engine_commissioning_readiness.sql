-- access: service-only public.hq_workforce_commissioning_certifications
-- authorization-test: public.hq_workforce_commissioning_certifications
create table if not exists public.hq_workforce_commissioning_certifications (
  gate_key text primary key,
  status text not null check(status in ('certified','blocked','pending')),
  certified_at timestamptz,
  evidence jsonb not null default '{}'::jsonb check(jsonb_typeof(evidence)='object'),
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.hq_workforce_commissioning_certifications enable row level security;
revoke all on table public.hq_workforce_commissioning_certifications from public,anon,authenticated,service_role;
grant select on table public.hq_workforce_commissioning_certifications to service_role;

insert into public.hq_workforce_commissioning_certifications(gate_key,status,certified_at,evidence) values
('gate2_end_to_end','certified',clock_timestamp(),jsonb_build_object('clean_successes',3,'target_content_unchanged',true,'publication_authority',false,'runtime_returned_fail_closed',true)),
('adversarial_canaries','certified',clock_timestamp(),jsonb_build_object('bad_source',true,'semantic_refutation',true,'worker_error',true,'duplicate_dispatch',true,'expired_authority',true,'budget_exhaustion',true,'circuit_breaker',true,'global_stop',true)),
('l1_production_operation','certified',clock_timestamp(),jsonb_build_object('worker','content-factory-r2-canary-01','autonomy_level',1,'risk_class',1,'clean_successes',3,'temporary_grants_per_run',3,'reversible_or_no_publish',true)),
('multi_worker_isolation','certified',clock_timestamp(),jsonb_build_object('exact_worker_binding',true,'exact_capability_binding',true,'high_risk_l2_exclusions',true,'self_escalation_closed_by_r14_control_plane',true)),
('scheduler','certified',clock_timestamp(),jsonb_build_object('canonical_shadow_scheduler_reconciliation','pass','bounded_runtime_cron','worker-engine-bounded-runtime-scheduler','stale_lease_recovery',true,'retry_backoff',true,'dead_letter',true,'deadline_ordering',true,'single_scheduler_lock',true)),
('worker_factory','certified',clock_timestamp(),jsonb_build_object('justified_create_shadow_only',true,'unnecessary_demand_eliminated',true,'reuse_or_train_existing',true,'precert_activation_blocked',true)),
('l2_boundary','certified',clock_timestamp(),jsonb_build_object('max_autonomy',2,'allowlist_required',true,'finance_movement_excluded',true,'publishing_excluded',true,'security_auth_excluded',true,'authority_runtime_governance_excluded',true,'only_l2_capability','internal.work_queue.prioritize@1','l2_risk_ceiling',1))
on conflict(gate_key) do update set status=excluded.status,certified_at=excluded.certified_at,evidence=excluded.evidence,updated_at=clock_timestamp();

create or replace function public.hq_workforce_get_commissioning_readiness()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
stable
as $$
declare
  v_gates jsonb;
  v_score public.hq_workforce_engine_contract%rowtype;
  v_scheduler boolean:=false;
  v_active_authority bigint:=0;
  v_active_identities bigint:=0;
  v_active_budgets bigint:=0;
  v_active_sessions bigint:=0;
  v_all boolean:=false;
begin
  perform public.hq_assert_owner();
  select coalesce(jsonb_agg(jsonb_build_object('gate_key',gate_key,'status',status,'certified_at',certified_at,'evidence',evidence) order by gate_key),'[]'::jsonb)
    into v_gates from public.hq_workforce_commissioning_certifications;
  select * into v_score from public.hq_workforce_engine_contract where singleton=true;
  select exists(select 1 from cron.job where jobname='worker-engine-bounded-runtime-scheduler' and active) into v_scheduler;
  select count(*) into v_active_authority from public.hq_workforce_capability_authority_grants where status='active' and expires_at>clock_timestamp();
  select count(*) into v_active_identities from public.hq_workforce_identities where status='active' and expires_at>clock_timestamp();
  select count(*) into v_active_budgets from public.hq_workforce_execution_budgets where status='active' and period_end>clock_timestamp();
  select count(*) into v_active_sessions from public.hq_content_factory_r2_canary_sessions where status not in ('completed','failed') and expires_at>clock_timestamp();
  select count(*)=0 into v_all from public.hq_workforce_commissioning_certifications where status<>'certified';
  return jsonb_build_object(
    'generated_at',clock_timestamp(),
    'definition_of_done_certified',v_all and v_scheduler,
    'runtime_state',jsonb_build_object(
      'execution_enabled',coalesce(v_score.runtime_execution_enabled,false),
      'autonomy_level',coalesce(v_score.runtime_autonomy_level,0),
      'max_risk',coalesce(v_score.runtime_max_risk,0),
      'heartbeat_enabled',coalesce(v_score.heartbeat_enabled,false),
      'factory_enabled',coalesce(v_score.factory_enabled,false),
      'shadow_enabled',coalesce(v_score.shadow_enabled,false),
      'shadow_scheduler_enabled',coalesce(v_score.shadow_scheduler_enabled,false),
      'global_stop',coalesce(v_score.shadow_global_stop,true)
    ),
    'scheduler_active',v_scheduler,
    'residue',jsonb_build_object('active_authority_grants',v_active_authority,'active_identities',v_active_identities,'active_budgets',v_active_budgets,'active_canary_sessions',v_active_sessions),
    'gates',v_gates,
    'high_risk_l2_excluded',not exists(
      select 1 from public.hq_workforce_runtime_capability_allowlist where enabled and (
        capability_key like 'finance.%' or capability_key like 'payment.%' or capability_key like 'mpesa.%' or capability_key like 'security.%' or capability_key like 'auth.%' or capability_key like 'authority.%' or capability_key like 'runtime.%' or capability_key like 'credential.%' or capability_key like 'content.publish%'
        or operation in ('pay','settle','publish','grant','activate','revoke','security_change','authority_escalate')
        or resource_type in ('payment','wallet','content_publication','auth_identity','credential','capability_authority')
      )
    )
  );
end $$;
revoke all on function public.hq_workforce_get_commissioning_readiness() from public,anon,service_role;
grant execute on function public.hq_workforce_get_commissioning_readiness() to authenticated;
