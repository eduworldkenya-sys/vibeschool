create or replace function public.hq_sync_workforce_run_trace()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_corr uuid; v_trace_event uuid; v_contract text; begin
 if new.work_item_id is null then return new; end if;
 select nullif(w.evidence->>'correlation_id','')::uuid into v_corr from public.hq_work_items w where w.id=new.work_item_id;
 if v_corr is null then return new; end if;
 select t.event_id,c.verification_event_type into v_trace_event,v_contract from public.hq_product_event_trace t left join public.hq_product_event_contract c on c.event_type=t.event_type where t.correlation_id=v_corr limit 1;
 if v_trace_event is null then return new; end if;
 if new.status in ('running','completed','verified') then
   update public.hq_product_event_trace set state=case when new.status='running' then 'actioned' when new.status='verified' and v_contract is null then 'verified' else 'awaiting_verification' end,verified_at=case when new.status='verified' and v_contract is null then now() else verified_at end,evidence=evidence||jsonb_build_object('workforce_run_id',new.id,'workforce_status',new.status,'execution_evidence',new.execution_evidence),updated_at=now() where event_id=v_trace_event and state not in ('failed','escalated');
 elsif new.status in ('failed','cancelled','blocked') then
   update public.hq_product_event_trace set state='failed',evidence=evidence||jsonb_build_object('workforce_run_id',new.id,'workforce_status',new.status),updated_at=now() where event_id=v_trace_event;
   insert into public.hq_notifications(event_id,category,severity,title,body,route,status,metadata) values(v_trace_event,'operations','warning','HQ action failed',format('Workforce run %s failed for correlated product event',new.id),'/hq','unread',jsonb_build_object('correlation_id',v_corr,'run_id',new.id,'work_item_id',new.work_item_id));
 end if;
 return new;
end $$;
revoke all on function public.hq_sync_workforce_run_trace() from public,anon,authenticated;
drop trigger if exists trg_hq_sync_workforce_run_trace on public.hq_workforce_runs;
create trigger trg_hq_sync_workforce_run_trace after insert or update of status,execution_evidence on public.hq_workforce_runs for each row execute function public.hq_sync_workforce_run_trace();

create or replace function public.hq_sync_workforce_verification_trace()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_work uuid; v_corr uuid; v_event uuid; v_expected text; begin
 if new.run_id is null then return new; end if;
 select work_item_id into v_work from public.hq_workforce_runs where id=new.run_id;
 if v_work is null then return new; end if;
 select nullif(evidence->>'correlation_id','')::uuid into v_corr from public.hq_work_items where id=v_work;
 if v_corr is null then return new; end if;
 select t.event_id,c.verification_event_type into v_event,v_expected from public.hq_product_event_trace t left join public.hq_product_event_contract c on c.event_type=t.event_type where t.correlation_id=v_corr limit 1;
 if v_event is null then return new; end if;
 if new.outcome_verified then
   update public.hq_product_event_trace set state=case when v_expected is null then 'verified' else 'awaiting_verification' end,verified_at=case when v_expected is null then now() else verified_at end,evidence=evidence||jsonb_build_object('workforce_verification_id',new.id,'workforce_outcome_verified',true),updated_at=now() where event_id=v_event and state not in ('failed','escalated');
 else
   update public.hq_product_event_trace set state='failed',evidence=evidence||jsonb_build_object('workforce_verification_id',new.id,'workforce_outcome_verified',false,'verification_evidence',new.evidence),updated_at=now() where event_id=v_event;
   insert into public.hq_notifications(event_id,category,severity,title,body,route,status,metadata) values(v_event,'operations','warning','HQ action verification failed','Independent workforce verification did not match the expected outcome.','/hq','unread',jsonb_build_object('correlation_id',v_corr,'run_id',new.run_id,'verification_id',new.id));
 end if;
 return new;
end $$;
revoke all on function public.hq_sync_workforce_verification_trace() from public,anon,authenticated;
drop trigger if exists trg_hq_sync_workforce_verification_trace on public.hq_workforce_outcome_verifications;
create trigger trg_hq_sync_workforce_verification_trace after insert or update of outcome_verified,evidence on public.hq_workforce_outcome_verifications for each row execute function public.hq_sync_workforce_verification_trace();

create table if not exists public.hq_control_journey_runs(id uuid primary key default gen_random_uuid(),journey_key text not null,status text not null check(status in('pass','fail','warn')),evidence jsonb not null default '{}'::jsonb,ran_at timestamptz not null default now());
alter table public.hq_control_journey_runs enable row level security;
revoke all on table public.hq_control_journey_runs from public,anon,authenticated;
grant select,insert,update,delete on table public.hq_control_journey_runs to service_role;
create index if not exists idx_hq_control_journey_runs_key_time on public.hq_control_journey_runs(journey_key,ran_at desc);

create or replace function public.hq_run_control_journeys()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_results jsonb:='[]'::jsonb; v_status text; v_evidence jsonb; v_count int; v_expected int; r record; begin
 select count(*) into v_count from pg_trigger where tgname='trg_hq_trace_product_event' and not tgisinternal;
 v_status:=case when v_count=1 then 'pass' else 'fail' end; v_evidence:=jsonb_build_object('trigger_count',v_count);
 insert into public.hq_control_journey_runs(journey_key,status,evidence) values('event_bus_trigger',v_status,v_evidence); v_results:=v_results||jsonb_build_array(jsonb_build_object('journey','event_bus_trigger','status',v_status,'evidence',v_evidence));
 select count(distinct tgrelid::regclass::text) into v_count from pg_trigger where not tgisinternal and tgname like 'trg_hq_%product%' or (not tgisinternal and tgname like 'trg_hq_%enforce%');
 v_status:=case when v_count>=6 then 'pass' else 'warn' end; v_evidence:=jsonb_build_object('guarded_tables',v_count,'minimum_expected',6);
 insert into public.hq_control_journey_runs(journey_key,status,evidence) values('database_product_guards',v_status,v_evidence); v_results:=v_results||jsonb_build_array(jsonb_build_object('journey','database_product_guards','status',v_status,'evidence',v_evidence));
 select count(distinct e.event_type) into v_expected from public.platform_events e where e.occurred_at>=now()-interval '7 days';
 select count(distinct e.event_type) into v_count from public.platform_events e join public.hq_product_event_contract c on c.event_type=e.event_type and c.active where e.occurred_at>=now()-interval '7 days';
 v_status:=case when v_expected=0 then 'warn' when v_count=v_expected then 'pass' when v_count::numeric/greatest(v_expected,1)>=0.8 then 'warn' else 'fail' end; v_evidence:=jsonb_build_object('covered_event_types',v_count,'emitted_event_types',v_expected,'coverage_ratio',case when v_expected=0 then null else round(v_count::numeric/v_expected,3) end);
 insert into public.hq_control_journey_runs(journey_key,status,evidence) values('event_contract_coverage',v_status,v_evidence); v_results:=v_results||jsonb_build_array(jsonb_build_object('journey','event_contract_coverage','status',v_status,'evidence',v_evidence));
 select count(*) into v_count from public.hq_product_event_trace t join public.hq_product_event_contract c on c.event_type=t.event_type where t.state in('awaiting_verification','routed','actioned') and t.created_at<now()-make_interval(mins=>greatest(5,c.max_unverified_minutes));
 v_status:=case when v_count=0 then 'pass' when v_count<5 then 'warn' else 'fail' end; v_evidence:=jsonb_build_object('overdue_traces',v_count);
 insert into public.hq_control_journey_runs(journey_key,status,evidence) values('verification_backlog',v_status,v_evidence); v_results:=v_results||jsonb_build_array(jsonb_build_object('journey','verification_backlog','status',v_status,'evidence',v_evidence));
 for r in select product_key,max(created_at) last_seen from public.hq_product_policy_state group by product_key loop
   v_status:=case when r.last_seen>=now()-interval '15 minutes' then 'pass' when r.last_seen>=now()-interval '24 hours' then 'warn' else 'fail' end; v_evidence:=jsonb_build_object('product_key',r.product_key,'last_seen',r.last_seen);
   insert into public.hq_control_journey_runs(journey_key,status,evidence) values('runtime_heartbeat:'||r.product_key,v_status,v_evidence); v_results:=v_results||jsonb_build_array(jsonb_build_object('journey','runtime_heartbeat:'||r.product_key,'status',v_status,'evidence',v_evidence));
 end loop;
 return jsonb_build_object('results',v_results,'passed',(select count(*) from jsonb_array_elements(v_results) x where x->>'status'='pass'),'warnings',(select count(*) from jsonb_array_elements(v_results) x where x->>'status'='warn'),'failed',(select count(*) from jsonb_array_elements(v_results) x where x->>'status'='fail'),'ran_at',now());
end $$;
revoke all on function public.hq_run_control_journeys() from public,anon,authenticated;
grant execute on function public.hq_run_control_journeys() to service_role;

create or replace function public.hq_run_operating_cycle()
returns jsonb language plpgsql security definer set search_path=public as $$
declare intel jsonb; rec jsonb; pf uuid; sec jsonb; verify jsonb; journeys jsonb; routed int; safe int;
begin perform public.hq_assert_owner(); intel:=public.hq_run_company_intelligence_v2(); pf:=public.hq_detect_policy_failure_burst(); sec:=public.hq_detect_security_signals(); rec:=public.hq_reconcile_findings(); routed:=public.hq_route_work_items(); safe:=public.hq_workforce_execute_safe_queue(); verify:=public.hq_reconcile_product_event_verifications(); journeys:=public.hq_run_control_journeys(); return jsonb_build_object('intelligence',intel,'policyFailureFinding',pf,'security',sec,'reconciliation',rec,'routedWorkItems',routed,'safeWorkforceRuns',safe,'productVerification',verify,'controlJourneys',journeys,'completed_at',now()); end $$;
revoke all on function public.hq_run_operating_cycle() from public,anon;
grant execute on function public.hq_run_operating_cycle() to authenticated;
