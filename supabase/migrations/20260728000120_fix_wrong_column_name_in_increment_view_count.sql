-- Second bug found by the same execution test: vibelearn_content_views
-- has a column named student_id, not viewer_id (verified directly against
-- information_schema.columns, not assumed from memory — that assumption
-- is exactly what caused this). Both the dedup SELECT and the INSERT
-- were referencing the wrong column name.

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
        and v.student_id = effective_viewer_id
        and v.viewed_at > now() - interval '24 hours'
    ) into already_viewed;

    if already_viewed then
      return;
    end if;

    insert into public.vibelearn_content_views(content_id, student_id, viewed_at)
    values (target_content_id, effective_viewer_id, now())
    on conflict do nothing;
  end if;

  update public.vibelearn_content
  set view_count = view_count + 1
  where id = target_content_id;
end;
$function$;

comment on function public.increment_view_count(uuid, uuid) is
'Viewer derived from auth.uid() internally, not trusted from the caller-supplied parameter. Fixed 2026-07-25 (two rounds): (1) ambiguous content_id column/parameter name collision, (2) wrong column name viewer_id vs actual student_id on vibelearn_content_views. Both found by actually executing the function under a simulated non-owner session, not by inspection.';
