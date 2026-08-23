begin;

-- P0 Chemistry learning-quality contract.
-- NON-ACTIVATING: runtime/heartbeat/factory/shadow/scheduler remain OFF,
-- autonomy/risk remain 0, Global Stop remains ON, and no publication/payment/
-- approval authority is granted.
--
-- This closes two fail-closed gaps:
-- 1) the professionally certified Chemistry Author was still stranded in draft
--    workforce lifecycle state and therefore could not receive its already-
--    governed chemistry.grade10 qualification;
-- 2) Chemistry stage PASS did not require machine-readable educational-quality
--    evidence, allowing "worker finished" to be weaker than "content is good".

-- Safely converge only the certified Content Author from stale draft -> restricted.
-- Restricted is the non-activating professional state used by the governed
-- Chemistry mission. No permissions or approval boundaries are expanded.
do $$
declare
  w public.hq_workforce_workers%rowtype;
  a public.hq_workforce_worker_assurance%rowtype;
  ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into w
  from public.hq_workforce_workers
  where worker_key='content-factory-r2-canary-01'
  for update;
  if not found then raise exception 'CHEMISTRY_AUTHOR_WORKER_REQUIRED'; end if;

  if w.status='draft' then
    select * into a
    from public.hq_workforce_worker_assurance
    where worker_key=w.worker_key
      and standard_key='vibeschool-professional-worker'
      and standard_version=1
    for update;
    if not found
       or a.certification_state<>'CERTIFIED'
       or a.qualification_state<>'CERTIFIED'
       or a.expires_at is null
       or a.expires_at<=clock_timestamp()
       or a.worker_version is distinct from w.version then
      raise exception 'CHEMISTRY_AUTHOR_RESTRICTED_CONVERGENCE_REQUIRES_CURRENT_CERTIFICATION';
    end if;

    if exists(
      select 1
      from jsonb_array_elements_text(coalesce(w.permissions,'[]'::jsonb)) p(permission)
      where permission ~* '(publish|approve|pay|spend|grant|deploy|runtime|scheduler|release_override|self_cert)'
    ) then
      raise exception 'CHEMISTRY_AUTHOR_PERMISSION_BOUNDARY_INVALID';
    end if;

    select * into ec
    from public.hq_workforce_engine_contract
    where singleton=true
    for update;
    if not found then raise exception 'WORKFORCE_ENGINE_CONTRACT_REQUIRED'; end if;
    if coalesce(ec.runtime_execution_enabled,false)
       or coalesce(ec.heartbeat_enabled,false)
       or coalesce(ec.factory_enabled,false)
       or coalesce(ec.runtime_autonomy_level,0)<>0
       or coalesce(ec.runtime_max_risk,0)<>0
       or coalesce(ec.shadow_enabled,false)
       or coalesce(ec.shadow_scheduler_enabled,false)
       or not coalesce(ec.shadow_global_stop,true) then
      raise exception 'CHEMISTRY_AUTHOR_STATUS_CONVERGENCE_REQUIRES_RUNTIME_OFF_GLOBAL_STOP_ON';
    end if;

    update public.hq_workforce_workers
    set status='restricted',updated_at=clock_timestamp()
    where worker_key=w.worker_key and status='draft';
  elsif w.status not in ('restricted','active') then
    raise exception 'CHEMISTRY_AUTHOR_UNSAFE_WORKFORCE_STATE:%',w.status;
  end if;
end $$;

-- Promote the authoring standards from "complete prose" to demonstrable learning.
update public.content_worker_profiles
set status='retired'
where profile_key in (
  'teacher-guide-quality-contract',
  'chemistry-grade10-author',
  'chemistry-content-worker-evaluation'
) and status='active';

with s(specification) as (values ($json$
{
  "candidate_rule":"Every required learning outcome must be taught, experienced, practised, assessed, and supported for the teacher. No average score may override a hard gate.",
  "contract_version":3,
  "required_sections":["objectives","prerequisite_knowledge","preparation_resources","teacher_explanation","worked_examples","kenyan_applications","learner_activities","misconceptions","teacher_prompts","differentiation_inclusion","guided_practice","assessment","marking_guidance","closure_reflection"],
  "outcome_trace_required":["concept_explanation","worked_or_concrete_example","learner_activity_or_experience","guided_practice","assessment_evidence","teacher_support","expected_learner_evidence"],
  "activity_required":["instructions","materials_or_resources","expected_observation_or_outcome","teacher_check"],
  "assessment_required":["mapped_outcome","question_or_task","answer_or_marking_guidance","evidence_of_mastery"],
  "critical_blockers":["curriculum_identity_invalid","evidence_not_ready","outcome_unteachable","outcome_trace_incomplete","scientific_correctness_failure","unsafe_practical","assessment_answer_unresolved","assessment_not_taught","lineage_invalid","blocking_uncertainty","teacher_cannot_execute_lesson"],
  "repair_policy":{"max_cycles":1,"repair_only_demonstrated_defects":true,"preserve_unaffected_approved_material":true,"semantic_or_safety_uncertainty":"escalate"}
}
$json$::jsonb))
insert into public.content_worker_profiles(
  profile_key,version,profile_kind,subject,status,specification,specification_sha256,activated_at
)
select 'teacher-guide-quality-contract',3,'quality_contract',null,'active',specification,
       pg_catalog.encode(extensions.digest(specification::text,'sha256'::text),'hex'::text),clock_timestamp()
from s;

with s(specification) as (values ($json$
{
  "subject":"Chemistry",
  "grade":10,
  "contract_version":3,
  "mission":"Produce classroom-ready learning, not summaries.",
  "requirements":["curriculum_outcome_traceability","scientific_correctness","conceptual_reasoning","worked_examples_where_applicable","laboratory_safety","apparatus","chemicals","expected_observations","balanced_equations_where_required","correct_symbols_and_units","particulate_explanations","scientific_models","misconception_handling","guided_practice","assessment_alignment","teacher_support","kenyan_school_feasibility"],
  "outcome_definition_of_done":["explain","exemplify","learner_experience","practise","assess","teacher_support","expected_evidence"],
  "practical_contract":["objective","materials","safety_controls","procedure","expected_observations","interpretation","equation_where_relevant","cleanup_or_disposal_where_relevant","learner_questions","expected_answers"],
  "assessment_contract":{"minimum_formal_items_per_chapter":6,"must_cover_taught_outcomes":true,"answers_or_marking_guidance_required":true,"untaught_question_forbidden":true},
  "misconception_contract":{"identify_common_error":true,"explain_why_wrong":true,"provide_correct_model":true,"include_check_for_understanding":true},
  "uncertainty_rule":"Block rather than infer unsupported scientific, curriculum, assessment, or safety-critical facts.",
  "critical_science_rules":["mass_number_equals_protons_plus_neutrons","ion_charge_uses_proton_electron_difference","coefficients_balance_equations_without_changing_subscripts","conductivity_alone_does_not_identify_acid_or_base","strength_is_not_concentration"]
}
$json$::jsonb))
insert into public.content_worker_profiles(
  profile_key,version,profile_kind,subject,status,specification,specification_sha256,activated_at
)
select 'chemistry-grade10-author',3,'subject','Chemistry','active',specification,
       pg_catalog.encode(extensions.digest(specification::text,'sha256'::text),'hex'::text),clock_timestamp()
from s;

with s(specification) as (values ($json$
{
  "contract_version":3,
  "dimensions":["curriculum_fidelity","scientific_correctness","pedagogical_depth","outcome_traceability","worked_reasoning_quality","classroom_executability","assessment_quality","teacher_usability","differentiation_inclusion","practical_safety_integrity","misconception_handling","evidence_provenance","structural_integrity","self_detection_performance"],
  "hard_pass_rule":"No unresolved major or critical defect; every outcome has a complete learning trace; fresh review is required after repair.",
  "adversarial_cases":["long_but_shallow_content","structurally_complete_pedagogically_weak","fluent_incorrect_chemistry","definition_without_explanation","worked_answer_without_reasoning","impossible_activity_resources","assessment_outcome_mismatch","assessment_tests_untaught_content","practical_missing_safety","incorrect_marking_answer","fake_curriculum_completeness","contradictory_evidence","missing_authoritative_source","unsupported_scientific_claim","duplicate_version_identity"],
  "production_regression_cases":[
    {"case_key":"introduction_to_chemistry","expected":"block","defects":["summary_not_classroom_ready","outcomes_not_teachably_traced","missing_detailed_activities","weak_assessment_linkage","missing_closure"]},
    {"case_key":"the_atom","expected":"block","defects":["summary_not_classroom_ready","scientific_correctness_failure","missing_explicit_model_activity","incomplete_assessment_linkage"]},
    {"case_key":"periodic_table","expected":"block","defects":["summary_not_classroom_ready","missing_guided_exploration","insufficient_ion_formula_worked_reasoning","incomplete_assessment_linkage"]},
    {"case_key":"chemical_bonding","expected":"block","defects":["summary_not_classroom_ready","insufficient_structure_property_teaching","missing_executable_vibelab","incomplete_assessment_linkage"]},
    {"case_key":"periodicity","expected":"block","defects":["summary_not_classroom_ready","missing_datasets","missing_executable_vibelab","trend_qualification_needed","incomplete_assessment_linkage"]},
    {"case_key":"acids_and_bases","expected":"block","defects":["summary_not_classroom_ready","practical_safety_detail_missing","missing_executable_vibelab","strength_concentration_depth","incomplete_assessment_linkage"]},
    {"case_key":"introduction_to_salts","expected":"block","defects":["summary_not_classroom_ready","salt_preparation_procedures_missing","practical_safety_detail_missing","missing_executable_vibelab","incomplete_assessment_linkage"]}
  ]
}
$json$::jsonb))
insert into public.content_worker_profiles(
  profile_key,version,profile_kind,subject,status,specification,specification_sha256,activated_at
)
select 'chemistry-content-worker-evaluation',3,'evaluation_suite','Chemistry','active',specification,
       pg_catalog.encode(extensions.digest(specification::text,'sha256'::text),'hex'::text),clock_timestamp()
from s;

-- Canonical bundle that Cyborg receives on every governed Chemistry stage claim.
create or replace function public.chemistry_learning_quality_contract()
returns jsonb
language sql
stable
set search_path=public,pg_temp
as $$
  select jsonb_build_object(
    'contract_version',3,
    'definition_of_done','AI cannot declare completion from prose length or fluency. Completion requires evidence for every hard learning gate.',
    'professional_profile',public.content_worker_active_profile('senior-educational-content-developer'),
    'quality_contract',public.content_worker_active_profile('teacher-guide-quality-contract'),
    'subject_profile',public.content_worker_active_profile('chemistry-grade10-author'),
    'evaluation_suite',public.content_worker_active_profile('chemistry-content-worker-evaluation'),
    'hard_gates',jsonb_build_array(
      'curriculum_outcomes_complete','scientific_accuracy','conceptual_depth','worked_examples_where_needed',
      'learner_activities_executable','guided_practice','misconceptions_addressed','assessment_aligned_to_taught_content',
      'teacher_support_complete','practical_safety_when_applicable','kenyan_classroom_feasibility','independent_critic_pass_after_repair'
    )
  )
$$;

revoke all on function public.chemistry_learning_quality_contract() from public,anon,authenticated;
grant execute on function public.chemistry_learning_quality_contract() to service_role;

-- Bind the contract into the immutable input packet before a stage attempt exists.
create or replace function public.chemistry_bind_learning_quality_contract()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  new.input_packet:=coalesce(new.input_packet,'{}'::jsonb)||jsonb_build_object(
    'learning_quality_contract',public.chemistry_learning_quality_contract()
  );
  return new;
end $$;

drop trigger if exists chemistry_bind_learning_quality_contract on public.chemistry_worker_stage_attempts;
create trigger chemistry_bind_learning_quality_contract
before insert on public.chemistry_worker_stage_attempts
for each row execute function public.chemistry_bind_learning_quality_contract();

-- PASS must now prove educational quality, not merely stage completion.
-- REPAIR_REQUIRED remains allowed to carry defects forward to the repair stage.
create or replace function public.chemistry_enforce_learning_quality_pass()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
declare
  q jsonb:=coalesce(new.output_packet->'quality_evidence','{}'::jsonb);
  v integer:=coalesce(nullif(new.output_packet->>'learning_quality_contract_version','')::integer,0);
begin
  if new.state='SUCCEEDED'
     and new.output_packet->>'disposition'='PASS' then
    if v<>3 then raise exception 'CHEMISTRY_LEARNING_QUALITY_CONTRACT_VERSION_REQUIRED'; end if;
    if jsonb_typeof(q)<>'object' then raise exception 'CHEMISTRY_QUALITY_EVIDENCE_REQUIRED'; end if;

    if new.stage='AUTHORING' then
      if not coalesce((q->>'outcome_coverage_complete')::boolean,false)
         or not coalesce((q->>'concept_explanations_complete')::boolean,false)
         or not coalesce((q->>'worked_examples_present_where_required')::boolean,false)
         or not coalesce((q->>'learner_activities_executable')::boolean,false)
         or not coalesce((q->>'guided_practice_present')::boolean,false)
         or not coalesce((q->>'misconceptions_addressed')::boolean,false)
         or not coalesce((q->>'assessment_alignment_complete')::boolean,false)
         or not coalesce((q->>'teacher_support_complete')::boolean,false)
         or not coalesce((q->>'scientific_accuracy_checked')::boolean,false)
         or not coalesce((q->>'kenyan_classroom_feasibility_checked')::boolean,false)
         or (coalesce((q->>'practical_present')::boolean,false)
             and not coalesce((q->>'practical_safety_complete')::boolean,false)) then
        raise exception 'CHEMISTRY_AUTHOR_PASS_MISSING_LEARNING_EVIDENCE';
      end if;
    elsif new.stage in ('P2_REVIEW','FRESH_P2_REVIEW') then
      if not coalesce((q->>'deterministic_contract_checks_pass')::boolean,false)
         or not coalesce((q->>'outcome_trace_complete')::boolean,false)
         or not coalesce((q->>'assessment_count_and_alignment_pass')::boolean,false)
         or not coalesce((q->>'teacher_guide_contract_pass')::boolean,false)
         or coalesce(nullif(q->>'unresolved_major_defects','')::integer,999)>0
         or coalesce(nullif(q->>'unresolved_critical_defects','')::integer,999)>0 then
        raise exception 'CHEMISTRY_QUALITY_PASS_MISSING_CONTRACT_EVIDENCE';
      end if;
    elsif new.stage in ('P3_REVIEW','FRESH_P3_REVIEW') then
      if not coalesce((q->>'independent_review')::boolean,false)
         or not coalesce((q->>'scientific_accuracy_pass')::boolean,false)
         or not coalesce((q->>'pedagogical_depth_pass')::boolean,false)
         or not coalesce((q->>'assessment_quality_pass')::boolean,false)
         or not coalesce((q->>'lab_safety_integrity_pass')::boolean,false)
         or not coalesce((q->>'classroom_executability_pass')::boolean,false)
         or not coalesce((q->>'teacher_usability_pass')::boolean,false)
         or coalesce(nullif(q->>'unresolved_major_defects','')::integer,999)>0
         or coalesce(nullif(q->>'unresolved_critical_defects','')::integer,999)>0 then
        raise exception 'CHEMISTRY_CRITIC_PASS_MISSING_INDEPENDENT_EVIDENCE';
      end if;
    elsif new.stage='REPAIRING' then
      if not coalesce((q->>'targeted_repair')::boolean,false)
         or not coalesce((q->>'preserved_unaffected_content')::boolean,false)
         or not coalesce((q->>'regression_checks_pass')::boolean,false)
         or coalesce(nullif(q->>'remaining_major_defects','')::integer,999)>0
         or coalesce(nullif(q->>'remaining_critical_defects','')::integer,999)>0 then
        raise exception 'CHEMISTRY_REPAIR_PASS_MISSING_REGRESSION_EVIDENCE';
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists chemistry_enforce_learning_quality_pass on public.chemistry_worker_stage_attempts;
create trigger chemistry_enforce_learning_quality_pass
before update of state,output_packet on public.chemistry_worker_stage_attempts
for each row execute function public.chemistry_enforce_learning_quality_pass();

-- Reconstruction-time assertions: this migration must never activate the engine.
do $$
declare ec public.hq_workforce_engine_contract%rowtype;
begin
  select * into ec from public.hq_workforce_engine_contract where singleton=true;
  if not found then raise exception 'WORKFORCE_ENGINE_CONTRACT_REQUIRED'; end if;
  if coalesce(ec.runtime_execution_enabled,false)
     or coalesce(ec.heartbeat_enabled,false)
     or coalesce(ec.factory_enabled,false)
     or coalesce(ec.runtime_autonomy_level,0)<>0
     or coalesce(ec.runtime_max_risk,0)<>0
     or coalesce(ec.shadow_enabled,false)
     or coalesce(ec.shadow_scheduler_enabled,false)
     or not coalesce(ec.shadow_global_stop,true) then
    raise exception 'CHEMISTRY_LEARNING_QUALITY_CONTRACT_NON_ACTIVATING_BOUNDARY_VIOLATED';
  end if;
end $$;

commit;
