create or replace function public.hq_run_control_journeys()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_results jsonb:='[]'::jsonb; v_status text; v_evidence jsonb; v_count int; v_expected int; r record; begin
 select count(*) into v_count from pg_trigger where tgname='trg_hq_trace_product_event' and not tgisinternal;
 v_status:=case when v_count=1 then 'pass' else 'fail' end; v_evidence:=jsonb_build_object('trigger_count',v_count);
 insert into public.hq_control_journey_runs(journey_key,status,evidence) values('event_bus_trigger',v_status,v_evidence); v_results:=v_results||jsonb_build_array(jsonb_build_object('journey','event_bus_trigger','status',v_status,'evidence',v_evidence));
 select count(distinct tgrelid::regclass::text) into v_count from pg_trigger where not tgisinternal and (tgname like 'trg_hq_%product%' or tgname like 'trg_hq_%enforce%');
 v_status:=case when v_count>=6 then 'pass' else 'warn' end; v_evidence:=jsonb_build_object('guarded_tables',v_count,'minimum_expected',6);
 insert into public.hq_control_journey_runs(journey_key,status,evidence) values('database_product_guards',v_status,v_evidence); v_results:=v_results||jsonb_build_array(jsonb_build_object('journey','database_product_guards','status',v_status,'evidence',v_evidence));
 select count(distinct e.event_type) into v_expected from public.platform_events e where e.occurred_at>=now()-interval '7 days';
 select count(distinct e.event_type) into v_count from public.platform_events e join public.hq_product_event_contract c on c.event_type=e.event_type and c.active where e.occurred_at>=now()-interval '7 days';
 v_status:=case when v_expected=0 then 'warn' when v_count=v_expected then 'pass' when v_count::numeric/greatest(v_expected,1)>=0.8 then 'warn' else 'fail' end; v_evidence:=jsonb_build_object('covered_event_types',v_count,'emitted_event_types',v_expected,'coverage_ratio',case when v_expected=0 then null else round(v_count::numeric/v_expected,3) end);
 insert into public.hq_control_journey_runs(journey_key,status,evidence) values('event_contract_coverage',v_status,v_evidence); v_results:=v_results||jsonb_build_array(jsonb_build_object('journey','event_contract_coverage','status',v_status,'evidence',v_evidence));
 select count(*) into v_count from public.hq_product_event_trace t join public.hq_product_event_contract c on c.event_type=t.event_type where t.state in('awaiting_verification','routed','actioned') and t.created_at<now()-make_interval(mins=>greatest(5,c.max_unverified_minutes));
 v_status:=case when v_count=0 then 'pass' when v_count<5 then 'warn' else 'fail' end; v_evidence:=jsonb_build_object('overdue_traces',v_count);
 insert into public.hq_control_journey_runs(journey_key,status,evidence) values('verification_backlog',v_status,v_evidence); v_results:=v_results||jsonb_build_array(jsonb_build_object('journey','verification_backlog','status',v_status,'evidence',v_evidence));
 for r in select product_key,max(updated_at) last_seen from public.hq_product_policy_state group by product_key loop
   v_status:=case when r.last_seen>=now()-interval '15 minutes' then 'pass' when r.last_seen>=now()-interval '24 hours' then 'warn' else 'fail' end; v_evidence:=jsonb_build_object('product_key',r.product_key,'last_seen',r.last_seen);
   insert into public.hq_control_journey_runs(journey_key,status,evidence) values('runtime_heartbeat:'||r.product_key,v_status,v_evidence); v_results:=v_results||jsonb_build_array(jsonb_build_object('journey','runtime_heartbeat:'||r.product_key,'status',v_status,'evidence',v_evidence));
 end loop;
 return jsonb_build_object('results',v_results,'passed',(select count(*) from jsonb_array_elements(v_results) x where x->>'status'='pass'),'warnings',(select count(*) from jsonb_array_elements(v_results) x where x->>'status'='warn'),'failed',(select count(*) from jsonb_array_elements(v_results) x where x->>'status'='fail'),'ran_at',now());
end $$;
revoke all on function public.hq_run_control_journeys() from public,anon,authenticated;
grant execute on function public.hq_run_control_journeys() to service_role;
