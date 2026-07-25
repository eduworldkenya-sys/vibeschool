-- ============================================================================
-- VIBETEXTBOOK READER HARDENING
--
-- Security model:
--   * vibe_publications remains the publication source of truth.
--   * Public clients no longer select locked chapter rows directly.
--   * get_vibetextbook_reader(uuid) returns:
--       - publication metadata when access is allowed
--       - chapter metadata for visible chapters
--       - chapter blocks only when the viewer may read the chapter
--   * Draft and archived publications are author-only.
--   * Paid and school-license content stays locked until a real entitlement
--     system is introduced.
--
-- Commercial interpretation used by this migration:
--   free            -> published/locked chapters readable
--   donation        -> published/locked chapters readable
--   freemium        -> first pricing.freeChapters readable
--   paid            -> author only until entitlement exists
--   school_license  -> author only until entitlement exists
-- ============================================================================

begin;

-- --------------------------------------------------------------------------
-- 1. Stop exposing locked chapter bodies through direct browser SELECT.
--
-- The previous policy allowed both published and locked chapter rows to be
-- selected by anyone whenever the parent publication was published. Because
-- blocks are stored on the same row, the full paid content was downloadable.
-- --------------------------------------------------------------------------

drop policy if exists
  "vibe_chapters_public_read_published_or_locked"
  on public.vibe_chapters;

drop policy if exists
  "vibe_chapters_public_read_published"
  on public.vibe_chapters;

create policy "vibe_chapters_public_read_published"
  on public.vibe_chapters
  for select
  using (
    status = 'published'
    and exists (
      select 1
      from public.vibe_publications p
      where p.id = vibe_chapters.publication_id
        and p.status = 'published'
    )
  );

-- --------------------------------------------------------------------------
-- 2. Canonical textbook reader RPC.
--
-- SECURITY DEFINER is deliberate: it can inspect chapter rows that RLS does
-- not expose publicly, but it releases blocks only after applying the reader
-- access rules below.
-- --------------------------------------------------------------------------

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
  where c.publication_id = publication_row.id
    and (
      viewer_is_author
      or c.status in ('published', 'locked')
    );

  return jsonb_build_object(
    'ok', true,
    'reason', null,
    'viewer_is_author', viewer_is_author,
    'author_name', author_display_name,
    'publication', to_jsonb(publication_row),
    'chapters', chapter_payload
  );
end;
$function$;

revoke all
  on function public.get_vibetextbook_reader(uuid)
  from public;

grant execute
  on function public.get_vibetextbook_reader(uuid)
  to anon, authenticated;

comment on function public.get_vibetextbook_reader(uuid) is
'Returns a VibeTextbook reader payload. Locked chapter blocks are omitted unless the viewer is allowed to read them.';

-- --------------------------------------------------------------------------
-- 3. Harden read counting.
--
-- The existing function accepts viewer_id for backward compatibility, but
-- authenticated identity is always derived from auth.uid(). This prevents a
-- signed-in caller from spoofing another user ID to defeat deduplication.
-- Anonymous requests still rely on the browser session guard because there
-- is no stable anonymous identity stored in the database.
-- --------------------------------------------------------------------------

create or replace function public.increment_publication_reads(
  pub_id uuid,
  viewer_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  effective_viewer_id uuid := auth.uid();
begin
  if not exists (
    select 1
    from public.vibe_publications p
    where p.id = pub_id
      and p.status = 'published'
  ) then
    return;
  end if;

  if effective_viewer_id is not null
     and exists (
       select 1
       from public.vibe_publication_views v
       where v.publication_id = pub_id
         and v.viewer_id = effective_viewer_id
         and v.viewed_at > now() - interval '24 hours'
     ) then
    return;
  end if;

  insert into public.vibe_publication_views (
    publication_id,
    viewer_id
  )
  values (
    pub_id,
    effective_viewer_id
  );

  update public.vibe_publications
  set total_reads = coalesce(total_reads, 0) + 1
  where id = pub_id;
end;
$function$;

revoke all
  on function public.increment_publication_reads(uuid, uuid)
  from public;

grant execute
  on function public.increment_publication_reads(uuid, uuid)
  to anon, authenticated;

commit;

-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================================

-- Function exists and is SECURITY DEFINER.
select
  p.proname,
  p.prosecdef,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'get_vibetextbook_reader',
    'increment_publication_reads'
  );

-- Locked chapters must no longer be included in a public direct-read policy.
select
  policyname,
  cmd,
  qual
from pg_policies
where schemaname = 'public'
  and tablename = 'vibe_chapters'
order by policyname;

-- Test with a real published VibeTextbook ID:
--
-- select jsonb_pretty(
--   public.get_vibetextbook_reader(
--     'REPLACE-WITH-PUBLICATION-UUID'::uuid
--   )
-- );
