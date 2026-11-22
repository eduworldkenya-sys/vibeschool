-- Attach the implemented VibeLab block to the existing private draft only.
-- The chapter stores the reader blocks, while assessments reference canonical
-- block IDs. The chapter trigger rebuilds those rows on save, so snapshot
-- and restore the stable block identities and the assessment lineage.
do $montage$
declare
  chapter_id_to_edit constant uuid := 'b58f778e-c78c-4fd9-b5d3-f88978ea847f';
  publication_id_to_edit constant uuid := 'eff38437-a033-4f62-83b4-59f2dfa0c889';
  block_key constant text := 'painting-montage-lesson-10-builder';
  reader_blocks jsonb;
  next_blocks jsonb;
  activity constant jsonb := '{
    "id":"painting-montage-lesson-10-builder",
    "type":"interactive",
    "content":"Montage Builder",
    "meta":{"interactiveType":"creative_arts_montage_builder"}
  }'::jsonb;
  anchor integer;
  anchor_count integer;
  block_count integer;
  original_ids jsonb;
  current_ids jsonb;
  guide_status text;
  assessment_links jsonb;
  foreign_key record;
  unexpected_reference boolean;
  restored_count integer;
begin
  select c.blocks into strict reader_blocks
  from public.vibe_chapters c
  join public.vibe_publications p on p.id = c.publication_id
  where c.id = chapter_id_to_edit and p.id = publication_id_to_edit
    and c.status = 'draft' and p.status = 'draft'
    and p.author_id = 'c49bf987-357f-46bc-98fb-9a326882e437'::uuid
    and c.title = '1.3 Painting and Montage'
  for update of p, c;

  select max(ordinality), count(*) into anchor, anchor_count
  from jsonb_array_elements(reader_blocks) with ordinality as b(payload, ordinality)
  where payload->>'type' = 'paragraph'
    and payload->>'content' like 'Lesson 10 — Learn and practise:%';
  if anchor_count <> 1 then
    raise exception 'Lesson 10 anchor is missing or ambiguous';
  end if;
  if reader_blocks -> anchor = activity then
    return;
  end if;
  if exists (select from jsonb_array_elements(reader_blocks) b where b->>'id' = block_key) then
    raise exception 'An existing Montage Builder needs reconciliation';
  end if;

  select status into strict guide_status from public.content_derivatives
    where id = '4c80f3c2-2de5-4bd7-8741-b1158d2ed0f5'::uuid
      and source_chapter_id = chapter_id_to_edit and audience = 'teacher'
    for update;
  if guide_status <> 'draft' then
    raise exception 'The guide needs a fresh revision before changing its source sequence';
  end if;

  block_count := jsonb_array_length(reader_blocks);
  select jsonb_object_agg(b.legacy_block_id, b.id) into original_ids
    from public.content_blocks b where b.chapter_id = chapter_id_to_edit;
  if original_ids is null or
    (select count(*) from jsonb_object_keys(original_ids)) <> block_count or
    exists (
      select from jsonb_array_elements(reader_blocks) with ordinality as r(payload, ordinality)
      left join public.content_blocks b on b.chapter_id = chapter_id_to_edit and b.sequence = r.ordinality
      where b.id is null or b.legacy_block_id is distinct from r.payload->>'id' or b.payload is distinct from r.payload
    ) then
    raise exception 'Reader and canonical blocks differ';
  end if;

  select jsonb_agg(payload order by position) into next_blocks
  from (
    select payload, ordinality * 2 as position
    from jsonb_array_elements(reader_blocks) with ordinality as b(payload, ordinality)
    union all
    select activity, anchor * 2 + 1
  ) arranged;

  -- Fail closed if this draft gains other relational dependencies.
  for foreign_key in
    select constraint_row.conrelid::regclass as relation, source_column.attname as column_name
    from pg_constraint constraint_row
    join pg_attribute source_column on source_column.attrelid = constraint_row.conrelid
      and source_column.attnum = constraint_row.conkey[1]
    where constraint_row.contype = 'f'
      and constraint_row.confrelid = 'public.content_blocks'::regclass
      and cardinality(constraint_row.conkey) = 1
      and constraint_row.conrelid <> 'public.generated_assessment_items'::regclass
  loop
    execute format(
      'select exists (select from %s linked join public.content_blocks b on b.id = linked.%I where b.chapter_id = $1)',
      foreign_key.relation, foreign_key.column_name
    ) into unexpected_reference using chapter_id_to_edit;
    if unexpected_reference then
      raise exception 'Additional source associations exist on %', foreign_key.relation;
    end if;
  end loop;
  if exists (
    select from public.content_blocks where chapter_id = chapter_id_to_edit and asset_id is not null
  ) then
    raise exception 'Canonical media associations need preservation before editing';
  end if;

  select jsonb_object_agg(i.id, i.source_block_id) into assessment_links
    from public.generated_assessment_items i
    join public.content_blocks b on b.id = i.source_block_id
    where b.chapter_id = chapter_id_to_edit;
  if assessment_links is null or (select count(*) from jsonb_object_keys(assessment_links)) <> 15 then
    raise exception 'The expected 15 assessment source links changed';
  end if;

  update public.vibe_chapters set blocks = next_blocks, updated_at = now()
    where id = chapter_id_to_edit;
  perform public.ce_reconcile_chapter_content_blocks(chapter_id_to_edit);

  update public.content_blocks b set id = original.value::uuid
    from jsonb_each_text(original_ids) original
    where b.chapter_id = chapter_id_to_edit and b.legacy_block_id = original.key;
  update public.generated_assessment_items i set source_block_id = original.value::uuid
    from jsonb_each_text(assessment_links) original
    where i.id = original.key::uuid;
  get diagnostics restored_count = row_count;
  if restored_count <> 15 then
    raise exception 'Expected to restore 15 assessment source links, restored %', restored_count;
  end if;

  select jsonb_object_agg(b.legacy_block_id, b.id) into current_ids
    from public.content_blocks b
    where b.chapter_id = chapter_id_to_edit and b.legacy_block_id <> block_key;
  if current_ids is distinct from original_ids or not exists (
    select from public.content_blocks b where b.chapter_id = chapter_id_to_edit
      and b.sequence = anchor + 1 and b.payload = activity and b.status = 'draft'
  ) then
    raise exception 'Montage Builder attachment did not preserve canonical block identities';
  end if;

  update public.content_derivatives d
    set body = jsonb_set(d.body, '{source_sequence}', (
      select jsonb_agg(jsonb_set(s.entry, '{sequence}', to_jsonb(b.sequence)) order by b.sequence)
      from jsonb_array_elements(d.body->'source_sequence') as s(entry)
      join public.content_blocks b on b.id = (s.entry->>'block_id')::uuid
      where b.chapter_id = chapter_id_to_edit
    )), updated_at = now()
    where d.id = '4c80f3c2-2de5-4bd7-8741-b1158d2ed0f5'::uuid;
end
$montage$;
