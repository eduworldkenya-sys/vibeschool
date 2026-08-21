begin;

-- PostgreSQL 15 compatibility repair for Priority 1 teacher-guide self review.
-- Keeps the quality contract identical while avoiding jsonb_object_length.

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

 if jsonb_typeof(coalesce(p_body->'answer_guidance','{}'::jsonb))='object' then
   select count(*)::int into answer_n
   from jsonb_object_keys(coalesce(p_body->'answer_guidance','{}'::jsonb));
 end if;
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

commit;
