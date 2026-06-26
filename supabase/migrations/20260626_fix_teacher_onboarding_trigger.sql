-- ─────────────────────────────────────────────
-- Fix: Teacher onboarding trigger
-- Runs on every new profile insert with role = 'teacher'
-- Creates: teacher_profiles, school_members, academic_terms
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_teacher_onboarding()
RETURNS trigger AS $$
DECLARE
  v_school_id uuid;
  v_term      int;
  v_year      int;
  v_start     date;
  v_end       date;
  v_name      text;
BEGIN
  -- Only run for teachers
  IF NEW.role != 'teacher' THEN
    RETURN NEW;
  END IF;

  v_school_id := NEW.school_id;

  -- 1. Create teacher_profiles row if missing
  INSERT INTO public.teacher_profiles (profile_id, school_id)
  VALUES (NEW.id, v_school_id)
  ON CONFLICT (profile_id) DO NOTHING;

  -- 2. Insert into school_members if missing
  IF v_school_id IS NOT NULL THEN
    INSERT INTO public.school_members (profile_id, school_id, role)
    VALUES (NEW.id, v_school_id, 'teacher')
    ON CONFLICT (profile_id, school_id) DO NOTHING;
  END IF;

  -- 3. Auto-create active academic term for school if none exists
  IF v_school_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.academic_terms
      WHERE school_id = v_school_id AND status = 'active'
    ) THEN
      -- Kenya academic calendar logic
      v_year := EXTRACT(YEAR FROM now())::int;

      IF EXTRACT(MONTH FROM now()) BETWEEN 1 AND 4 THEN
        v_term  := 1;
        v_name  := 'Term 1 ' || v_year;
        v_start := make_date(v_year, 1, 6);
        v_end   := make_date(v_year, 4, 4);
      ELSIF EXTRACT(MONTH FROM now()) BETWEEN 5 AND 8 THEN
        v_term  := 2;
        v_name  := 'Term 2 ' || v_year;
        v_start := make_date(v_year, 5, 5);
        v_end   := make_date(v_year, 8, 8);
      ELSE
        v_term  := 3;
        v_name  := 'Term 3 ' || v_year;
        v_start := make_date(v_year, 9, 1);
        v_end   := make_date(v_year, 11, 28);
      END IF;

      INSERT INTO public.academic_terms
        (school_id, name, term, academic_year, start_date, end_date, status)
      VALUES
        (v_school_id, v_name, v_term, v_year, v_start, v_end, 'active')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger if exists then recreate
DROP TRIGGER IF EXISTS on_teacher_profile_created ON public.profiles;

CREATE TRIGGER on_teacher_profile_created
  AFTER INSERT OR UPDATE OF school_id, role
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_teacher_onboarding();
