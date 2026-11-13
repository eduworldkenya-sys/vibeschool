-- Fix: published free VibeBooks chapters were hidden from anonymous readers.
--
-- Existing policy `vibe_chapters_entitled_reader_select` delegates to a helper
-- intentionally restricted to `vibetextbook`. Do not change that entitlement
-- helper or weaken paid-textbook access.
--
-- Permit only published chapters of published, zero-price eBooks. The same
-- condition applies to signed-out and signed-in readers. Paid, draft, archived
-- and locked chapters remain protected by the existing policies.
create policy vibe_chapters_public_free_ebook_select
on public.vibe_chapters
for select
to anon, authenticated
using (
  vibe_chapters.status = 'published'
  and exists (
    select 1
    from public.vibe_publications p
    where p.id = vibe_chapters.publication_id
      and p.format = 'ebook'
      and p.status = 'published'
      and coalesce(p.pricing->>'type', 'free') = 'free'
  )
);
