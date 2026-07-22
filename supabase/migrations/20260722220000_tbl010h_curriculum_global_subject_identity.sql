-- ============================================================================
-- TBL-010H
-- Link curriculum rows to the canonical subject row in public.subjects.
--
-- Subject architecture:
--   school subject: subjects.id with global_subject_id -> canonical subjects.id
--   canonical subject: subjects.id with global_subject_id IS NULL
-- ============================================================================

BEGIN;

ALTER TABLE public.curriculum
    ADD COLUMN IF NOT EXISTS global_subject_id uuid;

-- Preflight: every curriculum subject name must resolve to exactly one
-- canonical subject row before any data is changed.
DO $$
DECLARE
    v_unresolved bigint;
BEGIN
    SELECT count(*)
    INTO v_unresolved
    FROM (
        SELECT c.id
        FROM public.curriculum c
        LEFT JOIN public.subjects s
          ON lower(trim(s.name)) = lower(trim(c.subject))
         AND s.global_subject_id IS NULL
        GROUP BY c.id
        HAVING count(DISTINCT s.id) <> 1
    ) unresolved;

    IF v_unresolved <> 0 THEN
        RAISE EXCEPTION
            'tbl010h_abort: % curriculum row(s) do not resolve to exactly one canonical subject',
            v_unresolved;
    END IF;
END;
$$;

-- Backfill immutable canonical subject identity.
UPDATE public.curriculum c
SET global_subject_id = s.id
FROM public.subjects s
WHERE c.global_subject_id IS NULL
  AND s.global_subject_id IS NULL
  AND lower(trim(s.name)) = lower(trim(c.subject));

-- Post-backfill data guard.
DO $$
DECLARE
    v_missing bigint;
BEGIN
    SELECT count(*)
    INTO v_missing
    FROM public.curriculum
    WHERE global_subject_id IS NULL;

    IF v_missing <> 0 THEN
        RAISE EXCEPTION
            'tbl010h_abort: % curriculum row(s) remain without global_subject_id',
            v_missing;
    END IF;
END;
$$;

ALTER TABLE public.curriculum
    ALTER COLUMN global_subject_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'curriculum_global_subject_id_fkey'
          AND conrelid = 'public.curriculum'::regclass
    ) THEN
        ALTER TABLE public.curriculum
            ADD CONSTRAINT curriculum_global_subject_id_fkey
            FOREIGN KEY (global_subject_id)
            REFERENCES public.subjects(id)
            ON UPDATE CASCADE
            ON DELETE RESTRICT;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS curriculum_global_subject_lookup_idx
    ON public.curriculum(global_subject_id, grade, term);

-- Final structural checks.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'curriculum'
          AND column_name = 'global_subject_id'
          AND is_nullable = 'YES'
    ) THEN
        RAISE EXCEPTION
            'tbl010h_abort: curriculum.global_subject_id remains nullable';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.curriculum c
        JOIN public.subjects s
          ON s.id = c.global_subject_id
        WHERE s.global_subject_id IS NOT NULL
    ) THEN
        RAISE EXCEPTION
            'tbl010h_abort: curriculum links to non-canonical school subject rows';
    END IF;
END;
$$;

COMMIT;

-- Verification output
SELECT
    count(*) AS total_curriculum_rows,
    count(*) FILTER (
        WHERE global_subject_id IS NULL
    ) AS missing_global_subject_ids
FROM public.curriculum;

SELECT
    c.subject,
    c.global_subject_id,
    s.name AS canonical_subject_name
FROM public.curriculum c
JOIN public.subjects s
  ON s.id = c.global_subject_id
GROUP BY c.subject, c.global_subject_id, s.name
ORDER BY c.subject;
