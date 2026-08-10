begin;

-- Issue #41: separate the least-privilege anonymous reader from the
-- authenticated entitlement/author-preview reader.
--
-- Anonymous contract:
--   * only published VibeTextbooks;
--   * only chapter rows already visible to anon through RLS;
--   * blocks only for free/donation chapters or the configured freemium sample;
--   * no identity, progress, bookmark, entitlement, derivative, answer-key,
--     moderation, revenue, or author-private fields.
--
-- Authenticated contract:
--   * retains author draft preview, entitlements, progress and bookmarks;
--   * remains SECURITY DEFINER because those checks need rows hidden by RLS;
--   * is no longer executable by anon;
--   * serializes an explicit publication allowlist instead of the whole row.

create or replace function public.get_public_vibetextbook_reader(
  publication_id_input uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  publication_payload jsonb;
  publication_pricing jsonb;
  chapter_payload jsonb;
  pricing_type text;
  free_chapter_count integer := 0;
begin
  select
    jsonb_build_object(
      'id', p.id,
      'format', p.format,
      'title', p.title,
      'subtitle', p.subtitle,
      'cover_url', p.cover_url,
      'description', p.description,
      'genre', p.genre,
      'tags', p.tags,
      'language', p.language,
      'status', p.status,
      'pricing', p.pricing,
      'chapter_count', p.chapter_count,
      'total_reads', p.total_reads,
      'total_vibes', p.total_vibes,
      'cbc_subject', p.cbc_subject,
      'cbc_grade', p.cbc_grade,
      'cbc_aligned', p.cbc_aligned,
      'curriculum_framework', p.curriculum_framework,
      'series_name', p.series_name,
      'series_number', p.series_number,
      'publication_name', p.publication_name,
      'issue_number', p.issue_number,
      'created_at', p.created_at,
      'updated_at', p.updated_at,
      'published_at', p.published_at
    ),
    p.pricing
  into publication_payload, publication_pricing
  from public.vibe_publications p
  where p.id = publication_id_input
    and p.format = 'vibetextbook'
    and p.status = 'published';

  if publication_payload is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  pricing_type := coalesce(publication_pricing->>'type', 'free');
  free_chapter_count :=
    case
      when jsonb_typeof(publication_pricing->'freeChapters') = 'number'
      then greatest(0, (publication_pricing->>'freeChapters')::integer)
      else 0
    end;

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
        'can_read',
          case
            when pricing_type in ('free', 'donation') then true
            when pricing_type = 'freemium'
              and c.number <= free_chapter_count then true
            else false
          end,
        'is_bookmarked', false,
        'progress_percent', 0,
        'completed_at', null,
        'last_read_at', null,
        'curriculum', jsonb_build_object(
          'framework', publication_payload->>'curriculum_framework',
          'grade', publication_payload->>'cbc_grade',
          'subject', publication_payload->>'cbc_subject',
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
          'authority',
            case c.alignment_status
              when 'verified' then 'official'
              when 'creator_claimed' then 'publisher'
              when 'pending_review' then 'publisher'
              else null
            end,
          'verified_by', null,
          'verified_at', c.verified_at,
          'has_curriculum_detail',
            (
              c.cbc_strand is not null
              or coalesce(array_length(c.learning_outcomes, 1), 0) > 0
            )
        ),
        'blocks',
          case
            when pricing_type in ('free', 'donation')
              or (
                pricing_type = 'freemium'
                and c.number <= free_chapter_count
              )
            then
              case
                when jsonb_typeof(c.blocks) = 'array' then c.blocks
                else '[]'::jsonb
              end
            else null
          end
      )
      order by c.number
    ),
    '[]'::jsonb
  )
  into chapter_payload
  from public.vibe_chapters c
  where c.publication_id = publication_id_input
    and c.status = 'published';

  return jsonb_build_object(
    'ok', true,
    'reason', null,
    'viewer_is_author', false,
    'author_name', 'Vibeschool Publisher',
    'publication', publication_payload,
    'chapters', chapter_payload,
    'resume', null
  );
end;
$function$;

revoke all on function public.get_public_vibetextbook_reader(uuid)
  from public, anon, authenticated;
grant execute on function public.get_public_vibetextbook_reader(uuid)
  to anon, authenticated, service_role;

create or replace function public.get_vibetextbook_reader(
  publication_id_input uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  publication_row public.vibe_publications%rowtype;
  publication_payload jsonb;
  current_user_id uuid := auth.uid();
  viewer_is_author boolean := false;
  author_display_name text;
  chapter_payload jsonb;
  resume_payload jsonb;
begin
  if current_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_required');
  end if;

  select *
  into publication_row
  from public.vibe_publications
  where id = publication_id_input;

  if not found or publication_row.format <> 'vibetextbook' then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  viewer_is_author := current_user_id = publication_row.author_id;

  if publication_row.status <> 'published' and not viewer_is_author then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  publication_payload := jsonb_build_object(
    'id', publication_row.id,
    'format', publication_row.format,
    'title', publication_row.title,
    'subtitle', publication_row.subtitle,
    'cover_url', publication_row.cover_url,
    'description', publication_row.description,
    'genre', publication_row.genre,
    'tags', publication_row.tags,
    'language', publication_row.language,
    'status', publication_row.status,
    'pricing', publication_row.pricing,
    'chapter_count', publication_row.chapter_count,
    'total_reads', publication_row.total_reads,
    'total_vibes', publication_row.total_vibes,
    'cbc_subject', publication_row.cbc_subject,
    'cbc_grade', publication_row.cbc_grade,
    'cbc_aligned', publication_row.cbc_aligned,
    'curriculum_framework', publication_row.curriculum_framework,
    'series_name', publication_row.series_name,
    'series_number', publication_row.series_number,
    'publication_name', publication_row.publication_name,
    'issue_number', publication_row.issue_number,
    'created_at', publication_row.created_at,
    'updated_at', publication_row.updated_at,
    'published_at', publication_row.published_at
  );

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
        'cbc_strand', c.cbc_strand,
        'can_read', ent.can_read,
        'is_bookmarked', wi.id is not null,
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
              when c.learning_outcomes is not null
                and coalesce(array_length(c.learning_outcomes, 1), 0) > 0
              then c.learning_outcomes
              else coalesce(cs.learning_outcomes, '{}')
            end,
          'key_inquiry_questions', coalesce(cs.key_inquiry_questions, '{}'),
          'suggested_experiences', coalesce(cs.suggested_experiences, '{}'),
          'core_competencies', coalesce(cs.core_competencies, '{}'),
          'core_values', coalesce(cs.core_values, cs.values, '{}'),
          'source_ref', coalesce(cs.source_ref, cu.reference),
          'alignment_status', c.alignment_status,
          'authority',
            case c.alignment_status
              when 'verified' then 'official'
              when 'creator_claimed' then 'publisher'
              when 'pending_review' then 'publisher'
              else null
            end,
          'verified_by', c.verified_by,
          'verified_at', c.verified_at,
          'has_curriculum_detail',
            (
              cs.id is not null
              or cu.id is not null
              or coalesce(array_length(c.learning_outcomes, 1), 0) > 0
            )
        ),
        'blocks',
          case
            when ent.can_read then
              case
                when jsonb_typeof(c.blocks) = 'array' then c.blocks
                else '[]'::jsonb
              end
            else null
          end
      )
      order by c.number
    ),
    '[]'::jsonb
  )
  into chapter_payload
  from public.vibe_chapters c
  left join public.vibe_reading_progress rp
    on rp.chapter_id = c.id
    and rp.publication_id = c.publication_id
    and rp.viewer_id = current_user_id
  left join public.vibe_workspace_items wi
    on wi.chapter_id = c.id
    and wi.publication_id = c.publication_id
    and wi.viewer_id = current_user_id
    and wi.item_type = 'bookmark'
  left join public.cbc_strands cs on cs.id = c.sub_strand_id
  left join public.subjects subj on subj.id = cs.subject_id
  left join public.curriculum cu on cu.id = c.curriculum_id
  left join lateral (
    select public.can_viewer_read_chapter(c.id, current_user_id) as can_read
  ) ent on true
  where c.publication_id = publication_row.id
    and (viewer_is_author or c.status in ('published', 'locked'));

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

  return jsonb_build_object(
    'ok', true,
    'reason', null,
    'viewer_is_author', viewer_is_author,
    'author_name', author_display_name,
    'publication', publication_payload,
    'chapters', chapter_payload,
    'resume', resume_payload
  );
end;
$function$;

revoke all on function public.get_vibetextbook_reader(uuid)
  from public, anon, authenticated;
grant execute on function public.get_vibetextbook_reader(uuid)
  to authenticated, service_role;

comment on function public.get_public_vibetextbook_reader(uuid) is
'Least-privilege SECURITY INVOKER reader for signed-out visitors. Returns only published learner-safe content visible through RLS.';

comment on function public.get_vibetextbook_reader(uuid) is
'Authenticated reader for entitlement checks, caller-scoped progress/bookmarks, and author preview. Not executable by anon. Publication fields are explicitly allowlisted; derivatives and answer keys are not joined.';

commit;
