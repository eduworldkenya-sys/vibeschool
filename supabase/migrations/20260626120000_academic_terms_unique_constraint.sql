-- ─────────────────────────────────────────────
-- Add unique constraint on academic_terms
-- Prevents duplicate term rows from concurrent
-- onboarding paths (trigger, admin term page, manual seeds)
-- ─────────────────────────────────────────────

WITH ranked AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY school_id, term, academic_year
      ORDER BY (status = 'active') DESC, ctid
    ) AS rn
  FROM public.academic_terms
)
DELETE FROM public.academic_terms
WHERE ctid IN (SELECT ctid FROM ranked WHERE rn > 1);

ALTER TABLE public.academic_terms
  ADD CONSTRAINT academic_terms_school_term_year_unique
  UNIQUE (school_id, term, academic_year);
