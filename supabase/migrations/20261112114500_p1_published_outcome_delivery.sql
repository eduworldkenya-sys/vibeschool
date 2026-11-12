-- P1: one published Grade 4 Time outcome through the existing canonical reader.
-- Source identities: P0 vs_curriculum_* ledgers; versions: learning_resource_versions.
-- No timetable, school, class or learner assignment in the read contract.
-- No question-bank write, marking, exam answer exposure or mastery side effect.
-- authorization-test: scripts/test-p1-outcome-delivery.mjs
begin;

create or replace function public.vs_published_grade4_time_outcome(p_outcome_id uuid)
returns table(
  outcome_id uuid, outcome_code text, outcome_text text, source_locator text,
  resource_id uuid, resource_version_id uuid, lesson_order integer,
  title text, body text
)
language sql stable security definer set search_path = ''
as $delivery$
  select
    o.id, o.outcome_code::text, o.outcome_text::text, o.source_locator::text,
    v.resource_id, released.resource_version_id, released.lesson_order,
    released.title, released.body
  from public.vs_public_grade4_math_time_learner_lessons() released
  join public.learning_resource_versions v on v.id = released.resource_version_id
  join public.vs_curriculum_resource_aliases ra on ra.resource_id = v.resource_id
    and ra.package_id = 'VS-G04-MA-2.6-TIME-20261111'
  join public.vs_curriculum_alias_outcomes ao
    on ao.package_id = ra.package_id and ao.manuscript_alias = ra.manuscript_alias
  join public.curriculum_learning_outcomes o on o.id = ao.outcome_id
  where o.id = p_outcome_id
    and o.status = 'active'
    and o.sub_strand_id = 'e975dcc6-32a9-4274-a2a3-3d19e409cf5c'::uuid
    and (public.vs_curriculum_package_gate('VS-G04-MA-2.6-TIME-20261111')->>'state') = 'PASS'
  order by released.lesson_order, released.resource_version_id
  limit 10;
$delivery$;
revoke all on function public.vs_published_grade4_time_outcome(uuid) from public, anon, authenticated;
grant execute on function public.vs_published_grade4_time_outcome(uuid) to anon, authenticated;
comment on function public.vs_published_grade4_time_outcome(uuid) is
  'P1 certified and visible Time lessons for one exact reconciled stable outcome ID. Reuses the public learner reader; no enrolment or timetable required.';

-- These questions were deliberately released as learner-visible formative
-- questions within the certified originals. They are not protected exam variants.
-- Answers/explanations are shown only after the learner chooses Reveal in UI.
-- Do not record a score or infer competence from a reveal.
create or replace function public.vs_published_grade4_time_practice(p_outcome_id uuid)
returns table(
  outcome_id uuid, resource_version_id uuid, lesson_order integer,
  question_id text, question_kind text, prompt text, answer text, explanation text
)
language sql stable security definer set search_path = ''
as $practice$
  select
    released.outcome_id, released.resource_version_id, released.lesson_order,
    q.item->>'id', q.item->>'kind', q.item->>'prompt',
    q.item->>'answer', q.item->>'explanation'
  from public.vs_published_grade4_time_outcome(p_outcome_id) released
  join public.learning_resource_versions v on v.id = released.resource_version_id
    and v.resource_id = released.resource_id
    and v.lifecycle_status = 'certified'
    and v.certified_at is not null
    and v.rights_status in ('cleared', 'not_applicable')
    and v.payload->>'schema' = 'vibeschool.originals.lesson-content.v1'
    and v.payload->>'source_edition' = 'learner'
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(v.payload->'questions')='array'
      then v.payload->'questions' else '[]'::jsonb end
  ) with ordinality as q(item, sequence)
  where q.item->>'kind' in ('guided', 'exercise', 'formative_check')
    and q.item->>'id' ~ '^VS-G04-MA-TIME-L(0[1-9]|10)-(G|E|Q)[0-9]+$'
    and substring(q.item->>'id' from '-L(0[1-9]|10)-')::integer = released.lesson_order
    and nullif(btrim(q.item->>'prompt'), '') is not null
    and nullif(btrim(q.item->>'answer'), '') is not null
    and nullif(btrim(q.item->>'explanation'), '') is not null
    and coalesce(q.item->>'exam_eligibility', 'formative_only') = 'formative_only'
    and coalesce(q.item->>'visibility', 'learner_revealed') <> 'protected'
  order by released.lesson_order, q.sequence
  limit 100;
$practice$;
revoke all on function public.vs_published_grade4_time_practice(uuid) from public, anon, authenticated;
grant execute on function public.vs_published_grade4_time_practice(uuid) to anon, authenticated;
comment on function public.vs_published_grade4_time_practice(uuid) is
  'P1 read-only self-check from released formative questions; revealed answers cannot constitute exam marks or learner mastery.';

-- Public execution rights are limited to the two allowlisted reader responses.
-- The underlying alias, outcome, manifest and version tables retain their existing
-- owner-only/write and RLS boundaries.

-- Catalogue only outcomes with at least one currently released, eligible unit.
create or replace function public.vs_published_grade4_time_outcomes()
returns table(outcome_id uuid, outcome_code text, outcome_text text, source_locator text, lesson_count bigint)
language sql stable security definer set search_path = ''
as $catalogue$
  select o.id, o.outcome_code::text, o.outcome_text::text,
    o.source_locator::text, count(distinct released.resource_version_id)
  from public.vs_public_grade4_math_time_learner_lessons() released
  join public.learning_resource_versions v on v.id = released.resource_version_id
  join public.vs_curriculum_resource_aliases ra
    on ra.resource_id = v.resource_id and ra.package_id = 'VS-G04-MA-2.6-TIME-20261111'
  join public.vs_curriculum_alias_outcomes ao
    on ao.package_id = ra.package_id and ao.manuscript_alias = ra.manuscript_alias
  join public.curriculum_learning_outcomes o on o.id = ao.outcome_id
  where o.status = 'active'
    and o.sub_strand_id = 'e975dcc6-32a9-4274-a2a3-3d19e409cf5c'::uuid
  group by o.id, o.outcome_code, o.outcome_text, o.source_locator
  order by o.outcome_code;
$catalogue$;
revoke all on function public.vs_published_grade4_time_outcomes() from public, anon, authenticated;
grant execute on function public.vs_published_grade4_time_outcomes() to anon, authenticated;
comment on function public.vs_published_grade4_time_outcomes() is
  'Canonical released Time outcomes for public learner and teacher navigation; never claims whole-grade publication.';

commit;
