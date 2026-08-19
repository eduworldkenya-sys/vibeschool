create or replace function public.hq_content_factory_r2_operator_bind_semantic(p_session_id uuid, p_source_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare s public.hq_content_factory_r2_canary_sessions%rowtype; v_task uuid; begin
 if session_user<>'postgres' then raise exception 'gate2_operator_postgres_required'; end if;
 select * into s from public.hq_content_factory_r2_canary_sessions where id=p_session_id for update;
 if not found or s.status<>'research_dispatched' or s.expires_at<=clock_timestamp() then raise exception 'gate2_semantic_bind_session_denied'; end if;
 if not exists(select 1 from public.hq_workforce_task_contracts where id=s.research_task_id and status='completed') then raise exception 'gate2_research_task_not_completed'; end if;
 if not exists(select 1 from public.curriculum_intelligence_sources where id=p_source_id and proposal_id=s.proposal_id) then raise exception 'gate2_source_not_in_proposal'; end if;
 insert into public.hq_workforce_task_contracts(task_key,worker_key,tool_contract_id,capability_key,capability_version,operation,resource_type,scope_type,scope_ref,payload,idempotency_key,budget_key,budget_amount,status,max_attempts,plan_step_id)
 select 'gate2-semantic-'||s.proposal_id::text,s.worker_key,t.id,'content.evidence.semantic_verify',1,'verify_semantics','curriculum_intelligence_source','platform_internal','{}'::jsonb,
        jsonb_build_object('source_id',p_source_id,'token_budget',2500,'model_key','openai/gpt-oss-120b'),'gate2-semantic-'||s.proposal_id::text,'gate2_operations',1,'queued',1,s.semantic_step_id
 from public.hq_workforce_tool_contracts t where t.tool_key='content.evidence.semantic_verify' and t.version=1 and t.status='approved'
 returning id into v_task;
 update public.hq_content_factory_r2_canary_sessions set semantic_task_id=v_task,source_id=p_source_id,status='semantic_bound',evidence=evidence||jsonb_build_object('source_id',p_source_id,'semantic_model','openai/gpt-oss-120b') where id=s.id;
 return jsonb_build_object('session_id',s.id,'semantic_task_id',v_task,'source_id',p_source_id,'model_key','openai/gpt-oss-120b');
end $$;

create or replace function public.hq_content_factory_r2_operator_bind_authoring(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare s public.hq_content_factory_r2_canary_sessions%rowtype; v_task uuid; v_rec jsonb; begin
 if session_user<>'postgres' then raise exception 'gate2_operator_postgres_required'; end if;
 select * into s from public.hq_content_factory_r2_canary_sessions where id=p_session_id for update;
 if not found or s.status<>'semantic_dispatched' or s.expires_at<=clock_timestamp() then raise exception 'gate2_authoring_bind_session_denied'; end if;
 if not exists(select 1 from public.hq_workforce_task_contracts where id=s.semantic_task_id and status='completed') then raise exception 'gate2_semantic_task_not_completed'; end if;
 v_rec:=public.hq_content_research_reconcile_after_semantic(s.research_job_id);
 if v_rec->>'status'<>'evidence_ready' then raise exception 'gate2_semantic_reconciliation_not_ready:%',v_rec; end if;
 insert into public.hq_workforce_task_contracts(task_key,worker_key,tool_contract_id,capability_key,capability_version,operation,resource_type,scope_type,scope_ref,payload,idempotency_key,budget_key,budget_amount,status,max_attempts,plan_step_id)
 select 'gate2-authoring-'||s.proposal_id::text,s.worker_key,t.id,'content.authoring.source_grounded',1,'draft_content','curriculum_intelligence_proposal','platform_internal','{}'::jsonb,
        jsonb_build_object('proposal_id',s.proposal_id,'token_budget',3500,'model_key','openai/gpt-oss-120b'),'gate2-authoring-'||s.proposal_id::text,'gate2_operations',1,'queued',1,s.authoring_step_id
 from public.hq_workforce_tool_contracts t where t.tool_key='content.authoring.source_grounded' and t.version=1 and t.status='approved'
 returning id into v_task;
 update public.hq_content_factory_r2_canary_sessions set authoring_task_id=v_task,status='authoring_bound',evidence=evidence||jsonb_build_object('semantic_reconciliation',v_rec,'authoring_model','openai/gpt-oss-120b') where id=s.id;
 return jsonb_build_object('session_id',s.id,'authoring_task_id',v_task,'reconciliation',v_rec,'model_key','openai/gpt-oss-120b');
end $$;

revoke all on function public.hq_content_factory_r2_operator_bind_semantic(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.hq_content_factory_r2_operator_bind_authoring(uuid) from public,anon,authenticated,service_role;
