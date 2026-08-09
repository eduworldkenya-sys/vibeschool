-- Fail-closed reproducibility guard for the certified HQ Workforce OS.
-- This migration intentionally validates the required live schema instead of
-- silently allowing an incomplete environment to continue.
do $$
declare missing text[] := '{}'::text[]; obj text;
begin
  foreach obj in array array[
    'hq_context_decision_snapshots','hq_context_fact_definitions','hq_context_facts_cache','hq_context_provenance','hq_context_scopes','hq_context_sources',
    'hq_workforce_certification_results','hq_workforce_correction_events','hq_workforce_decisions','hq_workforce_evidence_policies','hq_workforce_evidence_qualifications',
    'hq_workforce_gap_evaluations','hq_workforce_gap_signals','hq_workforce_handoffs','hq_workforce_hr_diagnoses','hq_workforce_lanes','hq_workforce_learning_candidates',
    'hq_workforce_monitoring_alerts','hq_workforce_outcome_verifications','hq_workforce_positive_evidence','hq_workforce_probation_policies','hq_workforce_recovery_actions',
    'hq_workforce_replay_results','hq_workforce_runs','hq_workforce_security_events','hq_workforce_skill_promotions','hq_workforce_skills','hq_workforce_worker_certifications',
    'hq_workforce_worker_skills','hq_workforce_workers'
  ] loop
    if to_regclass('public.'||obj) is null then missing := array_append(missing,obj); end if;
  end loop;
  if array_length(missing,1) is not null then raise exception 'HQ Workforce schema incomplete. Missing relations: %', array_to_string(missing,', '); end if;

  missing := '{}'::text[];
  foreach obj in array array[
    'hq_context_resolve','hq_context_scope_allows','hq_workforce_authorize_fact','hq_workforce_authorize_skill_target','hq_workforce_authorize_snapshot',
    'hq_workforce_quantified_diagnosis','hq_workforce_context_health','hq_workforce_prepare_handoff','hq_workforce_prepare_skill_promotion',
    'hq_workforce_record_skill_benchmark','hq_workforce_finalize_skill_probation','hq_workforce_capture_founder_decision','hq_workforce_qualification_state',
    'hq_workforce_probation_state','hq_workforce_record_positive_outcome','hq_workforce_monitor_health','hq_workforce_list_decisions','hq_workforce_decide'
  ] loop
    if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=obj) then missing := array_append(missing,obj); end if;
  end loop;
  if array_length(missing,1) is not null then raise exception 'HQ Workforce schema incomplete. Missing functions: %', array_to_string(missing,', '); end if;

  if not exists(select 1 from pg_views where schemaname='public' and viewname='hq_workforce_worker_performance') then raise exception 'HQ Workforce schema incomplete. Missing worker performance view'; end if;
end $$;
