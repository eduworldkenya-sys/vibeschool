-- RPC: onboard_teacher_class
-- Called from Step 2 of teacher onboarding
-- Order is critical: school_members → teacher_profiles → subjects → classes → teacher_classes

CREATE OR REPLACE FUNCTION public.onboard_teacher_class(
  p_school_id  uuid,
  p_teacher_id uuid,
  p_grade      text,
  p_stream     text,
  p_subject    text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_class_id   uuid;
  v_subject_id uuid;
BEGIN
  -- 1. school_members FIRST — satisfies trg_verify_teacher_role
  INSERT INTO public.school_members (school_id, profile_id, role)
  VALUES (p_school_id, p_teacher_id, 'teacher')
  ON CONFLICT (school_id, profile_id) DO NOTHING;

  -- 2. teacher_profiles SECOND — trg_verify_teacher_role now passes
  INSERT INTO public.teacher_profiles (profile_id, school_id)
  VALUES (p_teacher_id, p_school_id)
  ON CONFLICT (profile_id) DO NOTHING;

  -- 3. subject — find or create
  SELECT id INTO v_subject_id
  FROM public.subjects
  WHERE school_id = p_school_id AND name = p_subject
  LIMIT 1;

  IF v_subject_id IS NULL THEN
    INSERT INTO public.subjects (school_id, name)
    VALUES (p_school_id, p_subject)
    RETURNING id INTO v_subject_id;
  END IF;

  -- 4. class — find or create
  SELECT id INTO v_class_id
  FROM public.classes
  WHERE school_id = p_school_id
    AND name      = p_grade
    AND COALESCE(stream, '') = COALESCE(p_stream, '')
  LIMIT 1;

  IF v_class_id IS NULL THEN
    INSERT INTO public.classes (school_id, teacher_id, name, stream, subject)
    VALUES (p_school_id, p_teacher_id, p_grade, NULLIF(p_stream, ''), p_subject)
    RETURNING id INTO v_class_id;
  END IF;

  -- 5. teacher_classes LAST
  INSERT INTO public.teacher_classes (school_id, teacher_id, class_id, subject_id, is_class_teacher)
  VALUES (p_school_id, p_teacher_id, v_class_id, v_subject_id, true)
  ON CONFLICT DO NOTHING;

  RETURN v_class_id;
END;
$$;
