begin;

create table if not exists public.content_blocks (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.vibe_publications(id) on delete cascade,
  chapter_id uuid not null references public.vibe_chapters(id) on delete cascade,
  legacy_block_id text,
  block_type text not null,
  sequence integer not null,
  payload jsonb not null default '{}'::jsonb,
  title text,
  plain_text text,
  status text not null default 'draft',
  is_teacher_only boolean not null default false,
  is_assessable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_blocks_type_nonempty check (btrim(block_type) <> ''),
  constraint content_blocks_sequence_positive check (sequence > 0),
  constraint content_blocks_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint content_blocks_status_check check (status in ('draft','published','unpublished','archived'))
);

create unique index if not exists content_blocks_chapter_sequence_uidx on public.content_blocks(chapter_id, sequence);
create unique index if not exists content_blocks_chapter_legacy_id_uidx on public.content_blocks(chapter_id, legacy_block_id) where legacy_block_id is not null and btrim(legacy_block_id) <> '';
create index if not exists content_blocks_publication_idx on public.content_blocks(publication_id);
create index if not exists content_blocks_chapter_type_idx on public.content_blocks(chapter_id, block_type);
create index if not exists content_blocks_status_idx on public.content_blocks(status);
create index if not exists content_blocks_payload_gin_idx on public.content_blocks using gin(payload);

alter table public.content_blocks enable row level security;
revoke all on table public.content_blocks from public, anon, authenticated;
grant select, insert, update, delete on table public.content_blocks to authenticated, service_role;

create policy content_blocks_public_read on public.content_blocks for select to anon, authenticated using (status = 'published' and exists (select 1 from public.vibe_publications p where p.id = content_blocks.publication_id and p.status = 'published'));
create policy content_blocks_author_read on public.content_blocks for select to authenticated using (exists (select 1 from public.vibe_publications p where p.id = content_blocks.publication_id and p.author_id = (select auth.uid())));
create policy content_blocks_author_insert on public.content_blocks for insert to authenticated with check (exists (select 1 from public.vibe_publications p where p.id = content_blocks.publication_id and p.author_id = (select auth.uid())));
create policy content_blocks_author_update on public.content_blocks for update to authenticated using (exists (select 1 from public.vibe_publications p where p.id = content_blocks.publication_id and p.author_id = (select auth.uid()))) with check (exists (select 1 from public.vibe_publications p where p.id = content_blocks.publication_id and p.author_id = (select auth.uid())));
create policy content_blocks_author_delete on public.content_blocks for delete to authenticated using (exists (select 1 from public.vibe_publications p where p.id = content_blocks.publication_id and p.author_id = (select auth.uid())));

create or replace function public.ce_extract_block_plain_text(p_payload jsonb)
returns text language sql immutable set search_path = public, pg_temp as $$
  select nullif(btrim(concat_ws(' ',p_payload->>'text',p_payload->>'content',p_payload->>'title',p_payload->>'caption',p_payload->>'question',p_payload->>'code',case when jsonb_typeof(p_payload->'items')='array' then (select string_agg(case when jsonb_typeof(x)='string' then trim(both '"' from x::text) else coalesce(x->>'text',x::text) end,' ') from jsonb_array_elements(p_payload->'items') x) else null end)), '');
$$;

create or replace function public.ce_validate_content_block()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare chapter_publication uuid;
begin
  select publication_id into chapter_publication from public.vibe_chapters where id=new.chapter_id;
  if chapter_publication is null then raise exception 'Chapter % does not exist',new.chapter_id; end if;
  if chapter_publication<>new.publication_id then raise exception 'Content block publication % does not match chapter publication %',new.publication_id,chapter_publication; end if;
  new.updated_at:=now();
  new.title:=nullif(btrim(coalesce(new.payload->>'title',new.payload->>'heading',new.title)),'');
  new.plain_text:=public.ce_extract_block_plain_text(new.payload);
  return new;
end $$;

create or replace function public.ce_reconcile_chapter_content_blocks(p_chapter_id uuid)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare chapter_row public.vibe_chapters%rowtype; block_row record; kept_sequences integer[]:='{}'; synced_count integer:=0;
begin
  select * into chapter_row from public.vibe_chapters where id=p_chapter_id;
  if not found then raise exception 'Chapter % does not exist',p_chapter_id; end if;
  if jsonb_typeof(chapter_row.blocks)<>'array' then raise exception 'Chapter % blocks must be a JSON array',p_chapter_id; end if;
  for block_row in select value as payload,ordinality::integer as seq from jsonb_array_elements(chapter_row.blocks) with ordinality loop
    if jsonb_typeof(block_row.payload)<>'object' then raise exception 'Chapter % block % must be a JSON object',p_chapter_id,block_row.seq; end if;
    if nullif(btrim(block_row.payload->>'type'),'') is null then raise exception 'Chapter % block % has no type',p_chapter_id,block_row.seq; end if;
    insert into public.content_blocks(publication_id,chapter_id,legacy_block_id,block_type,sequence,payload,status,is_teacher_only,is_assessable)
    values(chapter_row.publication_id,chapter_row.id,nullif(btrim(block_row.payload->>'id'),''),block_row.payload->>'type',block_row.seq,block_row.payload,case when chapter_row.status='published' then 'published' else 'draft' end,coalesce((block_row.payload->>'teacherOnly')::boolean,false),(block_row.payload->>'type') in ('question','activity','exercise','project','assessment'))
    on conflict(chapter_id,sequence) do update set publication_id=excluded.publication_id,legacy_block_id=excluded.legacy_block_id,block_type=excluded.block_type,payload=excluded.payload,status=excluded.status,is_teacher_only=excluded.is_teacher_only,is_assessable=excluded.is_assessable,updated_at=now();
    kept_sequences:=array_append(kept_sequences,block_row.seq); synced_count:=synced_count+1;
  end loop;
  delete from public.content_blocks where chapter_id=p_chapter_id and not(sequence=any(kept_sequences));
  return synced_count;
end $$;
revoke all on function public.ce_reconcile_chapter_content_blocks(uuid) from public,anon;
grant execute on function public.ce_reconcile_chapter_content_blocks(uuid) to authenticated,service_role;

create or replace function public.ce_reconcile_chapter_blocks_trigger() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$ begin perform public.ce_reconcile_chapter_content_blocks(new.id); return new; end $$;
revoke all on function public.ce_reconcile_chapter_blocks_trigger() from public,anon,authenticated; grant execute on function public.ce_reconcile_chapter_blocks_trigger() to service_role;
create or replace function public.ce_sync_content_block_status_from_chapter() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$ begin if old.status is distinct from new.status then update public.content_blocks set status=case when new.status='published' then 'published' else new.status end,updated_at=now() where chapter_id=new.id; end if; return new; end $$;
revoke all on function public.ce_sync_content_block_status_from_chapter() from public,anon,authenticated; grant execute on function public.ce_sync_content_block_status_from_chapter() to service_role;

drop trigger if exists ce_validate_content_block on public.content_blocks;
create trigger ce_validate_content_block before insert or update on public.content_blocks for each row execute function public.ce_validate_content_block();
drop trigger if exists ce_reconcile_chapter_blocks on public.vibe_chapters;
create trigger ce_reconcile_chapter_blocks after insert or update of blocks on public.vibe_chapters for each row execute function public.ce_reconcile_chapter_blocks_trigger();
drop trigger if exists ce_sync_content_block_status_from_chapter on public.vibe_chapters;
create trigger ce_sync_content_block_status_from_chapter after update of status on public.vibe_chapters for each row execute function public.ce_sync_content_block_status_from_chapter();

do $$ declare chapter_record record; begin for chapter_record in select id from public.vibe_chapters loop perform public.ce_reconcile_chapter_content_blocks(chapter_record.id); end loop; end $$;

insert into public.content_engine_authorities(domain,authoritative_table,authority_role,derived_tables,notes) values('content_block','public.content_blocks','Normalized first-class chapter content blocks',array['public.vibe_chapters.blocks'],'During frontend compatibility, vibe_chapters.blocks remains writable and is automatically reconciled into content_blocks. A later API-contract phase can make content_blocks the sole write authority.') on conflict(domain) do update set authoritative_table=excluded.authoritative_table,authority_role=excluded.authority_role,derived_tables=excluded.derived_tables,notes=excluded.notes,updated_at=now();
comment on table public.content_blocks is 'CE-003 normalized educational content blocks. Preserves current vibe_chapters.blocks JSON while making each explanation, activity, question, media item, note and future semantic block addressable.';
commit;
