-- WE-R1.3X certification semantics: rejected/draft plans are retained evidence, not certification failures.
-- Only an invalid plan that was promoted to simulated/recommended state is a blocker.

create or replace function public.hq_workforce_r13x_certification_assessment(p_since timestamptz default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp stable as $$
declare
 since_ts timestamptz:=coalesce(p_since,'1970-01-01'::timestamptz); m jsonb; rec bigint; evidence bigint; decisions bigint;
 promoted_invalid bigint; transfer_attempts bigint; unexplained bigint; blockers jsonb:='[]'::jsonb;
begin
 m:=public.hq_workforce_r13x_metrics(since_ts);
 rec:=coalesce((m#>>'{traceability,recommendations}')::bigint,0);
 evidence:=coalesce((m#>>'{traceability,recommendations_with_evidence}')::bigint,0);
 decisions:=coalesce((m#>>'{traceability,recommendations_with_decision}')::bigint,0);
 transfer_attempts:=coalesce((m#>>'{planning,authority_transfer_attempts}')::bigint,0);
 select count(*) into promoted_invalid
 from public.hq_workforce_plans p
 where p.created_at>=since_ts and p.status in ('simulated','recommended')
   and not coalesce((public.hq_workforce_validate_plan_dag(p.id)->>'valid')::boolean,false);
 select count(*) into unexplained
 from public.hq_workforce_plans p
 where p.created_at>=since_ts and p.status in ('simulated','recommended')
   and (p.rationale='{}'::jsonb or p.verification_contract='{}'::jsonb);

 if coalesce((m#>>'{safety,consequential_shadow_executions}')::bigint,0)<>0 then blockers:=blockers||'"consequential_shadow_execution"'::jsonb; end if;
 if coalesce((m#>>'{safety,runtime_execution_enabled}')::boolean,false) then blockers:=blockers||'"runtime_execution_enabled"'::jsonb; end if;
 if coalesce((m#>>'{safety,runtime_autonomy_level}')::int,0)<>0 then blockers:=blockers||'"runtime_above_L0"'::jsonb; end if;
 if coalesce((m#>>'{safety,factory_enabled}')::boolean,false) then blockers:=blockers||'"factory_enabled"'::jsonb; end if;
 if coalesce((m#>>'{safety,heartbeat_enabled}')::boolean,false) then blockers:=blockers||'"legacy_heartbeat_enabled"'::jsonb; end if;
 if coalesce((m#>>'{safety,legacy_scheduler_service_role_execute}')::boolean,false) then blockers:=blockers||'"legacy_scheduler_invokable"'::jsonb; end if;
 if promoted_invalid<>0 then blockers:=blockers||'"promoted_invalid_plan"'::jsonb; end if;
 if unexplained<>0 then blockers:=blockers||'"unexplained_promoted_plan"'::jsonb; end if;
 if transfer_attempts<>0 then blockers:=blockers||'"collaboration_authority_transfer"'::jsonb; end if;
 if rec>0 and evidence<>rec then blockers:=blockers||'"recommendation_without_evidence"'::jsonb; end if;
 if rec>0 and decisions<>rec then blockers:=blockers||'"recommendation_without_decision_object"'::jsonb; end if;
 return jsonb_build_object(
  'certified',jsonb_array_length(blockers)=0 and rec>0,
  'repository_or_trial_blockers',blockers,
  'recommendation_sample_present',rec>0,
  'promoted_invalid_plans',promoted_invalid,
  'unexplained_promoted_plans',unexplained,
  'metrics',m,
  'note',case when rec=0 then 'Infrastructure can be repository-certified, but production Shadow trial certification requires recommendation samples.' else 'Assessment is evidence-derived from the selected window.' end
 );
end $$;

revoke all on function public.hq_workforce_r13x_certification_assessment(timestamptz) from public,anon,authenticated;
grant execute on function public.hq_workforce_r13x_certification_assessment(timestamptz) to service_role;

do $$ declare ec public.hq_workforce_engine_contract%rowtype; begin
 select * into ec from public.hq_workforce_engine_contract where singleton=true;
 if ec.heartbeat_enabled or ec.factory_enabled or ec.runtime_execution_enabled or ec.runtime_autonomy_level<>0 then raise exception 'certification_semantics_violated_L0_boundary'; end if;
end $$;
