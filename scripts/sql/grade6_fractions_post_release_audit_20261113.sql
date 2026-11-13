-- Read-only independent production check after one-time release. No writes.
select r.canonical_key,r.grade,r.subject,r.asset_kind,r.status as resource_status,
       r.visibility,r.sub_strand_id,r.curriculum_outcome_id,
       v.id as resource_version_id,v.version,v.lifecycle_status,
       v.rights_status,v.certified_at,
       v.content_sha256=encode(extensions.digest(convert_to(v.payload::text,'UTF8'),'sha256'),'hex') as hash_matches,
       jsonb_array_length(v.payload->'questions') as explained_question_count,
       jsonb_array_length(v.payload->'quick_check_mcqs') as quiz_count,
       v.payload->'sections'->0->'tools'->0->>'id' as interactive_tool
from public.learning_resources r join public.learning_resource_versions v on v.resource_id=r.id
where r.canonical_key='vs:g6:mathematics:fractions:addition:learner:lesson:01';
select count(*) as public_reader_visible_lessons
from public.vs_public_grade6_fractions_addition_learner_lesson();
