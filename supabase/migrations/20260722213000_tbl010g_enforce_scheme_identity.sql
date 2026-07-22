-- ============================================================================
-- TBL-010G
-- Prevent future Scheme of Work rows without school and subject identity.
-- ============================================================================

DO $$
DECLARE
    v_orphan_count bigint;
BEGIN
    SELECT count(*)
    INTO v_orphan_count
    FROM public.scheme_of_work
    WHERE school_id IS NULL
       OR subject_id IS NULL;

    IF v_orphan_count <> 0 THEN
        RAISE EXCEPTION
            'tbl010g_abort: scheme_of_work still contains % rows with missing school_id or subject_id',
            v_orphan_count;
    END IF;
END;
$$;

ALTER TABLE public.scheme_of_work
    ALTER COLUMN school_id SET NOT NULL,
    ALTER COLUMN subject_id SET NOT NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'scheme_of_work'
          AND column_name IN ('school_id', 'subject_id')
          AND is_nullable = 'YES'
    ) THEN
        RAISE EXCEPTION
            'tbl010g_abort: scheme identity columns remain nullable';
    END IF;
END;
$$;
