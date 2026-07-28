-- Bug found by actually executing the function (simulated non-owner
-- session), not by inspection: `where content_id = increment_view_count.content_id`
-- was ambiguous — vibelearn_content_views.content_id (table column) vs
-- the function's own `content_id` parameter, both visible as bare
-- identifiers in the same scope. Postgres correctly rejected it with
-- 42702. This has been live and silently failing since the earlier
-- migration this session (harden_increment_view_count_and_trigger_fn_grants)
-- — the client never checks the RPC's error response, so view_count has
-- never actually incremented for any authenticated viewer since then.

create or replace function public.increment_view_count(content_id uuid, viewer_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  effective_viewer_id uuid := auth.uid();
  already_viewed boolean := false;
  target_content_id uuid := increment_view_count.content_id;
begin
  if effective_viewer_id is not null then
    select exists(
      select 1
      from public.vibelearn_content_views v
      where v.content_id = target_content_id
        and v.viewer_id = effective_viewer_id
        and v.viewed_at > now() - interval '24 hours'
    ) into already_viewed;

    if already_viewed then
      return;
    end if;

    insert into public.vibelearn_content_views(content_id, viewer_id, viewed_at)
    values (target_content_id, effective_viewer_id, now())
    on conflict do nothing;
  end if;

  update public.vibelearn_content
  set view_count = view_count + 1
  where id = target_content_id;
end;
$function$;

comment on function public.increment_view_count(uuid, uuid) is
'Viewer derived from auth.uid() internally, not trusted from the caller-supplied parameter. Fixed 2026-07-25: table/parameter column-name collision (content_id, viewer_id) made the dedup subquery ambiguous and errored on every authenticated call — now uses an unambiguous local variable and a table alias.';
