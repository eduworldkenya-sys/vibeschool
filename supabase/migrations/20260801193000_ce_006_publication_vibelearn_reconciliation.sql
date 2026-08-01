begin;

create or replace function public.ce_reconcile_textbook_index_internal(p_publication_id uuid)
returns table(content_id uuid, operation text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pub record;
  v_school_id uuid;
  v_subject_id uuid;
  v_existing_id uuid;
  v_result_id uuid;
  v_status text;
  v_subject_ids uuid[];
begin
  select p.id,p.author_id,p.format,p.title,p.description,p.status,p.cbc_subject,p.tags,p.cover_url
  into v_pub
  from public.vibe_publications p
  where p.id = p_publication_id;

  if not found then raise exception 'Publication % not found', p_publication_id; end if;

  if v_pub.format <> 'vibetextbook' then
    delete from public.vibelearn_content
    where vibe_publication_id = p_publication_id and type = 'textbook';
    return query select null::uuid, 'not_textbook'::text;
    return;
  end if;

  select id into v_existing_id
  from public.vibelearn_content
  where vibe_publication_id = p_publication_id and type = 'textbook';

  if v_pub.status <> 'published' and v_existing_id is null then
    return query select null::uuid, 'not_indexed_draft'::text;
    return;
  end if;

  select coalesce(sm.school_id, tp.school_id)
  into v_school_id
  from (select 1) d
  left join public.school_members sm on sm.profile_id = v_pub.author_id
  left join public.teacher_profiles tp on tp.profile_id = v_pub.author_id
  limit 1;

  select array_agg(id order by id)
  into v_subject_ids
  from public.subjects
  where lower(name) = lower(coalesce(v_pub.cbc_subject, ''));

  if coalesce(array_length(v_subject_ids, 1), 0) = 1 then
    v_subject_id := v_subject_ids[1];
  else
    v_subject_id := null;
  end if;

  v_status := case when v_pub.status = 'published' then 'live' else 'draft' end;

  insert into public.vibelearn_content(
    title, description, subject_id, type, url, thumbnail_url, tags, source,
    submitted_by, school_id, status, vibe_publication_id
  ) values (
    v_pub.title, v_pub.description, v_subject_id, 'textbook',
    '/read/textbook/' || p_publication_id::text, nullif(v_pub.cover_url, ''),
    coalesce(v_pub.tags, '{}'::text[]), 'vibetextbook', v_pub.author_id,
    v_school_id, v_status, p_publication_id
  )
  on conflict (vibe_publication_id) where vibe_publication_id is not null do update
  set title = excluded.title,
      description = excluded.description,
      subject_id = excluded.subject_id,
      type = 'textbook',
      url = excluded.url,
      thumbnail_url = excluded.thumbnail_url,
      tags = excluded.tags,
      source = 'vibetextbook',
      submitted_by = excluded.submitted_by,
      school_id = excluded.school_id,
      status = excluded.status,
      updated_at = now()
  returning id into v_result_id;

  return query select v_result_id, case when v_existing_id is null then 'inserted' else 'updated' end;
end;
$$;

revoke all on function public.ce_reconcile_textbook_index_internal(uuid) from public, anon, authenticated;
grant execute on function public.ce_reconcile_textbook_index_internal(uuid) to service_role;

create or replace function public.sync_vibelearn_textbook_index(p_publication_id uuid)
returns table(content_id uuid, operation text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_author uuid;
begin
  select author_id into v_author from public.vibe_publications where id = p_publication_id;
  if not found then raise exception 'Publication % not found', p_publication_id; end if;
  if auth.uid() is distinct from v_author then raise exception 'Not authorized to sync publication %', p_publication_id; end if;
  return query select * from public.ce_reconcile_textbook_index_internal(p_publication_id);
end;
$$;

create or replace function public.reconcile_textbook_index(p_publication_id uuid)
returns table(content_id uuid, operation text)
language sql
security definer
set search_path = public, pg_temp
as $$
  select * from public.sync_vibelearn_textbook_index(p_publication_id);
$$;

create or replace function public.admin_reconcile_vibelearn_textbook_index(p_publication_id uuid)
returns table(content_id uuid, operation text)
language sql
security definer
set search_path = public, pg_temp
as $$
  select * from public.ce_reconcile_textbook_index_internal(p_publication_id);
$$;

revoke all on function public.admin_reconcile_vibelearn_textbook_index(uuid) from public, anon, authenticated;
grant execute on function public.admin_reconcile_vibelearn_textbook_index(uuid) to service_role;

create or replace function public.ce_sync_vibelearn_from_publication()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.vibelearn_content where vibe_publication_id = old.id and type = 'textbook';
    return old;
  end if;
  perform public.ce_reconcile_textbook_index_internal(new.id);
  return new;
end;
$$;

revoke all on function public.ce_sync_vibelearn_from_publication() from public, anon, authenticated;
grant execute on function public.ce_sync_vibelearn_from_publication() to service_role;

drop trigger if exists sync_vibelearn_from_publication on public.vibe_publications;
drop trigger if exists ce_sync_vibelearn_from_publication on public.vibe_publications;
create trigger ce_sync_vibelearn_from_publication
after insert or update of format, title, description, status, cbc_subject, tags, cover_url, author_id or delete
on public.vibe_publications
for each row execute function public.ce_sync_vibelearn_from_publication();

create or replace function public.ce_guard_textbook_index_authority()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare v_type text;
begin
  if current_user in ('postgres', 'service_role') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_type := case when tg_op = 'DELETE' then old.type else new.type end;
  if v_type <> 'textbook' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  raise exception 'Textbook discovery rows are synchronized from vibe_publications and cannot be edited directly';
end;
$$;

drop trigger if exists ce_guard_textbook_index_authority on public.vibelearn_content;
create trigger ce_guard_textbook_index_authority
before insert or update or delete on public.vibelearn_content
for each row execute function public.ce_guard_textbook_index_authority();

do $$
declare r record;
begin
  for r in select id from public.vibe_publications where format = 'vibetextbook' loop
    perform public.ce_reconcile_textbook_index_internal(r.id);
  end loop;
end;
$$;

create or replace function public.content_engine_integrity_audit()
returns table(check_key text, severity text, issue_count bigint, detail text)
language sql
security definer
set search_path = public, pg_temp
as $$
  select 'published_textbook_missing_index','critical',count(*),'Published vibetextbook has no discovery-index row'
  from public.vibe_publications p
  where p.format = 'vibetextbook' and p.status = 'published'
    and not exists(select 1 from public.vibelearn_content c where c.type = 'textbook' and c.vibe_publication_id = p.id)
  union all
  select 'duplicate_textbook_index','critical',count(*),'More than one textbook index row points to one publication'
  from (select vibe_publication_id from public.vibelearn_content where type = 'textbook' and vibe_publication_id is not null group by vibe_publication_id having count(*) > 1) d
  union all
  select 'orphan_textbook_index','critical',count(*),'Textbook index row has no matching publication'
  from public.vibelearn_content c where c.type = 'textbook' and not exists(select 1 from public.vibe_publications p where p.id = c.vibe_publication_id)
  union all
  select 'textbook_index_status_mismatch','high',count(*),'Textbook index status differs from mapped publication lifecycle'
  from public.vibelearn_content c join public.vibe_publications p on p.id = c.vibe_publication_id
  where c.type = 'textbook' and c.status is distinct from case when p.status = 'published' then 'live' else 'draft' end
  union all
  select 'textbook_index_metadata_mismatch','high',count(*),'Textbook index metadata differs from publication authority'
  from public.vibelearn_content c join public.vibe_publications p on p.id = c.vibe_publication_id
  where c.type = 'textbook' and (
    c.title is distinct from p.title or c.description is distinct from p.description or
    c.thumbnail_url is distinct from nullif(p.cover_url, '') or c.tags is distinct from coalesce(p.tags, '{}'::text[]) or
    c.source is distinct from 'vibetextbook' or c.url is distinct from '/read/textbook/' || p.id::text
  )
  union all
  select 'chapter_publication_mismatch_scheme_link','critical',count(*),'Scheme resource chapter belongs to another publication'
  from public.scheme_lesson_resource_links l join public.vibe_chapters ch on ch.id = l.chapter_id where ch.publication_id <> l.publication_id
  union all
  select 'chapter_publication_mismatch_assignment','critical',count(*),'Assignment chapter belongs to another publication'
  from public.vibe_chapter_assignments a join public.vibe_chapters ch on ch.id = a.chapter_id where ch.publication_id <> a.publication_id
  union all
  select 'chapter_publication_mismatch_progress','critical',count(*),'Progress chapter belongs to another publication'
  from public.vibe_reading_progress r join public.vibe_chapters ch on ch.id = r.chapter_id where ch.publication_id <> r.publication_id
  union all
  select 'duplicate_scheme_resource_link','high',count(*),'Duplicate scheme resource links exist'
  from (select scheme_lesson_id, publication_id, chapter_id, resource_role from public.scheme_lesson_resource_links group by 1,2,3,4 having count(*) > 1) d
  union all
  select 'invalid_scheme_page_range','high',count(*),'Scheme resource page range is invalid'
  from public.scheme_lesson_resource_links where (page_start is null) <> (page_end is null) or coalesce(page_start,1) < 1 or coalesce(page_end,1) < 1 or (page_start is not null and page_end < page_start)
  union all
  select 'reading_progress_out_of_range','high',count(*),'Reading progress is outside 0..100'
  from public.vibe_reading_progress where progress_percent < 0 or progress_percent > 100
  union all
  select 'assignment_due_before_assigned','high',count(*),'Assignment due date precedes assignment date'
  from public.vibe_chapter_assignments where due_at is not null and due_at < assigned_at;
$$;

insert into public.content_engine_authorities(domain, authoritative_table, authority_role, derived_tables, notes)
values (
  'discovery_index',
  'public.vibelearn_content',
  'Derived searchable discovery index synchronized from publication authority',
  array[]::text[],
  'Published vibetextbooks are indexed as live; previously indexed non-published textbooks remain draft; never mutate textbook lifecycle directly in this table.'
)
on conflict(domain) do update
set authoritative_table = excluded.authoritative_table,
    authority_role = excluded.authority_role,
    derived_tables = excluded.derived_tables,
    notes = excluded.notes,
    updated_at = now();

commit;
