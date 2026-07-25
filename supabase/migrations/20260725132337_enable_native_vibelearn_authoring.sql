-- Enable native VibeLearn authoring while preserving legacy external-link
-- content. Epage and ebook rows must have either a native body or an
-- external URL. Textbook rows remain publication-backed and authoritative
-- through vibe_publications — unaffected by this migration.
--
-- This migration was already applied directly to the live database
-- (Supabase-recorded version 20260725132337); this file brings local
-- migration history into sync with what's actually live. Content and
-- version verified against the live schema before writing this file —
-- not reconstructed from memory.

alter table public.vibelearn_content
  alter column url drop not null;

alter table public.vibelearn_content
  drop constraint if exists vibelearn_content_source_of_truth_check;

alter table public.vibelearn_content
  add constraint vibelearn_content_source_of_truth_check
  check (
    (
      type in ('epage', 'ebook')
      and (
        nullif(btrim(body), '') is not null
        or nullif(btrim(url), '') is not null
      )
    )
    or
    (
      type = 'textbook'
      and vibe_publication_id is not null
    )
  );

comment on column public.vibelearn_content.body is
'Native VibeLearn content body for epage/ebook authoring. Legacy external-link content may continue to use url.';

comment on column public.vibelearn_content.url is
'Optional legacy/import URL for epage/ebook content and canonical reader URL for bridged textbook rows.';
