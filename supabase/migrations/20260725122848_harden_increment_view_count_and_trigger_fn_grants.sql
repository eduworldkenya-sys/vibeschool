-- Two fixes, both directly related to today's VibeTextbook bridge work
-- (both operate on vibelearn_content, which textbook rows now live in
-- and whose view_count feeds the same flat view_count*5 earnings trigger).

-- 1. increment_view_count — both overloads trusted a client-supplied
--    viewer_id instead of deriving it from auth.uid(), same class of bug
--    already fixed once this session in increment_publication_reads.
--    No app-code changes needed: all 4 existing call sites
--    (VibeLearnShellWrapper x2, global/read/[id], global/dashboard) keep
--    their exact same signatures — the client-supplied viewer_id becomes
--    advisory/ignored, auth.uid() is now authoritative.
--
--    Single-arg overload previously had ZERO dedup despite a misleading
--    comment at its only call site claiming "deduped 24h via RPC" — it
--    now delegates to the same logic as the two-arg version.
--
--    Known remaining limitation: anonymous callers (auth.uid() is null)
--    still get no dedup and can still repeatedly increment view_count.
--    Same accepted tradeoff as increment_publication_reads. Closing this
--    needs a trusted anonymous identifier (session token / fingerprint)
--    or moving counting behind a server endpoint — not done here.

create or replace function public.increment_view_count(content_id uuid, viewer_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  effective_viewer_id uuid := auth.uid();
  already_viewed boolean := false;
begin
  if effective_viewer_id is not null then
    select exists(
      select 1 from public.vibelearn_content_views
      where content_id = increment_view_count.content_id
        and viewer_id = effective_viewer_id
        and viewed_at > now() - interval '24 hours'
    ) into already_viewed;

    if already_viewed then return; end if;

    insert into public.vibelearn_content_views(content_id, viewer_id, viewed_at)
    values (increment_view_count.content_id, effective_viewer_id, now())
    on conflict do nothing;
  end if;

  update public.vibelearn_content
  set view_count = view_count + 1
  where id = increment_view_count.content_id;
end;
$function$;

create or replace function public.increment_view_count(content_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $function$
begin
  perform public.increment_view_count(increment_view_count.content_id, null::uuid);
end;
$function$;

comment on function public.increment_view_count(uuid, uuid) is
'Viewer is derived from auth.uid() internally, not trusted from the caller-supplied parameter (same fix pattern as increment_publication_reads). Anonymous calls skip dedup, same known/accepted limitation as increment_publication_reads.';
comment on function public.increment_view_count(uuid) is
'Delegates to the two-arg overload with auth.uid() derived internally. Previously had zero dedup logic despite a call-site comment claiming otherwise.';

-- 2. sync_vibelearn_from_publication — trigger-only function (returns
--    trigger), confirmed live via trg_sync_vibelearn_from_publication
--    (AFTER UPDATE OF title, description, status ON vibe_publications).
--    Direct anon/authenticated/PUBLIC execute grants are inert (trigger
--    functions cannot be invoked directly via PostgREST/RPC) but should
--    not exist for hygiene. Revoking does not affect the trigger, which
--    invokes the function through a completely separate mechanism.
revoke all on function public.sync_vibelearn_from_publication() from anon, authenticated, public;
