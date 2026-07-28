-- Real FK replacing the soft url-string convention, so a trigger can safely
-- target linked rows instead of pattern-matching on source/url text.
alter table vibelearn_content
  add column if not exists vibe_publication_id uuid references vibe_publications(id);

update vibelearn_content
set vibe_publication_id = '6fc551d7-c9ae-4402-ac52-3d0a46461e87'
where id = '4a0e2942-b0ca-4c9f-807b-504767489b85';

-- Sync only fires for rows that already have a deliberate link.
-- Creating the link stays a manual, reviewed act — this only keeps
-- an existing link's title/description/status from going stale.
create or replace function sync_vibelearn_from_publication()
returns trigger as $$
begin
  update vibelearn_content
  set title = new.title,
      description = coalesce(new.description, description),
      status = case when new.status = 'published' then 'live' else 'draft' end,
      updated_at = now()
  where vibe_publication_id = new.id;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_sync_vibelearn_from_publication on vibe_publications;

create trigger trg_sync_vibelearn_from_publication
  after update of title, description, status on vibe_publications
  for each row
  execute function sync_vibelearn_from_publication();
