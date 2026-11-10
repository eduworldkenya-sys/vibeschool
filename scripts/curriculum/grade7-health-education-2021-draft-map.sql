-- Grade 7 Health Education historical 2021 KICD DRAFT hierarchy.
-- Source is a mirror of a KICD-authored DRAFT; current KICD Grade 7 designs
-- DO NOT include Health Education as a standalone subject.
-- NEVER mark this historical source as current or its SLOs as verified.
-- Term grouping in metadata is an editorial proposal; do not write invented weeks.
-- Existing 12 unverified placeholder rows have no FK dependents (checked 2026-11-10).
BEGIN;
DO $preflight$
DECLARE total_count integer; placeholder_count integer; referenced_count integer;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE source_ref IS NULL AND strand_order IS NULL AND coalesce(array_length(learning_outcomes,1),0)=0)
    INTO total_count, placeholder_count FROM public.cbc_strands
    WHERE subject_id='d5e187d6-5c85-4d2e-b6d8-aa45110f8bc3'::uuid AND grade='Grade 7';
  IF NOT ((total_count=12 AND placeholder_count=12) OR
          (total_count=17 AND placeholder_count=0)) THEN
    RAISE EXCEPTION 'Unexpected Grade 7 Health Education state: total %, placeholder %',total_count,placeholder_count;
  END IF;
  IF total_count=12 THEN
    SELECT (SELECT count(*) FROM public.curriculum WHERE sub_strand_id IN (SELECT id FROM public.cbc_strands WHERE subject_id='d5e187d6-5c85-4d2e-b6d8-aa45110f8bc3'::uuid AND grade='Grade 7')) +
           (SELECT count(*) FROM public.scheme_of_work WHERE sub_strand_id IN (SELECT id FROM public.cbc_strands WHERE subject_id='d5e187d6-5c85-4d2e-b6d8-aa45110f8bc3'::uuid AND grade='Grade 7')) +
           (SELECT count(*) FROM public.lesson_plans WHERE strand_id IN (SELECT id FROM public.cbc_strands WHERE subject_id='d5e187d6-5c85-4d2e-b6d8-aa45110f8bc3'::uuid AND grade='Grade 7')) +
           (SELECT count(*) FROM public.curriculum_learning_outcomes WHERE sub_strand_id IN (SELECT id FROM public.cbc_strands WHERE subject_id='d5e187d6-5c85-4d2e-b6d8-aa45110f8bc3'::uuid AND grade='Grade 7')) INTO referenced_count;
    IF referenced_count<>0 THEN RAISE EXCEPTION 'Referenced placeholder rows detected: %',referenced_count; END IF;
  END IF;
END
$preflight$;
INSERT INTO public.curriculum_imports
 (source_type,authority_name,source_url,source_ref,curriculum_name,grade,subject,version_label,status,payload)
SELECT 'official','Kenya Institute of Curriculum Development (KICD)','https://teacher.co.ke/wp-content/uploads/2024/07/GRADE-7-CURRICULUM-DESIGNS-HEALTH-EDUCATION-2024-TEACHER.CO_.KE_.pdf','KICD-authored 2021 DRAFT, mirrored; historical only','CBC','Grade 7','Health Education','2021 DRAFT (historical)','draft',
 '{"provenance":{"publisher":"KICD","version":"2021 DRAFT","classification":"historical_draft_not_current_standalone","mirrored_source_url":"https://teacher.co.ke/wp-content/uploads/2024/07/GRADE-7-CURRICULUM-DESIGNS-HEALTH-EDUCATION-2024-TEACHER.CO_.KE_.pdf","current_kicd_grade7_url":"https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-seven-designs/","review_status":"hierarchy_source_checked; SLOs_and_weekly_scheme_not_verified"},"allocation":{"lessons_per_week_2021_draft":2,"minutes_per_lesson":40},"suggested_term_distribution":"VibeSchool editorial proposal, not prescribed by KICD","community_service_learning_project":"Present in 2021 draft; requires separate project mapping","strand_map":[{"strand":"Health and Nutrition","strandOrder":1,"subStrand":"Introduction to Health Education","subStrandOrder":1,"code":"1.1","suggestedTerm":1},{"strand":"Health and Nutrition","strandOrder":1,"subStrand":"Health Promotion","subStrandOrder":2,"code":"1.2","suggestedTerm":1},{"strand":"Health and Nutrition","strandOrder":1,"subStrand":"Nutrients and Their Functions in the Body","subStrandOrder":3,"code":"1.3","suggestedTerm":1},{"strand":"Human Body Systems","strandOrder":2,"subStrand":"Digestive System","subStrandOrder":1,"code":"2.1","suggestedTerm":1},{"strand":"Human Body Systems","strandOrder":2,"subStrand":"Excretory System","subStrandOrder":2,"code":"2.2","suggestedTerm":1},{"strand":"Human Body Systems","strandOrder":2,"subStrand":"Circulatory System","subStrandOrder":3,"code":"2.3","suggestedTerm":1},{"strand":"Mental and Emotional Health","strandOrder":3,"subStrand":"Mental Health","subStrandOrder":1,"code":"3.1","suggestedTerm":2},{"strand":"Mental and Emotional Health","strandOrder":3,"subStrand":"Mental Health in the Community","subStrandOrder":2,"code":"3.2","suggestedTerm":2},{"strand":"Use of Medicine","strandOrder":4,"subStrand":"Safe Use of Medicine","subStrandOrder":1,"code":"4.1","suggestedTerm":2},{"strand":"First Aid and Basic Life Support","strandOrder":5,"subStrand":"First Aid","subStrandOrder":1,"code":"5.1","suggestedTerm":2},{"strand":"First Aid and Basic Life Support","strandOrder":5,"subStrand":"First Aid for Common Accidents and Injuries","subStrandOrder":2,"code":"5.2","suggestedTerm":2},{"strand":"First Aid and Basic Life Support","strandOrder":5,"subStrand":"Road Safety","subStrandOrder":3,"code":"5.3","suggestedTerm":2},{"strand":"Environmental Health and Sanitation","strandOrder":6,"subStrand":"Environmental Health","subStrandOrder":1,"code":"6.1","suggestedTerm":3},{"strand":"Environmental Health and Sanitation","strandOrder":6,"subStrand":"Environmental Contaminants","subStrandOrder":2,"code":"6.2","suggestedTerm":3},{"strand":"Environmental Health and Sanitation","strandOrder":6,"subStrand":"Infection Prevention and Control","subStrandOrder":3,"code":"6.3","suggestedTerm":3},{"strand":"Human Reproductive Health","strandOrder":7,"subStrand":"Pubertal Growth and Development","subStrandOrder":1,"code":"7.1","suggestedTerm":3},{"strand":"Human Reproductive Health","strandOrder":7,"subStrand":"Reproductive Health","subStrandOrder":2,"code":"7.2","suggestedTerm":3}]}'::jsonb || jsonb_build_object('replaced_unverified_placeholders',
  coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'strand',name,'sub_strand',sub_strand))
    FROM public.cbc_strands WHERE subject_id='d5e187d6-5c85-4d2e-b6d8-aa45110f8bc3'::uuid AND grade='Grade 7' AND source_ref IS NULL),'[]'::jsonb))
WHERE NOT EXISTS (SELECT 1 FROM public.curriculum_imports
  WHERE grade='Grade 7' AND subject='Health Education' AND source_url='https://teacher.co.ke/wp-content/uploads/2024/07/GRADE-7-CURRICULUM-DESIGNS-HEALTH-EDUCATION-2024-TEACHER.CO_.KE_.pdf'
    AND version_label='2021 DRAFT (historical)');
DELETE FROM public.cbc_strands WHERE subject_id='d5e187d6-5c85-4d2e-b6d8-aa45110f8bc3'::uuid AND grade='Grade 7'
 AND source_ref IS NULL AND strand_order IS NULL
 AND coalesce(array_length(learning_outcomes,1),0)=0;
INSERT INTO public.cbc_strands
 (subject_id,grade,name,sub_strand,strand_order,sub_strand_order,source_ref,learning_outcomes,key_inquiry_questions)
 VALUES
  ('d5e187d6-5c85-4d2e-b6d8-aa45110f8bc3', 'Grade 7', 'Health and Nutrition', 'Introduction to Health Education', 1, 1, 'KICD Grade 7 Health Education 2021 DRAFT (historical, not current Grade 7 standalone subject); https://teacher.co.ke/wp-content/uploads/2024/07/GRADE-7-CURRICULUM-DESIGNS-HEALTH-EDUCATION-2024-TEACHER.CO_.KE_.pdf', ARRAY[]::text[], ARRAY[]::text[]),
  ('d5e187d6-5c85-4d2e-b6d8-aa45110f8bc3', 'Grade 7', 'Health and Nutrition', 'Health Promotion', 1, 2, 'KICD Grade 7 Health Education 2021 DRAFT (historical, not current Grade 7 standalone subject); https://teacher.co.ke/wp-content/uploads/2024/07/GRADE-7-CURRICULUM-DESIGNS-HEALTH-EDUCATION-2024-TEACHER.CO_.KE_.pdf', ARRAY[]::text[], ARRAY[]::text[]),
  ('d5e187d6-5c85-4d2e-b6d8-aa45110f8bc3', 'Grade 7', 'Health and Nutrition', 'Nutrients and Their Functions in the Body', 1, 3, 'KICD Grade 7 Health Education 2021 DRAFT (historical, not current Grade 7 standalone subject); https://teacher.co.ke/wp-content/uploads/2024/07/GRADE-7-CURRICULUM-DESIGNS-HEALTH-EDUCATION-2024-TEACHER.CO_.KE_.pdf', ARRAY[]::text[], ARRAY[]::text[]),
  ('d5e187d6-5c85-4d2e-b6d8-aa45110f8bc3', 'Grade 7', 'Human Body Systems', 'Digestive System', 2, 1, 'KICD Grade 7 Health Education 2021 DRAFT (historical, not current Grade 7 standalone subject); https://teacher.co.ke/wp-content/uploads/2024/07/GRADE-7-CURRICULUM-DESIGNS-HEALTH-EDUCATION-2024-TEACHER.CO_.KE_.pdf', ARRAY[]::text[], ARRAY[]::text[]),
  ('d5e187d6-5c85-4d2e-b6d8-aa45110f8bc3', 'Grade 7', 'Human Body Systems', 'Excretory System', 2, 2, 'KICD Grade 7 Health Education 2021 DRAFT (historical, not current Grade 7 standalone subject); https://teacher.co.ke/wp-content/uploads/2024/07/GRADE-7-CURRICULUM-DESIGNS-HEALTH-EDUCATION-2024-TEACHER.CO_.KE_.pdf', ARRAY[]::text[], ARRAY[]::text[]),
  ('d5e187d6-5c85-4d2e-b6d8-aa45110f8bc3', 'Grade 7', 'Human Body Systems', 'Circulatory System', 2, 3, 'KICD Grade 7 Health Education 2021 DRAFT (historical, not current Grade 7 standalone subject); https://teacher.co.ke/wp-content/uploads/2024/07/GRADE-7-CURRICULUM-DESIGNS-HEALTH-EDUCATION-2024-TEACHER.CO_.KE_.pdf', ARRAY[]::text[], ARRAY[]::text[]),
  ('d5e187d6-5c85-4d2e-b6d8-aa45110f8bc3', 'Grade 7', 'Mental and Emotional Health', 'Mental Health', 3, 1, 'KICD Grade 7 Health Education 2021 DRAFT (historical, not current Grade 7 standalone subject); https://teacher.co.ke/wp-content/uploads/2024/07/GRADE-7-CURRICULUM-DESIGNS-HEALTH-EDUCATION-2024-TEACHER.CO_.KE_.pdf', ARRAY[]::text[], ARRAY[]::text[]),
  ('d5e187d6-5c85-4d2e-b6d8-aa45110f8bc3', 'Grade 7', 'Mental and Emotional Health', 'Mental Health in the Community', 3, 2, 'KICD Grade 7 Health Education 2021 DRAFT (historical, not current Grade 7 standalone subject); https://teacher.co.ke/wp-content/uploads/2024/07/GRADE-7-CURRICULUM-DESIGNS-HEALTH-EDUCATION-2024-TEACHER.CO_.KE_.pdf', ARRAY[]::text[], ARRAY[]::text[]),
  ('d5e187d6-5c85-4d2e-b6d8-aa45110f8bc3', 'Grade 7', 'Use of Medicine', 'Safe Use of Medicine', 4, 1, 'KICD Grade 7 Health Education 2021 DRAFT (historical, not current Grade 7 standalone subject); https://teacher.co.ke/wp-content/uploads/2024/07/GRADE-7-CURRICULUM-DESIGNS-HEALTH-EDUCATION-2024-TEACHER.CO_.KE_.pdf', ARRAY[]::text[], ARRAY[]::text[]),
  ('d5e187d6-5c85-4d2e-b6d8-aa45110f8bc3', 'Grade 7', 'First Aid and Basic Life Support', 'First Aid', 5, 1, 'KICD Grade 7 Health Education 2021 DRAFT (historical, not current Grade 7 standalone subject); https://teacher.co.ke/wp-content/uploads/2024/07/GRADE-7-CURRICULUM-DESIGNS-HEALTH-EDUCATION-2024-TEACHER.CO_.KE_.pdf', ARRAY[]::text[], ARRAY[]::text[]),
  ('d5e187d6-5c85-4d2e-b6d8-aa45110f8bc3', 'Grade 7', 'First Aid and Basic Life Support', 'First Aid for Common Accidents and Injuries', 5, 2, 'KICD Grade 7 Health Education 2021 DRAFT (historical, not current Grade 7 standalone subject); https://teacher.co.ke/wp-content/uploads/2024/07/GRADE-7-CURRICULUM-DESIGNS-HEALTH-EDUCATION-2024-TEACHER.CO_.KE_.pdf', ARRAY[]::text[], ARRAY[]::text[]),
  ('d5e187d6-5c85-4d2e-b6d8-aa45110f8bc3', 'Grade 7', 'First Aid and Basic Life Support', 'Road Safety', 5, 3, 'KICD Grade 7 Health Education 2021 DRAFT (historical, not current Grade 7 standalone subject); https://teacher.co.ke/wp-content/uploads/2024/07/GRADE-7-CURRICULUM-DESIGNS-HEALTH-EDUCATION-2024-TEACHER.CO_.KE_.pdf', ARRAY[]::text[], ARRAY[]::text[]),
  ('d5e187d6-5c85-4d2e-b6d8-aa45110f8bc3', 'Grade 7', 'Environmental Health and Sanitation', 'Environmental Health', 6, 1, 'KICD Grade 7 Health Education 2021 DRAFT (historical, not current Grade 7 standalone subject); https://teacher.co.ke/wp-content/uploads/2024/07/GRADE-7-CURRICULUM-DESIGNS-HEALTH-EDUCATION-2024-TEACHER.CO_.KE_.pdf', ARRAY[]::text[], ARRAY[]::text[]),
  ('d5e187d6-5c85-4d2e-b6d8-aa45110f8bc3', 'Grade 7', 'Environmental Health and Sanitation', 'Environmental Contaminants', 6, 2, 'KICD Grade 7 Health Education 2021 DRAFT (historical, not current Grade 7 standalone subject); https://teacher.co.ke/wp-content/uploads/2024/07/GRADE-7-CURRICULUM-DESIGNS-HEALTH-EDUCATION-2024-TEACHER.CO_.KE_.pdf', ARRAY[]::text[], ARRAY[]::text[]),
  ('d5e187d6-5c85-4d2e-b6d8-aa45110f8bc3', 'Grade 7', 'Environmental Health and Sanitation', 'Infection Prevention and Control', 6, 3, 'KICD Grade 7 Health Education 2021 DRAFT (historical, not current Grade 7 standalone subject); https://teacher.co.ke/wp-content/uploads/2024/07/GRADE-7-CURRICULUM-DESIGNS-HEALTH-EDUCATION-2024-TEACHER.CO_.KE_.pdf', ARRAY[]::text[], ARRAY[]::text[]),
  ('d5e187d6-5c85-4d2e-b6d8-aa45110f8bc3', 'Grade 7', 'Human Reproductive Health', 'Pubertal Growth and Development', 7, 1, 'KICD Grade 7 Health Education 2021 DRAFT (historical, not current Grade 7 standalone subject); https://teacher.co.ke/wp-content/uploads/2024/07/GRADE-7-CURRICULUM-DESIGNS-HEALTH-EDUCATION-2024-TEACHER.CO_.KE_.pdf', ARRAY[]::text[], ARRAY[]::text[]),
  ('d5e187d6-5c85-4d2e-b6d8-aa45110f8bc3', 'Grade 7', 'Human Reproductive Health', 'Reproductive Health', 7, 2, 'KICD Grade 7 Health Education 2021 DRAFT (historical, not current Grade 7 standalone subject); https://teacher.co.ke/wp-content/uploads/2024/07/GRADE-7-CURRICULUM-DESIGNS-HEALTH-EDUCATION-2024-TEACHER.CO_.KE_.pdf', ARRAY[]::text[], ARRAY[]::text[])
 ON CONFLICT (subject_id,grade,name,sub_strand) DO NOTHING;
DO $verify$
BEGIN
 IF (SELECT count(*) FROM public.cbc_strands WHERE subject_id='d5e187d6-5c85-4d2e-b6d8-aa45110f8bc3'::uuid AND grade='Grade 7') <> 17
 OR (SELECT count(DISTINCT name) FROM public.cbc_strands WHERE subject_id='d5e187d6-5c85-4d2e-b6d8-aa45110f8bc3'::uuid AND grade='Grade 7') <> 7
 THEN RAISE EXCEPTION 'KICD 2021 draft hierarchy count validation failed'; END IF;
END
$verify$;
COMMIT;
