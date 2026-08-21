begin;

-- Priority 1: professionalize the existing Content Factory authoring worker in-place.
-- This adds governed professional context, inspectable planning, quality/evaluation evidence,
-- and fail-closed preflight contracts. It does not add a competing author/critic/publisher.

create table if not exists public.content_worker_profiles (
  profile_key text not null,
  version integer not null check (version > 0),
  profile_kind text not null check (profile_kind in ('professional','subject','quality_contract','evaluation_suite')),
  subject text,
  status text not null default 'draft' check (status in ('draft','active','retired')),
  specification jsonb not null,
  specification_sha256 text generated always as (encode(digest(specification::text,'sha256'),'hex')) stored,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  primary key(profile_key,version)
);
alter table public.content_worker_profiles enable row level security;
revoke all on table public.content_worker_profiles from public,anon,authenticated;
grant select on table public.content_worker_profiles to service_role;

create unique index if not exists content_worker_profiles_one_active
on public.content_worker_profiles(profile_key) where status='active';

create table if not exists public.content_worker_execution_contexts (
  id uuid primary key default gen_random_uuid(),
  task_id uuid,
  proposal_id uuid references public.curriculum_intelligence_proposals(id) on delete restrict,
  worker_key text not null,
  worker_profile_key text not null,
  worker_profile_version integer not null,
  subject_profile_key text,
  subject_profile_version integer,
  quality_contract_key text not null,
  quality_contract_version integer not null,
  evaluation_suite_version integer not null,
  mission_context jsonb not null,
  evidence_packet_sha256 text,
  plan jsonb not null,
  plan_sha256 text generated always as (encode(digest(plan::text,'sha256'),'hex')) stored,
  status text not null default 'planned' check (status in ('planned','generated','preflight_failed','self_review_failed','blocked','quality_candidate')),
  blockers jsonb not null default '[]'::jsonb,
  preflight jsonb,
  self_review jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.content_worker_execution_contexts enable row level security;
revoke all on table public.content_worker_execution_contexts from public,anon,authenticated;
grant select,insert,update on table public.content_worker_execution_contexts to service_role;
create index if not exists content_worker_execution_task_idx on public.content_worker_execution_contexts(task_id,created_at desc);

create table if not exists public.content_worker_evaluations (
  id uuid primary key default gen_random_uuid(),
  worker_key text not null,
  worker_profile_version integer not null,
  suite_version integer not null,
  case_key text not null,
  case_class text not null check (case_class in ('chemistry_regression','adversarial','production_sample')),
  expected_disposition text not null check (expected_disposition in ('pass','detect','repair','block','escalate')),
  actual_disposition text not null check (actual_disposition in ('pass','detect','repair','block','escalate','incorrect_pass')),
  dimension_scores jsonb not null default '{}'::jsonb,
  critical_failures jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  passed boolean not null,
  evaluated_at timestamptz not null default now(),
  unique(worker_key,worker_profile_version,suite_version,case_key)
);
alter table public.content_worker_evaluations enable row level security;
revoke all on table public.content_worker_evaluations from public,anon,authenticated;
grant select,insert,update on table public.content_worker_evaluations to service_role;

insert into public.content_worker_profiles(profile_key,version,profile_kind,status,specification,activated_at)
values
('senior-educational-content-developer',1,'professional','active',jsonb_build_object(
 'role','Senior Educational Content Developer / Subject Author',
 'responsibilities',jsonb_build_array('understand_assignment','retrieve_canonical_curriculum','retrieve_approved_evidence','decompose_learning_outcomes','build_coverage_plan','plan_instruction','produce_content','self_review','bounded_self_repair','declare_uncertainty','submit_governed_candidate'),
 'competencies',jsonb_build_array('curriculum_interpretation','subject_expertise','pedagogical_planning','lesson_sequencing','prerequisite_analysis','misconception_identification','classroom_activity_design','practical_design','safety_awareness','questioning_strategy','differentiation','inclusive_education','assessment_design','marking_guidance','learner_evidence','teacher_usability','age_appropriate_language','kenyan_context','source_discipline','revision_competence'),
 'may',jsonb_build_array('create_drafts','improve_explanations','produce_activities','create_assessments','perform_bounded_self_revision'),
 'must_not',jsonb_build_array('invent_curriculum','override_authoritative_evidence','self_publish','self_approve_publication','hide_uncertainty','fabricate_references','equate_structural_completeness_with_editorial_readiness'),
 'memory_policy',jsonb_build_object('stable_professional_memory','versioned_profile','subject_memory','versioned_subject_profile','mission_context','per_execution','execution_context','per_execution','quality_history','retrieve_relevant_defect_classes_only','evidence_context','bind_exact_packet','free_form_conversation_memory',false),
 'stop_conditions',jsonb_build_array('insufficient_curriculum_evidence','contradictory_authoritative_sources','scientific_uncertainty','unsafe_or_unverified_practical','required_outcome_unsatisfied','repeated_self_repair_failure','corrupted_lineage','unresolved_assessment_correctness','authority_violation'),
 'max_self_repair_cycles',1
),now()),
('chemistry-grade10-author',1,'subject','active',jsonb_build_object(
 'subject','Chemistry','grade',10,
 'requirements',jsonb_build_array('laboratory_safety','apparatus','chemicals','expected_observations','balanced_equations_where_required','correct_symbols','particulate_explanations','scientific_models','misconception_handling','executable_experimental_procedure','expected_results','interpretation','kenyan_school_feasibility'),
 'practical_contract',jsonb_build_array('objective','materials','procedure','safety_controls','expected_observations','interpretation','disposal_or_cleanup_where_relevant'),
 'uncertainty_rule','Block rather than infer unsupported scientific or safety-critical facts.'
),now()),
('teacher-guide-quality-contract',1,'quality_contract','active',jsonb_build_object(
 'required_sections',jsonb_build_array('objectives','prerequisite_knowledge','preparation_resources','teacher_explanation','kenyan_applications','learner_activities','misconceptions','teacher_prompts','differentiation_inclusion','assessment','marking_guidance','closure_reflection'),
 'outcome_trace_required',jsonb_build_array('teacher_explanation','learner_experience','teacher_check','assessment','expected_learner_evidence'),
 'activity_required',jsonb_build_array('instructions','expected_observation_or_outcome'),
 'assessment_required',jsonb_build_array('mapped_outcome','answer_or_marking_guidance'),
 'critical_blockers',jsonb_build_array('curriculum_identity_invalid','evidence_not_ready','outcome_unteachable','scientific_correctness_failure','unsafe_practical','assessment_answer_unresolved','lineage_invalid','blocking_uncertainty'),
 'candidate_rule','All hard gates pass; average scores cannot override a critical blocker.'
),now()),
('chemistry-content-worker-evaluation',1,'evaluation_suite','active',jsonb_build_object(
 'dimensions',jsonb_build_array('curriculum_fidelity','scientific_correctness','pedagogical_depth','classroom_executability','assessment_quality','teacher_usability','differentiation_inclusion','practical_safety_integrity','evidence_provenance','structural_integrity','self_detection_performance'),
 'regression_cases',jsonb_build_array('summary_not_classroom_ready','outcome_displayed_not_taught','shallow_science','activity_missing_detail','missing_expected_observations','weak_lab_orientation','weak_safety','weak_teacher_questioning','weak_misconceptions','weak_differentiation','incomplete_assessment','unclear_marking','weak_closure','insufficient_self_criticism'),
 'adversarial_cases',jsonb_build_array('fluent_incorrect_chemistry','impossible_activity_resources','assessment_outcome_mismatch','practical_missing_safety','incorrect_marking_answer','fake_curriculum_completeness','contradictory_evidence','missing_authoritative_source','unsupported_scientific_claim','duplicate_version_identity')
),now())
on conflict(profile_key,version) do nothing;

create or replace function public.content_worker_active_profile(p_profile_key text)
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 select jsonb_build_object('profile_key',profile_key,'version',version,'kind',profile_kind,'subject',subject,'sha256',specification_sha256,'specification',specification)
 from public.content_worker_profiles where profile_key=p_profile_key and status='active' limit 1
$$;
revoke all on function public.content_worker_active_profile(text) from public,anon,authenticated;
grant execute on function public.content_worker_active_profile(text) to service_role;

create or replace function public.content_worker_build_plan(p_claim jsonb)
returns jsonb language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare outcomes jsonb; subject text; grade text; evidence jsonb; blockers jsonb:='[]'::jsonb;
begin
 if p_claim is null or jsonb_typeof(p_claim)<>'object' then raise exception 'content_worker_claim_required'; end if;
 evidence:=coalesce(p_claim->'evidence_packet','{}'::jsonb);
 if coalesce(jsonb_array_length(coalesce(evidence->'sources','[]'::jsonb)),0)=0 then blockers:=blockers||jsonb_build_array('insufficient_curriculum_evidence'); end if;
 outcomes:=coalesce(p_claim->'curriculum_outcomes',p_claim->'target'->'learning_outcomes','[]'::jsonb);
 subject:=coalesce(p_claim->>'subject',p_claim->'target'->>'subject','');
 grade:=coalesce(p_claim->>'grade',p_claim->'target'->>'grade','');
 return jsonb_build_object(
  'plan_version',1,'job_identity',jsonb_build_object('task_id',p_claim->>'task_id','proposal_id',p_claim->>'proposal_id','worker_key',coalesce(p_claim->>'worker_key','content-authoring-worker')),
  'canonical_curriculum_identity',jsonb_build_object('subject',subject,'grade',grade,'outcomes',outcomes),
  'evidence_packet_sha256',p_claim->>'evidence_packet_sha256',
  'stages',jsonb_build_array('curriculum_interpretation','prerequisite_analysis','concept_decomposition','misconception_analysis','teaching_strategy','activity_practical_planning','assessment_planning','resources_safety_planning','coverage_matrix','artifact_generation','deterministic_preflight','self_review','bounded_repair'),
  'coverage_matrix',coalesce((select jsonb_agg(jsonb_build_object('outcome',x,'teacher_explanation',false,'learner_experience',false,'teacher_check',false,'assessment',false,'expected_learner_evidence',false)) from jsonb_array_elements(outcomes) x),'[]'::jsonb),
  'blockers',blockers
 );
end $$;
revoke all on function public.content_worker_build_plan(jsonb) from public,anon,authenticated;
grant execute on function public.content_worker_build_plan(jsonb) to service_role;

create or replace function public.content_worker_preflight(p_artifact jsonb,p_plan jsonb,p_subject text default null)
returns jsonb language plpgsql immutable security invoker set search_path=public,pg_temp as $$
declare failures jsonb:='[]'::jsonb; warnings jsonb:='[]'::jsonb; sections jsonb; coverage jsonb; s text;
begin
 if jsonb_typeof(p_artifact)<>'object' then return jsonb_build_object('passed',false,'critical_failures',jsonb_build_array('malformed_artifact'),'warnings','[]'::jsonb); end if;
 sections:=coalesce(p_artifact->'sections','{}'::jsonb);
 foreach s in array array['objectives','prerequisite_knowledge','preparation_resources','teacher_explanation','learner_activities','teacher_prompts','differentiation_inclusion','assessment','marking_guidance','closure_reflection'] loop
  if not (sections ? s) or nullif(btrim(coalesce(sections->>s,'')),'') is null then failures:=failures||jsonb_build_array('missing_section:'||s); end if;
 end loop;
 coverage:=coalesce(p_artifact->'coverage_matrix','[]'::jsonb);
 if jsonb_typeof(coverage)<>'array' then failures:=failures||jsonb_build_array('coverage_matrix_malformed');
 elsif exists(select 1 from jsonb_array_elements(coverage) c where not(coalesce((c->>'teacher_explanation')::boolean,false) and coalesce((c->>'learner_experience')::boolean,false) and coalesce((c->>'teacher_check')::boolean,false) and coalesce((c->>'assessment')::boolean,false) and coalesce((c->>'expected_learner_evidence')::boolean,false))) then failures:=failures||jsonb_build_array('curriculum_outcome_instructional_chain_incomplete'); end if;
 if lower(coalesce(p_subject,''))='chemistry' and coalesce((p_artifact->>'has_practical')::boolean,false) and (not (p_artifact ? 'practical_safety') or jsonb_array_length(coalesce(p_artifact->'practical_safety','[]'::jsonb))=0) then failures:=failures||jsonb_build_array('unsafe_practical:missing_safety_controls'); end if;
 if not (p_artifact ? 'citations') or jsonb_array_length(coalesce(p_artifact->'citations','[]'::jsonb))=0 then failures:=failures||jsonb_build_array('evidence_provenance_missing'); end if;
 if coalesce(p_artifact->'blockers','[]'::jsonb)<>'[]'::jsonb then failures:=failures||coalesce(p_artifact->'blockers','[]'::jsonb); end if;
 return jsonb_build_object('passed',jsonb_array_length(failures)=0,'critical_failures',failures,'warnings',warnings,'contract_version',1);
end $$;
revoke all on function public.content_worker_preflight(jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.content_worker_preflight(jsonb,jsonb,text) to service_role;

-- Bind the existing canary worker to the professional baseline without granting new authority.
update public.hq_workforce_workers
set title='Senior Educational Content Developer — Content Factory',
    mission='Produce evidence-grounded, curriculum-traceable, classroom-ready governed content candidates through deliberate planning, deterministic preflight, structured self-review and bounded escalation. Never self-publish or invent authority.',
    competencies=jsonb_build_array('curriculum interpretation','source-grounded authoring','pedagogical planning','assessment design','teacher usability','self-review','bounded repair','Chemistry subject profile'),
    approval_boundaries=jsonb_build_array('no_auto_publish','no_self_approval','no_authority_change','no_unverified_external_fact','no_hidden_uncertainty','no_unsafe_practical','no_spend_without_budget'),
    kpis=coalesce(kpis,'{}'::jsonb)||jsonb_build_object('primary_metric','trustworthy_classroom_ready_candidate_production','professional_profile','senior-educational-content-developer@1','subject_profile','chemistry-grade10-author@1','quality_contract','teacher-guide-quality-contract@1','evaluation_suite','chemistry-content-worker-evaluation@1','max_self_repair_cycles',1),
    updated_at=now()
where worker_key='content-factory-r2-canary-01';

-- No activation, publication authority, autonomy increase, or capability grant is performed here.
commit;
