-- Worker Engine continuous-improvement query and foreign-key coverage.

create index if not exists hq_workforce_improvement_incidents_run_id_idx
  on public.hq_workforce_improvement_incidents(run_id) where run_id is not null;
create index if not exists hq_workforce_improvement_incidents_worker_detected_idx
  on public.hq_workforce_improvement_incidents(worker_key,detected_at desc);

create index if not exists hq_workforce_regression_cases_source_incident_idx
  on public.hq_workforce_regression_cases(source_incident_id) where source_incident_id is not null;
create index if not exists hq_workforce_regression_cases_scope_idx
  on public.hq_workforce_regression_cases(scope_type,scope_key,status);

create index if not exists hq_workforce_improvement_candidates_learning_candidate_idx
  on public.hq_workforce_improvement_candidates(learning_candidate_id) where learning_candidate_id is not null;
create index if not exists hq_workforce_improvement_candidates_source_incident_idx
  on public.hq_workforce_improvement_candidates(source_incident_id);
create index if not exists hq_workforce_improvement_candidates_state_idx
  on public.hq_workforce_improvement_candidates(status,updated_at desc);

create index if not exists hq_workforce_health_events_scope_recorded_idx
  on public.hq_workforce_health_events(scope_type,scope_key,recorded_at desc);
