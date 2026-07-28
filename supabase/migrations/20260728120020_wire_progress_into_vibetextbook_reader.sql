-- READ-002 — wire reading progress into the canonical reader payload.
--
-- Adds, per chapter: progress_percent, completed_at, last_read_at (from
-- vibe_reading_progress, scoped to the calling viewer only — join key
-- includes viewer_id so anonymous/other-viewer rows never surface).
-- Adds a top-level 'resume' object: the viewer's most-recently-read
-- chapter for this publication, or null if signed out / no progress yet.
-- Everything else is unchanged from the 20260725090023 hardening version.

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
'Returns a VibeTextbook reader payload. Locked chapter blocks are omitted unless the viewer is allowed to read them. Each chapter includes the calling viewer''s progress_percent/completed_at/last_read_at (0/null when signed out or unread). Top-level resume is the viewer''s most-recently-read chapter, or null.';
