-- Canonical textbook index subject resolution; preservation-only patch.
-- Global subject rows (school_id IS NULL) take precedence over school copies.
-- Keeps release authorization, published-only indexing, school scope and SQL security unchanged.
-- Production baseline: public.ce_reconcile_textbook_index_internal(uuid), 2026-11-23.
-- Rollback: restore this function from the preceding applied migration.
CREATE OR REPLACE FUNCTION public.ce_reconcile_textbook_index_internal(p_publication_id uuid)
 RETURNS TABLE(content_id uuid, operation text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    delete from public.vibelearn_content
    where vibe_publication_id=p_publication_id and type='textbook';
    return query select null::uuid,'not_textbook'::text;
    return;
  end if;

  select id into v_existing_id
  from public.vibelearn_content
  where vibe_publication_id=p_publication_id and type='textbook';

  if v_pub.status <> 'published' and v_existing_id is null then
    return query select null::uuid,'not_indexed_draft'::text;
    return;
  end if;

  select coalesce(sm.school_id,tp.school_id)
  into v_school_id
  from (select 1) d
  left join public.school_members sm on sm.profile_id=v_pub.author_id
  left join public.teacher_profiles tp on tp.profile_id=v_pub.author_id
  limit 1;

  -- Prefer the single canonical (school-independent) subject. School copies
  -- can share the same display name and must not make the index ambiguous.
  select array_agg(id order by id)
  into v_subject_ids
  from public.subjects
  where lower(name)=lower(coalesce(v_pub.cbc_subject,''))
    and school_id is null;

  -- Preserve legacy unique-name behaviour if there is no global subject.
  -- More than one canonical match remains ambiguous and fails closed.
  if coalesce(array_length(v_subject_ids,1),0)=0 then
    select array_agg(id order by id)
    into v_subject_ids
    from public.subjects
    where lower(name)=lower(coalesce(v_pub.cbc_subject,''));
  end if;

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
$function$

