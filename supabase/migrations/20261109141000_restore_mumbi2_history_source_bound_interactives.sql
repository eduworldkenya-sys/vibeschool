-- Recover four historical source-bound interactive blocks in a Mumbi2 draft
-- without deleting/recreating content_blocks or assessment_items.source_block_id refs.
-- The live CE trigger normally DELETEs+INSERTs blocks on JSON updates, which would
-- break FK-linked assessment items. Temporarily replace only within this transaction
-- with a strictly guarded, identity-preserving one-off restoration branch, then
-- restore the exact original trigger definition before committing.
-- No published chapter is modified, no approval/verified status is changed.

do $repair$
declare
  v_original text;
  v_patched text;
  v_count integer;
  v_changed integer;
  v_missing integer;
  v_guard text := $guard$
  if tg_op = 'UPDATE'
     and old.status = 'draft' and new.status = 'draft'
     and exists (
       select 1 from public.vibe_publications p
       join public.profiles pr on pr.id=p.author_id
       where p.id=new.publication_id
         and p.title='Vibe History & Citizenship Grade 10'
         and pr.full_name='Mumbi2'
     )
     and jsonb_typeof(old.blocks)='array'
     and jsonb_typeof(new.blocks)='array'
     and jsonb_array_length(new.blocks)=jsonb_array_length(old.blocks)+1
     and (select count(*) from public.content_blocks b where b.chapter_id=new.id)
         =jsonb_array_length(new.blocks)
     and not exists (
       select 1 from jsonb_array_elements(old.blocks) e
       where not exists (
         select 1 from jsonb_array_elements(new.blocks) n
         where n.value=e.value
       )
     )
     and (select count(*)
          from jsonb_array_elements(new.blocks) with ordinality x(value,ordinality)
          join public.content_blocks b on b.chapter_id=new.id
             and b.sequence=x.ordinality::integer
             and b.legacy_block_id=x.value->>'id')
         =jsonb_array_length(new.blocks)
  then
    -- Every SQL block and its identity already exists at this exact position;
    -- original canonical blocks are unchanged; do not DELETE/INSERT source IDs.
    return new;
  end if;
$guard$;
begin
  select pg_get_functiondef('public.ce_reconcile_chapter_blocks_trigger()'::regprocedure)
    into v_original;
  if v_original is null
     or position(E'begin\n  delete from public.content_blocks where chapter_id = new.id;' in v_original)=0
  then
    raise exception 'Unexpected CE trigger body; refuse restorative rewrite';
  end if;

  create temporary table tmp_mumbi2_history_block_guard on commit drop as
  select c.id chapter_id,b.id block_id,b.legacy_block_id,b.sequence,
         (select count(*) from public.assessment_items ai where ai.source_block_id=b.id) assessment_refs
  from public.vibe_chapters c
  join public.vibe_publications p on p.id=c.publication_id
  join public.profiles pr on pr.id=p.author_id
  join public.content_blocks b on b.chapter_id=c.id
  where pr.full_name='Mumbi2'
    and p.title='Vibe History & Citizenship Grade 10'
    and c.status='draft'
    and jsonb_array_length(c.blocks)=9
    and (select count(*) from public.content_blocks bb where bb.chapter_id=c.id)=10
    and (select count(*) from public.content_blocks bb where bb.chapter_id=c.id
      and not exists(select 1 from jsonb_array_elements(c.blocks) e
                     where e.value->>'id'=bb.legacy_block_id)
      and bb.block_type='interactive'
      and exists(select 1 from public.assessment_items ai where ai.source_block_id=bb.id)
    )=1
    and (select count(*) from jsonb_array_elements(c.blocks) e where not exists(
      select 1 from public.content_blocks bb where bb.chapter_id=c.id
        and bb.legacy_block_id=e.value->>'id'))=0;

  select count(distinct chapter_id) into v_count
  from tmp_mumbi2_history_block_guard;
  -- Clean rebuilds have no Mumbi2 tenant content; zero targets is a valid no-op.
  -- Any partially populated production cohort must fail closed, not silently skip.
  if v_count=0 then
    return;
  end if;
  if v_count<>4
     or (select count(*) from tmp_mumbi2_history_block_guard)<>40
  then
    raise exception 'Expected four intact 10-block history chapters, got %',v_count;
  end if;

  v_patched:=replace(v_original,
    E'begin\n  delete from public.content_blocks where chapter_id = new.id;',
    'begin'||E'\n'||v_guard||E'\n  delete from public.content_blocks where chapter_id = new.id;');
  execute v_patched;

  with rebuilt as (
    select c.id,
      (select jsonb_agg(
          coalesce(
            (select x.value from jsonb_array_elements(c.blocks) x
             where x.value->>'id'=b.legacy_block_id),
            b.payload || jsonb_build_object('id',b.legacy_block_id,'type','interactive')
          ) order by b.sequence)
       from public.content_blocks b where b.chapter_id=c.id) repaired_blocks
    from public.vibe_chapters c
    where c.id in (select distinct chapter_id from tmp_mumbi2_history_block_guard)
  )
  update public.vibe_chapters c
     set blocks=rebuilt.repaired_blocks,updated_at=clock_timestamp()
    from rebuilt where c.id=rebuilt.id;
  get diagnostics v_changed=row_count;
  if v_changed<>4 then
    raise exception 'Changed unexpected number of chapters: %',v_changed;
  end if;

  -- Restore canonical normal CE trigger implementation within same transaction.
  execute v_original;

  select count(*) into v_missing from tmp_mumbi2_history_block_guard x
  left join public.content_blocks b on b.id=x.block_id
  where b.id is null
     or b.chapter_id is distinct from x.chapter_id
     or b.legacy_block_id is distinct from x.legacy_block_id
     or b.sequence is distinct from x.sequence
     or x.assessment_refs is distinct from
       (select count(*) from public.assessment_items a where a.source_block_id=x.block_id);
  if v_missing<>0 then
    raise exception 'Source block or assessment references were changed: %',v_missing;
  end if;

  if (select count(*) from public.vibe_chapters c
      where c.id in (select distinct chapter_id from tmp_mumbi2_history_block_guard)
        and jsonb_array_length(c.blocks)=10
        and (select count(*) from public.content_blocks b where b.chapter_id=c.id)=10
        and (select count(*) from jsonb_array_elements(c.blocks) with ordinality x(value,ordinality)
             join public.content_blocks b on b.chapter_id=c.id
               and b.sequence=x.ordinality::integer
               and b.legacy_block_id=x.value->>'id')=10
      )<>4
  then
    raise exception 'Canonical history blocks not reconciled as expected';
  end if;
  if pg_get_functiondef('public.ce_reconcile_chapter_blocks_trigger()'::regprocedure)
      is distinct from v_original then
    raise exception 'Temporary trigger override was not restored';
  end if;
end $repair$;
