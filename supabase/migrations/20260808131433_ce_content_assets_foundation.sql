begin;

create table if not exists public.content_assets (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.vibe_publications(id) on delete cascade,
  chapter_id uuid null references public.vibe_chapters(id) on delete cascade,
  asset_type text not null check (asset_type in ('image','illustration','diagram','audio','video','animation','model_3d','simulation')),
  storage_path text null,
  public_url text null,
  thumbnail_url text null,
  title text null,
  caption text null,
  alt_text text null,
  metadata jsonb not null default '{}'::jsonb,
  license text null,
  status text not null default 'ready' check (status in ('draft','processing','ready','failed','archived')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_assets_location_check check (
    nullif(btrim(coalesce(storage_path,'')), '') is not null
    or nullif(btrim(coalesce(public_url,'')), '') is not null
  )
);

create index if not exists idx_content_assets_publication on public.content_assets(publication_id, created_at desc);
create index if not exists idx_content_assets_chapter on public.content_assets(chapter_id) where chapter_id is not null;
create index if not exists idx_content_assets_type on public.content_assets(asset_type, status);

alter table public.content_blocks
  add column if not exists asset_id uuid null references public.content_assets(id) on delete set null;

create index if not exists idx_content_blocks_asset on public.content_blocks(asset_id) where asset_id is not null;

alter table public.content_assets enable row level security;

drop policy if exists content_assets_read on public.content_assets;
create policy content_assets_read
on public.content_assets
for select
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.vibe_publications p
    where p.id = content_assets.publication_id
      and p.status = 'published'
      and content_assets.status = 'ready'
  )
);

drop policy if exists content_assets_insert_owner on public.content_assets;
create policy content_assets_insert_owner
on public.content_assets
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.vibe_publications p
    where p.id = content_assets.publication_id
      and p.author_id = auth.uid()
  )
  and (
    chapter_id is null
    or exists (
      select 1 from public.vibe_chapters c
      where c.id = content_assets.chapter_id
        and c.publication_id = content_assets.publication_id
    )
  )
);

drop policy if exists content_assets_update_owner on public.content_assets;
create policy content_assets_update_owner
on public.content_assets
for update
to authenticated
using (
  exists (
    select 1 from public.vibe_publications p
    where p.id = content_assets.publication_id
      and p.author_id = auth.uid()
  )
)
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.vibe_publications p
    where p.id = content_assets.publication_id
      and p.author_id = auth.uid()
  )
  and (
    chapter_id is null
    or exists (
      select 1 from public.vibe_chapters c
      where c.id = content_assets.chapter_id
        and c.publication_id = content_assets.publication_id
    )
  )
);

drop policy if exists content_assets_delete_owner on public.content_assets;
create policy content_assets_delete_owner
on public.content_assets
for delete
to authenticated
using (
  exists (
    select 1 from public.vibe_publications p
    where p.id = content_assets.publication_id
      and p.author_id = auth.uid()
  )
);

commit;
