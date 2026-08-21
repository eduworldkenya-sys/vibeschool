-- Close the legacy WE-L9 path that coupled qualification to activation/authority.
create or replace function public.hq_workforce_qualify_factory_workers(p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r record; t public.hq_workforce_factory_templates%rowtype; c record; v_observed jsonb; v_passed int; v_ready int:=0; v_failed int:=0;
begin
 if p_limit<1 or p_limit>50 then raise exception 'invalid_qualification_limit'; end if;
 for r in select fr.*,de.lane_key,gs.signal_type from public.hq_workforce_factory_runs fr join public.hq_workforce_demand_evidence de on de.id=fr.demand_evidence_id join public.hq_workforce_gap_signals gs on gs.id=de.gap_id where fr.decision='create_digital_worker_probation' and fr.worker_key is not null and public.hq_workforce_current_lifecycle_state(fr.worker_key)='shadow' order by fr.created_at for update of fr skip locked limit p_limit loop
  perform public.hq_workforce_professional_baseline(r.worker_key);
  select * into t from public.hq_workforce_factory_templates ft where ft.lane_key=r.lane_key and ft.signal_type=r.signal_type and ft.status='approved' and exists(select 1 from public.hq_workforce_tool_contracts tc where tc.id=r.tool_contract_id and tc.required_capability_key=ft.capability_key and tc.operation=ft.operation and tc.resource_type=ft.resource_type) order by ft.version desc limit 1;
  if not found then v_failed:=v_failed+1; continue; end if;
  v_passed:=0;
  for c in select * from public.hq_workforce_factory_qualification_cases qc where qc.template_id=t.id and qc.status='approved' order by qc.case_key loop
   v_observed:=public.hq_workforce_execute_shadow_tool(r.tool_contract_id,c.input_snapshot);
   perform public.hq_workforce_record_shadow_run(r.worker_key,r.tool_contract_id,c.input_snapshot,c.expected_outcome,v_observed,'governance_factory_verifier_v2');
   if v_observed=c.expected_outcome then v_passed:=v_passed+1; end if;
  end loop;
  if v_passed<3 then
   perform public.hq_workforce_record_qualification_evidence(r.worker_key,'shadow','governance_factory_verifier_v2','factory-shadow-v2',false,jsonb_build_object('passed',v_passed,'required',3)); v_failed:=v_failed+1; continue;
  end if;
  perform public.hq_workforce_record_qualification_evidence(r.worker_key,'shadow','governance_factory_verifier-v2','factory-shadow-v2',true,jsonb_build_object('passed',v_passed,'required',3));
  perform public.hq_workforce_transition_worker(r.worker_key,'certification_pending','shadow qualification passed; professional independent certification required',r.creation_contract_id);
  v_ready:=v_ready+1;
 end loop;
 return jsonb_build_object('ready_for_independent_certification',v_ready,'failed',v_failed,'authority_granted',false,'activated',false,'professional_certification_required',true);
end $$;
revoke all on function public.hq_workforce_qualify_factory_workers(integer) from public,anon,authenticated; grant execute on function public.hq_workforce_qualify_factory_workers(integer) to service_role;
