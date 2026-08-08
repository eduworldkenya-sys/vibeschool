-- Repair CE chapter->content_blocks reconciliation after content_blocks schema drift.
-- Production was still writing removed columns body_json/position and invalid
-- inactive/active statuses. Current canonical columns are payload/sequence and
-- status values draft/published/unpublished/archived.

create or replace function public.ce_reconcile_chapter_blocks_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_block jsonb;
  v_sequence integer := 1;
  v_type text;
  v_plain text;
  v_status text;
  v_legacy_block_id text;
  v_payload jsonb;
begin
  delete from public.content_blocks where chapter_id = new.id;

  v_status := case
    when new.status in ('published', 'locked') then 'published'
    when new.status = 'archived' then 'archived'
    when new.status = 'unpublished' then 'unpublished'
    else 'draft'
  end;

  for v_block in
    select value
    from jsonb_array_elements(coalesce(new.blocks, '[]'::jsonb))
  loop
    v_type := coalesce(v_block->>'type', 'paragraph');
    v_plain := regexp_replace(coalesce(v_block->>'content', ''), '<[^>]*>', ' ', 'g');
    v_legacy_block_id := nullif(v_block->>'id', '');
    v_payload := jsonb_build_object(
      'source_block_id', v_legacy_block_id,
      'source_block_type', v_type,
      'content', coalesce(v_block->>'content', ''),
      'meta', coalesce(v_block->'meta', '{}'::jsonb)
    );

    insert into public.content_blocks(
      publication_id,
      chapter_id,
      legacy_block_id,
      block_type,
      sequence,
      payload,
      plain_text,
      status,
      is_teacher_only,
      is_assessable
    ) values (
      new.publication_id,
      new.id,
      v_legacy_block_id,
      case
        when v_type = 'question' then 'question'
        when v_type in ('activity', 'experiment', 'project') then 'activity'
        when v_type in ('image', 'diagram', 'video', 'audio', 'model3d', 'simulation') then 'media'
        else 'content'
      end,
      v_sequence,
      v_payload,
      nullif(btrim(v_plain), ''),
      v_status,
      false,
      (v_type = 'question')
    );

    v_sequence := v_sequence + 1;
  end loop;

  return new;
end;
$function$;
