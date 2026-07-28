-- READ-004 — CBC curriculum identity in the canonical reader.
--
-- Adds a normalized 'curriculum' object to each chapter in
-- get_vibetextbook_reader's payload, resolved server-side from the
-- official curriculum tables (cbc_strands via sub_strand_id, curriculum
-- via curriculum_id), never queried directly by the client. Everything
-- else in the function is unchanged from the READ-002 (20260728120020)
-- version.
--
-- alignment_status is passed through verbatim (unclaimed / creator_claimed /
-- pending_review / verified / rejected) so the client can label honestly —
-- cbc_aligned=true on the publication must never be presented as
-- "verified" on its own; only vibe_chapters.alignment_status = 'verified'
-- means that.
--
-- Most chapters currently have no sub_strand_id/curriculum_id at all
-- (2 of 19 / 1 of 19 live) — has_curriculum_detail lets the client show
-- a minimal state instead of an empty panel.

create or replace function public.get_vibetextbook_reader(
  publication_id_input uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth
as $function$
declare
  publication_row public.vibe_publications%rowtype;
  current_user_id uuid := auth.uid();
  viewer_is_author boolean := false;
  pricing_type text;
  free_chapter_count integer := 0;
  author_display_name text;
  chapter_payload jsonb;
  resume_payload jsonb;
begin
  select *
  into publication_row
  from public.vibe_publications
  where id = publication_id_input;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'reason', 'not_found'
    );
  end if;

  if publication_row.format <> 'vibetextbook' then
    return jsonb_build_object(
      'ok', false,
      'reason', 'not_found'
    );
  end if;

  viewer_is_author :=
    current_user_id is not null
    and current_user_id = publication_row.author_id;

  if publication_row.status <> 'published'
     and not viewer_is_author then
    return jsonb_build_object(
      'ok', false,
      'reason', 'not_found'
    );
  end if;

  pricing_type :=
    coalesce(publication_row.pricing->>'type', 'free');

  free_chapter_count :=
    case
      when jsonb_typeof(publication_row.pricing->'freeChapters') = 'number'
      then greatest(
        0,
        (publication_row.pricing->>'freeChapters')::integer
      )
      else 0
    end;

  select coalesce(p.full_name, 'Anonymous')
  into author_display_name
  from public.profiles p
  where p.id = publication_row.author_id;

  author_display_name := coalesce(author_display_name, 'Anonymous');

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
        'learning_outcomes', c.learning_outcomes,
        'cbc_strand', c.cbc_strand,

        'can_read',
          case
            when viewer_is_author then true
            when pricing_type in ('free', 'donation')
              and c.status in ('published', 'locked')
              then true
            when pricing_type = 'freemium'
              and c.status in ('published', 'locked')
              and c.number <= free_chapter_count
              then true
            else false
          end,

        'progress_percent', coalesce(rp.progress_percent, 0),
        'completed_at', rp.completed_at,
        'last_read_at', rp.last_read_at,

        'curriculum', jsonb_build_object(
          'framework', publication_row.curriculum_framework,
          'grade', coalesce(cs.grade, cu.grade, publication_row.cbc_grade),
          'subject', coalesce(cu.subject, subj.name, publication_row.cbc_subject),
          'strand', coalesce(cs.name, cu.strand, c.cbc_strand),
          'sub_strand', coalesce(cs.sub_strand, cu.sub_strand),
          'topic', cu.topic,
          'term', coalesce(cs.term, cu.term),
          'week', coalesce(cs.week, cu.week),
          'learning_outcomes',
            case
              when c.learning_outcomes is not null and array_length(c.learning_outcomes, 1) > 0
              then c.learning_outcomes
              else coalesce(cs.learning_outcomes, '{}')
            end,
          'key_inquiry_questions', coalesce(cs.key_inquiry_questions, '{}'),
          'suggested_experiences', coalesce(cs.suggested_experiences, '{}'),
          'core_competencies', coalesce(cs.core_competencies, '{}'),
          'core_values', coalesce(cs.core_values, cs.values, '{}'),
          'source_ref', coalesce(cs.source_ref, cu.reference),
          'alignment_status', c.alignment_status,
          'verified_at', c.verified_at,
          'has_curriculum_detail',
            (cs.id is not null or cu.id is not null
              or (c.learning_outcomes is not null and array_length(c.learning_outcomes, 1) > 0))
        ),

        'blocks',
          case
            when viewer_is_author then
              case
                when jsonb_typeof(c.blocks) = 'array' then c.blocks
                else '[]'::jsonb
              end

            when pricing_type in ('free', 'donation')
              and c.status in ('published', 'locked')
              then
                case
                  when jsonb_typeof(c.blocks) = 'array' then c.blocks
                  else '[]'::jsonb
                end

            when pricing_type = 'freemium'
              and c.status in ('published', 'locked')
              and c.number <= free_chapter_count
              then
                case
                  when jsonb_typeof(c.blocks) = 'array' then c.blocks
                  else '[]'::jsonb
                end

            else null
          end
      )
      order by c.number asc
    ),
    '[]'::jsonb
  )
  into chapter_payload
  from public.vibe_chapters c
  left join public.vibe_reading_progress rp
    on rp.chapter_id = c.id
    and rp.publication_id = c.publication_id
    and rp.viewer_id = current_user_id
  left join public.cbc_strands cs
    on cs.id = c.sub_strand_id
  left join public.subjects subj
    on subj.id = cs.subject_id
  left join public.curriculum cu
    on cu.id = c.curriculum_id
  where c.publication_id = publication_row.id
    and (
      viewer_is_author
      or c.status in ('published', 'locked')
    );

  if current_user_id is not null then
    select jsonb_build_object(
      'chapter_id', rp.chapter_id,
      'progress_percent', rp.progress_percent,
      'last_read_at', rp.last_read_at
    )
    into resume_payload
    from public.vibe_reading_progress rp
    where rp.viewer_id = current_user_id
      and rp.publication_id = publication_row.id
    order by rp.last_read_at desc
    limit 1;
  else
    resume_payload := null;
  end if;

  return jsonb_build_object(
    'ok', true,
    'reason', null,
    'viewer_is_author', viewer_is_author,
    'author_name', author_display_name,
    'publication', to_jsonb(publication_row),
    'chapters', chapter_payload,
    'resume', resume_payload
  );
end;
$function$;

comment on function public.get_vibetextbook_reader(uuid) is
'Returns a VibeTextbook reader payload. Locked chapter blocks are omitted unless the viewer is allowed to read them. Each chapter includes progress_percent/completed_at/last_read_at (viewer-scoped) and a curriculum object resolved server-side from cbc_strands/curriculum (grade/subject/strand/sub_strand/topic/term/week/learning_outcomes/key_inquiry_questions/suggested_experiences/core_competencies/core_values/source_ref/alignment_status/verified_at/has_curriculum_detail). alignment_status is passed through verbatim — the client must not infer "verified" from cbc_aligned alone. Top-level resume is the viewer''s most-recently-read chapter, or null.';
