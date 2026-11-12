-- Grade 4 Mathematics 1.1(a): independently review before governed execution.
--
-- Scope: only TWO known draft, fully revealed worked examples in the EXISTING
-- Grade 4 Mathematics Term 1 place-value chapter. They are not assessment
-- questions. Preserve all source text, resource identities, lesson history,
-- scheme records, teacher materials, and already-created assessment data.
--
-- This is an explicit candidate repair script, NOT a migration, certification,
-- authority promotion or permission to execute ad-hoc production SQL.
-- Apply only through VibeSchool's approved change-control / migration route.
-- Recheck current database state immediately before execution.
--
-- Preconditions:
--   1. Exact publication and chapter must still be draft.
--   2. Both exact blocks must exist with the exact original disclosed text.
--   3. Neither block has downstream assessment-item references.
--   4. Both flags are either true (repair) or false (already repaired).
-- Any partial state or changed text FAILS CLOSED.
--
-- Expected postcondition: same two blocks, text and UUIDs unchanged, only
-- is_assessable=false (and updated_at refreshed if changed).
begin;
set local lock_timeout = '5s';

do $repair$
declare
  v_valid integer;
  v_true integer;
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
end;
$verify$;
commit;
