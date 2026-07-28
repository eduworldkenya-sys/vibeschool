-- READ-003 — Continue Reading shelf RPC.
--
-- Returns the viewer's most-recently-touched VibeTextbooks, one row per
-- publication (most recent chapter only), newest first. Built entirely
-- on top of READ-002's vibe_reading_progress — no new writes, no legacy
-- vibelearn_* tables involved.
--
-- Re-checks entitlement per row (same free/donation/freemium rule as
-- get_vibetextbook_reader / record_reading_progress): if a chapter the
-- viewer was reading is no longer covered by the publication's current
-- pricing, it silently drops off the shelf instead of resuming into a
-- chapter that would now be blocked.
--
-- "completed" is publication-level: true only when the viewer has a
-- completed_at on every chapter currently in the publication's readable
-- set (published/locked). Adding a new chapter later correctly flips a
-- previously "completed" textbook back to incomplete.
--
-- Anonymous callers get an empty list, not an error (no progress rows
-- can exist for them).

create or replace function public.get_continue_reading(
  limit_input integer default 10
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth
as $function$
declare
  v_viewer_id uuid := auth.uid();
  v_limit     integer;
  v_result    jsonb;
begin
  if v_viewer_id is null then
    return jsonb_build_object('ok', true, 'items', '[]'::jsonb);
  end if;

  v_limit := greatest(1, least(50, coalesce(limit_input, 10)));

  with latest_progress as (
    select distinct on (rp.publication_id)
      rp.publication_id,
      rp.chapter_id,
      rp.progress_percent,
      rp.last_read_at,
      rp.completed_at
    from public.vibe_reading_progress rp
    where rp.viewer_id = v_viewer_id
    order by rp.publication_id, rp.last_read_at desc
  ),
  chapter_counts as (
    select
      c.publication_id,
      count(*) filter (where c.status in ('published', 'locked')) as total_chapters
    from public.vibe_chapters c
    group by c.publication_id
  ),
  completed_counts as (
    select
      rp.publication_id,
      count(*) filter (where rp.completed_at is not null) as completed_chapters
    from public.vibe_reading_progress rp
    where rp.viewer_id = v_viewer_id
    group by rp.publication_id
  ),
  ranked as (
    select
      p.id as publication_id,
      p.title,
      p.cover_url,
      p.cbc_subject,
      p.cbc_grade,
      lp.chapter_id as current_chapter_id,
      ch.number as current_chapter_number,
      ch.title as current_chapter_title,
      lp.progress_percent,
      lp.last_read_at,
      (
        coalesce(cc.completed_chapters, 0) > 0
        and coalesce(cc.completed_chapters, 0) >= coalesce(chc.total_chapters, 0)
      ) as completed
    from latest_progress lp
    join public.vibe_publications p on p.id = lp.publication_id
    join public.vibe_chapters ch on ch.id = lp.chapter_id
    left join chapter_counts chc on chc.publication_id = lp.publication_id
    left join completed_counts cc on cc.publication_id = lp.publication_id
    where p.status = 'published'
      and p.format = 'vibetextbook'
      and (
        coalesce(p.pricing->>'type', 'free') in ('free', 'donation')
        or (
          coalesce(p.pricing->>'type', 'free') = 'freemium'
          and ch.number <= greatest(
            0,
            case
              when jsonb_typeof(p.pricing->'freeChapters') = 'number'
              then (p.pricing->>'freeChapters')::integer
              else 0
            end
          )
        )
        or p.author_id = v_viewer_id
      )
    order by lp.last_read_at desc
    limit v_limit
  )
  select coalesce(
    jsonb_agg(to_jsonb(ranked.*) order by ranked.last_read_at desc),
    '[]'::jsonb
  )
  into v_result
  from ranked;

  return jsonb_build_object('ok', true, 'items', v_result);
end;
$function$;

revoke all on function public.get_continue_reading(integer) from public;
grant execute on function public.get_continue_reading(integer) to anon, authenticated;

comment on function public.get_continue_reading(integer) is
'Returns the viewer''s most-recently-read VibeTextbooks (one row per publication, newest chapter progress first) for the Continue Reading shelf. Entitlement-rechecked per row; anonymous callers get an empty list.';
