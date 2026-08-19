-- VibeSchool Task 5: repair the normal content release path needed by the
-- Grade 4 pilot. This preserves author + HQ release authority and fixes two
-- production-proven reconciliation defects: an ambiguous PL/pgSQL output name
-- in publish_publication(), and textbook subject resolution that ignored the
-- publication author's school-scoped canonical subject identity.

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
  where p.id=p_publication_id;

  if not found then raise exception 'Publication % not found',p_publication_id; end if;

  if v_pub.format <> 'vibetextbook' then
    delete from public.vibelearn_content vc
    where vc.vibe_publication_id=p_publication_id and vc.type='textbook';
    return query select null::uuid,'not_textbook'::text;
    return;
  end if;

  select vc.id into v_existing_id
  from public.vibelearn_content vc
  where vc.vibe_publication_id=p_publication_id and vc.type='textbook';

  if v_pub.status <> 'published' and v_existing_id is null then
    return query select null::uuid,'not_indexed_draft'::text;
    return;
  end if;

  select coalesce(sm.school_id,tp.school_id)
  into v_school_id
  from (select 1) d
  left join lateral (
    select x.school_id
    from public.school_members x
    where x.profile_id=v_pub.author_id
    order by x.school_id
    limit 1
  ) sm on true
  left join public.teacher_profiles tp on tp.profile_id=v_pub.author_id
  limit 1;

  -- Subjects are school-scoped in the current Teacher/Student operating model.
  -- Resolve against the author's canonical school first so a common subject name
  -- such as Mathematics does not become ambiguous merely because many schools use it.
  select array_agg(s.id order by s.id)
  into v_subject_ids
  from public.subjects s
  where lower(btrim(s.name))=lower(btrim(coalesce(v_pub.cbc_subject,'')))
    and (v_school_id is null or s.school_id=v_school_id);

  if coalesce(array_length(v_subject_ids,1),0)=1 then
    v_subject_id:=v_subject_ids[1];
  else
    v_subject_id:=null;
  end if;

  v_status:=case when v_pub.status='published' then 'live' else 'draft' end;

  insert into public.vibelearn_content(
    title,description,subject_id,type,url,thumbnail_url,tags,source,
    submitted_by,school_id,status,vibe_publication_id
  ) values (
    v_pub.title,v_pub.description,v_subject_id,'textbook',
    '/read/textbook/'||p_publication_id::text,nullif(v_pub.cover_url,''),
    coalesce(v_pub.tags,'{}'::text[]),'vibetextbook',v_pub.author_id,
    v_school_id,v_status,p_publication_id
  )
  on conflict (vibe_publication_id) where vibe_publication_id is not null do update
  set title=excluded.title,
      description=excluded.description,
      subject_id=excluded.subject_id,
      type='textbook',
      url=excluded.url,
      thumbnail_url=excluded.thumbnail_url,
      tags=excluded.tags,
      source='vibetextbook',
      submitted_by=excluded.submitted_by,
      school_id=excluded.school_id,
      status=excluded.status,
      updated_at=now()
  returning id into v_result_id;

  return query select v_result_id,case when v_existing_id is null then 'inserted' else 'updated' end;
end;
$$;

create or replace function public.publish_publication(p_publication_id uuid)
returns table(publication_id uuid, operation text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_author_id uuid;
  v_format text;
  v_title text;
  v_subject text;
  v_grade text;
  v_pricing jsonb;
  v_now timestamptz:=now();
begin
  select p.author_id,p.format,p.title,p.cbc_subject,p.cbc_grade,p.pricing
  into v_author_id,v_format,v_title,v_subject,v_grade,v_pricing
  from public.vibe_publications p
  where p.id=p_publication_id
  for update;

  if not found then raise exception 'Publication % not found',p_publication_id; end if;
  if v_format not in('vibetextbook','ebook') then
    raise exception 'Publication format % is not supported by Content Studio lifecycle',v_format;
  end if;
  if auth.uid() is distinct from v_author_id then
    raise exception 'Not authorized to publish publication %',p_publication_id;
  end if;

  perform public.hq_require_policy_enabled(
    case when v_format='vibetextbook' then 'vibebooks' else 'vibelearn' end,
    'publication.release_enabled'
  );

  if nullif(btrim(v_title),'') is null then raise exception 'Title is required before publishing'; end if;
  if v_format='vibetextbook' and nullif(btrim(v_subject),'') is null then
    raise exception 'CBC subject is required before publishing';
  end if;
  if v_format='vibetextbook' and nullif(btrim(v_grade),'') is null then
    raise exception 'CBC grade is required before publishing';
  end if;
  if not exists(
    select 1 from public.vibe_chapters vc where vc.publication_id=p_publication_id
  ) then
    raise exception 'At least one chapter is required before publishing';
  end if;

  update public.vibe_publications p
  set status='published',published_at=coalesce(p.published_at,v_now),updated_at=v_now
  where p.id=p_publication_id;

  update public.vibe_chapters vc
  set status=case
        when coalesce(v_pricing->>'type','free') in('paid','school_license') then 'locked'
        when coalesce(v_pricing->>'type','free')='freemium'
          and vc.number>greatest(coalesce((v_pricing->>'freeChapters')::integer,0),0) then 'locked'
        else 'published'
      end,
      published_at=case
        when coalesce(v_pricing->>'type','free') in('paid','school_license') then vc.published_at
        when coalesce(v_pricing->>'type','free')='freemium'
          and vc.number>greatest(coalesce((v_pricing->>'freeChapters')::integer,0),0) then vc.published_at
        else coalesce(vc.published_at,v_now)
      end,
      updated_at=v_now
  where vc.publication_id=p_publication_id and vc.status='draft';

  update public.content_blocks cb
  set status=case when vc.status='published' then 'published' else 'draft' end,
      updated_at=v_now
  from public.vibe_chapters vc
  where cb.chapter_id=vc.id
    and vc.publication_id=p_publication_id
    and cb.status is distinct from case when vc.status='published' then 'published' else 'draft' end;

  perform public.ce_capture_publication_revision(p_publication_id,'publish');
  if v_format='vibetextbook' then
    perform public.sync_vibelearn_textbook_index(p_publication_id);
  end if;

  return query select p_publication_id,'published'::text;
end;
$$;

revoke all on function public.publish_publication(uuid) from public, anon;
grant execute on function public.publish_publication(uuid) to authenticated, service_role;

comment on function public.publish_publication(uuid) is
  'Author-owned publication release with HQ policy gate; Task 5 fixes ambiguous publication_id lookup and canonical VibeLearn subject reconciliation.';