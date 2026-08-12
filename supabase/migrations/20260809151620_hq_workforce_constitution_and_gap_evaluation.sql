-- Recovered verbatim from the production Supabase migration ledger for L0 replay parity.
insert into public.hq_workforce_contract_clauses(clause_key,version,clause_type,scope_type,scope_key,rule,status) values
('default-deny',1,'authority','company',null,'{"unknown_action":"deny","principle":"no implicit authority"}'::jsonb,'active'),
('paid-ai-default-off',1,'ai','company',null,'{"external_ai":"deny","routine_external_ai_required":false}'::jsonb,'active'),
('new-worker-probation',1,'lifecycle','company',null,'{"initial_status":"probation","full_authority":false,"certification_required":true}'::jsonb,'active'),
('outcome-before-success',1,'verification','company',null,'{"execution_success_is_not_outcome_success":true,"independent_verification_required":true}'::jsonb,'active'),
('human-high-impact',1,'approval','company',null,'{"financial_material":"approval_required","legal":"approval_required","destructive":"approval_required","external_high_impact":"approval_required"}'::jsonb,'active'),
('learning-promotion',1,'learning','company',null,'{"correction_auto_promote":false,"approval_required":true,"provenance_required":true}'::jsonb,'active')
on conflict(clause_key,version) do nothing;
create or replace function public.hq_context_capture_company_snapshot(p_decision_key text,p_decision_type text,p_reason text,p_actor_type text default 'system',p_actor_key text default 'workforce-engine') returns uuid language plpgsql security invoker set search_path=public as $$ declare sid uuid; facts_doc jsonb; begin
 select coalesce(jsonb_agg(jsonb_build_object('fact_key',c.fact_key,'value',c.value,'fact_definition_id',c.fact_definition_id,'fact_definition_version',d.version,'computed_at',c.computed_at,'freshness_expires_at',c.freshness_expires_at,'confidence',c.confidence,'confidence_source',c.confidence_source) order by c.fact_key),'[]'::jsonb) into facts_doc from public.hq_context_facts_cache c join public.hq_context_fact_definitions d on d.id=c.fact_definition_id join public.hq_context_scopes s on s.id=c.scope_id where s.scope_type='company' and s.scope_owner_key='hq';
 insert into public.hq_context_decision_snapshots(decision_key,decision_type,taken_at,rules_version,context_version,facts,outcome,reason,actor_type,actor_key) values(p_decision_key,p_decision_type,now(),'workforce-constitution-v1','company-context-v1',facts_doc,null,p_reason,p_actor_type,p_actor_key) returning id into sid;
 insert into public.hq_context_provenance(snapshot_id,fact_key,fact_definition_id,source_id,raw_refs,computation_digest)
 select sid,d.fact_key,d.id,d.source_id,jsonb_build_object('source',s.connection_ref,'computed_at',c.computed_at),md5(d.computation_ref) from public.hq_context_facts_cache c join public.hq_context_fact_definitions d on d.id=c.fact_definition_id join public.hq_context_sources s on s.id=d.source_id join public.hq_context_scopes sc on sc.id=c.scope_id where sc.scope_type='company' and sc.scope_owner_key='hq'; return sid; end $$;
create or replace function public.hq_workforce_evaluate_candidate_gaps() returns integer language plpgsql security invoker set search_path=public as $$ declare g record; sid uuid; n integer:=0; begin
 for g in select * from public.hq_workforce_gap_signals where status='candidate' loop
  sid:=public.hq_context_capture_company_snapshot('gap-eval:'||g.gap_key||':'||extract(epoch from now())::bigint,'workforce_gap_evaluation','Deterministic evaluation of workforce gap.');
  insert into public.hq_workforce_gap_evaluations(gap_id,diagnosis,decision,evidence_snapshot_id,reason,execution_method)
  values(g.id,case when g.signal_type='capacity_gap' and g.lane_key is not null then 'missing_lane_owner' else 'unknown' end,case when g.signal_type='capacity_gap' and g.lane_key is not null then 'create_probation_digital_worker' else 'human_review' end,sid,case when g.signal_type='capacity_gap' and g.lane_key is not null then 'Active lane has no accountable owner; no existing worker capacity exists.' else 'Gap does not match a certified deterministic diagnosis pattern.' end,'local_algorithm');
  update public.hq_workforce_gap_signals set status='accepted' where id=g.id; n:=n+1;
 end loop; return n; end $$;
revoke all on function public.hq_context_capture_company_snapshot(text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.hq_workforce_evaluate_candidate_gaps() from public,anon,authenticated;
