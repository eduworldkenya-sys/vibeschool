-- Grade 4 CA Painting and Montage: repair existing draft lineage only.
-- Requires the identity-preserving chapter trigger migration to have been applied.
-- Does not approve a guide/assessment, change RLS or publish anything.
-- Safe to rerun only if exact source evidence remains identical.
DO $repair$
DECLARE
  v_pub constant uuid := 'eff38437-a033-4f62-83b4-59f2dfa0c889';
  v_chapter constant uuid := 'b58f778e-c78c-4fd9-b5d3-f88978ea847f';
  v_guide constant uuid := '4c80f3c2-2de5-4bd7-8741-b1158d2ed0f5';
  v_assessment constant uuid := 'dfe28d9f-a380-42ac-b043-675e2278d18f';
  v_resource constant uuid := '120fb919-382d-41ba-a31f-2bd149a7a7d5';
  v_builder_key constant text := 'painting-montage-lesson-10-builder';
  v_builder constant jsonb := '{"id":"painting-montage-lesson-10-builder","type":"interactive","content":"Montage Builder","meta":{"interactiveType":"creative_arts_montage_builder"}}'::jsonb;
  v_blocks jsonb;
  v_new_blocks jsonb;
  v_anchor bigint;
  v_anchors integer;
  v_question_rows integer;
  v_good integer;
  v_changed integer;
  v_guide_sources integer;
  v_guide_matched integer;
  v_existing_builder integer;
BEGIN
  PERFORM 1 FROM public.vibe_publications
    WHERE id=v_pub AND status='draft' AND title='Grade 4 Creative Arts'
      AND author_id='c49bf987-357f-46bc-98fb-9a326882e437'::uuid
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CA_PUBLICATION_DRAFT_CHANGED'; END IF;
  SELECT c.blocks INTO STRICT v_blocks FROM public.vibe_chapters c
    WHERE c.id=v_chapter AND c.publication_id=v_pub AND c.status='draft'
      AND c.title='1.3 Painting and Montage' FOR UPDATE;
  PERFORM 1 FROM public.content_derivatives
    WHERE id=v_guide AND source_publication_id=v_pub
      AND source_chapter_id=v_chapter AND status='draft' AND audience='teacher'
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CA_TEACHER_GUIDE_CHANGED'; END IF;
  PERFORM 1 FROM public.generated_assessments ga WHERE ga.id=v_assessment
    AND ga.status='moderation' AND ga.total_marks=24 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CA_ASSESSMENT_CHANGED'; END IF;
  PERFORM 1 FROM public.learning_resources
    WHERE id=v_resource AND publication_id=v_pub AND chapter_id=v_chapter
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CA_RESOURCE_CHANGED'; END IF;

  -- Match all 15 existing keyed questions to the existing canonical blocks.
  WITH canonical_questions AS (
    SELECT b.id, b.payload->>'content' as content,
      row_number() over(order by b.sequence) as n
    FROM public.content_blocks b
    WHERE b.chapter_id=v_chapter AND b.block_type='question'
  ), matching AS (
    SELECT i.id AS item_id, q.id AS block_id, i.source_block_id,
      lower(regexp_replace(replace(i.prompt,'colors','colours'),'[[:space:]]+','','g')) =
      lower(regexp_replace(replace(
        btrim(regexp_replace(split_part(q.content,E'\n',1),'^[0-9]+[.] +','')),
        'colors','colours'),'[[:space:]]+','','g')) as exactly_matched
    FROM public.generated_assessment_items i
    JOIN canonical_questions q ON q.n=i.sequence
    WHERE i.assessment_id=v_assessment
  )
  SELECT count(*),count(*) filter(where exactly_matched
      AND (source_block_id IS NULL OR source_block_id=block_id))
    INTO v_question_rows,v_good FROM matching;
  IF v_question_rows<>15 OR v_good<>15 THEN
    RAISE EXCEPTION 'CA_QUESTION_LINEAGE_MISMATCH matched %/%',v_good,v_question_rows;
  END IF;

  WITH canonical_questions AS (
    SELECT b.id,row_number() over(order by b.sequence) as n
    FROM public.content_blocks b WHERE b.chapter_id=v_chapter AND b.block_type='question'
  )
  UPDATE public.generated_assessment_items i SET source_block_id=q.id
  FROM canonical_questions q
  WHERE i.assessment_id=v_assessment AND i.sequence=q.n
    AND i.source_block_id IS DISTINCT FROM q.id;
  GET DIAGNOSTICS v_changed=ROW_COUNT;
  IF v_changed NOT BETWEEN 0 AND 15 THEN
    RAISE EXCEPTION 'CA_QUESTION_LINEAGE_UPDATE_ANOMALY';
  END IF;

  -- Attach the previously specified interactive, not a new replacement unit.
  SELECT count(*) INTO v_existing_builder
  FROM jsonb_array_elements(v_blocks) b
  WHERE b->>'id'=v_builder_key;
  IF v_existing_builder>1 THEN RAISE EXCEPTION 'CA_DUPLICATE_MONTAGE_BUILDER'; END IF;
  IF v_existing_builder=0 THEN
    SELECT max(ordinality),count(*) INTO v_anchor,v_anchors
    FROM jsonb_array_elements(v_blocks) WITH ORDINALITY b(value,ordinality)
    WHERE value->>'type'='paragraph'
      AND value->>'content' LIKE '%Lesson 10 — Learn and practise:%';
    IF v_anchors<>1 THEN RAISE EXCEPTION 'CA_LESSON_10_ANCHOR_CHANGED: %',v_anchors; END IF;
    SELECT jsonb_agg(item ORDER BY position) INTO v_new_blocks FROM (
      SELECT value AS item, ordinalITY*2 AS position
      FROM jsonb_array_elements(v_blocks) WITH ORDINALITY b(value,ordinality)
      UNION ALL
      SELECT v_builder, v_anchor*2+1
    ) ordered;
    UPDATE public.vibe_chapters c SET blocks=v_new_blocks,updated_at=now()
      WHERE c.id=v_chapter AND c.status='draft';
    IF NOT FOUND THEN RAISE EXCEPTION 'CA_CHAPTER_UPDATE_FAILED'; END IF;
  END IF;

  -- Rebind all 31 guide source citations to the same *text* in the current
  -- canonical blocks. Earlier autosaves destroyed their previous row UUIDs.
  SELECT jsonb_array_length(d.body->'source_sequence') INTO v_guide_sources
  FROM public.content_derivatives d WHERE d.id=v_guide;
  WITH guide_sources AS (
    SELECT e.value as source, e.ordinality as ord
    FROM public.content_derivatives d,
      LATERAL jsonb_array_elements(d.body->'source_sequence')
        WITH ORDINALITY e(value,ordinality)
    WHERE d.id=v_guide
  ), exact_matches AS (
    SELECT gs.ord, b.id FROM guide_sources gs
    JOIN public.content_blocks b ON b.chapter_id=v_chapter
      AND lower(btrim(regexp_replace(b.payload->>'content','<[^>]+>','','g'))) =
          lower(btrim(gs.source->>'text'))
  ) SELECT count(*) INTO v_guide_matched FROM exact_matches;
  IF v_guide_sources<>31 OR v_guide_matched<>31 THEN
    RAISE EXCEPTION 'CA_GUIDE_SOURCE_MATCH_MISMATCH matched %/%',
       v_guide_matched,v_guide_sources;
  END IF;

  UPDATE public.content_derivatives d
  SET body=jsonb_set(d.body,'{source_sequence}', (
    SELECT jsonb_agg(e.value || jsonb_build_object(
      'block_id', b.id, 'sequence', b.sequence) ORDER BY e.ordinalITY)
    FROM jsonb_array_elements(d.body->'source_sequence')
      WITH ORDINALITY e(value,ordinality)
    JOIN public.content_blocks b ON b.chapter_id=v_chapter
      AND lower(btrim(regexp_replace(b.payload->>'content','<[^>]+>','','g'))) =
          lower(btrim(e.value->>'text'))
  ),true),updated_at=now()
  WHERE d.id=v_guide AND d.status='draft';
  IF NOT FOUND THEN RAISE EXCEPTION 'CA_GUIDE_RELINK_FAILED'; END IF;

  IF (SELECT count(*) FROM public.generated_assessment_items i
      JOIN public.content_blocks b ON b.id=i.source_block_id
      WHERE i.assessment_id=v_assessment AND b.chapter_id=v_chapter
        AND b.block_type='question')<>15 THEN
    RAISE EXCEPTION 'CA_QUESTION_RECHECK_FAILED';
  END IF;
  IF (SELECT count(*) FROM public.content_blocks
      WHERE chapter_id=v_chapter AND block_type='interactive'
        AND payload->'meta'->>'interactiveType'='creative_arts_montage_builder')<>1 THEN
    RAISE EXCEPTION 'CA_INTERACTIVE_RECHECK_FAILED';
  END IF;
  IF (SELECT count(*) FROM public.content_derivatives d,
      LATERAL jsonb_array_elements(d.body->'source_sequence') e
      JOIN public.content_blocks b ON b.id=(e.value->>'block_id')::uuid
        AND b.sequence=(e.value->>'sequence')::integer
      WHERE d.id=v_guide AND b.chapter_id=v_chapter)<>31 THEN
    RAISE EXCEPTION 'CA_GUIDE_RECHECK_FAILED';
  END IF;
END;
$repair$;
