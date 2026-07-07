-- ─────────────────────────────────────────────
-- Feature: Teacher Active Weeks (Week dropdown history)
-- Returns only weeks where the teacher has real recorded
-- activity (attendance / lesson_plans / homework), joined
-- against term_weeks date ranges. Prefers a school-specific
-- term_weeks override over the national default row when
-- both exist for the same term_id + week_number.
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_teacher_active_weeks(
  p_school_id  uuid,
  p_teacher_id uuid
)
RETURNS TABLE(
  term_id       uuid,
  term_number   int,
  academic_year int,
  week_number   int,
  start_date    date,
  end_date      date,
  week_type     text,
  label         text
) AS $$
  SELECT term_id, term_number, academic_year, week_number, start_date, end_date, week_type, label
  FROM (
    SELECT DISTINCT ON (tw.term_id, tw.week_number)
      tw.term_id,
      at.term AS term_number,
      at.academic_year,
      tw.week_number,
      tw.start_date,
      tw.end_date,
      tw.week_type,
      tw.label
    FROM public.term_weeks tw
    JOIN public.academic_terms at ON at.id = tw.term_id
    WHERE at.school_id = p_school_id
      AND (tw.school_id = p_school_id OR tw.school_id IS NULL)
      AND (
        EXISTS (
          SELECT 1 FROM public.attendance a
          WHERE a.school_id = p_school_id
            AND a.teacher_id = p_teacher_id
            AND a.date BETWEEN tw.start_date AND tw.end_date
        )
        OR EXISTS (
          SELECT 1 FROM public.lesson_plans lp
          WHERE lp.school_id = p_school_id
            AND lp.teacher_id = p_teacher_id
            AND lp.week_start BETWEEN tw.start_date AND tw.end_date
        )
        OR EXISTS (
          SELECT 1 FROM public.homework hw
          WHERE hw.school_id = p_school_id
            AND hw.teacher_id = p_teacher_id
            AND hw.created_at::date BETWEEN tw.start_date AND tw.end_date
        )
      )
    ORDER BY tw.term_id, tw.week_number, (tw.school_id IS NULL)
  ) deduped
  ORDER BY academic_year, term_number, week_number;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_teacher_active_weeks(uuid, uuid) TO authenticated;
