-- Cover Workroom foreign keys used by ownership and audit queries.
create index if not exists hq_work_items_owner_id_idx
  on public.hq_work_items (owner_id);

create index if not exists hq_work_item_updates_actor_id_idx
  on public.hq_work_item_updates (actor_id);

create index if not exists hq_work_item_updates_worker_id_idx
  on public.hq_work_item_updates (worker_id);

create index if not exists hq_work_item_links_added_by_idx
  on public.hq_work_item_links (added_by);
