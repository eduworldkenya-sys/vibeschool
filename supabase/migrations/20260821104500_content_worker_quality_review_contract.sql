begin;

-- Priority 1 quality-review closure. Extends the existing authoring worker baseline with
-- deterministic inspection, bounded repair planning, explicit quality-candidate gating,
-- and the seven real Grade 10 Chemistry review cases. No publication authority is added.

update public.content_worker_profiles set status='retired' where status='active' and profile_key in (
  'senior-educational-content-developer','chemistry-grade10-author','teacher-guide-quality-contract','chemistry-content-worker-evaluation'
);

insert into public.content_worker_profiles(profile_key,version,profile_kind,status,specification,activated_at)
values
('senior-educational-content-developer',2,'professional','active',jsonb_build_object(
 'role','Senior Educational Content Developer / Subject Author',
 'workflow',jsonb_build_array('assignment','context_retrieval','curriculum_understanding','planning','evidence_grounding','generation','deterministic_preflight','inspection_mode_self_review','bounded_targeted_repair','escalation_or_quality_candidate'),
 'responsibilities',jsonb_build_array('understand_assignment','retrieve_canonical_curriculum','retrieve_approved_evidence','decompose_learning_outcomes','build_coverage_plan','plan_instruction','produce_content','self_review','bounded_self_repair','declare_uncertainty','submit_governed_candidate'),
 'memory_policy',jsonb_build_object('stable_professional_memory','versioned_profile','subject_memory','versioned_subject_profile','mission_context','per_execution','execution_context','per_execution','quality_history','defect_class_retrieval_only','evidence_context','exact_packet_binding','free_form_conversation_memory',false),
 'stop_conditions',jsonb_build_array('insufficient_curriculum_evidence','contradictory_authoritative_sources','scientific_uncertainty','unsafe_or_unverified_practical','required_outcome_unsatisfied','repeated_self_repair_failure','corrupted_lineage','unresolved_assessment_correctness','authority_violation'),
 'max_self_repair_cycles',1,'publication_authority',false,'self_approval',false
),now()),
('chemistry-grade10-author',2,'subject','active',jsonb_build_object(
 'subject','Chemistry','grade',10,
 'requirements',jsonb_build_array('laboratory_safety','apparatus','chemicals','expected_observations','balanced_equations_where_required','correct_symbols','particulate_explanations','scientific_models','misconception_handling','executable_experimental_procedure','expected_results','interpretation','kenyan_school_feasibility'),
 'practical_contract',jsonb_build_array('objective','materials','procedure','safety_controls','expected_observations','interpretation','cleanup_or_disposal_where_relevant'),
 'critical_science_rules',jsonb_build_array('mass_number_equals_protons_plus_neutrons','ion_charge_uses_proton_electron_difference','coefficients_balance_equations_without_changing_subscripts','conductivity_alone_does_not_identify_acid_or_base','strength_is_not_concentration'),
 'uncertainty_rule','Block rather than infer unsupported scientific or safety-critical facts.'
),now()),
('teacher-guide-quality-contract',2,'quality_contract','active',jsonb_build_object(
 'required_sections',jsonb_build_array('objectives','prerequisite_knowledge','preparation_resources','teacher_explanation','kenyan_applications','learner_activities','misconceptions','teacher_prompts','differentiation_inclusion','assessment','marking_guidance','closure_reflection'),
 'outcome_trace_required',jsonb_build_array('teacher_explanation','learner_experience','teacher_check','assessment','expected_learner_evidence'),
 'activity_required',jsonb_build_array('instructions','expected_observation_or_outcome'),
 'assessment_required',jsonb_build_array('mapped_outcome','answer_or_marking_guidance'),
 'critical_blockers',jsonb_build_array('curriculum_identity_invalid','evidence_not_ready','outcome_unteachable','scientific_correctness_failure','unsafe_practical','assessment_answer_unresolved','lineage_invalid','blocking_uncertainty'),
 'candidate_rule','Every hard gate passes. An average score can never override a critical blocker.',
 'repair_policy',jsonb_build_object('max_cycles',1,'repair_only_obvious_bounded_defects',true,'semantic_or_safety_uncertainty','escalate')
),now()),
('chemistry-content-worker-evaluation',2,'evaluation_suite','active',jsonb_build_object(
 'dimensions',jsonb_build_array('curriculum_fidelity','scientific_correctness','pedagogical_depth','classroom_executability','assessment_quality','teacher_usability','differentiation_inclusion','practical_safety_integrity','evidence_provenance','structural_integrity','self_detection_performance'),
 'production_regression_cases',jsonb_build_array(
   jsonb_build_object('case_key','introduction_to_chemistry','expected','block','defects',jsonb_build_array('summary_not_classroom_ready','outcomes_not_teachably_traced','missing_detailed_activities','weak_assessment_linkage','missing_closure')),
   jsonb_build_object('case_key','the_atom','expected','block','defects',jsonb_build_array('summary_not_classroom_ready','scientific_correctness_failure','missing_explicit_simulation_activity','incomplete_assessment_linkage')),
   jsonb_build_object('case_key','periodic_table','expected','block','defects',jsonb_build_array('summary_not_classroom_ready','missing_guided_exploration','insufficient_ion_formula_worked_reasoning','incomplete_assessment_linkage')),
   jsonb_build_object('case_key','chemical_bonding','expected','block','defects',jsonb_build_array('summary_not_classroom_ready','insufficient_structure_property_teaching','missing_executable_vibelab','incomplete_assessment_linkage')),
   jsonb_build_object('case_key','periodicity','expected','block','defects',jsonb_build_array('summary_not_classroom_ready','missing_datasets','missing_executable_vibelab','trend_qualification_needed','incomplete_assessment_linkage')),
   jsonb_build_object('case_key','acids_and_bases','expected','block','defects',jsonb_build_array('summary_not_classroom_ready','practical_safety_detail_missing','missing_executable_vibelab','strength_concentration_depth','incomplete_assessment_linkage')),
   jsonb_build_object('case_key','introduction_to_salts','expected','block','defects',jsonb_build_array('summary_not_classroom_ready','salt_preparation_procedures_missing','practical_safety_detail_missing','missing_executable_vibelab','incomplete_assessment_linkage'))
 ),
 'adversarial_cases',jsonb_build_array('structurally_complete_pedagogically_weak','fluent_incorrect_chemistry','impossible_activity_resources','assessment_outcome_mismatch','practical_missing_safety','incorrect_marking_answer','fake_curriculum_completeness','contradictory_evidence','missing_authoritative_source','unsupported_scientific_claim','duplicate_version_identity')
),now());

create or replace function public.content_worker_teacher_guide_self_review(p_body jsonb,p_quality jsonb default '{}'::jsonb)
returns jsonb language plpgsql immutable security invoker set search_path=public,pg_temp as $$
declare
 findings jsonb:='[]'::jsonb; repairable jsonb:='[]'::jsonb; blockers jsonb:='[]'::jsonb;
 required text; formal_n int:=coalesce((p_quality->>'formal_assessment_items')::int,0); answer_n int:=0; txt text;
begin
 if p_body is null or jsonb_typeof(p_body)<>'object' then
   return jsonb_build_object('mode','inspection','passed',false,'findings',jsonb_build_array(jsonb_build_object('code','malformed_artifact','severity','critical')),'repairable','[]'::jsonb,'blockers',jsonb_build_array('malformed_artifact'),'max_repair_cycles',1);
 end if;

 foreach required in array array['objectives','prerequisite_knowledge','preparation_resources','teacher_explanation','learner_activities','teacher_prompts','differentiation_inclusion','closure_reflection'] loop
   if not (p_body ? required) then
     findings:=findings||jsonb_build_array(jsonb_build_object('code','missing_section:'||required,'severity','major','disposition','repair'));
     repairable:=repairable||jsonb_build_array('missing_section:'||required);
   end if;
 end loop;

 if p_body ? 'sequence' and not (p_body ? 'teacher_explanation') and not (p_body ? 'learner_activities') then
   findings:=findings||jsonb_build_array(jsonb_build_object('code','summary_not_classroom_ready','severity','critical','disposition','block'));
   blockers:=blockers||jsonb_build_array('summary_not_classroom_ready');
 end if;

 if not (p_body ? 'outcome_coverage') then
   findings:=findings||jsonb_build_array(jsonb_build_object('code','curriculum_outcome_trace_missing','severity','critical','disposition','block'));
   blockers:=blockers||jsonb_build_array('curriculum_outcome_trace_missing');
 end if;

 if jsonb_typeof(coalesce(p_body->'answer_guidance','{}'::jsonb))='object' then answer_n:=jsonb_object_length(coalesce(p_body->'answer_guidance','{}'::jsonb)); end if;
 if formal_n>0 and answer_n<formal_n and not (p_body ? 'moderated_assessment_links') then
   findings:=findings||jsonb_build_array(jsonb_build_object('code','incomplete_assessment_treatment','severity','critical','disposition','block','formal_items',formal_n,'answer_guidance_items',answer_n));
   blockers:=blockers||jsonb_build_array('incomplete_assessment_treatment');
 end if;

 if not (p_body ? 'citations') and not (p_quality ? 'verified_evidence_packet_sha256') then
   findings:=findings||jsonb_build_array(jsonb_build_object('code','evidence_provenance_missing','severity','critical','disposition','block'));
   blockers:=blockers||jsonb_build_array('evidence_provenance_missing');
 end if;

 txt:=lower(p_body::text);
 if txt ~ 'mass number[^.]{0,80}(protons?[^.]{0,30}electrons?|electrons?[^.]{0,30}protons?)' then
   findings:=findings||jsonb_build_array(jsonb_build_object('code','scientific_correctness_failure:mass_number','severity','critical','disposition','escalate'));
   blockers:=blockers||jsonb_build_array('scientific_correctness_failure:mass_number');
 end if;

 if coalesce((p_body->>'has_practical')::boolean,false) and not (p_body ? 'practical_safety') then
   findings:=findings||jsonb_build_array(jsonb_build_object('code','unsafe_practical:missing_safety_controls','severity','critical','disposition','escalate'));
   blockers:=blockers||jsonb_build_array('unsafe_practical:missing_safety_controls');
 end if;

 return jsonb_build_object(
   'mode','inspection','passed',jsonb_array_length(blockers)=0 and jsonb_array_length(findings)=0,
   'findings',findings,'repairable',repairable,'blockers',blockers,
   'repair_plan',case when jsonb_array_length(repairable)>0 then jsonb_build_object('bounded',true,'max_cycles',1,'targets',repairable) else null end,
   'max_repair_cycles',1
 );
end $$;
revoke all on function public.content_worker_teacher_guide_self_review(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.content_worker_teacher_guide_self_review(jsonb,jsonb) to service_role;

create or replace function public.content_worker_quality_candidate_decision(p_preflight jsonb,p_self_review jsonb,p_blocking_uncertainty boolean default false)
returns jsonb language sql immutable security invoker set search_path=public,pg_temp as $$
 select case
   when p_blocking_uncertainty then jsonb_build_object('decision','blocked','reason','blocking_uncertainty')
   when not coalesce((p_preflight->>'passed')::boolean,false) then jsonb_build_object('decision','blocked','reason','deterministic_preflight_failed')
   when not coalesce((p_self_review->>'passed')::boolean,false) then jsonb_build_object('decision','blocked','reason','self_review_failed')
   else jsonb_build_object('decision','quality_candidate','publication_authority',false)
 end
$$;
revoke all on function public.content_worker_quality_candidate_decision(jsonb,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.content_worker_quality_candidate_decision(jsonb,jsonb,boolean) to service_role;

update public.hq_workforce_workers
set title='Senior Educational Content Developer — Content Factory',
    mission='Produce evidence-grounded, curriculum-traceable, classroom-ready governed content candidates through deliberate planning, deterministic preflight, inspection-mode self-review, one bounded targeted repair cycle and explicit escalation. Never self-publish or invent authority.',
    kpis=coalesce(kpis,'{}'::jsonb)||jsonb_build_object(
      'primary_metric','trustworthy_classroom_ready_candidate_production',
      'professional_profile','senior-educational-content-developer@2',
      'subject_profile','chemistry-grade10-author@2',
      'quality_contract','teacher-guide-quality-contract@2',
      'evaluation_suite','chemistry-content-worker-evaluation@2',
      'max_self_repair_cycles',1,
      'quality_candidate_requires',jsonb_build_array('curriculum_identity_valid','evidence_ready','coverage_complete','artifact_contract_complete','deterministic_preflight_pass','self_review_pass','no_blocking_uncertainty')
    ),
    updated_at=now()
where worker_key='content-factory-r2-canary-01';

commit;
