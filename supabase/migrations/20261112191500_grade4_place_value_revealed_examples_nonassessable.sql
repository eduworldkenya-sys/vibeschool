-- Grade 4 Mathematics 1.1(a) exact-ID assessment integrity repair.
-- Does not touch outcome authority, content, teacher-owned schemes or publication.
-- Deliberately fail closed on unexpected source text, lifecycle or assessment references.
-- Invariant: no revealed worked example may be protected-assessment eligible.
-- Tracked migration: apply only through repository CI and controlled database deployment.
-- Existing block UUIDs, content and chapter/publication identities are preserved.
set local lock_timeout = '5s';

do $repair$
declare
  v_valid integer;
  v_true integer;
  v_present integer;
begin
  -- Avoid racing another author/review while inspecting and applying.
  perform 1
  from public.content_blocks
  where id in (
    '02b9a7e6-87ac-4471-a5ce-549997be9781'::uuid,
    '2cae20c4-7908-4a56-8134-a3521f1852c1'::uuid
  )
  order by id
  for update;

  -- Newly reconstructed/blank databases have none of these historical
  -- editorial records. Do not invent them or make reconstruction fail.
  -- A partially present target, chapter or publication is NOT a blank
  -- installation and must still fail closed.
  select count(*) into v_present from public.content_blocks
  where id in (
    '02b9a7e6-87ac-4471-a5ce-549997be9781'::uuid,
    '2cae20c4-7908-4a56-8134-a3521f1852c1'::uuid
  );
  if v_present = 0
    and not exists (
      select 1 from public.vibe_chapters
      where id = 'f95c252a-da2d-477c-b4cb-33b5f8338e10'::uuid
    )
    and not exists (
      select 1 from public.vibe_publications
      where id = '2745c031-65be-47de-bd75-1e1db74d4123'::uuid
    ) then
    raise notice 'Grade 4 Place Value: no legacy publication in clean database; controlled no-op.';
    return;
  end if;
  if v_present <> 2 then
    raise exception 'Grade 4 Place Value repair blocked: partial historical block set (% of 2)', v_present;
  end if;

  select count(*), count(*) filter (where b.is_assessable)
  into v_valid, v_true
  from public.content_blocks b
  join public.vibe_chapters c on c.id = b.chapter_id
  join public.vibe_publications p on p.id = b.publication_id
  where b.chapter_id = 'f95c252a-da2d-477c-b4cb-33b5f8338e10'::uuid
    and b.publication_id = '2745c031-65be-47de-bd75-1e1db74d4123'::uuid
    and b.block_type = 'activity'
    and b.status = 'draft'
    and c.status = 'draft'
    and p.status = 'draft'
    and (
      (
        b.id = '02b9a7e6-87ac-4471-a5ce-549997be9781'::uuid
        and b.plain_text = $example1$In 3,482, what is the value of the digit 4? Find its column (Hundreds), then multiply the digit by the value represented by its place: 4 × 100 = 400.$example1$
      ) or (
        b.id = '2cae20c4-7908-4a56-8134-a3521f1852c1'::uuid
        and b.plain_text = $example2$In 5,047, what is the value of the digit 0, and the digit 7? 0 is in Hundreds (0 × 100 = 0), 7 is in Ones (7 × 1 = 7).$example2$
      )
    );

  if v_valid <> 2 then
    raise exception 'Grade 4 Place Value repair blocked: expected TWO unchanged draft worked examples; found %', v_valid;
  end if;

  if exists (
    select 1 from public.assessment_items
    where source_block_id in (
      '02b9a7e6-87ac-4471-a5ce-549997be9781'::uuid,
      '2cae20c4-7908-4a56-8134-a3521f1852c1'::uuid
    )
  ) or exists (
    select 1 from public.generated_assessment_items
    where source_block_id in (
      '02b9a7e6-87ac-4471-a5ce-549997be9781'::uuid,
      '2cae20c4-7908-4a56-8134-a3521f1852c1'::uuid
    )
  ) then
    raise exception 'Grade 4 Place Value repair blocked: downstream assessments now reference exposed examples';
  end if;

  if v_true = 2 then
    update public.content_blocks
       set is_assessable = false, updated_at = now()
     where id in (
       '02b9a7e6-87ac-4471-a5ce-549997be9781'::uuid,
       '2cae20c4-7908-4a56-8134-a3521f1852c1'::uuid
     );
    raise notice 'Grade 4 Place Value: exact two revealed examples marked non-assessable.';
  elsif v_true = 0 then
    raise notice 'Grade 4 Place Value: both exact examples already non-assessable; no-op.';
  else
    raise exception 'Grade 4 Place Value repair blocked: inconsistent partial state, % of 2 currently assessable', v_true;
  end if;
end;
$repair$;

-- Postcondition is part of the transaction: rollback if it fails.
do $verify$
begin
  -- The sole permitted empty case is a fully absent legacy chapter
  -- AND publication. Partial historical material remains an error.
  if exists (
    select 1 from public.content_blocks
    where id in (
      '02b9a7e6-87ac-4471-a5ce-549997be9781'::uuid,
      '2cae20c4-7908-4a56-8134-a3521f1852c1'::uuid
    )
  ) or exists (
    select 1 from public.vibe_chapters
    where id = 'f95c252a-da2d-477c-b4cb-33b5f8338e10'::uuid
  ) or exists (
    select 1 from public.vibe_publications
    where id = '2745c031-65be-47de-bd75-1e1db74d4123'::uuid
  ) then
    if (
      select count(*)
      from public.content_blocks
      where id in (
        '02b9a7e6-87ac-4471-a5ce-549997be9781'::uuid,
        '2cae20c4-7908-4a56-8134-a3521f1852c1'::uuid
      ) and is_assessable = false
    ) <> 2 then
      raise exception 'Grade 4 Place Value repair postcondition failed';
    end if;
  end if;
end;
$verify$;
