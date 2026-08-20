-- P0 pilot content release governance.
-- Publishing is consequential: a draft may only become learner-visible after the
-- repository release checks pass and an authenticated platform owner explicitly
-- approves the exact reviewed content fingerprint. No service-role/worker bypass.
-- access: owner-only public.publication_release_approvals
-- authorization-test: public.publication_release_approvals

create table if not exists public.publication_release_approvals (
  publication_id uuid primary key references public.vibe_publications(id) on delete cascade,
  status text not null check (status in ('approved','rejected')),
  content_fingerprint text not null,
  reviewed_by uuid not null references auth.users(id),
  reviewed_at timestamptz not null default clock_timestamp(),
  notes text not null default ''
);

alter table public.publication_release_approvals enable row level security;
revoke all on table public.publication_release_approvals from public,anon,authenticated,service_role;

create or replace function public.publication_release_fingerprint(p_publication_id uuid)
returns text
language sql
security definer
set search_path=public,pg_temp
stable
as $$
  select md5(
    jsonb_build_object(
      'publication', to_jsonb(p) - array['total_reads','earnings_ksh','published_at','created_at','updated_at'],
      'chapters', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'chapter', to_jsonb(c) - array['published_at','created_at','updated_at'],
            'blocks', coalesce((
              select jsonb_agg(to_jsonb(b) - array['created_at','updated_at'] order by b.sequence,b.id)
              from public.content_blocks b where b.chapter_id=c.id
            ),'[]'::jsonb),
            'official_outcomes', coalesce((
              select jsonb_agg(to_jsonb(o) order by o.id)
              from public.curriculum_learning_outcomes o
              where o.curriculum_id=c.curriculum_id and o.status='active' and o.source_type='official'
            ),'[]'::jsonb),
            'resources', coalesce((
              select jsonb_agg(to_jsonb(r) order by r.id)
              from public.learning_resources r where r.chapter_id=c.id
            ),'[]'::jsonb),
            'teacher_derivatives', coalesce((
              select jsonb_agg(to_jsonb(d) order by d.id)
              from public.content_derivatives d where d.source_chapter_id=c.id and d.audience='teacher'
            ),'[]'::jsonb),
            'assessment_items', coalesce((
              select jsonb_agg(to_jsonb(gai) order by gai.id)
              from public.generated_assessment_items gai
              join public.generated_assessments ga on ga.id=gai.assessment_id
              join public.content_assessment_blueprints bp on bp.id=ga.blueprint_id
              where bp.title ilike '%'||c.title||'%'
            ),'[]'::jsonb)
          ) order by c.number,c.id
        )
        from public.vibe_chapters c where c.publication_id=p.id
      ),'[]'::jsonb)
    )::text
  )
  from public.vibe_publications p
  where p.id=p_publication_id
$$;

revoke all on function public.publication_release_fingerprint(uuid) from public,anon,authenticated,service_role;

create or replace function public.hq_review_publication_release(
  p_publication_id uuid,
  p_approve boolean,
  p_notes text default ''
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  v_fingerprint text;
  v_chapters integer;
  v_checks integer;
  v_failures integer;
begin
  if v_uid is null or not public.is_platform_owner() then
    raise exception 'HQ platform owner required';
  end if;

  if not exists(select 1 from public.vibe_publications where id=p_publication_id and status='draft') then
    raise exception 'Draft publication required for release review';
  end if;

  if coalesce(p_approve,false) then
    perform 1 from public.hq_run_publication_release_check(p_publication_id);

    select count(*) into v_chapters from public.vibe_chapters where publication_id=p_publication_id;
    select count(*), count(*) filter(where status='fail')
      into v_checks,v_failures
      from public.publication_release_checks
      where publication_id=p_publication_id;

    if v_chapters < 1 or v_checks <> v_chapters*7 or v_failures <> 0 then
      raise exception 'publication_release_checks_not_green:chapters=%,checks=%,failures=%',v_chapters,v_checks,v_failures;
    end if;
  end if;

  v_fingerprint:=public.publication_release_fingerprint(p_publication_id);
  if v_fingerprint is null then raise exception 'Publication not found'; end if;

  insert into public.publication_release_approvals(
    publication_id,status,content_fingerprint,reviewed_by,reviewed_at,notes
  ) values (
    p_publication_id,
    case when coalesce(p_approve,false) then 'approved' else 'rejected' end,
    v_fingerprint,v_uid,clock_timestamp(),coalesce(p_notes,'')
  )
  on conflict(publication_id) do update set
    status=excluded.status,
    content_fingerprint=excluded.content_fingerprint,
    reviewed_by=excluded.reviewed_by,
    reviewed_at=excluded.reviewed_at,
    notes=excluded.notes;

  return jsonb_build_object(
    'publication_id',p_publication_id,
    'status',case when coalesce(p_approve,false) then 'approved' else 'rejected' end,
    'content_fingerprint',v_fingerprint,
    'reviewed_by',v_uid
  );
end $$;

revoke all on function public.hq_review_publication_release(uuid,boolean,text) from public,anon,service_role;
grant execute on function public.hq_review_publication_release(uuid,boolean,text) to authenticated;

create or replace function public.publish_publication(p_publication_id uuid)
returns table(publication_id uuid, operation text)
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  v_author_id uuid;
  v_format text;
  v_title text;
  v_subject text;
  v_grade text;
  v_pricing jsonb;
  v_now timestamptz:=now();
  v_current_fingerprint text;
  v_approved_fingerprint text;
begin
  select author_id,format,title,cbc_subject,cbc_grade,pricing
    into v_author_id,v_format,v_title,v_subject,v_grade,v_pricing
    from public.vibe_publications where id=p_publication_id for update;
  if not found then raise exception 'Publication % not found',p_publication_id; end if;
  if v_format not in('vibetextbook','ebook') then raise exception 'Publication format % is not supported by Content Studio lifecycle',v_format; end if;
  if auth.uid() is distinct from v_author_id then raise exception 'Not authorized to publish publication %',p_publication_id; end if;

  perform public.hq_require_policy_enabled(case when v_format='vibetextbook' then 'vibebooks' else 'vibelearn' end,'publication.release_enabled');
  if nullif(btrim(v_title),'') is null then raise exception 'Title is required before publishing'; end if;
  if v_format='vibetextbook' and nullif(btrim(v_subject),'') is null then raise exception 'CBC subject is required before publishing'; end if;
  if v_format='vibetextbook' and nullif(btrim(v_grade),'') is null then raise exception 'CBC grade is required before publishing'; end if;
  if not exists(select 1 from public.vibe_chapters where publication_id=p_publication_id) then raise exception 'At least one chapter is required before publishing'; end if;

  v_current_fingerprint:=public.publication_release_fingerprint(p_publication_id);
  select content_fingerprint into v_approved_fingerprint
    from public.publication_release_approvals
    where publication_id=p_publication_id and status='approved';
  if v_approved_fingerprint is null then raise exception 'publication_release_approval_required'; end if;
  if v_approved_fingerprint is distinct from v_current_fingerprint then raise exception 'publication_release_approval_stale'; end if;
  if exists(select 1 from public.publication_release_checks where publication_id=p_publication_id and status='fail') then
    raise exception 'publication_release_checks_not_green';
  end if;

  update public.vibe_publications set status='published',published_at=coalesce(published_at,v_now),updated_at=v_now where id=p_publication_id;
  update public.vibe_chapters
     set status=case when coalesce(v_pricing->>'type','free') in('paid','school_license') then 'locked'
                     when coalesce(v_pricing->>'type','free')='freemium' and number>greatest(coalesce((v_pricing->>'freeChapters')::integer,0),0) then 'locked'
                     else 'published' end,
         published_at=case when coalesce(v_pricing->>'type','free') in('paid','school_license') then published_at
                           when coalesce(v_pricing->>'type','free')='freemium' and number>greatest(coalesce((v_pricing->>'freeChapters')::integer,0),0) then published_at
                           else coalesce(published_at,v_now) end,
         updated_at=v_now
   where publication_id=p_publication_id and status='draft';
  update public.content_blocks cb
     set status=case when vc.status='published' then 'published' else 'draft' end,updated_at=v_now
    from public.vibe_chapters vc
   where cb.chapter_id=vc.id and vc.publication_id=p_publication_id
     and cb.status is distinct from case when vc.status='published' then 'published' else 'draft' end;
  perform public.ce_capture_publication_revision(p_publication_id,'publish');
  if v_format='vibetextbook' then perform public.sync_vibelearn_textbook_index(p_publication_id); end if;
  return query select p_publication_id,'published'::text;
end $$;

revoke all on function public.publish_publication(uuid) from public,anon;
grant execute on function public.publish_publication(uuid) to authenticated;

do $$
declare d text;
begin
  if has_table_privilege('anon','public.publication_release_approvals','SELECT')
     or has_table_privilege('authenticated','public.publication_release_approvals','SELECT')
     or has_table_privilege('service_role','public.publication_release_approvals','SELECT') then
    raise exception 'publication_release_approval_table_exposed';
  end if;
  if has_function_privilege('anon','public.hq_review_publication_release(uuid,boolean,text)','EXECUTE')
     or has_function_privilege('service_role','public.hq_review_publication_release(uuid,boolean,text)','EXECUTE') then
    raise exception 'publication_release_human_approval_boundary_exposed';
  end if;
  select lower(pg_get_functiondef('public.publish_publication(uuid)'::regprocedure)) into d;
  if position('publication_release_approval_required' in d)=0
     or position('publication_release_approval_stale' in d)=0
     or position('publication_release_fingerprint' in d)=0 then
    raise exception 'publish_publication_release_gate_missing';
  end if;
end $$;
