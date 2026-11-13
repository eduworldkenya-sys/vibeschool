-- Certified-only Grade 6 Mathematics Fractions reader.
-- Follows Grade 4 Time public reader; no candidate/editorial content is exposed.
begin;
create or replace function public.vs_public_grade6_fractions_addition_learner_lesson()
returns table(resource_version_id uuid, resource_id uuid, title text, unit_id text,
              sections jsonb, questions jsonb, quick_check_mcqs jsonb)
language sql stable security definer set search_path = ''
as $reader$
select v.id,r.id,r.title::text,(v.payload->>'unit_id')::text,
       v.payload->'sections',v.payload->'questions',v.payload->'quick_check_mcqs'
from public.learning_resources r
join public.learning_resource_versions v on v.resource_id=r.id
join public.cbc_strands s on s.id=r.sub_strand_id
join public.grade6_mathematics_reader_bindings b on b.sub_strand_id=s.id and b.status='active'
join public.curriculum_learning_outcomes o on o.id=r.curriculum_outcome_id
where r.canonical_key='vs:g6:mathematics:fractions:addition:learner:lesson:01'
  and r.source_type='platform_authored' and r.owner_type='platform'
  and r.status='active' and r.visibility='public'
  and r.grade='Grade 6' and r.subject='Mathematics'
  and r.asset_kind='learner_notes' and r.purpose='teach'
  and r.sub_strand_id='d8f452e0-3270-4389-ad86-646af8f26f6d'::uuid
  and r.curriculum_outcome_id='65cc88b5-0767-4c09-965c-0ce562f3fdae'::uuid
  and s.grade='Grade 6' and s.name='Numbers' and s.sub_strand='Fractions'
  and b.source_ref='VS-CUR-G06-MA-2026#1.4'
  and o.status='active' and o.sub_strand_id=s.id and o.outcome_code='VS-G6-MA-1.4-1'
  and v.version=1 and v.lifecycle_status='certified'
  and v.certified_at is not null and v.rights_status='cleared'
  and v.payload_format='json'
  and v.payload->>'schema'='vibeschool.originals.lesson-content.v1'
  and v.payload->>'package_id'='VS-G06-MA-1.4-FRACTIONS-ADD-20261113'
  and v.payload->>'source_edition'='learner'
  and v.payload->>'unit_id'='1.4'
  and jsonb_typeof(v.payload->'sections')='array'
  and jsonb_array_length(v.payload->'sections')=6
  and jsonb_typeof(v.payload->'questions')='array'
  and jsonb_array_length(v.payload->'questions')=63
  and jsonb_typeof(v.payload->'quick_check_mcqs')='array'
  and jsonb_array_length(v.payload->'quick_check_mcqs')=5
  and v.content_sha256=encode(extensions.digest(convert_to(v.payload::text,'UTF8'),'sha256'),'hex')
  and public.fn_learning_resource_visible(r.id)
limit 1;
$reader$;
revoke all on function public.vs_public_grade6_fractions_addition_learner_lesson()
  from public,anon,authenticated,service_role;
grant execute on function public.vs_public_grade6_fractions_addition_learner_lesson()
  to anon,authenticated;
comment on function public.vs_public_grade6_fractions_addition_learner_lesson() is
  'Only certified Grade 6 fractions learner material. No private drafts, teacher-only content or unseen exam bank.';
commit;
