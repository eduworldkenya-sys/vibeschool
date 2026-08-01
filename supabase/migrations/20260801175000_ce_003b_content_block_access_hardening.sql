begin;

grant select on table public.content_blocks to anon;

create or replace function public.ce_reconcile_chapter_content_blocks(p_chapter_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  chapter_row public.vibe_chapters%rowtype;
  block_row record;
  kept_sequences integer[] := '{}';
  synced_count integer := 0;
  caller uuid := auth.uid();
begin
  select * into chapter_row
  from public.vibe_chapters
  where id = p_chapter_id;

  if not found then
    raise exception 'Chapter % does not exist', p_chapter_id;
  end if;

  if current_user not in ('postgres', 'service_role')
     and not exists (
       select 1 from public.vibe_publications p
       where p.id = chapter_row.publication_id
         and p.author_id = caller
     ) then
    raise exception 'Not authorized to reconcile chapter %', p_chapter_id;
  end if;

  if jsonb_typeof(chapter_row.blocks) <> 'array' then
    raise exception 'Chapter % blocks must be a JSON array', p_chapter_id;
  end if;

  for block_row in
    select value as payload, ordinality::integer as seq
    from jsonb_array_elements(chapter_row.blocks) with ordinality
  loop
    if jsonb_typeof(block_row.payload) <> 'object' then
      raise exception 'Chapter % block % must be a JSON object', p_chapter_id, block_row.seq;
    end if;

    if nullif(btrim(block_row.payload->>'type'), '') is null then
      raise exception 'Chapter % block % has no type', p_chapter_id, block_row.seq;
    end if;

    insert into public.content_blocks(
      publication_id, chapter_id, legacy_block_id, block_type, sequence,
      payload, status, is_teacher_only, is_assessable
    )
    values (
      chapter_row.publication_id,
      chapter_row.id,
      nullif(btrim(block_row.payload->>'id'), ''),
      block_row.payload->>'type',
      block_row.seq,
      block_row.payload,
      case when chapter_row.status = 'published' then 'published' else 'draft' end,
      coalesce((block_row.payload->>'teacherOnly')::boolean, false),
      (block_row.payload->>'type') in ('question','activity','exercise','project','assessment')
    )
    on conflict (chapter_id, sequence) do update
    set publication_id = excluded.publication_id,
        legacy_block_id = excluded.legacy_block_id,
        block_type = excluded.block_type,
        payload = excluded.payload,
        status = excluded.status,
        is_teacher_only = excluded.is_teacher_only,
        is_assessable = excluded.is_assessable,
        updated_at = now();

    kept_sequences := array_append(kept_sequences, block_row.seq);
    synced_count := synced_count + 1;
  end loop;

  delete from public.content_blocks
  where chapter_id = p_chapter_id
    and not (sequence = any(kept_sequences));

  return synced_count;
end;
$$;

revoke all on function public.ce_reconcile_chapter_content_blocks(uuid) from public, anon;
grant execute on function public.ce_reconcile_chapter_content_blocks(uuid) to authenticated, service_role;

commit;
