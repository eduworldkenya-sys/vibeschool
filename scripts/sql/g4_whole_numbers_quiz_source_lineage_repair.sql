-- Bounded, idempotent repair for the EXISTING Mumbi2 Whole Numbers assessment.
-- Fixes source-block lineage only; neither creates/approves assessments nor
-- activates curriculum, resources, publishing identities or publications.
-- Do not run against another chapter, another assessment or a published book.
BEGIN;
DO $repair$
DECLARE
  v_publication constant uuid := '6fc551d7-c9ae-4402-ac52-3d0a46461e87';
  v_chapter constant uuid := 'b23413c2-f7ae-44c2-9f5e-98f3cdeeeb8a';
  v_blueprint_title constant text := 'Whole Numbers — Grade 4 Mathematics (v3 moderation)';
  v_assessment uuid;
  v_count integer := 0;
  v_actual integer := 0;
  rec record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.vibe_publications
    WHERE id=v_publication AND author_id='c49bf987-357f-46bc-98fb-9a326882e437'
      AND format='vibetextbook' AND status='draft'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.vibe_chapters
    WHERE id=v_chapter AND publication_id=v_publication AND status='draft'
  ) THEN RAISE EXCEPTION 'G4_WN_DRAFT_OWNER_AND_CHAPTER_REQUIRED'; END IF;

  SELECT ga.id INTO v_assessment
  FROM public.generated_assessments ga
  JOIN public.content_assessment_blueprints bp ON bp.id=ga.blueprint_id
  WHERE bp.title=v_blueprint_title AND ga.status='moderation'
    AND ga.total_marks=16 AND ga.version=1;

  IF v_assessment IS NULL OR (
    SELECT count(*) FROM public.generated_assessments ga
    JOIN public.content_assessment_blueprints bp ON bp.id=ga.blueprint_id
    WHERE bp.title=v_blueprint_title
  ) <> 1 THEN
    RAISE EXCEPTION 'G4_WN_EXACT_ASSESSMENT_IDENTITY_REQUIRED';
  END IF;

  IF (SELECT count(*) FROM public.generated_assessment_items
      WHERE assessment_id=v_assessment) <> 11 OR
     (SELECT sum(marks) FROM public.generated_assessment_items
      WHERE assessment_id=v_assessment) <> 16 THEN
    RAISE EXCEPTION 'G4_WN_EXACT_11_ITEM_16_MARK_SCOPE_REQUIRED';
  END IF;

  FOR rec IN
    SELECT i.id item_id, i.sequence, i.outcome_id, i.source_block_id previous_block,
           i.source_resource_id, o.outcome_code, b.id matching_block,
           b.status block_status, b.is_teacher_only, b.publication_id block_publication
    FROM public.generated_assessment_items i
    JOIN public.curriculum_learning_outcomes o ON o.id=i.outcome_id
    LEFT JOIN public.content_blocks b
      ON b.chapter_id=v_chapter
     AND b.legacy_block_id=CASE
       WHEN i.sequence=11 THEN 'wn-v3-WN-intro-p'
       ELSE 'wn-v3-WN-'||lpad(i.sequence::text,2,'0')||'-p'
     END
    WHERE i.assessment_id=v_assessment
    ORDER BY i.sequence
  LOOP
    v_count:=v_count+1;
    IF rec.sequence<1 OR rec.sequence>11 OR
       rec.outcome_code <> 'G4-MATH-1.1-'||chr(96+rec.sequence) OR
       rec.matching_block IS NULL OR rec.block_status<>'draft' OR
       rec.is_teacher_only IS DISTINCT FROM false OR
       rec.block_publication IS DISTINCT FROM v_publication OR
       (rec.previous_block IS NOT NULL AND rec.previous_block<>rec.matching_block)
    THEN RAISE EXCEPTION 'G4_WN_ITEM_OUTCOME_BLOCK_MISMATCH: %',rec.sequence; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.chapter_learning_outcome_links l
      WHERE l.chapter_id=v_chapter AND l.publication_id=v_publication AND l.outcome_id=rec.outcome_id
    ) THEN RAISE EXCEPTION 'G4_WN_CHAPTER_OUTCOME_NOT_LINKED: %',rec.sequence; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.learning_resources r
      JOIN public.content_assessment_sources cas ON cas.resource_id=r.id
      JOIN public.generated_assessments ga ON ga.blueprint_id=cas.blueprint_id
      WHERE ga.id=v_assessment AND r.id=rec.source_resource_id
        AND r.chapter_id=v_chapter AND r.publication_id=v_publication
        AND (cas.outcome_id IS NULL OR cas.outcome_id=rec.outcome_id)
    ) THEN RAISE EXCEPTION 'G4_WN_UNAUTHORIZED_ITEM_SOURCE: %',rec.sequence; END IF;

    INSERT INTO public.content_block_outcome_links
      (id,publication_id,chapter_id,content_block_id,outcome_id,relationship,created_by)
    VALUES (gen_random_uuid(),v_publication,v_chapter,rec.matching_block,rec.outcome_id,'explains',NULL)
    ON CONFLICT (content_block_id,outcome_id) DO NOTHING;

    UPDATE public.generated_assessment_items
       SET source_block_id=rec.matching_block
     WHERE id=rec.item_id AND assessment_id=v_assessment
       AND source_block_id IS DISTINCT FROM rec.matching_block;
  END LOOP;
  IF v_count<>11 THEN RAISE EXCEPTION 'G4_WN_ITEM_COUNT_CHANGED'; END IF;

  SELECT count(*) INTO v_actual
  FROM public.generated_assessment_items i
  JOIN public.content_block_outcome_links l
    ON l.content_block_id=i.source_block_id AND l.outcome_id=i.outcome_id
   AND l.publication_id=v_publication AND l.chapter_id=v_chapter
  WHERE i.assessment_id=v_assessment;
  IF v_actual<>11 THEN RAISE EXCEPTION 'G4_WN_LINEAGE_NOT_COMPLETE'; END IF;
END $repair$;
COMMIT;
