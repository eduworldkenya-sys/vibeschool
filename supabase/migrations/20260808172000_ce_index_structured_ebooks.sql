begin;

alter table public.vibelearn_content
  drop constraint if exists vibelearn_content_source_of_truth_check;

alter table public.vibelearn_content
  add constraint vibelearn_content_source_of_truth_check
  check (
    (type = 'epage' and (nullif(btrim(body), '') is not null or nullif(btrim(url), '') is not null) and vibe_publication_id is null)
    or
    (type = 'ebook' and ((vibe_publication_id is not null) or (vibe_publication_id is null and (nullif(btrim(body), '') is not null or nullif(btrim(url), '') is not null))))
    or
    (type = 'textbook' and vibe_publication_id is not null)
  );

create or replace function public.ce_reconcile_ebook_index_internal(p_publication_id uuid)
returns table(content_id uuid, operation text)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_pub record; v_school_id uuid; v_existing_id uuid; v_result_id uuid; v_status text;
begin
  select p.id,p.author_id,p.format,p.title,p.description,p.status,p.tags,p.cover_url into v_pub
  from public.vibe_publications p where p.id = p_publication_id;
  if not found then raise exception 'Publication % not found', p_publication_id; end if;
  if v_pub.format <> 'ebook' then
    delete from public.vibelearn_content where vibe_publication_id = p_publication_id and type = 'ebook';
    return query select null::uuid, 'not_ebook'::text; return;
  end if;
  select id into v_existing_id from public.vibelearn_content where vibe_publication_id = p_publication_id and type = 'ebook';
  if v_pub.status <> 'published' and v_existing_id is null then
    return query select null::uuid, 'not_indexed_draft'::text; return;
  end if;
  select coalesce(sm.school_id, tp.school_id) into v_school_id
  from (select 1) d left join public.school_members sm on sm.profile_id = v_pub.author_id
  left join public.teacher_profiles tp on tp.profile_id = v_pub.author_id limit 1;
  v_status := case when v_pub.status = 'published' then 'live' else 'draft' end;
  insert into public.vibelearn_content(title,description,type,url,thumbnail_url,tags,source,submitted_by,school_id,status,vibe_publication_id)
  values(v_pub.title,v_pub.description,'ebook','/global/read/publication/' || p_publication_id::text,nullif(v_pub.cover_url,''),coalesce(v_pub.tags,'{}'::text[]),'content_engine',v_pub.author_id,v_school_id,v_status,p_publication_id)
  on conflict (vibe_publication_id) where vibe_publication_id is not null do update
  set title=excluded.title,description=excluded.description,type='ebook',url=excluded.url,thumbnail_url=excluded.thumbnail_url,tags=excluded.tags,source='content_engine',submitted_by=excluded.submitted_by,school_id=excluded.school_id,status=excluded.status,updated_at=now()
  returning id into v_result_id;
  return query select v_result_id, case when v_existing_id is null then 'inserted' else 'updated' end;
end;
$$;
revoke all on function public.ce_reconcile_ebook_index_internal(uuid) from public, anon, authenticated;
grant execute on function public.ce_reconcile_ebook_index_internal(uuid) to service_role;

create or replace function public.ce_sync_vibelearn_from_publication()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then delete from public.vibelearn_content where vibe_publication_id = old.id; return old; end if;
  if new.format = 'vibetextbook' then
    perform public.ce_reconcile_textbook_index_internal(new.id);
    delete from public.vibelearn_content where vibe_publication_id = new.id and type = 'ebook';
  elsif new.format = 'ebook' then
    perform public.ce_reconcile_ebook_index_internal(new.id);
    delete from public.vibelearn_content where vibe_publication_id = new.id and type = 'textbook';
  else
    delete from public.vibelearn_content where vibe_publication_id = new.id and type in ('ebook','textbook');
  end if;
  return new;
end;
$$;

create or replace function public.ce_guard_textbook_index_authority()
returns trigger language plpgsql set search_path = public, pg_temp
as $$
declare v_linked boolean;
begin
  if current_user in ('postgres','service_role') then return case when tg_op='DELETE' then old else new end; end if;
  v_linked := case when tg_op='DELETE' then old.vibe_publication_id is not null else new.vibe_publication_id is not null end;
  if v_linked then raise exception 'Structured publication discovery rows are synchronized from vibe_publications and cannot be edited directly'; end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;

do $$ declare r record; begin
  for r in select id from public.vibe_publications where format='ebook' loop
    perform public.ce_reconcile_ebook_index_internal(r.id);
  end loop;
end $$;

commit;
