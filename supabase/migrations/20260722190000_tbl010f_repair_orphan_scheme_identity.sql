-- ============================================================================
-- TBL-010F
-- Repair one known orphan Scheme of Work identity row.
-- Abort if any live assumption has changed.
-- ============================================================================

DO $$
DECLARE
    v_target_id constant uuid :=
        'ed83edb5-3323-4c3a-8179-08add352974d';

    v_expected_teacher_id constant uuid :=
        'c49bf987-357f-46bc-98fb-9a326882e437';

    v_expected_class_id constant uuid :=
        '8a8f97c2-adf0-44a7-8b9f-7f3cec9fd612';

    v_expected_school_id constant uuid :=
        'c51ec2ae-5b70-4f69-887d-54eb9f312db7';

    v_expected_subject_id constant uuid :=
        '3f280c11-d2e7-48c3-9eba-d0c56e073c51';

    v_row_count integer;
    v_assignment_count integer;
BEGIN
    --------------------------------------------------------------------------
    -- Blank/replay safety: this is a targeted production-data repair. A clean
    -- database legitimately has no target row, so there is nothing to repair.
    --------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM public.scheme_of_work WHERE id = v_target_id
    ) THEN
        RAISE NOTICE 'tbl010f: target row absent; no repair required';
        RETURN;
    END IF;

    --------------------------------------------------------------------------
    -- Idempotency:
    -- If the exact repair is already present, exit successfully.
    --------------------------------------------------------------------------
    IF EXISTS (
        SELECT 1
        FROM public.scheme_of_work
        WHERE id = v_target_id
          AND teacher_id = v_expected_teacher_id
          AND class_id = v_expected_class_id
          AND school_id = v_expected_school_id
          AND subject_id = v_expected_subject_id
    ) THEN
        RAISE NOTICE 'tbl010f: target row already repaired';
        RETURN;
    END IF;

    --------------------------------------------------------------------------
    -- Target must still exist exactly once in the expected orphan state.
    --------------------------------------------------------------------------
    SELECT count(*)
    INTO v_row_count
    FROM public.scheme_of_work
    WHERE id = v_target_id
      AND teacher_id = v_expected_teacher_id
      AND class_id = v_expected_class_id
      AND school_id IS NULL
      AND subject_id IS NULL
      AND grade = 'Grade 1'
      AND subject = 'English'
      AND term = 2
      AND week = 12
      AND topic = 'Placeholder - awaiting KICD week 12 content'
      AND status = 'planned'
      AND source = 'curriculum';

    IF v_row_count <> 1 THEN
        RAISE EXCEPTION
            'tbl010f_abort: target row does not match expected orphan state';
    END IF;

    --------------------------------------------------------------------------
    -- Class must still belong to the expected school.
    --------------------------------------------------------------------------
    SELECT count(*)
    INTO v_row_count
    FROM public.classes
    WHERE id = v_expected_class_id
      AND school_id = v_expected_school_id;

    IF v_row_count <> 1 THEN
        RAISE EXCEPTION
            'tbl010f_abort: class does not belong to expected school';
    END IF;

    --------------------------------------------------------------------------
    -- Subject must still be the expected school-scoped English subject.
    --------------------------------------------------------------------------
    SELECT count(*)
    INTO v_row_count
    FROM public.subjects
    WHERE id = v_expected_subject_id
      AND school_id = v_expected_school_id
      AND name = 'English'
      AND global_subject_id IS NOT NULL;

    IF v_row_count <> 1 THEN
        RAISE EXCEPTION
            'tbl010f_abort: expected English school subject is invalid';
    END IF;

    --------------------------------------------------------------------------
    -- Teacher/class must have exactly one matching English assignment.
    --------------------------------------------------------------------------
    SELECT count(*)
    INTO v_assignment_count
    FROM public.teacher_classes tc
    JOIN public.subjects s
      ON s.id = tc.subject_id
    WHERE tc.teacher_id = v_expected_teacher_id
      AND tc.class_id = v_expected_class_id
      AND tc.subject_id = v_expected_subject_id
      AND s.school_id = v_expected_school_id
      AND s.name = 'English';

    IF v_assignment_count <> 1 THEN
        RAISE EXCEPTION
            'tbl010f_abort: expected teacher/class English assignment count is %, expected 1',
            v_assignment_count;
    END IF;

    --------------------------------------------------------------------------
    -- Repair exactly one row.
    --------------------------------------------------------------------------
    UPDATE public.scheme_of_work
    SET
        school_id = v_expected_school_id,
        subject_id = v_expected_subject_id,
        updated_at = now()
    WHERE id = v_target_id
      AND teacher_id = v_expected_teacher_id
      AND class_id = v_expected_class_id
      AND school_id IS NULL
      AND subject_id IS NULL;

    GET DIAGNOSTICS v_row_count = ROW_COUNT;

    IF v_row_count <> 1 THEN
        RAISE EXCEPTION
            'tbl010f_abort: update affected % rows, expected 1',
            v_row_count;
    END IF;

    --------------------------------------------------------------------------
    -- Post-update proof.
    --------------------------------------------------------------------------
    SELECT count(*)
    INTO v_row_count
    FROM public.scheme_of_work
    WHERE id = v_target_id
      AND teacher_id = v_expected_teacher_id
      AND class_id = v_expected_class_id
      AND school_id = v_expected_school_id
      AND subject_id = v_expected_subject_id;

    IF v_row_count <> 1 THEN
        RAISE EXCEPTION
            'tbl010f_abort: repaired identity verification failed';
    END IF;
END;
$$;

-- Final targeted proof: this known row must no longer be orphaned.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.scheme_of_work
        WHERE id = 'ed83edb5-3323-4c3a-8179-08add352974d'
          AND (
              school_id IS NULL
              OR subject_id IS NULL
          )
    ) THEN
        RAISE EXCEPTION
            'tbl010f_abort: target scheme row remains orphaned';
    END IF;
END;
$$;
