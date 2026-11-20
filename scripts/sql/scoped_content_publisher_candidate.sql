-- Non-activating SQL candidate. Apply only under rollback for review/testing.
-- The existing publication release approval remains the approval authority.
alter table public.publication_release_approvals
 add column if not exists delegated_publisher_id uuid references auth.users(id),
 add column if not exists delegation_fingerprint text,
 add column if not exists delegated_by uuid references auth.users(id),
 add column if not exists delegated_at timestamptz,
 add column if not exists delegation_expires_at timestamptz,
 add column if not exists delegation_revoked_by uuid references auth.users(id),
 add column if not exists delegation_revoked_at timestamptz;

create or replace function public.hq_bind_publication_release_publisher(p_publication_id uuid,p_publisher_id uuid,p_expires_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.publication_release_approvals%rowtype; p public.vibe_publications%rowtype; actor uuid:=auth.uid();
begin
 if actor is null or not public.is_platform_owner() then raise exception 'authenticated_platform_owner_required'; end if;
 if p_publisher_id is null or p_publisher_id=actor or not public.hq_profile_is_active(p_publisher_id) then raise exception 'distinct_active_publisher_required'; end if;
 if p_expires_at is null or p_expires_at<=clock_timestamp() or p_expires_at>clock_timestamp()+interval '24 hours' then raise exception 'bounded_publisher_expiry_required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('vs:sole-platform-publisher',0));
 select * into p from public.vibe_publications where id=p_publication_id for update;
 if not found or p.status<>'draft' or p.format not in ('vibetextbook','ebook') then raise exception 'eligible_draft_required'; end if;
 if p.author_id=p_publisher_id then raise exception 'publisher_must_be_distinct_from_draft_author'; end if;
 select * into a from public.publication_release_approvals where publication_id=p_publication_id for update;
 if not found or a.status<>'approved' or a.content_fingerprint is distinct from public.publication_release_fingerprint(p_publication_id) then raise exception 'current_approved_fingerprint_required'; end if;
 if p_publisher_id=a.reviewed_by then raise exception 'reviewer_cannot_be_delegated_publisher'; end if;
 if exists(select 1 from public.publication_release_approvals other where other.delegated_publisher_id is not null and other.delegation_revoked_at is null and other.delegation_expires_at>clock_timestamp() and other.delegated_publisher_id<>p_publisher_id) then raise exception 'another_operational_publisher_is_active'; end if;
 update public.publication_release_approvals set delegated_publisher_id=p_publisher_id,delegation_fingerprint=a.content_fingerprint,
 delegated_by=actor,delegated_at=clock_timestamp(),delegation_expires_at=p_expires_at,delegation_revoked_by=null,delegation_revoked_at=null where publication_id=p_publication_id;
 return jsonb_build_object('publication_id',p_publication_id,'publisher_id',p_publisher_id,'expires_at',p_expires_at,'fingerprint',a.content_fingerprint);
end $$;
revoke all on function public.hq_bind_publication_release_publisher(uuid,uuid,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.hq_bind_publication_release_publisher(uuid,uuid,timestamptz) to authenticated;

create or replace function public.hq_revoke_publication_release_publisher(p_publication_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or not public.is_platform_owner() then raise exception 'authenticated_platform_owner_required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('vs:sole-platform-publisher',0));
 perform 1 from public.vibe_publications where id=p_publication_id for update;
 update public.publication_release_approvals set delegation_revoked_by=actor,delegation_revoked_at=clock_timestamp()
 where publication_id=p_publication_id and delegated_publisher_id is not null and delegation_revoked_at is null;
end $$;
revoke all on function public.hq_revoke_publication_release_publisher(uuid) from public,anon,authenticated,service_role;
grant execute on function public.hq_revoke_publication_release_publisher(uuid) to authenticated;

create or replace function public.ce_require_scoped_release_publisher(p_publication_id uuid,p_check_fingerprint boolean)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.publication_release_approvals%rowtype; actor uuid:=auth.uid();
begin
 select * into a from public.publication_release_approvals where publication_id=p_publication_id for update;
 if not found or a.delegated_publisher_id is null then return false; end if;
 if actor is null or actor is distinct from a.delegated_publisher_id or not public.hq_profile_is_active(actor) then raise exception 'scoped_publisher_required'; end if;
 if a.delegated_at is null or a.delegated_by is null or a.delegation_expires_at is null or a.delegation_revoked_at is not null or a.delegation_expires_at<=clock_timestamp() then raise exception 'scoped_publisher_expired_or_revoked'; end if;
 if a.status<>'approved' or a.delegation_fingerprint is distinct from a.content_fingerprint or a.content_fingerprint is null then raise exception 'scoped_publisher_approval_stale'; end if;
 if p_check_fingerprint and a.content_fingerprint is distinct from public.publication_release_fingerprint(p_publication_id) then raise exception 'scoped_publisher_approval_stale'; end if;
 return true;
end $$;
revoke all on function public.ce_require_scoped_release_publisher(uuid,boolean) from public,anon,authenticated,service_role;

create or replace function public.ce_guard_scoped_publication_release()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if old.status='published' and exists(select 1 from public.publication_release_approvals a where a.publication_id=old.id and a.delegated_publisher_id is not null) then
  if new.status='published' and (to_jsonb(new)-array['total_reads','earnings_ksh','total_vibes','updated_at']) is distinct from (to_jsonb(old)-array['total_reads','earnings_ksh','total_vibes','updated_at']) then raise exception 'scoped_live_publication_requires_revision'; end if;
 end if;
 if new.status='published' and old.status is distinct from new.status then
  if public.ce_require_scoped_release_publisher(old.id,true) then
   if (to_jsonb(new)-array['status','published_at','updated_at']) is distinct from (to_jsonb(old)-array['status','published_at','updated_at']) then raise exception 'scoped_release_cannot_edit_publication'; end if;
   perform public.hq_require_policy_enabled(case when old.format='vibetextbook' then 'vibebooks' else 'vibelearn' end,'publication.release_enabled');
   if exists(select 1 from public.publication_release_checks c where c.publication_id=old.id and c.status='fail') then raise exception 'publication_release_checks_not_green'; end if;
  end if;
 end if;
 return new;
end $$;
revoke all on function public.ce_guard_scoped_publication_release() from public,anon,authenticated,service_role;
drop trigger if exists ce_guard_scoped_publication_release on public.vibe_publications;
create trigger ce_guard_scoped_publication_release before update on public.vibe_publications for each row execute function public.ce_guard_scoped_publication_release();

create or replace function public.ce_guard_scoped_chapter_release()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 -- Guard changes to already released scoped chapters, including unchanged status.
 if tg_op='UPDATE' and old.status in ('published','locked') and exists(select 1 from public.publication_release_approvals a where a.publication_id=old.publication_id and a.delegated_publisher_id is not null) then
  if (to_jsonb(new)-array['status','published_at','updated_at']) is distinct from (to_jsonb(old)-array['status','published_at','updated_at']) then raise exception 'scoped_live_chapter_requires_revision'; end if;
 end if;
 if new.status in ('published','locked') then
  if tg_op='INSERT' then
   if exists(select 1 from public.publication_release_approvals where publication_id=new.publication_id and delegated_publisher_id is not null) then raise exception 'scoped_release_new_chapter_requires_new_draft'; end if;
  elsif old.status is distinct from new.status or old.publication_id is distinct from new.publication_id then
   if public.ce_require_scoped_release_publisher(new.publication_id,false) then
    if (to_jsonb(new)-array['status','published_at','updated_at']) is distinct from (to_jsonb(old)-array['status','published_at','updated_at']) then raise exception 'scoped_release_cannot_edit_chapter'; end if;
   end if;
  end if;
 end if;
 return new;
end $$;
revoke all on function public.ce_guard_scoped_chapter_release() from public,anon,authenticated,service_role;
drop trigger if exists ce_guard_scoped_chapter_release on public.vibe_chapters;
create trigger ce_guard_scoped_chapter_release before insert or update on public.vibe_chapters for each row execute function public.ce_guard_scoped_chapter_release();


-- Reuse existing revision capture; preserve public author-only contract.
CREATE OR REPLACE FUNCTION public.ce_capture_publication_revision_internal(p_publication_id uuid, p_reason text, p_actor uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_author uuid;
  v_revision integer;
  v_snapshot jsonb;
begin
  select author_id into v_author
  from public.vibe_publications
  where id=p_publication_id
  for update;

  if not found then raise exception 'Publication not found'; end if;
  if p_actor is null or p_actor is distinct from (select auth.uid()) then
    raise exception 'Not authorized';
  end if;

  select coalesce(max(revision_number),0)+1
  into v_revision
  from public.publication_revisions
  where publication_id=p_publication_id;

  select jsonb_build_object(
    'publication', to_jsonb(p),
    'chapters', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.number)
      from public.vibe_chapters c
      where c.publication_id=p_publication_id
    ), '[]'::jsonb)
  ) into v_snapshot
  from public.vibe_publications p
  where p.id=p_publication_id;

  insert into public.publication_revisions(publication_id, revision_number, snapshot, created_by, reason)
  values(p_publication_id, v_revision, v_snapshot, p_actor, nullif(btrim(p_reason),''));

  return v_revision;
end;
$function$
;
revoke all on function public.ce_capture_publication_revision_internal(uuid,text,uuid) from public,anon,authenticated,service_role;
create or replace function public.ce_capture_publication_revision(p_publication_id uuid,p_reason text default null)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_author uuid;
begin
 select p.author_id into v_author from public.vibe_publications p where p.id=p_publication_id for update;
 if not found then raise exception 'Publication not found'; end if;
 if auth.uid() is null or v_author is distinct from auth.uid() then raise exception 'Not authorized'; end if;
 return public.ce_capture_publication_revision_internal(p_publication_id,p_reason,auth.uid());
end $$;

CREATE OR REPLACE FUNCTION public.publish_publication(p_publication_id uuid)
 RETURNS TABLE(publication_id uuid, operation text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  v_delegated boolean;
begin
  select author_id,format,title,cbc_subject,cbc_grade,pricing into v_author_id,v_format,v_title,v_subject,v_grade,v_pricing from public.vibe_publications where id=p_publication_id for update;
  if not found then raise exception 'Publication % not found',p_publication_id; end if;
  if v_format not in('vibetextbook','ebook') then raise exception 'Publication format % is not supported by Content Studio lifecycle',v_format; end if;
  v_delegated:=public.ce_require_scoped_release_publisher(p_publication_id,true);
  if auth.uid() is null or (not v_delegated and auth.uid() is distinct from v_author_id) then raise exception 'Not authorized to publish publication %',p_publication_id; end if;
  perform public.hq_require_policy_enabled(case when v_format='vibetextbook' then 'vibebooks' else 'vibelearn' end,'publication.release_enabled');
  if nullif(btrim(v_title),'') is null then raise exception 'Title is required before publishing'; end if;
  if v_format='vibetextbook' and nullif(btrim(v_subject),'') is null then raise exception 'CBC subject is required before publishing'; end if;
  if v_format='vibetextbook' and nullif(btrim(v_grade),'') is null then raise exception 'CBC grade is required before publishing'; end if;
  if not exists(select 1 from public.vibe_chapters where publication_id=p_publication_id) then raise exception 'At least one chapter is required before publishing'; end if;
  v_current_fingerprint:=public.publication_release_fingerprint(p_publication_id);
  select a.content_fingerprint into v_approved_fingerprint from public.publication_release_approvals a where a.publication_id=p_publication_id and a.status='approved' for update;
  if v_approved_fingerprint is null then raise exception 'publication_release_approval_required'; end if;
  if v_approved_fingerprint is distinct from v_current_fingerprint then raise exception 'publication_release_approval_stale'; end if;
  if exists(select 1 from public.publication_release_checks c where c.publication_id=p_publication_id and c.status='fail') then raise exception 'publication_release_checks_not_green'; end if;
  update public.vibe_publications set status='published',published_at=coalesce(published_at,v_now),updated_at=v_now where id=p_publication_id;
  update public.vibe_chapters
     set status=case when coalesce(v_pricing->>'type','free') in('paid','school_license') then 'locked'
                     when coalesce(v_pricing->>'type','free')='freemium' and number>greatest(coalesce((v_pricing->>'freeChapters')::integer,0),0) then 'locked'
                     else 'published' end,
         published_at=case when coalesce(v_pricing->>'type','free') in('paid','school_license') then published_at
                           when coalesce(v_pricing->>'type','free')='freemium' and number>greatest(coalesce((v_pricing->>'freeChapters')::integer,0),0) then published_at
                           else coalesce(published_at,v_now) end,
         updated_at=v_now
   where public.vibe_chapters.publication_id=p_publication_id and status='draft';
  update public.content_blocks cb
     set status=case when vc.status='published' then 'published' else 'draft' end,updated_at=v_now
    from public.vibe_chapters vc
   where cb.chapter_id=vc.id and vc.publication_id=p_publication_id
     and cb.status is distinct from case when vc.status='published' then 'published' else 'draft' end;
  if v_delegated then perform public.ce_capture_publication_revision_internal(p_publication_id,'publish',auth.uid());
  else perform public.ce_capture_publication_revision(p_publication_id,'publish'); end if;
  if v_format='vibetextbook' then
    if v_delegated then perform public.ce_reconcile_textbook_index_internal(p_publication_id);
    else perform public.sync_vibelearn_textbook_index(p_publication_id); end if;
  end if;
  return query select p_publication_id,'published'::text;
end $function$
;

create or replace function public.publish_textbook(p_publication_id uuid)
returns table(content_id uuid,operation text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_format text; v_content_id uuid;
begin
 select p.format into v_format from public.vibe_publications p where p.id=p_publication_id;
 if not found or v_format<>'vibetextbook' then raise exception 'textbook_required'; end if;
 perform public.publish_publication(p_publication_id);
 select vc.id into v_content_id from public.vibelearn_content vc where vc.vibe_publication_id=p_publication_id and vc.type='textbook';
 if v_content_id is null then raise exception 'textbook_index_missing_after_release'; end if;
 return query select v_content_id,'updated'::text;
end $$;
revoke all on function public.publish_textbook(uuid) from public,anon,service_role;
grant execute on function public.publish_textbook(uuid) to authenticated;
revoke all on function public.publish_publication(uuid) from public,anon,service_role;
grant execute on function public.publish_publication(uuid) to authenticated;
