-- READ-002 — secure progress-write RPC.
--
-- viewer_id is always derived from auth.uid(), never accepted from the
-- client. Anonymous callers are rejected. Entitlement is re-checked here
-- (same free/donation/freemium rule as get_vibetextbook_reader) so a
-- viewer cannot record progress on a chapter they aren't allowed to read.
-- Progress is monotonic (GREATEST of existing vs incoming) unless
-- reset_input is true. completed_at is server-derived at a 90% threshold,
-- never trusted from the client. Upsert on (viewer_id, publication_id,
-- chapter_id) is idempotent.

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
set search_path = public, auth
as $function$
declare
  v_viewer_id             uuid := auth.uid();
  v_chapter                public.vibe_chapters%rowtype;
  v_publication             public.vibe_publications%rowtype;
  v_viewer_is_author       boolean := false;
  v_pricing_type           text;
  v_free_chapter_count     integer := 0;
  v_can_read               boolean := false;
  v_clamped_percent        integer;
  v_existing_percent       integer;
  v_new_percent            integer;
  v_completion_threshold constant integer := 90;
  v_result                 public.vibe_reading_progress%rowtype;
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

  v_clamped_percent := greatest(0, least(100, progress_percent_input));

  select * into v_chapter
  from public.vibe_chapters
  where id = chapter_id_input;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'chapter_not_found');
  end if;

  if v_chapter.publication_id <> publication_id_input then
    return jsonb_build_object('ok', false, 'reason', 'chapter_publication_mismatch');
  end if;

  select * into v_publication
  from public.vibe_publications
  where id = publication_id_input;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'publication_not_found');
  end if;

  v_viewer_is_author := v_viewer_id = v_publication.author_id;

  if v_publication.status <> 'published' and not v_viewer_is_author then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  v_pricing_type := coalesce(v_publication.pricing->>'type', 'free');

  v_free_chapter_count := case
    when jsonb_typeof(v_publication.pricing->'freeChapters') = 'number'
    then greatest(0, (v_publication.pricing->>'freeChapters')::integer)
    else 0
  end;

  v_can_read :=
    v_viewer_is_author
    or (
      v_pricing_type in ('free', 'donation')
      and v_chapter.status in ('published', 'locked')
    )
    or (
      v_pricing_type = 'freemium'
      and v_chapter.status in ('published', 'locked')
      and v_chapter.number <= v_free_chapter_count
    );

  if not v_can_read then
    return jsonb_build_object('ok', false, 'reason', 'not_entitled');
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
    viewer_id, publication_id, chapter_id,
    progress_percent, reading_position,
    started_at, last_read_at, completed_at, updated_at
  )
  values (
    v_viewer_id, publication_id_input, chapter_id_input,
    v_new_percent, position_input,
    now(), now(),
    case when v_new_percent >= v_completion_threshold then now() else null end,
    now()
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
    'last_read_at', v_result.last_read_at
  );
end;
$function$;

revoke all on function public.record_reading_progress(uuid, uuid, integer, jsonb, boolean) from public;
grant execute on function public.record_reading_progress(uuid, uuid, integer, jsonb, boolean) to authenticated;

comment on function public.record_reading_progress(uuid, uuid, integer, jsonb, boolean) is
'Records/updates the authenticated viewer''s reading progress for one chapter. Derives viewer_id from auth.uid(); rejects anonymous callers and viewers without entitlement to the chapter (same rule as get_vibetextbook_reader). Progress is monotonic unless reset_input is true. completed_at is server-derived at the 90%% threshold.';
