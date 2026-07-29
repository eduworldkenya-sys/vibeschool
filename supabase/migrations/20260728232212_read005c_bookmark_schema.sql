alter table public.vibe_workspace_items drop constraint if exists vwi_bookmark_scope_check;
alter table public.vibe_workspace_items add constraint vwi_bookmark_scope_check check (item_type <> 'bookmark' or (chapter_id is not null and publication_id is not null));
drop index if exists public.vwi_bookmark_unique;
create unique index vwi_bookmark_unique on public.vibe_workspace_items (viewer_id, chapter_id) where item_type = 'bookmark';
