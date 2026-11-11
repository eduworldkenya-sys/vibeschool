-- Read-only verification of Grade 4 Mathematics Time release.
-- Expected: all counts = 10 except question_count=72 and invalid_hash_count=0.
select
  count(*) as total_versions,
  count(*) filter (where v.lifecycle_status='certified' and v.certified_at is not null) as certified_versions,
  count(*) filter (where r.status='active' and r.visibility='public') as active_public_resources,
  count(*) filter (where r.sub_strand_id='e975dcc6-32a9-4274-a2a3-3d19e409cf5c') as canonical_time_bindings,
  coalesce(sum(jsonb_array_length(v.payload->'questions')),0) as question_count,
  count(*) filter (where v.content_sha256<>encode(extensions.digest(convert_to(v.payload::text,'UTF8'),'sha256'),'hex')) as invalid_hash_count
from public.learning_resources r join public.learning_resource_versions v on v.resource_id=r.id
where r.canonical_key like 'vs:g4:mathematics:time:learner:lesson:%';

-- Run this SELECT separately with role anon to prove the real read boundary:
select count(*) as anonymous_reader_lessons, min(lesson_order) first_lesson, max(lesson_order) last_lesson
from public.vs_public_grade4_math_time_learner_lessons();
