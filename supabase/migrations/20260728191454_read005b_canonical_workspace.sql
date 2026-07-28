-- READ-005B
-- Canonical learner study-workspace authority.
--
-- Live Supabase was written before repository parity was completed.
-- This migration is deliberately convergent:
-- - creates missing objects;
-- - removes duplicate indexes/constraints produced by interrupted runs;
-- - recreates the canonical RPC definitions;
-- - normalizes grants and RLS.

create table if not exists public.vibe_workspace_items (
  id uuid primary key default gen_random_uuid(),

  -- auth.uid() = profiles.id is the canonical reader identity.
  viewer_id uuid not null
    references public.profiles(id)
    on delete cascade,

  item_type text not null
    check (
      item_type in (
        'publication_save',
        'bookmark',
        'highlight',
        'note',
        'definition',
        'vocabulary',
        'formula'
      )
    ),

  publication_id uuid
    references public.vibe_publications(id)
    on delete cascade,

  chapter_id uuid
    references public.vibe_chapters(id)
    on delete cascade,

  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Remove duplicate interrupted-run objects before creating one authority.
alter table public.vibe_workspace_items
  drop constraint if exists vwi_pubsave_chapter_null;

alter table public.vibe_workspace_items
  drop constraint if exists vwi_pubsave_no_chapter;

alter table public.vibe_workspace_items
  drop constraint if exists vwi_pubsave_requires_publication;

drop index if exists public.uq_vwi_publication_save;
drop index if exists public.vwi_publication_save_unique;

drop index if exists public.idx_vwi_publication;
drop index if exists public.vwi_publication_idx;

drop index if exists public.idx_vwi_viewer;
drop index if exists public.idx_vwi_type;

alter table public.vibe_workspace_items
  add constraint vwi_pubsave_scope_check
  check (
    item_type <> 'publication_save'
    or (
      publication_id is not null
      and chapter_id is null
    )
  );

create unique index vwi_publication_save_unique
  on public.vibe_workspace_items (
    viewer_id,
    publication_id
  )
  where item_type = 'publication_save';

create index if not exists vwi_viewer_type_idx
  on public.vibe_workspace_items (
    viewer_id,
    item_type
  );

create index if not exists vwi_publication_idx
  on public.vibe_workspace_items (publication_id)
  where publication_id is not null;

create index if not exists vwi_chapter_idx
  on public.vibe_workspace_items (chapter_id)
  where chapter_id is not null;

create or replace function public.set_vibe_workspace_item_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists vwi_set_updated_at
  on public.vibe_workspace_items;

drop trigger if exists set_vibe_workspace_item_updated_at
  on public.vibe_workspace_items;

create trigger set_vibe_workspace_item_updated_at
before update on public.vibe_workspace_items
for each row
execute function public.set_vibe_workspace_item_updated_at();

alter table public.vibe_workspace_items enable row level security;

drop policy if exists "vwi_owner_all"
  on public.vibe_workspace_items;

drop policy if exists "vwi_owner_only"
  on public.vibe_workspace_items;

drop policy if exists "Workspace owner can read items"
  on public.vibe_workspace_items;

drop policy if exists "workspace_owner_select"
  on public.vibe_workspace_items;

create policy "workspace_owner_select"
on public.vibe_workspace_items
for select
to authenticated
using (viewer_id = auth.uid());

-- Direct client writes are intentionally unavailable.
-- All writes must pass through SECURITY DEFINER RPCs.
revoke all on table public.vibe_workspace_items
  from anon, authenticated;

grant select on table public.vibe_workspace_items
  to authenticated;

drop function if exists public.toggle_publication_save(uuid);

create function public.toggle_publication_save(
  p_publication_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_viewer_id uuid := auth.uid();
  v_publication public.vibe_publications%rowtype;
  v_deleted_count integer;
begin
  if v_viewer_id is null then
    return jsonb_build_object(
      'ok', false,
      'reason', 'auth_required',
      'saved', false
    );
  end if;

  select *
  into v_publication
  from public.vibe_publications
  where id = p_publication_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'reason', 'publication_not_found',
      'saved', false
    );
  end if;

  if v_publication.status <> 'published' then
    return jsonb_build_object(
      'ok', false,
      'reason', 'not_entitled',
      'saved', false
    );
  end if;

  -- READ-005B saves the publication itself rather than chapter content.
  -- A published publication is saveable. Chapter-level entitlement remains
  -- enforced by get_vibetextbook_reader and record_reading_progress.
  delete from public.vibe_workspace_items
  where viewer_id = v_viewer_id
    and publication_id = p_publication_id
    and item_type = 'publication_save';

  get diagnostics v_deleted_count = row_count;

  if v_deleted_count > 0 then
    return jsonb_build_object(
      'ok', true,
      'reason', null,
      'saved', false,
      'publication_id', p_publication_id
    );
  end if;

  insert into public.vibe_workspace_items (
    viewer_id,
    item_type,
    publication_id,
    chapter_id,
    payload
  )
  values (
    v_viewer_id,
    'publication_save',
    p_publication_id,
    null,
    '{}'::jsonb
  )
  on conflict (
    viewer_id,
    publication_id
  )
  where item_type = 'publication_save'
  do nothing;

  return jsonb_build_object(
    'ok', true,
    'reason', null,
    'saved', true,
    'publication_id', p_publication_id
  );
end;
$$;

drop function if exists public.get_my_library();

create function public.get_my_library()
returns table (
  publication_id uuid,
  cover_url text,
  title text,
  cbc_grade text,
  cbc_subject text,
  saved_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    publication.id,
    publication.cover_url,
    publication.title,
    publication.cbc_grade,
    publication.cbc_subject,
    workspace.created_at
  from public.vibe_workspace_items workspace
  join public.vibe_publications publication
    on publication.id = workspace.publication_id
  where workspace.viewer_id = auth.uid()
    and workspace.item_type = 'publication_save'
    and publication.status = 'published'
  order by workspace.created_at desc;
$$;

revoke all on function public.toggle_publication_save(uuid)
  from public, anon;

revoke all on function public.get_my_library()
  from public, anon;

grant execute on function public.toggle_publication_save(uuid)
  to authenticated;

grant execute on function public.get_my_library()
  to authenticated;

grant execute on function public.toggle_publication_save(uuid)
  to service_role;

grant execute on function public.get_my_library()
  to service_role;

comment on table public.vibe_workspace_items is
  'Canonical READ-track study-workspace authority keyed by auth.uid()/profiles.id.';

comment on function public.toggle_publication_save(uuid) is
  'Idempotently toggles one publication_save for the authenticated viewer.';

comment on function public.get_my_library() is
  'Returns the authenticated viewer''s currently published saved publications.';
