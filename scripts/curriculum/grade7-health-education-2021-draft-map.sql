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
-- No curriculum_imports entry: its created_by column requires a real authenticated author.
-- Provenance remains attached to each hierarchy row and version-controlled here.
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
