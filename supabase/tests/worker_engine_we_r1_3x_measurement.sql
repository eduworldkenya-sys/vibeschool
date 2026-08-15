\set ON_ERROR_STOP on
begin;

-- Repository-local safety assessment must detect zero samples as not yet trial-certified,
-- while still proving no hidden runtime/Factory/legacy-scheduler authority is active.
do $$ declare a jsonb; m jsonb; begin
 m:=public.hq_workforce_r13x_metrics(clock_timestamp()+interval '1 hour');
 if coalesce((m#>>'{safety,consequential_shadow_executions}')::int,-1)<>0 then raise exception 'measurement_reports_consequential_execution:%',m; end if;
 if coalesce((m#>>'{safety,runtime_execution_enabled}')::boolean,true) then raise exception 'measurement_reports_runtime_on:%',m; end if;
 if coalesce((m#>>'{safety,factory_enabled}')::boolean,true) then raise exception 'measurement_reports_factory_on:%',m; end if;
 if coalesce((m#>>'{safety,legacy_scheduler_service_role_execute}')::boolean,true) then raise exception 'measurement_reports_legacy_scheduler_authority:%',m; end if;
 a:=public.hq_workforce_r13x_certification_assessment(clock_timestamp()+interval '1 hour');
 if coalesce((a->>'certified')::boolean,true) then raise exception 'zero_sample_trial_incorrectly_certified:%',a; end if;
 if coalesce((a->>'recommendation_sample_present')::boolean,true) then raise exception 'zero_sample_window_incorrectly_has_samples:%',a; end if;
end $$;

-- Create a complete nonconsequential recommendation evidence set to prove the assessment is data-derived.
do $$ declare tid uuid; wid uuid; did uuid; a jsonb; begin
 insert into public.hq_workforce_shadow_traces(cycle_key,worker_key,lane_key,scope_type,status,confidence,consequential_action_performed)
 values('measurement-test','measurement-worker','quality','platform_internal','awaiting_review',.9,false) returning trace_id into tid;
 insert into public.hq_workforce_evidence(trace_id,evidence_kind,source_type,classification,payload)
 values(tid,'fact','acceptance','internal','{"measurement":true}');
 insert into public.hq_workforce_shadow_decisions(trace_id,decision_key,proposed_action,required_authority,hypothetical_authority_result,authority_reason,state)
 values(tid,'MEASURE-'||tid::text,'{"execute":false}','{"autonomy_level":0}','deny','test identity intentionally uncertified','awaiting_review') returning id into did;
 a:=public.hq_workforce_r13x_certification_assessment(clock_timestamp()-interval '1 minute');
 if not coalesce((a->>'recommendation_sample_present')::boolean,false) then raise exception 'sample_not_detected:%',a; end if;
 if coalesce((a#>>'{metrics,traceability,recommendations}')::int,0)<1 then raise exception 'recommendation_metric_missing:%',a; end if;
 if (a#>>'{metrics,traceability,recommendations_with_evidence}')::int<>(a#>>'{metrics,traceability,recommendations}')::int then raise exception 'evidence_traceability_ratio_failed:%',a; end if;
 if (a#>>'{metrics,traceability,recommendations_with_decision}')::int<>(a#>>'{metrics,traceability,recommendations}')::int then raise exception 'decision_traceability_ratio_failed:%',a; end if;
end $$;

-- Calibration statistics must be empirical, not a self-reported confidence label.
insert into public.hq_workforce_evaluations(trace_id,worker_key,predicted_confidence,score,human_agreement,useful,evaluator_key)
values(gen_random_uuid(),'measurement-worker',.90,.80,true,true,'acceptance'),
      (gen_random_uuid(),'measurement-worker',.80,.70,false,true,'acceptance'),
      (gen_random_uuid(),'measurement-worker',.70,.75,true,false,'acceptance');
select public.hq_workforce_refresh_calibration('worker','measurement-worker');
do $$ declare m jsonb; begin
 m:=public.hq_workforce_r13x_metrics(clock_timestamp()-interval '1 minute');
 if coalesce((m#>>'{learning,calibrated_dimensions}')::int,0)<1 then raise exception 'calibration_not_measured:%',m; end if;
 if m#>>'{learning,mean_calibration_error}' is null then raise exception 'calibration_error_missing:%',m; end if;
end $$;

do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin
 select * into ec from public.hq_workforce_engine_contract where singleton=true;
 if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 then raise exception 'measurement_suite_changed_runtime_boundary'; end if;
end $$;
rollback;
