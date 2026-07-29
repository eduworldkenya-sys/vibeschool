create or replace function public.record_reading_activity(
  p_chapter_id uuid,
  p_client_session_id uuid,
  p_event text,
  p_active_seconds integer default 0,
  p_progress_percent integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_viewer uuid := auth.uid();
  v_publication_id uuid;
  v_session public.vibe_reading_sessions%rowtype;
  v_seconds integer := greatest(0, least(coalesce(p_active_seconds, 0), 300));
  v_progress integer := greatest(0, least(coalesce(p_progress_percent, 0), 100));
begin
  if v_viewer is null then
    return jsonb_build_object('ok', false, 'reason', 'auth_required');
  end if;
  if p_client_session_id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_session');
  end if;
  if p_event not in ('start','heartbeat','completed','chapter_change','page_hide','reader_close') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_event');
  end if;

  select publication_id into v_publication_id
  from public.vibe_chapters
  where id = p_chapter_id;

  if v_publication_id is null then
    return jsonb_build_object('ok', false, 'reason', 'chapter_not_found');
  end if;
  if not public.can_viewer_read_chapter(p_chapter_id, v_viewer) then
    return jsonb_build_object('ok', false, 'reason', 'not_entitled');
  end if;

  insert into public.vibe_reading_sessions(
    viewer_id, publication_id, chapter_id, client_session_id,
    active_seconds, max_progress_percent, completed_at, ended_at, end_reason
  ) values (
    v_viewer, v_publication_id, p_chapter_id, p_client_session_id,
    v_seconds, v_progress,
    case when p_event = 'completed' or v_progress >= 90 then now() else null end,
    case when p_event in ('completed','chapter_change','page_hide','reader_close') then now() else null end,
    case when p_event in ('completed','chapter_change','page_hide','reader_close') then p_event else null end
  )
  on conflict (viewer_id, client_session_id) do update set
    last_active_at = now(),
    active_seconds = public.vibe_reading_sessions.active_seconds + v_seconds,
    max_progress_percent = greatest(public.vibe_reading_sessions.max_progress_percent, v_progress),
    completed_at = coalesce(
      public.vibe_reading_sessions.completed_at,
      case when p_event = 'completed' or v_progress >= 90 then now() else null end
    ),
    ended_at = case
      when p_event in ('completed','chapter_change','page_hide','reader_close') then now()
      else public.vibe_reading_sessions.ended_at
    end,
    end_reason = case
      when p_event in ('completed','chapter_change','page_hide','reader_close') then p_event
      else public.vibe_reading_sessions.end_reason
    end,
    updated_at = now()
  returning * into v_session;

  return jsonb_build_object(
    'ok', true,
    'session_id', v_session.id,
    'active_seconds', v_session.active_seconds,
    'max_progress_percent', v_session.max_progress_percent,
    'completed', v_session.completed_at is not null
  );
end;
$$;

revoke all on function public.record_reading_activity(uuid,uuid,text,integer,integer)
  from public, anon;
grant execute on function public.record_reading_activity(uuid,uuid,text,integer,integer)
  to authenticated;
