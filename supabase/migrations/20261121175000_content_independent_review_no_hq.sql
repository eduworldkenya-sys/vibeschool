-- Content-only approval removal: old RPC names kept for API compatibility.

-- Does NOT change curriculum authority, resource certification, final publish authorization, tenant ownership, or HQ administration.

-- Publisher still Mumbi2; reviewer must be a distinct active permitted actor. Evidence/QA checks still apply.

begin;

-- Supersedes the manual platform-owner gate ONLY for the three content-approval decisions.
-- This role check reuses the existing permission registry, not a second authority table.
-- A reviewer may use the RPCs directly; no HQ page or platform-owner identity is required.
create or replace function public.ce_require_independent_content_approver(
  p_publication_id uuid, p_created_by uuid default null)
returns void language plpgsql security definer set search_path=public,pg_temp
as $content_authority$
declare v_actor uuid:=auth.uid(); v_author uuid;
begin
  if v_actor is null or not public.hq_profile_is_active(v_actor) or not exists (
    select 1 from public.hq_human_members hm
    where hm.profile_id=v_actor and hm.status='active' and hm.revoked_at is null
      and hm.suspended_at is null
      and (hm.access_expires_at is null or hm.access_expires_at>clock_timestamp())
      and hm.role in ('reviewer','partner_admin','hq_admin')
      and 'content.approve'=any(hm.permissions)
  ) then
    raise exception using errcode='42501',message='CONTENT_APPROVER_AUTH_REQUIRED';
  end if;
  select author_id into v_author from public.vibe_publications
   where id=p_publication_id and status='draft';
  if v_author is null then
    raise exception using errcode='23514',message='REVIEWABLE_DRAFT_PUBLICATION_REQUIRED';
  end if;
  if v_actor=v_author or (p_created_by is not null and v_actor=p_created_by) then
    raise exception using errcode='42501',message='AUTHOR_CANNOT_INDEPENDENTLY_APPROVE';
  end if;
end $content_authority$;
revoke all on function public.ce_require_independent_content_approver(uuid,uuid)
  from public,anon,authenticated,service_role;


CREATE OR REPLACE FUNCTION public.hq_review_teacher_guide(p_derivative_id uuid, p_approve boolean, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare d public.content_derivatives%rowtype; v_work uuid; begin
 -- Scoped, authenticated, independent content reviewer checked after artifact lookup.
 select * into d from public.content_derivatives where id=p_derivative_id for update; if not found then raise exception 'Teacher guide not found'; end if;
 if d.body->>'kind'<>'teacher_guide' then raise exception 'TEACHER_GUIDE_SHAPE_REQUIRED'; end if;
 perform public.ce_require_independent_content_approver(d.source_publication_id,d.created_by);
 if p_approve then
   if nullif(btrim(p_note),'') is null then raise exception 'INDEPENDENT_REVIEW_NOTE_REQUIRED'; end if;
   if coalesce((public.content_worker_teacher_guide_self_review(d.body,d.quality)->>'passed')::boolean,false) is distinct from true then
     raise exception 'TEACHER_GUIDE_QUALITY_CHECK_FAILED';
   end if;
   if d.source_chapter_id is null or d.source_resource_id is null or
      not exists (select 1 from public.vibe_chapters c where c.id=d.source_chapter_id and c.publication_id=d.source_publication_id) or
      not exists (select 1 from public.learning_resources r where r.id=d.source_resource_id and r.chapter_id=d.source_chapter_id and r.publication_id=d.source_publication_id)
      then raise exception 'TEACHER_GUIDE_SOURCE_SCOPE_REQUIRED'; end if;
 end if;
 if d.derivative_type<>'teacher_notes' or d.audience<>'teacher' or d.status<>'draft' then raise exception 'Teacher guide is not reviewable'; end if;
 update public.content_derivatives set status=case when p_approve then 'approved' else 'archived' end,quality=coalesce(quality,'{}'::jsonb)||jsonb_build_object('reviewed_by',auth.uid(),'reviewed_at',now(),'review_note',p_note,'approved',p_approve),updated_at=now() where id=p_derivative_id returning * into d;
 update public.hq_work_items set status='resolved',acted_at=now(),resolved_at=now(),owner_id=coalesce(owner_id,auth.uid()),verification_status=case when p_approve then 'verified' else 'not_required' end,action_taken=jsonb_build_object('action',case when p_approve then 'approve_teacher_guide' else 'reject_teacher_guide' end,'derivative_id',p_derivative_id,'note',p_note),verification_evidence=jsonb_build_object('derivative_status',d.status),updated_at=now() where source_type='content_derivative' and source_id=p_derivative_id and status in ('open','in_progress','waiting_approval') returning id into v_work;
 return jsonb_build_object('derivative_id',p_derivative_id,'status',d.status,'hq_work_item_id',v_work);
end $function$


CREATE OR REPLACE FUNCTION public.hq_review_generated_assessment(p_assessment_id uuid, p_approve boolean, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare a public.generated_assessments%rowtype; v_items int; v_missing_source int; v_missing_answer int; v_marks numeric; v_work uuid; v_publication uuid; v_pub_count integer; begin
 -- Independent content permission checked against the only linked publication below.
 select * into a from public.generated_assessments where id=p_assessment_id for update; if not found then raise exception 'Assessment not found'; end if;
 select count(distinct r.publication_id),(array_agg(distinct r.publication_id))[1]
 into v_pub_count,v_publication
 from public.content_assessment_sources cas
 join public.learning_resources r on r.id=cas.resource_id
 where cas.blueprint_id=a.blueprint_id;
 if v_pub_count is distinct from 1 or v_publication is null then
   raise exception 'ASSESSMENT_SINGLE_PUBLICATION_SCOPE_REQUIRED';
 end if;
 perform public.ce_require_independent_content_approver(v_publication,a.generated_by);
 if p_approve and nullif(btrim(p_note),'') is null then raise exception 'INDEPENDENT_REVIEW_NOTE_REQUIRED'; end if;
 if a.status<>'moderation' then raise exception 'Assessment is not in moderation'; end if;
 select count(*),count(*) filter(where source_block_id is null),count(*) filter(where coalesce(answer_key,'{}'::jsonb)='{}'::jsonb),coalesce(sum(marks),0) into v_items,v_missing_source,v_missing_answer,v_marks from public.generated_assessment_items where assessment_id=p_assessment_id;
 if p_approve and (v_items<6 or v_missing_source>0 or v_missing_answer>0 or v_marks<>a.total_marks) then raise exception 'Assessment moderation gate failed: items %, missing_source %, missing_answer %, item_marks %, assessment_marks %',v_items,v_missing_source,v_missing_answer,v_marks,a.total_marks; end if;
 update public.generated_assessments set status=case when p_approve then 'approved' else 'archived' end,moderated_by=auth.uid(),moderated_at=now(),updated_at=now() where id=p_assessment_id returning * into a;
 if p_approve then update public.content_assessment_blueprints set status='approved',updated_at=now() where id=a.blueprint_id; end if;
 update public.hq_work_items set status='resolved',acted_at=now(),resolved_at=now(),owner_id=coalesce(owner_id,auth.uid()),verification_status=case when p_approve then 'verified' else 'not_required' end,action_taken=jsonb_build_object('action',case when p_approve then 'approve_assessment' else 'reject_assessment' end,'assessment_id',p_assessment_id,'note',p_note),verification_evidence=jsonb_build_object('assessment_status',a.status,'item_count',v_items,'missing_source',v_missing_source,'missing_answer',v_missing_answer,'total_marks',v_marks),updated_at=now() where source_type='generated_assessment' and source_id=p_assessment_id and status in ('open','in_progress','waiting_approval') returning id into v_work;
 return jsonb_build_object('assessment_id',p_assessment_id,'status',a.status,'item_count',v_items,'total_marks',v_marks,'hq_work_item_id',v_work);
end $function$


CREATE OR REPLACE FUNCTION public.hq_review_publication_release(p_publication_id uuid, p_approve boolean, p_notes text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_fingerprint text;
  v_chapters integer;
  v_checks integer;
  v_failures integer;
begin
  perform public.ce_require_independent_content_approver(p_publication_id,null);
  if coalesce(p_approve,false) and nullif(btrim(p_notes),'') is null then
    raise exception 'INDEPENDENT_REVIEW_NOTE_REQUIRED';
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

    if v_chapters < 1 or v_checks <> (v_chapters*8 + 2) or v_failures <> 0 then
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
end $function$


revoke all on function public.hq_review_teacher_guide(uuid,boolean,text) from public,anon,service_role;

grant execute on function public.hq_review_teacher_guide(uuid,boolean,text) to authenticated;

revoke all on function public.hq_review_generated_assessment(uuid,boolean,text) from public,anon,service_role;

grant execute on function public.hq_review_generated_assessment(uuid,boolean,text) to authenticated;

revoke all on function public.hq_review_publication_release(uuid,boolean,text) from public,anon,service_role;

grant execute on function public.hq_review_publication_release(uuid,boolean,text) to authenticated;

commit;