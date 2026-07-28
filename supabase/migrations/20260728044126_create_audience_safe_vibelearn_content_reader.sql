-- Audience-safe reader RPC for vibelearn_content (Learning Page/Ebook).
-- Confirmed live, active leak: a real student-role account (verified via
-- profiles.role = 'student') can currently SELECT any live row directly
-- and receive the FULL body, including [TEACHER_ONLY]-style content —
-- vibelearn_content_read policy only checks auth.uid() IS NOT NULL, no
-- role check. This RPC strips teacher-only content server-side, before
-- it ever leaves Postgres — same principle already used correctly in
-- get_vibetextbook_reader for locked chapter blocks.
--
-- Marker convention: [TEACHER_ONLY] ... [/TEACHER_ONLY] within body.
-- Everything between (inclusive of the markers) is removed entirely for
-- viewers who are not the author and not role teacher/admin.
--
-- Preserves the existing draft-guard behavior from the client-side fix
-- (non-author + non-live = not found) — this RPC now supersedes that
-- client-side check; app/global/read/[id]/page.tsx should stop selecting
-- vibelearn_content directly and call this RPC instead.

create or replace function public.get_vibelearn_content_reader(content_id_input uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth
as $function$
declare
  row_data           public.vibelearn_content%rowtype;
  viewer_id          uuid := auth.uid();
  viewer_role        text;
  viewer_is_author    boolean := false;
  can_see_teacher_content boolean := false;
  safe_body          text;
  had_teacher_content boolean := false;
begin
  select * into row_data
  from public.vibelearn_content
  where id = content_id_input;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  viewer_is_author := viewer_id is not null and viewer_id = row_data.submitted_by;

  if row_data.status <> 'live' and not viewer_is_author then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  select role into viewer_role
  from public.profiles
  where id = viewer_id;

  can_see_teacher_content :=
    viewer_is_author
    or viewer_role in ('teacher', 'admin');

  had_teacher_content :=
    row_data.body is not null
    and row_data.body ~ '\[TEACHER_ONLY\]';

  if can_see_teacher_content or row_data.body is null then
    safe_body := row_data.body;
  else
    safe_body := regexp_replace(
      row_data.body,
      '\[TEACHER_ONLY\].*?\[/TEACHER_ONLY\]',
      '',
      'gs'
    );

    -- Collapse blank-line runs left after restricted sections are removed.
    safe_body := regexp_replace(
      safe_body,
      '\n{3,}',
      E'\n\n',
      'g'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', row_data.id,
    'title', row_data.title,
    'description', row_data.description,
    'body', safe_body,
    'type', row_data.type,
    'source', row_data.source,
    'url', row_data.url,
    'tags', row_data.tags,
    'status', row_data.status,
    'view_count', row_data.view_count,
    'earnings_ksh', row_data.earnings_ksh,
    'created_at', row_data.created_at,
    'submitted_by', row_data.submitted_by,
    'viewer_is_author', viewer_is_author,
    'teacher_content_redacted',
      had_teacher_content and not can_see_teacher_content
  );
end;
$function$;

grant execute
on function public.get_vibelearn_content_reader(uuid)
to authenticated;

comment on function public.get_vibelearn_content_reader(uuid) is
'Audience-safe reader for vibelearn_content. Strips [TEACHER_ONLY]...[/TEACHER_ONLY] marked sections from body for viewers who are not the author and not role teacher/admin. Never sends restricted text to the client — filtering happens before the response leaves Postgres.';
