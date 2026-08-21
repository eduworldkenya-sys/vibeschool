\set ON_ERROR_STOP on
begin;

-- Profiles are versioned, active and authority-safe.
do $$ begin
 if (select count(*) from public.content_worker_profiles where status='active' and profile_key in ('senior-educational-content-developer','chemistry-grade10-author','teacher-guide-quality-contract','chemistry-content-worker-evaluation')) <> 4 then raise exception 'professional profiles missing'; end if;
 if has_table_privilege('anon','public.content_worker_profiles','select') or has_table_privilege('authenticated','public.content_worker_profiles','select') then raise exception 'professional memory exposed'; end if;
 if has_function_privilege('anon','public.content_worker_preflight(jsonb,jsonb,text)','execute') or has_function_privilege('authenticated','public.content_worker_preflight(jsonb,jsonb,text)','execute') then raise exception 'preflight authority exposed'; end if;
end $$;

-- Structurally plausible but pedagogically weak guide must fail.
do $$ declare r jsonb; begin
 r:=public.content_worker_preflight(jsonb_build_object('sections',jsonb_build_object('objectives','x','prerequisite_knowledge','x','preparation_resources','x','teacher_explanation','x','learner_activities','x','teacher_prompts','x','differentiation_inclusion','x','assessment','x','marking_guidance','x','closure_reflection','x'),'coverage_matrix',jsonb_build_array(jsonb_build_object('outcome','O1','teacher_explanation',true,'learner_experience',false,'teacher_check',true,'assessment',true,'expected_learner_evidence',false)),'citations',jsonb_build_array(jsonb_build_object('source_id','s1'))), '{}'::jsonb,'Chemistry');
 if coalesce((r->>'passed')::boolean,true) then raise exception 'weak outcome coverage incorrectly passed'; end if;
 if not (r->'critical_failures' ? 'curriculum_outcome_instructional_chain_incomplete') then raise exception 'coverage failure not classified'; end if;
end $$;

-- Chemistry practical without safety must fail closed.
do $$ declare r jsonb; begin
 r:=public.content_worker_preflight(jsonb_build_object('sections',jsonb_build_object('objectives','x','prerequisite_knowledge','x','preparation_resources','x','teacher_explanation','x','learner_activities','x','teacher_prompts','x','differentiation_inclusion','x','assessment','x','marking_guidance','x','closure_reflection','x'),'coverage_matrix','[]'::jsonb,'citations',jsonb_build_array(jsonb_build_object('source_id','s1')),'has_practical',true), '{}'::jsonb,'Chemistry');
 if coalesce((r->>'passed')::boolean,true) then raise exception 'unsafe practical incorrectly passed'; end if;
 if not exists(select 1 from jsonb_array_elements_text(r->'critical_failures') x where x like 'unsafe_practical:%') then raise exception 'unsafe practical not classified'; end if;
end $$;

-- Missing provenance must fail.
do $$ declare r jsonb; begin
 r:=public.content_worker_preflight(jsonb_build_object('sections',jsonb_build_object('objectives','x','prerequisite_knowledge','x','preparation_resources','x','teacher_explanation','x','learner_activities','x','teacher_prompts','x','differentiation_inclusion','x','assessment','x','marking_guidance','x','closure_reflection','x'),'coverage_matrix','[]'::jsonb), '{}'::jsonb,'Chemistry');
 if coalesce((r->>'passed')::boolean,true) then raise exception 'unsupported candidate incorrectly passed'; end if;
 if not (r->'critical_failures' ? 'evidence_provenance_missing') then raise exception 'provenance failure not classified'; end if;
end $$;

-- Explicit blockers cannot be averaged away.
do $$ declare r jsonb; begin
 r:=public.content_worker_preflight(jsonb_build_object('sections',jsonb_build_object('objectives','x','prerequisite_knowledge','x','preparation_resources','x','teacher_explanation','x','learner_activities','x','teacher_prompts','x','differentiation_inclusion','x','assessment','x','marking_guidance','x','closure_reflection','x'),'coverage_matrix','[]'::jsonb,'citations',jsonb_build_array(jsonb_build_object('source_id','s1')),'blockers',jsonb_build_array('contradictory_authoritative_sources')), '{}'::jsonb,'Chemistry');
 if coalesce((r->>'passed')::boolean,true) then raise exception 'blocking uncertainty incorrectly passed'; end if;
end $$;

-- Existing worker remains non-publisher and gets professional contract.
do $$ declare w public.hq_workforce_workers%rowtype; begin
 select * into w from public.hq_workforce_workers where worker_key='content-factory-r2-canary-01';
 if not found then raise exception 'existing content worker missing'; end if;
 if not (w.approval_boundaries ? 'no_auto_publish') or not (w.approval_boundaries ? 'no_self_approval') then raise exception 'publication boundary weakened'; end if;
 if w.kpis->>'professional_profile' <> 'senior-educational-content-developer@1' then raise exception 'worker profile not bound'; end if;
end $$;

rollback;
