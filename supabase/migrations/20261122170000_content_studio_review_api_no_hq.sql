-- Content Studio independent review implementations; preserves existing machine-review receipts,
-- author/reviewer separation, assessment integrity and exact fingerprint approval.
-- No delegation to legacy HQ review RPCs. Legacy entrypoints remain for compatibility.
begin;

create or replace function public.content_run_publication_release_check(p_publication_id uuid)
returns table(check_code text,status text,score numeric,details jsonb)
language plpgsql
security definer
set search_path=public,pg_temp
as $
declare ch record; wc int; oc int; rc int; td int; ib int; ab int; canonical_ai int; delivery_ai int; ai int; stale_derivatives int; research_blockers int; rights_blockers int; expected_interactive boolean; v_publication_status text;
begin
 perform public.ce_require_independent_content_approver(p_publication_id,null);
 select status into v_publication_status from public.vibe_publications vp where vp.id=p_publication_id; if not found then raise exception 'Publication not found'; end if;
 delete from public.publication_release_checks where publication_id=p_publication_id;
 select count(*) into research_blockers
 from public.curriculum_intelligence_proposals cip
 left join lateral (
   select crj.status research_status,crj.evidence_score
   from public.curriculum_research_jobs crj
   where crj.proposal_id=cip.id order by crj.created_at desc limit 1
 ) latest on true
 where cip.publication_id=p_publication_id
   and cip.status in ('pending_review','approved')
   and (cip.verification_status<>'verified' or coalesce(latest.research_status,'missing')<>'evidence_ready' or coalesce(latest.evidence_score,0)<.80);
 select count(*) into rights_blockers
 from public.curriculum_content_rights ccr
 join public.curriculum_intelligence_proposals cip on cip.id=ccr.proposal_id
 where cip.publication_id=p_publication_id and ccr.rights_class='unknown_review_required';
 insert into public.publication_release_checks(publication_id,chapter_id,check_code,status,score,details) values
 (p_publication_id,null,'research_evidence',case when research_blockers=0 then 'pass' else 'fail' end,case when research_blockers=0 then 100 else 0 end,jsonb_build_object('blocking_proposals',research_blockers,'minimum_evidence_score',0.80)),
 (p_publication_id,null,'rights_clearance',case when rights_blockers=0 then 'pass' else 'fail' end,case when rights_blockers=0 then 100 else 0 end,jsonb_build_object('unknown_rights_sources',rights_blockers));
 for ch in select vc.* from public.vibe_chapters vc where vc.publication_id=p_publication_id order by vc.number loop
  wc:=coalesce(ch.word_count,0);
  select count(*) filter(where cb.block_type='interactive'),count(*) filter(where cb.is_assessable) into ib,ab from public.content_blocks cb where cb.chapter_id=ch.id and (cb.status='published' or (v_publication_status='draft' and cb.status='draft'));
  select count(*) into oc from public.chapter_learning_outcome_links cl where cl.chapter_id=ch.id;
  select count(*) into rc from public.learning_resources lr where lr.chapter_id=ch.id and lr.status='active';
  select count(*) into td from public.content_derivatives cd where cd.source_chapter_id=ch.id and cd.audience='teacher' and cd.status='approved';
  select count(*) into stale_derivatives from public.content_derivatives cd where cd.source_chapter_id=ch.id and cd.status='stale';
  select count(distinct gai.id) into canonical_ai
  from public.generated_assessment_items gai
  join public.generated_assessments ga on ga.id=gai.assessment_id
  join public.content_assessment_blueprints cab on cab.id=ga.blueprint_id
  join public.content_assessment_sources cas on cas.blueprint_id=cab.id
  join public.learning_resources lr on lr.id=cas.resource_id
  where lr.chapter_id=ch.id and lr.publication_id=p_publication_id
    and ga.status in ('approved','published')
    and gai.source_block_id in (select cb.id from public.content_blocks cb where cb.chapter_id=ch.id and (cb.status='published' or (v_publication_status='draft' and cb.status='draft')));
  select count(*) into delivery_ai from public.assessment_items aii
  where aii.source_block_id in (select cb.id from public.content_blocks cb where cb.chapter_id=ch.id and (cb.status='published' or (v_publication_status='draft' and cb.status='draft'))) and aii.status='approved';
  ai:=canonical_ai+delivery_ai;
  expected_interactive:=exists(select 1 from public.content_blocks cb where cb.chapter_id=ch.id and (cb.status='published' or (v_publication_status='draft' and cb.status='draft')) and cb.block_type='interactive') or coalesce(ch.blocks,'[]'::jsonb)::text ~* 'interactive|simulation|lab|experiment|diagram';
  insert into public.publication_release_checks(publication_id,chapter_id,check_code,status,score,details) values
  (p_publication_id,ch.id,'depth',case when wc>=1200 then 'pass' when wc>=900 then 'warn' else 'fail' end,least(100,wc/12.0),jsonb_build_object('word_count',wc,'target',1200)),
  (p_publication_id,ch.id,'curriculum_outcomes',case when oc>0 then 'pass' else 'fail' end,case when oc>0 then 100 else 0 end,jsonb_build_object('mapped_outcomes',oc)),
  (p_publication_id,ch.id,'canonical_resource',case when rc>0 then 'pass' else 'fail' end,case when rc>0 then 100 else 0 end,jsonb_build_object('active_resources',rc)),
  (p_publication_id,ch.id,'teacher_guide',case when td>0 then 'pass' else 'fail' end,case when td>0 then 100 else 0 end,jsonb_build_object('approved_teacher_derivatives',td)),
  (p_publication_id,ch.id,'assessment',case when ai>=6 then 'pass' when ai>=3 then 'warn' else 'fail' end,least(100,ai*100.0/6),jsonb_build_object('canonical_approved_items',canonical_ai,'delivery_approved_items',delivery_ai,'target',6)),
  (p_publication_id,ch.id,'interactive',case when expected_interactive and ib=0 then 'fail' when ib>0 then 'pass' else 'warn' end,case when ib>0 then 100 when expected_interactive then 0 else 70 end,jsonb_build_object('published_interactive_blocks',ib,'expected_from_content',expected_interactive)),
  (p_publication_id,ch.id,'assessable_blocks',case when ab>=2 then 'pass' else 'fail' end,least(100,ab*50.0),jsonb_build_object('published_assessable_blocks',ab,'target',2)),
  (p_publication_id,ch.id,'derivative_freshness',case when stale_derivatives=0 then 'pass' else 'fail' end,case when stale_derivatives=0 then 100 else 0 end,jsonb_build_object('stale_derivatives',stale_derivatives));
 end loop;
 return query select prc.check_code,prc.status,prc.score,prc.details from public.publication_release_checks prc where prc.publication_id=p_publication_id order by prc.chapter_id nulls first,prc.check_code;
end $;


CREATE OR REPLACE FUNCTION public.content_review_teacher_guide(p_derivative_id uuid, p_approve boolean, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare d public.content_derivatives%rowtype; begin
 -- Scoped, authenticated, independent content reviewer checked after artifact lookup.
 select * into d from public.content_derivatives where id=p_derivative_id for update; if not found then raise exception 'Teacher guide not found'; end if;
 if d.body->>'kind'<>'teacher_guide' then raise exception 'TEACHER_GUIDE_SHAPE_REQUIRED'; end if;
 perform public.ce_require_independent_content_approver(d.source_publication_id,d.created_by);
 if p_approve and not public.ce_is_human_content_approver(auth.uid()) then
   perform public.ce_require_machine_review_receipt(
     d.source_publication_id,'teacher_guide',d.id,
     encode(extensions.digest(convert_to(d.body::text,'UTF8'),'sha256'),'hex')
   );
 end if;
 if not coalesce(p_approve,false) and not public.ce_is_human_content_approver(auth.uid()) then
   raise exception 'MACHINE_REJECTION_REQUIRES_INDEPENDENT_NEGATIVE_REVIEW';
 end if;
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

 return jsonb_build_object('derivative_id',p_derivative_id,'status',d.status);
end $function$;

CREATE OR REPLACE FUNCTION public.content_review_generated_assessment(p_assessment_id uuid, p_approve boolean, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare a public.generated_assessments%rowtype; v_items int; v_missing_source int; v_missing_answer int; v_marks numeric; v_publication uuid; v_pub_count integer; begin
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
 if p_approve and not public.ce_is_human_content_approver(auth.uid()) then
   perform public.ce_require_machine_review_receipt(
     v_publication,'assessment',a.id,public.ce_machine_assessment_sha256(a.id)
   );
 end if;
 if not coalesce(p_approve,false) and not public.ce_is_human_content_approver(auth.uid()) then
   raise exception 'MACHINE_REJECTION_REQUIRES_INDEPENDENT_NEGATIVE_REVIEW';
 end if;
 if p_approve and nullif(btrim(p_note),'') is null then raise exception 'INDEPENDENT_REVIEW_NOTE_REQUIRED'; end if;
 if a.status<>'moderation' then raise exception 'Assessment is not in moderation'; end if;
 select count(*),count(*) filter(where source_block_id is null),count(*) filter(where coalesce(answer_key,'{}'::jsonb)='{}'::jsonb),coalesce(sum(marks),0) into v_items,v_missing_source,v_missing_answer,v_marks from public.generated_assessment_items where assessment_id=p_assessment_id;
 if p_approve and (v_items<6 or v_missing_source>0 or v_missing_answer>0 or v_marks<>a.total_marks) then raise exception 'Assessment moderation gate failed: items %, missing_source %, missing_answer %, item_marks %, assessment_marks %',v_items,v_missing_source,v_missing_answer,v_marks,a.total_marks; end if;
 update public.generated_assessments set status=case when p_approve then 'approved' else 'archived' end,moderated_by=auth.uid(),moderated_at=now(),updated_at=now() where id=p_assessment_id returning * into a;
 if p_approve then update public.content_assessment_blueprints set status='approved',updated_at=now() where id=a.blueprint_id; end if;

 return jsonb_build_object('assessment_id',p_assessment_id,'status',a.status,'item_count',v_items,'total_marks',v_marks);
end $function$;

CREATE OR REPLACE FUNCTION public.content_review_publication_release(p_publication_id uuid, p_approve boolean, p_notes text DEFAULT ''::text)
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
  if p_approve and not public.ce_is_human_content_approver(auth.uid()) then
    perform public.ce_require_machine_review_receipt(
      p_publication_id,'release',p_publication_id,
      public.publication_release_fingerprint(p_publication_id)
    );
  end if;
  if not coalesce(p_approve,false) and not public.ce_is_human_content_approver(auth.uid()) then
    raise exception 'MACHINE_REJECTION_REQUIRES_INDEPENDENT_NEGATIVE_REVIEW';
  end if;
  if coalesce(p_approve,false) and nullif(btrim(p_notes),'') is null then
    raise exception 'INDEPENDENT_REVIEW_NOTE_REQUIRED';
  end if;

  if not exists(select 1 from public.vibe_publications where id=p_publication_id and status='draft') then
    raise exception 'Draft publication required for release review';
  end if;

  if coalesce(p_approve,false) then
    perform 1 from public.content_run_publication_release_check(p_publication_id);

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
end $function$;

revoke all on function public.content_review_teacher_guide(uuid,boolean,text) from public,anon,service_role;
grant execute on function public.content_review_teacher_guide(uuid,boolean,text) to authenticated;
revoke all on function public.content_review_generated_assessment(uuid,boolean,text) from public,anon,service_role;
grant execute on function public.content_review_generated_assessment(uuid,boolean,text) to authenticated;
revoke all on function public.content_review_publication_release(uuid,boolean,text) from public,anon,service_role;
grant execute on function public.content_review_publication_release(uuid,boolean,text) to authenticated;
revoke all on function public.content_run_publication_release_check(uuid) from public,anon,service_role;
grant execute on function public.content_run_publication_release_check(uuid) to authenticated;
commit;
