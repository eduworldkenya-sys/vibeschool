alter table public.curriculum_intelligence_proposals drop constraint if exists curriculum_intelligence_proposals_proposal_type_check;
alter table public.curriculum_intelligence_proposals add constraint curriculum_intelligence_proposals_proposal_type_check check (proposal_type = any (array['curriculum_change','correction','current_update','current_fact_update','enrichment','assessment_update','teacher_guidance','new_content','review_candidate']::text[]));

alter table public.curriculum_intelligence_audit drop constraint if exists curriculum_intelligence_audit_action_check;
alter table public.curriculum_intelligence_audit add constraint curriculum_intelligence_audit_action_check check (action = any (array['created','engine_generated','approved','rejected','applied','superseded','edited']::text[]));
