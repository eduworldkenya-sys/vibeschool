begin;

-- Replace legacy creator-claimed chapter mappings with the already-promoted,
-- owner-verified KICD Grade 10 Chemistry outcome set. The mapping is exact and
-- deterministic: each chapter title must match exactly one promoted KICD
-- sub-strand, and every promoted outcome must be mapped exactly once.
-- No curriculum source, verified outcome, or publication content is mutated.

do $$
declare
  v_publication_id constant uuid := '28791ef6-c87b-454e-b941-0c3c05a3fb1b';
  v_import_id constant uuid := 'cb335e35-3460-4c16-a3d1-1fb90bf4fb16';
  v_chapters integer;
  v_outcomes integer;
  v_exact_substrands integer;
  v_mapped integer;
  v_linked_chapters integer;
begin
  if not exists (
    select 1 from public.curriculum_imports i
    where i.id=v_import_id
      and i.status='verified'
      and i.source_type='official'
      and lower(i.authority_name) like '%kenya institute of curriculum development%'
      and lower(i.subject)='chemistry'
      and replace(lower(i.grade),' ','') in ('grade10','10')
      and i.content_sha256 is not null
  ) then
    raise exception 'VERIFIED_KICD_CHEMISTRY_IMPORT_REQUIRED';
  end if;

  select count(*) into v_chapters
  from public.vibe_chapters c
  where c.publication_id=v_publication_id;
  if v_chapters<>7 then raise exception 'CHEMISTRY_SEVEN_CHAPTERS_REQUIRED:%',v_chapters; end if;

  select count(*) into v_outcomes
  from public.curriculum_learning_outcomes o
  where o.source_import_id=v_import_id
    and o.status='verified'
    and o.source_type='official';
  if v_outcomes<>32 then raise exception 'CHEMISTRY_32_VERIFIED_OUTCOMES_REQUIRED:%',v_outcomes; end if;

  select count(distinct cs.id) into v_exact_substrands
  from public.vibe_chapters c
  join public.cbc_strands cs
    on cs.subject_id=(select canonical_subject_id from public.curriculum_authority_sources s
                      join public.curriculum_authority_snapshots sn on sn.source_id=s.id
                      where sn.status='promoted' and s.grade='Grade 10'
                        and lower(s.subject_label)='chemistry'
                      order by sn.promoted_at desc limit 1)
   and cs.grade='Grade 10'
   and cs.term is null and cs.week is null
   and lower(btrim(cs.sub_strand))=lower(btrim(c.title))
  where c.publication_id=v_publication_id;
  if v_exact_substrands<>7 then raise exception 'CHEMISTRY_EXACT_CHAPTER_SUBSTRANDS_REQUIRED:%',v_exact_substrands; end if;

  -- Preserve legacy creator-claimed outcomes themselves as history, but remove
  -- their chapter authority links for this publication before canonical binding.
  delete from public.chapter_learning_outcome_links l
  using public.vibe_chapters c
  where l.chapter_id=c.id
    and l.publication_id=v_publication_id
    and c.publication_id=v_publication_id;

  insert into public.chapter_learning_outcome_links(
    publication_id,chapter_id,outcome_id,alignment_strength,sequence,evidence_note
  )
  select
    v_publication_id,
    c.id,
    o.id,
    'masters',
    row_number() over(partition by c.id order by o.outcome_code,o.id)::integer,
    'Canonical KICD Grade 10 Chemistry binding from promoted Curriculum Authority snapshot; exact chapter title = official sub-strand.'
  from public.vibe_chapters c
  join public.cbc_strands cs
    on cs.grade='Grade 10'
   and cs.term is null and cs.week is null
   and lower(btrim(cs.sub_strand))=lower(btrim(c.title))
  join public.curriculum_learning_outcomes o
    on o.sub_strand_id=cs.id
   and o.source_import_id=v_import_id
   and o.status='verified'
   and o.source_type='official'
  where c.publication_id=v_publication_id
  on conflict(chapter_id,outcome_id) do update
    set publication_id=excluded.publication_id,
        alignment_strength=excluded.alignment_strength,
        sequence=excluded.sequence,
        evidence_note=excluded.evidence_note,
        updated_at=clock_timestamp();

  get diagnostics v_mapped=row_count;
  if v_mapped<>32 then raise exception 'CHEMISTRY_CANONICAL_LINK_COUNT_MISMATCH:%',v_mapped; end if;

  select count(distinct c.id),count(distinct l.outcome_id)
    into v_linked_chapters,v_mapped
  from public.vibe_chapters c
  join public.chapter_learning_outcome_links l
    on l.chapter_id=c.id and l.publication_id=v_publication_id
  join public.curriculum_learning_outcomes o
    on o.id=l.outcome_id
  where c.publication_id=v_publication_id
    and o.source_import_id=v_import_id
    and o.status='verified'
    and o.source_type='official';

  if v_linked_chapters<>7 or v_mapped<>32 then
    raise exception 'CHEMISTRY_CANONICAL_BINDING_INCOMPLETE:chapters=% outcomes=%',v_linked_chapters,v_mapped;
  end if;
end $$;

commit;
