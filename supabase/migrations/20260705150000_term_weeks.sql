-- ─────────────────────────────────────────────
-- Feature: Term Weeks (exam/sports/holiday week types)
-- national defaults (school_id IS NULL) can be overridden per-school
-- Auto-seeds 'normal' weeks whenever a new academic_terms row is created
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.term_weeks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  term_id       uuid NOT NULL REFERENCES public.academic_terms(id) ON DELETE CASCADE,
  week_number   int NOT NULL,
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  week_type     text NOT NULL DEFAULT 'normal'
                CHECK (week_type IN ('normal','exam','midterm_break','sports','holiday')),
  label         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS term_weeks_national_unique
  ON public.term_weeks (term_id, week_number)
  WHERE school_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS term_weeks_school_unique
  ON public.term_weeks (term_id, week_number, school_id)
  WHERE school_id IS NOT NULL;

ALTER TABLE public.term_weeks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS term_weeks_select ON public.term_weeks;
CREATE POLICY term_weeks_select ON public.term_weeks
  FOR SELECT
  USING (
    school_id IS NULL
    OR school_id IN (SELECT school_id FROM public.school_members WHERE profile_id = auth.uid())
  );

DROP POLICY IF EXISTS term_weeks_write ON public.term_weeks;
CREATE POLICY term_weeks_write ON public.term_weeks
  FOR ALL
  USING (
    school_id IN (
      SELECT school_id FROM public.school_members
      WHERE profile_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM public.school_members
      WHERE profile_id = auth.uid() AND role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION public.generate_term_weeks(p_term_id uuid)
RETURNS void AS $$
DECLARE
  v_start   date;
  v_end     date;
  v_week    int := 1;
  v_cursor  date;
BEGIN
  SELECT start_date, end_date INTO v_start, v_end
  FROM public.academic_terms
  WHERE id = p_term_id;

  IF v_start IS NULL OR v_end IS NULL THEN
    RETURN;
  END IF;

  v_cursor := v_start;

  WHILE v_cursor <= v_end LOOP
    INSERT INTO public.term_weeks (school_id, term_id, week_number, start_date, end_date, week_type)
    VALUES (NULL, p_term_id, v_week, v_cursor, LEAST(v_cursor + 6, v_end), 'normal')
    ON CONFLICT DO NOTHING;

    v_cursor := v_cursor + 7;
    v_week := v_week + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_academic_term_created()
RETURNS trigger AS $$
BEGIN
  PERFORM public.generate_term_weeks(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_academic_term_created ON public.academic_terms;

CREATE TRIGGER on_academic_term_created
  AFTER INSERT ON public.academic_terms
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_academic_term_created();

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.academic_terms LOOP
    PERFORM public.generate_term_weeks(r.id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.get_week_type(p_school_id uuid, p_term_id uuid, p_week_number int)
RETURNS TABLE(week_type text, label text) AS $$
  SELECT week_type, label FROM public.term_weeks
  WHERE term_id = p_term_id AND week_number = p_week_number AND school_id = p_school_id
  UNION ALL
  SELECT week_type, label FROM public.term_weeks
  WHERE term_id = p_term_id AND week_number = p_week_number AND school_id IS NULL
  LIMIT 1;
$$ LANGUAGE sql STABLE;
