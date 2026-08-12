begin;

-- refresh_internal_originality_checks performs a cross-publication exact-duplicate
-- lookup by a normalized-content MD5. Without an expression index it repeatedly
-- scans the full content_blocks table for every candidate block.
create index if not exists idx_content_blocks_normalized_md5
  on public.content_blocks (
    (md5(regexp_replace(lower(coalesce(plain_text,'')), '\s+', ' ', 'g')))
  )
  include (id, publication_id, created_at, status);

commit;
