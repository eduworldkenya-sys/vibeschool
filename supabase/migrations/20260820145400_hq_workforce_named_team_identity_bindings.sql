-- Complete governed production identity bindings for the named HQ team.
-- NON-ACTIVATING: this creates no runtime grant, scheduler, autonomy, risk or execution enablement.

insert into public.hq_workforce_workers (
  worker_key, worker_kind, title, department_key, job_key, manager_worker_key,
  mission, status, reasoning_mode, paid_ai_allowed,
  competencies, permissions, approval_boundaries, kpis
)
values (
  'platform-worker-01',
  'digital',
  'Platform Reliability Worker',
  'operations',
  null,
  null,
  'Protect platform reliability, recovery readiness and operational health while escalating consequential actions for approval.',
  'active',
  'deterministic',
  false,
  '["reliability diagnosis","incident evidence","recovery verification"]'::jsonb,
  '["read_hq_work","record_evidence","request_approval"]'::jsonb,
  '["no_destructive_actions","no_runtime_activation","no_authority_change","no_external_high_impact_without_approval"]'::jsonb,
  '["verified_recovery_rate","incident_escape_rate","evidence_completeness"]'::jsonb
)
on conflict (worker_key) do update set
  title=excluded.title,
  department_key=excluded.department_key,
  mission=excluded.mission,
  reasoning_mode='deterministic',
  paid_ai_allowed=false,
  competencies=excluded.competencies,
  permissions=excluded.permissions,
  approval_boundaries=excluded.approval_boundaries,
  kpis=excluded.kpis,
  updated_at=clock_timestamp();

-- Preserve the current safe Worker Engine posture.
do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 or ec.runtime_max_risk<>0 then
    raise exception 'named_team_identity_binding_must_not_activate_runtime';
  end if;
end $$;
