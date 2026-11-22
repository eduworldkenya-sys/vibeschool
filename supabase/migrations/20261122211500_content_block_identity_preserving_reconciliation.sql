-- Preserve canonical content_block UUIDs across chapter draft autosaves, insertions,
-- reordering, and edits. Previously the chapter AFTER UPDATE trigger deleted and
-- recreated every row, silently clearing linked assessment IDs via ON DELETE SET NULL.
-- No rights, review, publication or RLS grant changes are made in this migration.
CREATE OR REPLACE FUNCTION public.ce_reconcile_chapter_blocks_trigger()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $reconcile$
DECLARE
  v_block jsonb;
  v_seq integer;
  v_kind text;
  v_type text;
  v_legacy text;
  v_payload jsonb;
  v_status text;
  v_shift integer;
  v_existing public.content_blocks%rowtype;
  v_old public.content_blocks%rowtype;
  v_ref record;
  v_referenced boolean;
BEGIN
  -- ON UPDATE OF blocks fires even if the column is re-saved unchanged.
  IF TG_OP = 'UPDATE' AND new.blocks IS NOT DISTINCT FROM old.blocks THEN
    RETURN new;
  END IF;
  IF jsonb_typeof(coalesce(new.blocks, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'CHAPTER_BLOCK_ARRAY_REQUIRED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(new.blocks, '[]'::jsonb)) b
    WHERE jsonb_typeof(b.value) <> 'object'
  ) THEN RAISE EXCEPTION 'CHAPTER_BLOCK_OBJECT_REQUIRED'; END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(coalesce(new.blocks, '[]'::jsonb)) b
    WHERE nullif(btrim(b.value->>'id'), '') IS NOT NULL
    GROUP BY b.value->>'id'
    HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'CHAPTER_BLOCK_DUPLICATE_STABLE_ID'; END IF;

  v_status := CASE
    WHEN new.status IN ('published', 'locked') THEN 'published'
    WHEN new.status = 'archived' THEN 'archived'
    WHEN new.status = 'unpublished' THEN 'unpublished'
    ELSE 'draft'
  END;

  -- Shift existing sequences above the entire incoming range. This avoids
  -- unique(chapter_id, sequence) conflicts when blocks move or are inserted.
  SELECT greatest(coalesce(max(sequence), 0),
                  jsonb_array_length(coalesce(new.blocks, '[]'::jsonb))) + 1
    INTO v_shift
    FROM public.content_blocks WHERE chapter_id = new.id;
  IF v_shift > 1000000000 THEN RAISE EXCEPTION 'CHAPTER_SEQUENCE_RANGE_UNSAFE'; END IF;
  UPDATE public.content_blocks
     SET sequence = sequence + v_shift
   WHERE chapter_id = new.id;

  FOR v_block, v_seq IN
    SELECT b.value, b.ordinality::integer
    FROM jsonb_array_elements(coalesce(new.blocks, '[]'::jsonb))
         WITH ORDINALITY AS b(value, ordinality)
  LOOP
    v_type := coalesce(nullif(btrim(v_block->>'type'), ''), 'paragraph');
    v_legacy := nullif(btrim(v_block->>'id'), '');
    v_kind := CASE
      WHEN v_type = 'question' THEN 'question'
      WHEN v_type IN ('activity','experiment','project') THEN 'activity'
      WHEN v_type = 'interactive' THEN 'interactive'
      WHEN v_type IN ('image','diagram','video','audio','model3d','simulation') THEN 'media'
      ELSE 'content'
    END;
    v_payload := jsonb_build_object(
      'source_block_id', v_legacy,
      'source_block_type', v_type,
      'content', coalesce(v_block->>'content', ''),
      'meta', coalesce(v_block->'meta', '{}'::jsonb)
    );
    v_existing.id := null;

    IF v_legacy IS NOT NULL THEN
      SELECT * INTO v_existing
      FROM public.content_blocks
      WHERE chapter_id = new.id AND legacy_block_id = v_legacy;
    ELSE
      -- Only preserve identity for an ID-less row if exact payload and
      -- ordinal are unchanged; never guess that different content is identical.
      SELECT * INTO v_existing
      FROM public.content_blocks
      WHERE chapter_id = new.id
        AND legacy_block_id IS NULL
        AND sequence = v_shift + v_seq
        AND payload = v_payload;
    END IF;

    IF v_existing.id IS NOT NULL THEN
      -- Existing approved/linked questions may be moved but may not silently
      -- change meaning while their answer keys still point to the old prompt.
      IF (v_existing.payload IS DISTINCT FROM v_payload OR v_existing.block_type IS DISTINCT FROM v_kind)
         AND (EXISTS (SELECT 1 FROM public.generated_assessment_items a WHERE a.source_block_id = v_existing.id)
              OR EXISTS (SELECT 1 FROM public.assessment_items a WHERE a.source_block_id = v_existing.id))
      THEN
        RAISE EXCEPTION 'LINKED_QUESTION_EDIT_REQUIRES_ASSESSMENT_REVISION: %', v_legacy;
      END IF;

      UPDATE public.content_blocks
      SET publication_id = new.publication_id,
          legacy_block_id = v_legacy,
          block_type = v_kind,
          sequence = v_seq,
          payload = v_payload,
          status = v_status,
          is_teacher_only = false,
          is_assessable = (v_type = 'question')
      WHERE id = v_existing.id;
    ELSE
      INSERT INTO public.content_blocks (
        publication_id, chapter_id, legacy_block_id, block_type,
        sequence, payload, status, is_teacher_only, is_assessable
      ) VALUES (
        new.publication_id, new.id, v_legacy, v_kind,
        v_seq, v_payload, v_status, false, (v_type = 'question')
      );
    END IF;
  END LOOP;

  -- Deleted blocks must never silently orphan learning/assessment/source
  -- references. Check all real single-column FKs before deleting stale rows.
  FOR v_old IN
    SELECT * FROM public.content_blocks
    WHERE chapter_id = new.id AND sequence > v_shift
  LOOP
    FOR v_ref IN
      SELECT c.conrelid::regclass AS relation, a.attname AS column_name
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
      WHERE c.contype = 'f'
        AND c.confrelid = 'public.content_blocks'::regclass
        AND cardinality(c.conkey) = 1
    LOOP
      EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s WHERE %I=$1)',
                     v_ref.relation, v_ref.column_name)
        INTO v_referenced USING v_old.id;
      IF v_referenced THEN
        RAISE EXCEPTION 'LINKED_CONTENT_BLOCK_DELETE_REQUIRES_REVIEW: % (%)',
          coalesce(v_old.legacy_block_id, v_old.id::text), v_ref.relation;
      END IF;
    END LOOP;
  END LOOP;
  DELETE FROM public.content_blocks
    WHERE chapter_id = new.id AND sequence > v_shift;

  RETURN new;
END;
$reconcile$;

-- Existing trigger remains AFTER INSERT OR UPDATE OF blocks and retains its
-- privileges and security boundary. No historical chapter is rewritten here.
