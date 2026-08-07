create or replace function public.student_resolve_vibelearn_assessment_source(
  p_publication_id uuid,
  p_chapter_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_student uuid := auth.uid();
  v_publication public.vibe_publications%rowtype;
  v_chapter public.vibe_chapters%rowtype;
  v_can_read boolean := false;
  v_blocks jsonb := '[]'::jsonb;
  v_outcomes jsonb := '[]'::jsonb;
begin
  if v_student is null then
    raise exception 'Authentication required';
  end if;

  select * into v_publication
  from public.vibe_publications
  where id = p_publication_id
    and status = 'published'
    and format = 'vibetextbook';

  if not found then
    raise exception 'Publication not available';
  end if;

  select * into v_chapter
  from public.vibe_chapters
  where id = p_chapter_id
    and publication_id = p_publication_id
    and status in ('published','locked');

  if not found then
    raise exception 'Chapter not available';
  end if;

  select public.can_viewer_read_chapter(p_chapter_id, v_student) into v_can_read;
  if coalesce(v_can_read, false) is not true then
    raise exception 'Chapter not available';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id,
      'title', b.title,
      'plain_text', b.plain_text,
      'block_type', b.block_type,
      'sequence', b.sequence
    ) order by b.sequence), '[]'::jsonb)
  into v_blocks
  from public.content_blocks b
  where b.publication_id = p_publication_id
    and b.chapter_id = p_chapter_id
    and b.status = 'published'
    and b.is_assessable = true
    and b.is_teacher_only = false
    and nullif(btrim(coalesce(b.plain_text, '')), '') is not null;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id,
      'outcome_code', x.outcome_code,
      'outcome_text', x.outcome_text,
      'bloom_level', x.bloom_level,
      'difficulty', x.difficulty,
      'content_block_ids', x.content_block_ids
    ) order by x.outcome_code nulls last, x.outcome_text), '[]'::jsonb)
  into v_outcomes
  from (
    select o.id, o.outcome_code, o.outcome_text, o.bloom_level, o.difficulty,
           jsonb_agg(distinct l.content_block_id) as content_block_ids
    from public.content_block_outcome_links l
    join public.curriculum_learning_outcomes o on o.id = l.outcome_id
    join public.content_blocks b on b.id = l.content_block_id
    where l.publication_id = p_publication_id
      and l.chapter_id = p_chapter_id
      and o.status = 'verified'
      and b.status = 'published'
      and b.is_assessable = true
      and b.is_teacher_only = false
    group by o.id, o.outcome_code, o.outcome_text, o.bloom_level, o.difficulty
  ) x;

  return jsonb_build_object(
    'ok', true,
    'source_kind', 'vibetextbook_chapter',
    'publication_id', v_publication.id,
    'publication_title', v_publication.title,
    'chapter_id', v_chapter.id,
    'chapter_title', coalesce(v_chapter.title, 'Unit ' || v_chapter.number::text),
    'subject', v_publication.cbc_subject,
    'grade', v_publication.cbc_grade,
    'blocks', v_blocks,
    'outcomes', v_outcomes,
    'assessable_block_count', jsonb_array_length(v_blocks),
    'verified_outcome_count', jsonb_array_length(v_outcomes)
  );
end;
$$;

revoke all on function public.student_resolve_vibelearn_assessment_source(uuid, uuid) from public;
revoke all on function public.student_resolve_vibelearn_assessment_source(uuid, uuid) from anon;
grant execute on function public.student_resolve_vibelearn_assessment_source(uuid, uuid) to authenticated;
