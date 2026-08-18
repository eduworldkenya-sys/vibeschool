begin;

-- READ / Learning Product harmonization v1.
-- One authority answers whether a viewer can read a chapter, and chapter
-- navigation alone can never manufacture completion evidence.

create or replace function public.record_reading_progress(
  publication_id_input uuid,
  chapter_id_input uuid,
  progress_percent_input integer,
  position_input jsonb default null,
  reset_input boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_viewer_id uuid := auth.uid();
  v_chapter public.vibe_chapters%rowtype;
  v_clamped_percent integer;
  v_existing_percent integer;
  v_new_percent integer;
  v_final_block_id text;
  v_position_block_id text;
  v_position_scroll numeric;
  v_completion_threshold constant integer := 90;
  v_result public.vibe_reading_progress%rowtype;
begin
  if v_viewer_id is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_required');
  end if;

  if publication_id_input is null or chapter_id_input is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_input');
  end if;

  if progress_percent_input is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_progress');
  end if;

  select * into v_chapter
  from public.vibe_chapters
  where id = chapter_id_input;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'chapter_not_found');
  end if;

  if v_chapter.publication_id <> publication_id_input then
    return jsonb_build_object('ok', false, 'reason', 'chapter_publication_mismatch');
  end if;

  if not public.can_viewer_read_chapter(chapter_id_input, v_viewer_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_entitled');
  end if;

  v_clamped_percent := greatest(0, least(100, progress_percent_input));

  if v_clamped_percent >= v_completion_threshold then
    if jsonb_typeof(position_input) <> 'object' then
      return jsonb_build_object('ok', false, 'reason', 'completion_evidence_required');
    end if;

    select x.block->>'id'
    into v_final_block_id
    from jsonb_array_elements(
      case when jsonb_typeof(v_chapter.blocks) = 'array' then v_chapter.blocks else '[]'::jsonb end
    ) with ordinality as x(block, ord)
    where jsonb_typeof(x.block) = 'object'
      and nullif(btrim(coalesce(x.block->>'id', '')), '') is not null
    order by x.ord desc
    limit 1;

    v_position_block_id := nullif(btrim(coalesce(position_input->>'block_id', '')), '');

    if jsonb_typeof(position_input->'scroll_percent') = 'number' then
      v_position_scroll := (position_input->>'scroll_percent')::numeric;
    else
      v_position_scroll := null;
    end if;

    if v_final_block_id is null
       or v_position_block_id is distinct from v_final_block_id
       or v_position_scroll is null
       or v_position_scroll < v_completion_threshold then
      return jsonb_build_object('ok', false, 'reason', 'completion_evidence_required');
    end if;
  end if;

  select progress_percent into v_existing_percent
  from public.vibe_reading_progress
  where viewer_id = v_viewer_id
    and publication_id = publication_id_input
    and chapter_id = chapter_id_input;

  if reset_input then
    v_new_percent := v_clamped_percent;
  else
    v_new_percent := greatest(coalesce(v_existing_percent, 0), v_clamped_percent);
  end if;

  insert into public.vibe_reading_progress as vrp (
    viewer_id, publication_id, chapter_id, progress_percent, reading_position,
    started_at, last_read_at, completed_at, updated_at
  )
  values (
    v_viewer_id, publication_id_input, chapter_id_input, v_new_percent, position_input,
    now(), now(), case when v_new_percent >= v_completion_threshold then now() else null end, now()
  )
  on conflict (viewer_id, publication_id, chapter_id) do update
    set progress_percent = v_new_percent,
        reading_position = coalesce(position_input, vrp.reading_position),
        last_read_at = now(),
        completed_at = case
          when v_new_percent >= v_completion_threshold then coalesce(vrp.completed_at, now())
          when reset_input then null
          else vrp.completed_at
        end,
        updated_at = now()
  returning * into v_result;

  return jsonb_build_object(
    'ok', true,
    'progress_percent', v_result.progress_percent,
    'completed_at', v_result.completed_at,
    'last_read_at', v_result.last_read_at,
    'reading_position', v_result.reading_position
  );
end;
$function$;

revoke all on function public.record_reading_progress(uuid,uuid,integer,jsonb,boolean)
  from public, anon, authenticated;
grant execute on function public.record_reading_progress(uuid,uuid,integer,jsonb,boolean)
  to authenticated, service_role;

comment on function public.record_reading_progress(uuid,uuid,integer,jsonb,boolean) is
'Canonical VibeLearn progress writer. Uses can_viewer_read_chapter for access parity. Completion >=90% requires a validated final structured-block reading position.';

create or replace function public.get_public_vibetextbook_reader(publication_id_input uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_publication public.vibe_publications%rowtype;
  v_publication_payload jsonb;
  v_chapters jsonb;
begin
  select * into v_publication
  from public.vibe_publications
  where id = publication_id_input
    and format = 'vibetextbook'
    and status = 'published';

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  v_publication_payload := jsonb_build_object(
    'id', v_publication.id,
    'format', v_publication.format,
    'title', v_publication.title,
    'subtitle', v_publication.subtitle,
    'cover_url', v_publication.cover_url,
    'description', v_publication.description,
    'genre', v_publication.genre,
    'tags', v_publication.tags,
    'language', v_publication.language,
    'status', v_publication.status,
    'pricing', v_publication.pricing,
    'chapter_count', v_publication.chapter_count,
    'total_reads', v_publication.total_reads,
    'total_vibes', v_publication.total_vibes,
    'cbc_subject', v_publication.cbc_subject,
    'cbc_grade', v_publication.cbc_grade,
    'cbc_aligned', v_publication.cbc_aligned,
    'curriculum_framework', v_publication.curriculum_framework,
    'series_name', v_publication.series_name,
    'series_number', v_publication.series_number,
    'publication_name', v_publication.publication_name,
    'issue_number', v_publication.issue_number,
    'created_at', v_publication.created_at,
    'updated_at', v_publication.updated_at,
    'published_at', v_publication.published_at
  );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'publication_id', c.publication_id,
        'title', c.title,
        'number', c.number,
        'status', c.status,
        'word_count', c.word_count,
        'reading_time_min', c.reading_time_min,
        'published_at', c.published_at,
        'created_at', c.created_at,
        'updated_at', c.updated_at,
        'cbc_strand', c.cbc_strand,
        'can_read', public.can_viewer_read_chapter(c.id, null),
        'is_bookmarked', false,
        'progress_percent', 0,
        'completed_at', null,
        'last_read_at', null,
        'curriculum', jsonb_build_object(
          'framework', v_publication.curriculum_framework,
          'grade', v_publication.cbc_grade,
          'subject', v_publication.cbc_subject,
          'strand', c.cbc_strand,
          'sub_strand', null,
          'topic', null,
          'term', null,
          'week', null,
          'learning_outcomes', coalesce(c.learning_outcomes, '{}'),
          'key_inquiry_questions', '{}',
          'suggested_experiences', '{}',
          'core_competencies', '{}',
          'core_values', '{}',
          'source_ref', null,
          'alignment_status', c.alignment_status,
          'authority', case c.alignment_status
            when 'verified' then 'official'
            when 'creator_claimed' then 'publisher'
            when 'pending_review' then 'publisher'
            else null
          end,
          'verified_by', null,
          'verified_at', c.verified_at,
          'has_curriculum_detail',
            (c.cbc_strand is not null or coalesce(array_length(c.learning_outcomes, 1), 0) > 0)
        ),
        'blocks', case
          when public.can_viewer_read_chapter(c.id, null)
            then public.reader_sanitize_blocks(
              case when jsonb_typeof(c.blocks) = 'array' then c.blocks else '[]'::jsonb end
            )
          else null
        end
      )
      order by c.number
    ),
    '[]'::jsonb
  ) into v_chapters
  from public.vibe_chapters c
  where c.publication_id = v_publication.id
    and c.status in ('published', 'locked');

  return jsonb_build_object(
    'ok', true,
    'reason', null,
    'viewer_is_author', false,
    'author_name', 'Vibeschool Publisher',
    'publication', v_publication_payload,
    'chapters', v_chapters,
    'resume', null
  );
end;
$function$;

revoke all on function public.get_public_vibetextbook_reader(uuid)
  from public, anon, authenticated;
grant execute on function public.get_public_vibetextbook_reader(uuid)
  to anon, authenticated, service_role;

comment on function public.get_public_vibetextbook_reader(uuid) is
'Learner-safe public VibeTextbook preview. Uses canonical chapter authority and redacts answer keys from any readable block payload.';

commit;
