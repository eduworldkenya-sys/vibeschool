-- Adds 'textbook' as a legal vibelearn_content.type, enforces the
-- epage/ebook-vs-textbook invariant, indexes the bridge column, and
-- makes publication deletion cascade to its index row.

-- 1. Widen the type check FIRST so the reconciliation update below is legal.
alter table public.vibelearn_content
  drop constraint vibelearn_content_type_check;

alter table public.vibelearn_content
  add constraint vibelearn_content_type_check
  check (type = any (array['epage'::text, 'ebook'::text, 'textbook'::text]));

-- 2. Reconcile the one pre-existing bridged row. It was manually typed
--    'ebook' as a workaround before 'textbook' existed as a value; it is
--    in fact a bridged VibeTextbook (vibe_publication_id points at a
--    vibe_publications row with format = 'vibetextbook').
update public.vibelearn_content
set type = 'textbook'
where id = '4a0e2942-b0ca-4c9f-807b-504767489b85'
  and vibe_publication_id = '6fc551d7-c9ae-4402-ac52-3d0a46461e87';

-- 3. Enforce the source-of-truth invariant per type. Intentionally looser
--    than "mutually exclusive" — a textbook row may also carry a url
--    (observed live usage: the internal /global/read/publication/:id
--    route), it just isn't required to. What must never happen: a
--    textbook row with no publication to back it, or an epage/ebook row
--    with no url to open.
alter table public.vibelearn_content
  add constraint vibelearn_content_source_of_truth_check
  check (
    (type in ('epage', 'ebook') and url is not null)
    or
    (type = 'textbook' and vibe_publication_id is not null)
  );

-- 4. A publication can only back one index row.
create unique index if not exists vibelearn_content_vibe_publication_id_unique
  on public.vibelearn_content (vibe_publication_id)
  where vibe_publication_id is not null;

-- 5. Deleting a publication should remove its marketplace index row
--    (lifecycle rule: Deleted -> cascade-delete the index row).
--    Existing FK is NO ACTION; replace with ON DELETE CASCADE.
alter table public.vibelearn_content
  drop constraint vibelearn_content_vibe_publication_id_fkey;

alter table public.vibelearn_content
  add constraint vibelearn_content_vibe_publication_id_fkey
  foreign key (vibe_publication_id)
  references public.vibe_publications(id)
  on delete cascade;
