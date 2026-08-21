\set ON_ERROR_STOP on
begin;

-- Profiles are versioned, active and authority-safe.
do $$ declare suite jsonb; begin
 if (select count(*) from public.content_worker_profiles where status='active' and version=2 and profile_key in ('senior-educational-content-developer','chemistry-grade10-author','teacher-guide-quality-contract','chemistry-content-worker-evaluation')) <> 4 then raise exception 'professional v2 profiles missing'; end if;
 if has_table_privilege('anon','public.content_worker_profiles','select') or has_table_privilege('authenticated','public.content_worker_profiles','select') then raise exception 'professional memory exposed'; end if;
 if has_function_privilege('anon','public.content_worker_preflight(jsonb,jsonb,text)','execute') or has_function_privilege('authenticated','public.content_worker_preflight(jsonb,jsonb,text)','execute') then raise exception 'preflight authority exposed'; end if;
 if has_function_privilege('anon','public.content_worker_teacher_guide_self_review(jsonb,jsonb)','execute') or has_function_privilege('authenticated','public.content_worker_teacher_guide_self_review(jsonb,jsonb)','execute') then raise exception 'self review authority exposed'; end if;
 if has_function_privilege('anon','public.content_worker_begin_execution(jsonb)','execute') or has_function_privilege('authenticated','public.content_worker_begin_execution(jsonb)','execute') then raise exception 'execution-context authority exposed'; end if;
 if has_function_privilege('anon','public.content_worker_finish_execution(uuid,text,jsonb,jsonb)','execute') or has_function_privilege('authenticated','public.content_worker_finish_execution(uuid,text,jsonb,jsonb)','execute') then raise exception 'execution-finalization authority exposed'; end if;
 select specification into suite from public.content_worker_profiles where profile_key='chemistry-content-worker-evaluation' and version=2;
 if jsonb_array_length(suite->'production_regression_cases')<>7 then raise exception 'seven chemistry production regressions not captured'; end if;
end $$;

-- Structurally plausible but pedagogically weak guide must fail.
do $$ declare r jsonb; begin
 r:=public.content_worker_preflight(jsonb_build_object('sections',jsonb_build_object('objectives','x','prerequisite_knowledge','x','preparation_resources','x','teacher_explanation','x','learner_activities','x','teacher_prompts','x','differentiation_inclusion','x','assessment','x','marking_guidance','x','closure_reflection','x'),'coverage_matrix',jsonb_build_array(jsonb_build_object('outcome','O1','teacher_explanation',true,'learner_experience',false,'teacher_check',true,'assessment',true,'expected_learner_evidence',false)),'citations',jsonb_build_array(jsonb_build_object('source_id','s1'))), '{}'::jsonb,'Chemistry');
 if coalesce((r->>'passed')::boolean,true) then raise exception 'weak outcome coverage incorrectly passed'; end if;
 if not (r->'critical_failures' ? 'curriculum_outcome_instructional_chain_incomplete') then raise exception 'coverage failure not classified'; end if;
end $$;

-- Legacy seven-guide shape must be recognized as a summary, not classroom-ready.
do $$ declare r jsonb; begin
 r:=public.content_worker_teacher_guide_self_review(
   jsonb_build_object('purpose','summary','sequence',jsonb_build_array('step 1','step 2'),'misconceptions',jsonb_build_array('m1'),'answer_guidance',jsonb_build_object('q1','a1','q2','a2'),'assessment_guidance','brief'),
   jsonb_build_object('formal_assessment_items',6)
 );
 if coalesce((r->>'passed')::boolean,true) then raise exception 'legacy summary guide incorrectly passed self review'; end if;
 if not exists(select 1 from jsonb_array_elements(r->'findings') f where f->>'code'='summary_not_classroom_ready') then raise exception 'summary defect not detected'; end if;
 if not exists(select 1 from jsonb_array_elements(r->'findings') f where f->>'code'='incomplete_assessment_treatment') then raise exception 'assessment mismatch not detected'; end if;
 if jsonb_array_length(r->'repairable')=0 then raise exception 'bounded repair targets missing'; end if;
end $$;

-- Known Atom scientific failure must escalate, not be polished through.
do $$ declare r jsonb; begin
 r:=public.content_worker_teacher_guide_self_review(jsonb_build_object('objectives','x','prerequisite_knowledge','x','preparation_resources','x','teacher_explanation','Mass number is found by adding protons and electrons.','learner_activities','x','teacher_prompts','x','differentiation_inclusion','x','closure_reflection','x','outcome_coverage',jsonb_build_array('O1'),'citations',jsonb_build_array('s1')),jsonb_build_object('formal_assessment_items',0,'verified_evidence_packet_sha256','abc'));
 if coalesce((r->>'passed')::boolean,true) then raise exception 'incorrect chemistry passed self review'; end if;
 if not exists(select 1 from jsonb_array_elements_text(r->'blockers') b where b like 'scientific_correctness_failure:%') then raise exception 'scientific failure not escalated'; end if;
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

-- Candidate decision requires both deterministic preflight and inspection-mode self review.
do $$ declare d jsonb; begin
 d:=public.content_worker_quality_candidate_decision(jsonb_build_object('passed',true),jsonb_build_object('passed',true),false);
 if d->>'decision'<>'quality_candidate' or coalesce((d->>'publication_authority')::boolean,true) then raise exception 'quality candidate contract invalid'; end if;
 d:=public.content_worker_quality_candidate_decision(jsonb_build_object('passed',true),jsonb_build_object('passed',false),false);
 if d->>'decision'<>'blocked' then raise exception 'self review failure incorrectly promoted'; end if;
 d:=public.content_worker_quality_candidate_decision(jsonb_build_object('passed',true),jsonb_build_object('passed',true),true);
 if d->>'decision'<>'blocked' then raise exception 'uncertainty incorrectly promoted'; end if;
end $$;

-- Existing executor receives governed professional context and persists an inspectable plan.
do $$ declare e jsonb; eid uuid; finished jsonb; begin
 e:=public.content_worker_begin_execution(jsonb_build_object(
   'worker_key','content-factory-r2-canary-01',
   'subject','Chemistry','grade','10',
   'title','Synthetic professionalization examination',
   'claim','Explain a verified chemistry concept',
   'curriculum_relevance','Grade 10 Chemistry examination fixture',
   'claim_sha256','claim-sha',
   'evidence_packet_sha256','evidence-sha',
   'evidence_packet',jsonb_build_object('sources',jsonb_build_array(jsonb_build_object('source_id','s1'))),
   'curriculum_outcomes',jsonb_build_array('O1'),
   'target',jsonb_build_object('current_content_sha256','content-sha','block_type','paragraph')
 ));
 eid:=(e->>'execution_context_id')::uuid;
 if eid is null then raise exception 'inspectable execution context not created'; end if;
 if e->'subject_profile'->>'profile_key'<>'chemistry-grade10-author' then raise exception 'chemistry subject profile not resolved'; end if;
 if not (e->'plan'->'stages' ? 'deterministic_preflight') or not (e->'plan'->'stages' ? 'self_review') then raise exception 'professional plan stages missing'; end if;
 if (select status from public.content_worker_execution_contexts where id=eid)<>'planned' then raise exception 'execution not persisted as planned'; end if;
 finished:=public.content_worker_finish_execution(eid,'quality_candidate',jsonb_build_object('mode','inspection','findings','[]'::jsonb,'blocking_uncertainty',false,'repair_applied',false),'[]'::jsonb);
 if finished->>'status'<>'quality_candidate' then raise exception 'execution cannot reach governed quality candidate'; end if;
end $$;

-- Existing worker remains non-publisher and gets professional v2 contract.
do $$ declare w public.hq_workforce_workers%rowtype; begin
 select * into w from public.hq_workforce_workers where worker_key='content-factory-r2-canary-01';
 if not found then raise exception 'existing content worker missing'; end if;
 if not (w.approval_boundaries ? 'no_auto_publish') or not (w.approval_boundaries ? 'no_self_approval') then raise exception 'publication boundary weakened'; end if;
 if w.kpis->>'professional_profile' <> 'senior-educational-content-developer@2' then raise exception 'worker v2 profile not bound'; end if;
 if coalesce((w.kpis->>'max_self_repair_cycles')::int,0)<>1 then raise exception 'bounded repair contract missing'; end if;
end $$;

rollback;
