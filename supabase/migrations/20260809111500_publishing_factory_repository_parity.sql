-- Repository parity for the production publishing factory assembled on 2026-08-09.
-- This migration is intentionally idempotent and records the current authoritative
-- orchestration, HQ review, explicit apply, and release-certification contracts.

create unique index if not exists hq_work_items_source_open_uq
on public.hq_work_items(source_type, source_id)
where source_id is not null and status in ('open','in_progress','waiting_approval');

create or replace function public.enqueue_unresearched_proposals()
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare r record; n int:=0;
begin
  for r in
    select p.id
    from public.curriculum_intelligence_proposals p
    where p.status='pending_review'
      and not exists(
        select 1 from public.curriculum_research_jobs j
        where j.proposal_id=p.id
          and j.status in ('queued','running','evidence_ready','needs_human')
      )
  loop
    perform public.enqueue_proposal_research(r.id);
    n:=n+1;
  end loop;
  return n;
end $$;

create or replace function public.hq_run_publication_release_check(p_publication_id uuid)
returns table(check_code text,status text,score numeric,details jsonb)
language sql
security definer
set search_path=public,pg_temp
as $$ select * from public.ce_run_publication_release_check(p_publication_id); $$;

create or replace function public.ce_run_publication_release_check(p_publication_id uuid)
returns table(check_code text,status text,score numeric,details jsonb)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare ch record; wc int; oc int; rc int; td int; ib int; ab int; canonical_ai int; delivery_ai int; ai int; stale_derivatives int; research_blockers int; rights_blockers int; expected_interactive boolean;
begin
 if current_user not in ('service_role','postgres') and not public.is_platform_owner() then raise exception 'HQ platform owner required'; end if;
 if not exists(select 1 from public.vibe_publications vp where vp.id=p_publication_id) then raise exception 'Publication not found'; end if;
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
  select count(*) filter(where cb.block_type='interactive'),count(*) filter(where cb.is_assessable) into ib,ab from public.content_blocks cb where cb.chapter_id=ch.id and cb.status='published';
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
    and gai.source_block_id in (select cb.id from public.content_blocks cb where cb.chapter_id=ch.id and cb.status='published');
  select count(*) into delivery_ai from public.assessment_items aii
  where aii.source_block_id in (select cb.id from public.content_blocks cb where cb.chapter_id=ch.id and cb.status='published') and aii.status='approved';
  ai:=canonical_ai+delivery_ai;
  expected_interactive:=exists(select 1 from public.content_blocks cb where cb.chapter_id=ch.id and cb.status='published' and cb.block_type='interactive') or coalesce(ch.blocks,'[]'::jsonb)::text ~* 'interactive|simulation|lab|experiment|diagram';
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

create or replace function public.hq_sync_content_engine_work(p_publication_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_research int:=0; v_editorial int:=0; v_release int:=0; v_guides int:=0; v_assessments int:=0; v_depth int:=0; v_vibelab int:=0;
begin
 if current_user not in ('service_role','postgres') and not public.is_platform_owner() then raise exception 'HQ platform owner required'; end if;
 insert into public.hq_work_items(department_key,work_type,priority,status,title,summary,source_type,source_id,route,approval_required,evidence)
 select 'learning','research_review',case when p.volatility='high' or p.curriculum_relevance in ('C4','C5') then 'high' else 'normal' end,'open',coalesce(nullif(p.title,''),'Research curriculum proposal'),coalesce(nullif(p.rationale,''),p.claim),'curriculum_intelligence_proposal',p.id,'/hq/content',true,jsonb_build_object('publication_id',p.publication_id,'chapter_id',p.chapter_id,'verification_status',p.verification_status,'editorial_status',p.editorial_status)
 from public.curriculum_intelligence_proposals p where (p_publication_id is null or p.publication_id=p_publication_id) and p.status in ('pending_review','approved') and coalesce(p.verification_status,'')<>'verified' on conflict do nothing; get diagnostics v_research=row_count;
 insert into public.hq_work_items(department_key,work_type,priority,status,title,summary,source_type,source_id,route,approval_required,evidence)
 select 'content','editorial_action',case when a.priority>=85 then 'critical' when a.priority>=65 then 'high' else 'normal' end,'open','Editorial action: '||replace(a.action_type,'_',' '),a.rationale,'curriculum_editorial_action',a.id,'/hq/content',true,jsonb_build_object('publication_id',a.publication_id,'chapter_id',a.chapter_id,'proposal_id',a.proposal_id,'action_status',a.status,'attempt_count',a.attempt_count)
 from public.curriculum_editorial_actions a where (p_publication_id is null or a.publication_id=p_publication_id) and a.status in ('queued','failed','dead_letter') and not (a.proposal_id is null and a.created_by='release-certification-engine') on conflict do nothing; get diagnostics v_editorial=row_count;
 insert into public.hq_work_items(department_key,work_type,priority,status,title,summary,source_type,source_id,route,approval_required,evidence)
 select 'content','teacher_guide_review','high','waiting_approval','Review teacher guide: '||d.title,'A source-grounded teacher guide draft is ready for editorial review.','content_derivative',d.id,'/hq/content',true,jsonb_build_object('publication_id',d.source_publication_id,'chapter_id',d.source_chapter_id,'derivative_type',d.derivative_type,'status',d.status,'quality',d.quality)
 from public.content_derivatives d where d.audience='teacher' and d.derivative_type='teacher_notes' and d.status='draft' and (p_publication_id is null or d.source_publication_id=p_publication_id) on conflict do nothing; get diagnostics v_guides=row_count;
 insert into public.hq_work_items(department_key,work_type,priority,status,title,summary,source_type,source_id,route,approval_required,evidence)
 select 'quality','assessment_moderation','high','waiting_approval','Moderate assessment: '||cab.title,'Canonical publication assessment is generated and requires moderation before release.','generated_assessment',ga.id,'/hq/content',true,jsonb_build_object('publication_id',lr.publication_id,'chapter_id',lr.chapter_id,'blueprint_id',cab.id,'item_count',(select count(*) from public.generated_assessment_items gai where gai.assessment_id=ga.id),'total_marks',ga.total_marks,'status',ga.status)
 from public.generated_assessments ga join public.content_assessment_blueprints cab on cab.id=ga.blueprint_id join public.content_assessment_sources cas on cas.blueprint_id=cab.id join public.learning_resources lr on lr.id=cas.resource_id where ga.status='moderation' and lr.publication_id is not null and (p_publication_id is null or lr.publication_id=p_publication_id) on conflict do nothing; get diagnostics v_assessments=row_count;
 insert into public.hq_work_items(department_key,work_type,priority,status,title,summary,source_type,source_id,route,approval_required,evidence)
 select 'content','content_depth_revision','high','open','Expand chapter depth: '||vc.title,'Published chapter is below the publication-grade depth threshold and requires an evidence-grounded revision.','vibe_chapter',vc.id,'/hq/content',true,jsonb_build_object('publication_id',vc.publication_id,'chapter_id',vc.id,'word_count',prc.details->'word_count','target',prc.details->'target','check_code',prc.check_code,'editorial_action_id',(select a.id from public.curriculum_editorial_actions a where a.chapter_id=vc.id and a.action_type='rewrite_explanation' and a.proposal_id is null and a.created_by='release-certification-engine' order by a.created_at desc limit 1))
 from public.publication_release_checks prc join public.vibe_chapters vc on vc.id=prc.chapter_id where prc.check_code='depth' and prc.status='fail' and (p_publication_id is null or prc.publication_id=p_publication_id) on conflict do nothing; get diagnostics v_depth=row_count;
 insert into public.hq_work_items(department_key,work_type,priority,status,title,summary,source_type,source_id,route,approval_required,evidence)
 select 'content','vibelab_review','high','open','Add VibeLab experience: '||vc.title,'Chapter expects an interactive laboratory/simulation experience but no published interactive block satisfies release certification.','vibe_chapter_vibelab',vc.id,'/hq/content',true,jsonb_build_object('publication_id',vc.publication_id,'chapter_id',vc.id,'release_details',prc.details,'editorial_action_id',(select a.id from public.curriculum_editorial_actions a where a.chapter_id=vc.id and a.action_type='add_vibelab' and a.proposal_id is null and a.created_by='release-certification-engine' order by a.created_at desc limit 1))
 from public.publication_release_checks prc join public.vibe_chapters vc on vc.id=prc.chapter_id where prc.check_code='interactive' and prc.status='fail' and (p_publication_id is null or prc.publication_id=p_publication_id) on conflict do nothing; get diagnostics v_vibelab=row_count;
 insert into public.hq_work_items(department_key,work_type,priority,status,title,summary,source_type,source_id,route,approval_required,evidence)
 select 'quality','publication_release','high','waiting_approval','Publication release blocked: '||vp.title,'Release certification has failing checks.','vibe_publication',vp.id,'/hq/content',true,jsonb_build_object('publication_id',vp.id,'failed_checks',count(*) filter(where prc.status='fail'),'warning_checks',count(*) filter(where prc.status='warn'),'checked_at',max(prc.checked_at))
 from public.vibe_publications vp join public.publication_release_checks prc on prc.publication_id=vp.id where (p_publication_id is null or vp.id=p_publication_id) group by vp.id,vp.title having count(*) filter(where prc.status='fail')>0 on conflict do nothing; get diagnostics v_release=row_count;
 return jsonb_build_object('research_work_created',v_research,'editorial_work_created',v_editorial,'teacher_guide_reviews_created',v_guides,'assessment_moderations_created',v_assessments,'depth_revisions_created',v_depth,'vibelab_reviews_created',v_vibelab,'release_work_created',v_release);
end $$;

create or replace function public.run_connected_content_engine(p_publication_id uuid,p_trigger text default 'manual')
returns uuid language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_run uuid; v_intel uuid; v_checks int:=0; v_failed int:=0; v_warn int:=0; v_sync jsonb; v_intel_trigger text;
begin
 if current_user not in ('service_role','postgres') and not public.is_platform_owner() then raise exception 'HQ platform owner required'; end if;
 if not exists(select 1 from public.vibe_publications where id=p_publication_id) then raise exception 'Publication not found'; end if;
 if p_trigger not in ('scheduled','manual','post_release','recovery') then raise exception 'Invalid orchestration trigger'; end if;
 v_intel_trigger:=case when p_trigger='scheduled' then 'scheduled' else 'manual' end;
 insert into public.content_engine_orchestration_runs(publication_id,trigger_type,status,stages,blockers,started_at,created_by) values(p_publication_id,p_trigger,'running','[]'::jsonb,'[]'::jsonb,now(),auth.uid()) returning id into v_run;
 begin
  v_intel:=public.run_content_intelligence_cycle(v_intel_trigger);
  perform public.enqueue_unresearched_proposals();
  perform public.hq_run_publication_release_check(p_publication_id);
  select count(*),count(*) filter(where status='fail'),count(*) filter(where status='warn') into v_checks,v_failed,v_warn from public.publication_release_checks where publication_id=p_publication_id;
  v_sync:=public.hq_sync_content_engine_work(p_publication_id);
  update public.content_engine_orchestration_runs set status=case when v_failed>0 then 'blocked' else 'completed' end,stages=jsonb_build_array(jsonb_build_object('stage','learning_intelligence','status','completed','intelligence_run_id',v_intel),jsonb_build_object('stage','research_queue','status','completed'),jsonb_build_object('stage','release_certification','status',case when v_failed>0 then 'blocked' else 'passed' end,'checks',v_checks,'failed',v_failed,'warnings',v_warn),jsonb_build_object('stage','hq_sync','status','completed','work_created',v_sync)),blockers=case when v_failed>0 then jsonb_build_array(jsonb_build_object('type','release_checks','count',v_failed)) else '[]'::jsonb end,completed_at=now() where id=v_run;
  return v_run;
 exception when others then
  update public.content_engine_orchestration_runs set status='failed',blockers=jsonb_build_array(jsonb_build_object('type','exception','message',sqlerrm)),completed_at=now() where id=v_run;
  raise;
 end;
end $$;

create or replace function public.hq_review_teacher_guide(p_derivative_id uuid,p_approve boolean,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare d public.content_derivatives%rowtype; v_work uuid;
begin
 if not public.is_platform_owner() then raise exception 'HQ platform owner required'; end if;
 select * into d from public.content_derivatives where id=p_derivative_id for update; if not found then raise exception 'Teacher guide not found'; end if;
 if d.derivative_type<>'teacher_notes' or d.audience<>'teacher' or d.status<>'draft' then raise exception 'Teacher guide is not reviewable'; end if;
 update public.content_derivatives set status=case when p_approve then 'approved' else 'archived' end,quality=coalesce(quality,'{}'::jsonb)||jsonb_build_object('reviewed_by',auth.uid(),'reviewed_at',now(),'review_note',p_note,'approved',p_approve),updated_at=now() where id=p_derivative_id returning * into d;
 update public.hq_work_items set status='resolved',acted_at=now(),resolved_at=now(),owner_id=coalesce(owner_id,auth.uid()),verification_status=case when p_approve then 'verified' else 'not_required' end,action_taken=jsonb_build_object('action',case when p_approve then 'approve_teacher_guide' else 'reject_teacher_guide' end,'derivative_id',p_derivative_id,'note',p_note),verification_evidence=jsonb_build_object('derivative_status',d.status),updated_at=now() where source_type='content_derivative' and source_id=p_derivative_id and status in ('open','in_progress','waiting_approval') returning id into v_work;
 return jsonb_build_object('derivative_id',p_derivative_id,'status',d.status,'hq_work_item_id',v_work);
end $$;

create or replace function public.hq_review_generated_assessment(p_assessment_id uuid,p_approve boolean,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare a public.generated_assessments%rowtype; v_items int; v_missing_source int; v_missing_answer int; v_marks numeric; v_work uuid;
begin
 if not public.is_platform_owner() then raise exception 'HQ platform owner required'; end if;
 select * into a from public.generated_assessments where id=p_assessment_id for update; if not found then raise exception 'Assessment not found'; end if;
 if a.status<>'moderation' then raise exception 'Assessment is not in moderation'; end if;
 select count(*),count(*) filter(where source_block_id is null),count(*) filter(where coalesce(answer_key,'{}'::jsonb)='{}'::jsonb),coalesce(sum(marks),0) into v_items,v_missing_source,v_missing_answer,v_marks from public.generated_assessment_items where assessment_id=p_assessment_id;
 if p_approve and (v_items<6 or v_missing_source>0 or v_missing_answer>0 or v_marks<>a.total_marks) then raise exception 'Assessment moderation gate failed: items %, missing_source %, missing_answer %, item_marks %, assessment_marks %',v_items,v_missing_source,v_missing_answer,v_marks,a.total_marks; end if;
 update public.generated_assessments set status=case when p_approve then 'approved' else 'archived' end,moderated_by=auth.uid(),moderated_at=now(),updated_at=now() where id=p_assessment_id returning * into a;
 if p_approve then update public.content_assessment_blueprints set status='approved',updated_at=now() where id=a.blueprint_id; end if;
 update public.hq_work_items set status='resolved',acted_at=now(),resolved_at=now(),owner_id=coalesce(owner_id,auth.uid()),verification_status=case when p_approve then 'verified' else 'not_required' end,action_taken=jsonb_build_object('action',case when p_approve then 'approve_assessment' else 'reject_assessment' end,'assessment_id',p_assessment_id,'note',p_note),verification_evidence=jsonb_build_object('assessment_status',a.status,'item_count',v_items,'missing_source',v_missing_source,'missing_answer',v_missing_answer,'total_marks',v_marks),updated_at=now() where source_type='generated_assessment' and source_id=p_assessment_id and status in ('open','in_progress','waiting_approval') returning id into v_work;
 return jsonb_build_object('assessment_id',p_assessment_id,'status',a.status,'item_count',v_items,'total_marks',v_marks,'hq_work_item_id',v_work);
end $$;

create or replace function public.hq_review_chapter_revision(p_derivative_id uuid,p_approve boolean,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare d public.content_derivatives%rowtype; v_work uuid; v_blocks jsonb; v_current int; v_added int; v_projected int; v_target int;
begin
 if not public.is_platform_owner() then raise exception 'HQ platform owner required'; end if;
 select * into d from public.content_derivatives where id=p_derivative_id for update; if not found then raise exception 'Revision draft not found'; end if;
 if d.derivative_type<>'revision_notes' or d.audience<>'student' or d.status<>'draft' then raise exception 'Revision draft is not reviewable'; end if;
 v_blocks:=d.body->'proposed_blocks'; v_current:=coalesce((d.body->>'current_word_count')::int,0); v_target:=greatest(1200,coalesce((d.body->>'target_word_count')::int,1200));
 if p_approve then
  if jsonb_typeof(v_blocks)<>'array' or jsonb_array_length(v_blocks)=0 then raise exception 'Revision draft has no proposed_blocks'; end if;
  if exists(select 1 from jsonb_array_elements(v_blocks) b where btrim(coalesce(b->>'plain_text',''))='' or coalesce(b->>'block_type','') not in ('content','activity','question','interactive','media','note')) then raise exception 'Revision draft contains invalid proposed block'; end if;
  if exists(select 1 from jsonb_array_elements(v_blocks) b where jsonb_typeof(b->'metadata'->'source_refs')<>'array' or jsonb_array_length(coalesce(b->'metadata'->'source_refs','[]'::jsonb))=0) then raise exception 'Every proposed block requires source_refs'; end if;
  select coalesce(sum(cardinality(regexp_split_to_array(trim(b->>'plain_text'),'\s+'))),0)::int into v_added from jsonb_array_elements(v_blocks) b;
  v_projected:=v_current+v_added;
  if v_projected<v_target then raise exception 'Revision depth gate failed: projected words %, target %',v_projected,v_target; end if;
 end if;
 update public.content_derivatives set status=case when p_approve then 'approved' else 'archived' end,quality=coalesce(quality,'{}'::jsonb)||jsonb_build_object('reviewed_by',auth.uid(),'reviewed_at',now(),'review_note',p_note,'approved',p_approve,'projected_word_count',case when p_approve then v_projected else null end,'target_word_count',v_target,'source_gate_passed',p_approve),updated_at=now() where id=p_derivative_id returning * into d;
 update public.hq_work_items set status=case when p_approve then 'in_progress' else 'resolved' end,owner_id=coalesce(owner_id,auth.uid()),acted_at=now(),resolved_at=case when p_approve then null else now() end,verification_status=case when p_approve then 'pending' else 'not_required' end,action_taken=jsonb_build_object('action',case when p_approve then 'approve_chapter_revision' else 'reject_chapter_revision' end,'derivative_id',p_derivative_id,'note',p_note,'next',case when p_approve then 'apply_revision_and_recertify' else 'none' end),verification_evidence=case when p_approve then jsonb_build_object('projected_word_count',v_projected,'target_word_count',v_target,'source_refs_required',true) else verification_evidence end,updated_at=now() where work_type='content_depth_revision' and source_id=d.source_chapter_id and status in ('open','in_progress','waiting_approval') returning id into v_work;
 return jsonb_build_object('derivative_id',d.id,'status',d.status,'hq_work_item_id',v_work,'apply_required',p_approve,'projected_word_count',case when p_approve then v_projected else null end,'target_word_count',v_target);
end $$;

create or replace function public.hq_review_vibelab_spec(p_derivative_id uuid,p_approve boolean,p_note text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare d public.content_derivatives%rowtype; v_action uuid; v_work uuid;
begin
 if not public.is_platform_owner() then raise exception 'HQ platform owner required'; end if;
 select * into d from public.content_derivatives where id=p_derivative_id for update; if not found then raise exception 'VibeLab spec not found'; end if;
 if d.derivative_type<>'project_brief' or d.audience<>'student' or d.status<>'draft' or coalesce(d.body->>'kind','')<>'vibelab_simulation_spec' then raise exception 'VibeLab spec is not reviewable'; end if;
 update public.content_derivatives set status=case when p_approve then 'approved' else 'archived' end,quality=coalesce(quality,'{}'::jsonb)||jsonb_build_object('reviewed_by',auth.uid(),'reviewed_at',now(),'review_note',p_note,'approved',p_approve),updated_at=now() where id=p_derivative_id returning * into d;
 select id into v_action from public.curriculum_editorial_actions where chapter_id=d.source_chapter_id and action_type='add_vibelab' and output->>'vibelab_spec_derivative_id'=p_derivative_id::text order by created_at desc limit 1;
 if v_action is not null then update public.curriculum_editorial_actions set status=case when p_approve then 'approved' else 'rejected' end,output=coalesce(output,'{}'::jsonb)||jsonb_build_object('reviewed_by',auth.uid(),'reviewed_at',now(),'review_note',p_note,'functional_implementation_required',p_approve),updated_at=now() where id=v_action; end if;
 update public.hq_work_items set status=case when p_approve then 'in_progress' else 'resolved' end,acted_at=now(),owner_id=coalesce(owner_id,auth.uid()),verification_status=case when p_approve then 'pending' else 'not_required' end,action_taken=jsonb_build_object('action',case when p_approve then 'approve_vibelab_spec' else 'reject_vibelab_spec' end,'derivative_id',p_derivative_id,'note',p_note,'next',case when p_approve then 'functional_implementation_and_verification' else 'none' end),updated_at=now(),resolved_at=case when p_approve then null else now() end where work_type='vibelab_review' and evidence->>'vibelab_spec_derivative_id'=p_derivative_id::text and status in ('open','in_progress','waiting_approval') returning id into v_work;
 return jsonb_build_object('derivative_id',p_derivative_id,'status',d.status,'editorial_action_id',v_action,'hq_work_item_id',v_work,'functional_implementation_required',p_approve);
end $$;

create or replace function public.hq_apply_approved_chapter_revision(p_derivative_id uuid,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare d public.content_derivatives%rowtype; ch public.vibe_chapters%rowtype; v_revision int; v_snapshot_id uuid; v_blocks jsonb; v_block jsonb; v_seq int; v_added int:=0; v_new_words int:=0; v_run uuid; v_failed int; v_work uuid;
begin
 if not public.is_platform_owner() then raise exception 'HQ platform owner required'; end if;
 select * into d from public.content_derivatives where id=p_derivative_id for update; if not found then raise exception 'Revision draft not found'; end if;
 if d.derivative_type<>'revision_notes' or d.audience<>'student' or d.status<>'approved' then raise exception 'Revision must be approved before apply'; end if;
 if coalesce((d.quality->>'applied')::boolean,false) then raise exception 'Revision already applied'; end if;
 select * into ch from public.vibe_chapters where id=d.source_chapter_id and publication_id=d.source_publication_id for update; if not found then raise exception 'Source chapter not found'; end if;
 v_blocks:=d.body->'proposed_blocks'; if jsonb_typeof(v_blocks)<>'array' or jsonb_array_length(v_blocks)=0 then raise exception 'Revision contains no proposed_blocks'; end if;
 select coalesce(max(revision_number),0)+1 into v_revision from public.publication_revisions where publication_id=d.source_publication_id;
 insert into public.publication_revisions(publication_id,revision_number,snapshot,created_by,reason)
 values(d.source_publication_id,v_revision,jsonb_build_object('publication',(select to_jsonb(vp) from public.vibe_publications vp where vp.id=d.source_publication_id),'chapter',to_jsonb(ch),'content_blocks',(select coalesce(jsonb_agg(to_jsonb(cb) order by cb.sequence),'[]'::jsonb) from public.content_blocks cb where cb.chapter_id=ch.id),'captured_for_derivative_id',d.id),auth.uid(),coalesce(p_reason,'Before applying approved chapter revision')) returning id into v_snapshot_id;
 select coalesce(max(sequence),0) into v_seq from public.content_blocks where chapter_id=ch.id;
 for v_block in select value from jsonb_array_elements(v_blocks) loop
  v_seq:=v_seq+1;
  insert into public.content_blocks(publication_id,chapter_id,block_type,title,plain_text,sequence,is_assessable,status,metadata)
  values(ch.publication_id,ch.id,v_block->>'block_type',nullif(v_block->>'title',''),v_block->>'plain_text',v_seq,coalesce((v_block->>'is_assessable')::boolean,false),'published',coalesce(v_block->'metadata','{}'::jsonb)||jsonb_build_object('revision_derivative_id',d.id,'publication_revision_number',v_revision));
  v_added:=v_added+1; v_new_words:=v_new_words+cardinality(regexp_split_to_array(trim(v_block->>'plain_text'),'\s+'));
 end loop;
 update public.vibe_chapters set word_count=coalesce(word_count,0)+v_new_words,updated_at=now() where id=ch.id;
 update public.content_derivatives set status='stale',updated_at=now(),quality=coalesce(quality,'{}'::jsonb)||jsonb_build_object('stale_reason','source_chapter_revised','source_revision_number',v_revision) where source_chapter_id=ch.id and id<>d.id and status='approved';
 update public.content_derivatives set quality=coalesce(quality,'{}'::jsonb)||jsonb_build_object('applied',true,'applied_at',now(),'applied_by',auth.uid(),'publication_revision_id',v_snapshot_id,'publication_revision_number',v_revision),updated_at=now() where id=d.id;
 v_run:=public.run_connected_content_engine(d.source_publication_id,'recovery');
 select count(*) into v_failed from public.publication_release_checks where publication_id=d.source_publication_id and status='fail';
 update public.hq_work_items set status=case when v_failed=0 then 'resolved' else 'in_progress' end,verification_status=case when v_failed=0 then 'verified' else 'failed' end,verification_evidence=jsonb_build_object('orchestration_run_id',v_run,'remaining_release_failures',v_failed,'publication_revision_id',v_snapshot_id,'blocks_added',v_added,'words_added',v_new_words),action_taken=coalesce(action_taken,'{}'::jsonb)||jsonb_build_object('action','apply_chapter_revision','derivative_id',d.id,'publication_revision_number',v_revision),resolved_at=case when v_failed=0 then now() else null end,updated_at=now() where work_type='content_depth_revision' and source_id=ch.id and status in ('open','in_progress','waiting_approval') returning id into v_work;
 return jsonb_build_object('derivative_id',d.id,'publication_revision_id',v_snapshot_id,'revision_number',v_revision,'blocks_added',v_added,'words_added',v_new_words,'orchestration_run_id',v_run,'remaining_release_failures',v_failed,'hq_work_item_id',v_work);
end $$;

revoke all on function public.enqueue_unresearched_proposals() from public,anon,authenticated;
revoke all on function public.hq_run_publication_release_check(uuid) from public,anon,authenticated;
revoke all on function public.ce_run_publication_release_check(uuid) from public,anon,authenticated;
revoke all on function public.hq_sync_content_engine_work(uuid) from public,anon,authenticated;
revoke all on function public.run_connected_content_engine(uuid,text) from public,anon,authenticated;
revoke all on function public.hq_review_teacher_guide(uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.hq_review_generated_assessment(uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.hq_review_chapter_revision(uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.hq_review_vibelab_spec(uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.hq_apply_approved_chapter_revision(uuid,text) from public,anon,authenticated;

grant execute on function public.enqueue_unresearched_proposals() to service_role;
grant execute on function public.hq_run_publication_release_check(uuid) to service_role;
grant execute on function public.ce_run_publication_release_check(uuid) to service_role;
grant execute on function public.hq_sync_content_engine_work(uuid) to service_role;
grant execute on function public.run_connected_content_engine(uuid,text) to service_role;
