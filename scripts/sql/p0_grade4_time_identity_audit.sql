-- Operator verification of P0 Time identity. No mutation in this read-only part.
-- Run with database owner/service context after applying migration.
select public.vs_curriculum_package_gate('VS-G04-MA-2.6-TIME-20261111') as grade4_time_identity_gate;
select count(*) as canonical_time_outcomes,
       count(*) filter (where source_locator is not null) as outcomes_with_source_locator,
       count(*) filter (where status = 'active') as active_outcomes
from public.curriculum_learning_outcomes
where sub_strand_id='e975dcc6-32a9-4274-a2a3-3d19e409cf5c';
select count(*) as required_source_outcomes from public.vs_curriculum_source_requirements
where package_id='VS-G04-MA-2.6-TIME-20261111';
select count(*) as stable_identity_links from public.vs_curriculum_alias_outcomes
where package_id='VS-G04-MA-2.6-TIME-20261111';
select count(distinct resource_id) as linked_resources, count(*) as lesson_to_outcome_alias_links
from public.vs_curriculum_resource_aliases
where package_id='VS-G04-MA-2.6-TIME-20261111';
select count(*) as certified_reader_lessons
from public.vs_public_grade4_math_time_learner_lessons();

-- The following negative tests must be run in separate explicit transactions
-- by an authorised operator. ROLLBACK means no persistent edits.
--
-- begin;
-- delete from public.vs_curriculum_alias_outcomes
-- where package_id='VS-G04-MA-2.6-TIME-20261111'
--   and manuscript_alias='VS-G04-MA-T-F';
-- select public.vs_curriculum_package_gate('VS-G04-MA-2.6-TIME-20261111');
-- -- EXPECT: BLOCKED_CURRICULUM_RECONCILIATION
-- rollback;
--
-- begin;
-- delete from public.vs_curriculum_resource_aliases
-- where package_id='VS-G04-MA-2.6-TIME-20261111'
--   and manuscript_alias='VS-G04-MA-T-G';
-- select public.vs_curriculum_package_gate('VS-G04-MA-2.6-TIME-20261111');
-- -- EXPECT: BLOCKED_CURRICULUM_RECONCILIATION
-- rollback;
