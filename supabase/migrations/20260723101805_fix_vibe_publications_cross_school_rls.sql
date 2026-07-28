drop policy if exists vibe_publications_owner_or_school_staff on vibe_publications;

create policy vibe_publications_owner_only
  on vibe_publications for all
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists vibe_chapters_owner_or_school_staff on vibe_chapters;

create policy vibe_chapters_owner_only
  on vibe_chapters for all
  using (
    exists (
      select 1 from vibe_publications p
      where p.id = vibe_chapters.publication_id
      and p.author_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from vibe_publications p
      where p.id = vibe_chapters.publication_id
      and p.author_id = auth.uid()
    )
  );
