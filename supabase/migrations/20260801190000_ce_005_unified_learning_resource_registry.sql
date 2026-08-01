begin;

alter table public.learning_resources
  drop constraint if exists chk_learning_resource_single_source,
  drop constraint if exists chk_learning_resource_source_type,
  drop constraint if exists learning_resources_source_type_check;

drop index if exists public.uq_learning_resources_publication;
drop index if exists public.uq_learning_resources_chapter;
drop index if exists public.uq_learning_resources_content;

alter table public.learning_resources
  add column content_block_id uuid references public.content_blocks(id) on delete cascade,
  add column visibility text not null default 'private',
  add column owner_type text not null default 'creator',
  add column school_id uuid references public.schools(id) on delete set null,
  add column canonical_key text;

update public.learning_resources r
set publication_id = c.publication_id,
    updated_at = now()
from public.vibe_chapters c
where r.source_type = 'chapter'
  and r.chapter_id = c.id
  and r.publication_id is distinct from c.publication_id;

update public.learning_resources
set visibility = case when status = 'active' and source_type in ('publication','chapter') then 'public' else 'private' end,
    owner_type = case when source_type in ('publication','chapter','content_block') then 'publisher' else 'creator' end,
    canonical_key = case source_type
      when 'publication' then 'publication:' || publication_id::text
      when 'chapter' then 'chapter:' || chapter_id::text
      when 'vibelearn_content' then 'vibelearn_content:' || content_id::text
      when 'content_block' then 'content_block:' || content_block_id::text
      else source_type || ':' || id::text
    end;

alter table public.learning_resources
  alter column canonical_key set not null,
  add constraint learning_resources_source_type_check check (source_type in ('publication','chapter','vibelearn_content','content_block','teacher_note','uploaded_document','external_resource')),
  add constraint learning_resources_visibility_check check (visibility in ('public','school','class','private','licensed','purchased','assigned')),
  add constraint learning_resources_owner_type_check check (owner_type in ('publisher','creator','teacher','school','platform')),
  add constraint learning_resources_title_nonempty check (btrim(title) <> ''),
  add constraint learning_resources_target_contract_check check (
    (source_type = 'publication' and publication_id is not null and chapter_id is null and content_id is null and content_block_id is null)
    or (source_type = 'chapter' and publication_id is not null and chapter_id is not null and content_id is null and content_block_id is null)
    or (source_type = 'vibelearn_content' and content_id is not null and publication_id is null and chapter_id is null and content_block_id is null)
    or (source_type = 'content_block' and publication_id is not null and chapter_id is not null and content_block_id is not null and content_id is null)
    or (source_type in ('teacher_note','uploaded_document','external_resource') and publication_id is null and chapter_id is null and content_id is null and content_block_id is null)
  ),
  add constraint learning_resources_school_visibility_check check (visibility <> 'school' or school_id is not null);

create unique index learning_resources_canonical_key_uidx on public.learning_resources(canonical_key);
create unique index learning_resources_publication_uidx on public.learning_resources(publication_id) where source_type = 'publication';
create unique index learning_resources_chapter_uidx on public.learning_resources(chapter_id) where source_type = 'chapter';
create unique index learning_resources_content_uidx on public.learning_resources(content_id) where source_type = 'vibelearn_content';
create unique index learning_resources_content_block_uidx on public.learning_resources(content_block_id) where source_type = 'content_block';
create index learning_resources_visibility_status_idx on public.learning_resources(visibility, status);
create index learning_resources_school_idx on public.learning_resources(school_id) where school_id is not null;

create or replace function public.ce_validate_learning_resource()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  chapter_publication uuid;
  block_publication uuid;
  block_chapter uuid;
begin
  if new.source_type = 'chapter' then
    select publication_id into chapter_publication from public.vibe_chapters where id = new.chapter_id;
    if chapter_publication is null then raise exception 'Chapter % does not exist', new.chapter_id; end if;
    if chapter_publication <> new.publication_id then raise exception 'Chapter publication mismatch'; end if;
  elsif new.source_type = 'content_block' then
    select publication_id, chapter_id into block_publication, block_chapter from public.content_blocks where id = new.content_block_id;
    if block_publication is null then raise exception 'Content block % does not exist', new.content_block_id; end if;
    if block_publication <> new.publication_id or block_chapter <> new.chapter_id then raise exception 'Content block publication/chapter mismatch'; end if;
  end if;

  new.canonical_key := case new.source_type
    when 'publication' then 'publication:' || new.publication_id::text
    when 'chapter' then 'chapter:' || new.chapter_id::text
    when 'vibelearn_content' then 'vibelearn_content:' || new.content_id::text
    when 'content_block' then 'content_block:' || new.content_block_id::text
    else coalesce(nullif(btrim(new.canonical_key), ''), new.source_type || ':' || new.id::text)
  end;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ce_validate_learning_resource on public.learning_resources;
create trigger ce_validate_learning_resource
before insert or update on public.learning_resources
for each row execute function public.ce_validate_learning_resource();

create or replace function public.ce_register_learning_resource(
  p_source_type text,
  p_publication_id uuid default null,
  p_chapter_id uuid default null,
  p_content_id uuid default null,
  p_content_block_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_visibility text default 'private',
  p_school_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller uuid := auth.uid();
  result_id uuid;
  resolved_title text;
  resolved_creator uuid;
begin
  if caller is null and current_user not in ('postgres','service_role') then
    raise exception 'Authentication required';
  end if;

  if p_source_type = 'publication' then
    select title, author_id into resolved_title, resolved_creator from public.vibe_publications where id = p_publication_id;
  elsif p_source_type = 'chapter' then
    select coalesce(c.title, p.title), p.author_id into resolved_title, resolved_creator
    from public.vibe_chapters c join public.vibe_publications p on p.id = c.publication_id
    where c.id = p_chapter_id and c.publication_id = p_publication_id;
  elsif p_source_type = 'vibelearn_content' then
    select title, submitted_by into resolved_title, resolved_creator from public.vibelearn_content where id = p_content_id;
  elsif p_source_type = 'content_block' then
    select coalesce(b.title, b.plain_text, c.title), p.author_id into resolved_title, resolved_creator
    from public.content_blocks b
    join public.vibe_chapters c on c.id = b.chapter_id
    join public.vibe_publications p on p.id = b.publication_id
    where b.id = p_content_block_id and b.chapter_id = p_chapter_id and b.publication_id = p_publication_id;
  else
    resolved_title := p_title;
    resolved_creator := caller;
  end if;

  if resolved_title is null then raise exception 'Resource target does not exist or has no title'; end if;
  if current_user not in ('postgres','service_role') and resolved_creator is distinct from caller then
    raise exception 'Only the resource owner may register this resource';
  end if;

  insert into public.learning_resources(
    source_type, publication_id, chapter_id, content_id, content_block_id,
    title, description, status, visibility, owner_type, school_id, created_by, learning_outcomes
  ) values (
    p_source_type, p_publication_id, p_chapter_id, p_content_id, p_content_block_id,
    coalesce(nullif(btrim(p_title), ''), resolved_title), p_description, 'active', p_visibility,
    case when p_source_type in ('publication','chapter','content_block') then 'publisher' else 'creator' end,
    p_school_id, coalesce(caller, resolved_creator), '{}'::text[]
  )
  on conflict (canonical_key) do update
  set title = excluded.title,
      description = excluded.description,
      status = 'active',
      visibility = excluded.visibility,
      school_id = excluded.school_id,
      updated_at = now()
  returning id into result_id;

  return result_id;
end;
$$;

revoke all on function public.ce_register_learning_resource(text,uuid,uuid,uuid,uuid,text,text,text,uuid) from public, anon;
grant execute on function public.ce_register_learning_resource(text,uuid,uuid,uuid,uuid,text,text,text,uuid) to authenticated, service_role;

insert into public.content_engine_authorities(domain, authoritative_table, authority_role, derived_tables, notes)
values (
  'learning_resource',
  'public.learning_resources',
  'Unified normalized registry for publications, chapters, content blocks, VibeLearn content and future teacher resources',
  array['public.scheme_lesson_resource_links'],
  'Canonical keys and source-specific constraints prevent duplicate or ambiguous educational resource identities.'
)
on conflict (domain) do update
set authoritative_table = excluded.authoritative_table,
    authority_role = excluded.authority_role,
    derived_tables = excluded.derived_tables,
    notes = excluded.notes,
    updated_at = now();

commit;
