-- authorization-test: public.vibe_publications, public.vibe_chapters
-- General fiction is independent of the school-only academic release.
-- Preserve every existing restrictive policy, entitlement, and account state.
-- Owner-approved public reading for Taraji and the CPA companion only.
create or replace function public.post_secondary_publication_visible(p_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.post_secondary_public_enabled()
    or exists (
      select 1 from public.vibe_publications p
      where p.id = p_id
        and ((p.id = 'c0b2a83f-d726-4eed-812e-7d79f57497df'::uuid and p.genre = 'fiction')
          or (p.id = '51f1052d-2f59-46bb-9186-c1a7937d203a'::uuid and p.genre = 'self_help'))
        and p.format = 'ebook' and p.status = 'published'
        and p.publication_name = 'VibeSchool Originals'
        and 'VibeSchool Originals' = any(coalesce(p.tags, ARRAY[]::text[]))
        and not coalesce(p.cbc_aligned,false)
        and nullif(btrim(coalesce(p.cbc_grade,'')), '') is null
        and nullif(btrim(coalesce(p.cbc_subject,'')), '') is null
        and p.pricing->>'type' = 'free'
    )
    or (p_id is distinct from '51f1052d-2f59-46bb-9186-c1a7937d203a'::uuid
        and p_id is distinct from 'c0b2a83f-d726-4eed-812e-7d79f57497df'::uuid
        and not exists (
          select 1 from public.vibe_publications p where p.id=p_id and (
            lower(btrim(coalesce(p.cbc_grade,''))) in ('college','university','professional studies','tvet','post-secondary','post_secondary','certificate','diploma','higher diploma','undergraduate','postgraduate','cpa','cs')
            or exists (select 1 from unnest(coalesce(p.tags, ARRAY[]::text[])) tag
              where lower(btrim(tag)) in ('cpa','kasneb','kasneb cpa','kasneb cs','certified public accountants','certified secretaries','post-secondary','post_secondary','professional studies','college','university','tvet'))
          )
        ));
$$;
revoke all on function public.post_secondary_publication_visible(uuid) from public;
grant execute on function public.post_secondary_publication_visible(uuid) to anon, authenticated, service_role;
comment on function public.post_secondary_publication_visible(uuid) is 'Visibility intersection only; both approved free Originals books are general reading; CPA academic content stays muted. Never grants entitlement.';

do $$ begin
  if public.post_secondary_public_enabled() then raise exception 'Academic mute must remain enabled'; end if;
  if not public.post_secondary_publication_visible('c0b2a83f-d726-4eed-812e-7d79f57497df') or not public.post_secondary_publication_visible('51f1052d-2f59-46bb-9186-c1a7937d203a') then raise exception 'Approved Originals must be visible'; end if;
end $$;
