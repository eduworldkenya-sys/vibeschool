-- Reconcile per-chapter draft review semantics without auto-publishing.
-- A draft's candidate blocks are valid review inputs while learner delivery remains unpublished.
-- The checker emits 8 checks/chapter + 2 publication-level checks; preserve all thresholds.

create or replace function public.ce_run_publication_release_check(p_publication_id uuid)
returns table(check_code text,status text,score numeric,details jsonb)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare ch record; wc int; oc int; rc int; td int; ib int; ab int; canonical_ai int; delivery_ai int; ai int; stale_derivatives int; research_blockers int; rights_blockers int; expected_interactive boolean; v_publication_status text;
begin
 if current_user not in ('service_role','postgres') and not public.is_platform_owner() then raise exception 'HQ platform owner required'; end if;
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
end $$;

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
end $$;

-- Keep existing REVOKE/GRANT boundaries unchanged: review remains auth.uid + owner guarded.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.hq_review_publication_release(uuid,boolean,text)'::regprocedure) into definition;
  if position('v_chapters*8 + 2' in definition)=0 then raise exception 'Release approval count contract incomplete'; end if;
  select pg_get_functiondef('public.ce_run_publication_release_check(uuid)'::regprocedure) into definition;
  if position('v_publication_status' in definition)=0 then raise exception 'Draft review eligibility missing'; end if;
end $$;
