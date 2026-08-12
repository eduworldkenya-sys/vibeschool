begin;

drop index if exists public.idx_content_blocks_normalized_md5;
create index idx_content_blocks_normalized_md5
  on public.content_blocks (
    (md5(regexp_replace(lower(plain_text), '\s+', ' ', 'g')))
  )
  include (id, publication_id, created_at, status);

commit;
