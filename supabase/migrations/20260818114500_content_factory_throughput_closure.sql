begin;

-- Content Factory throughput closure: prepare safe work automatically, keep semantic/release authority human.

create or replace function public.ce_release_remediation_policy(p_check_code text)
returns jsonb language sql immutable set search_path=public,pg_temp as $$
select case lower(coalesce(p_check_code,''))
 when 'canonical_resource' then jsonb_build_object('work_type','canonical_resource_repair','department','content','approval_required',false,'mode','deterministic')
 when 'curriculum_outcomes' then jsonb_build_object('work_type','curriculum_mapping_review','department','content','approval_required',true,'mode','human_authority')
 when 'teacher_guide' then jsonb_build_object('work_type','teacher_guide_generation','department','content','approval_required',false,'mode','source_grounded_draft')
 when 'assessment' then jsonb_build_object('work_type','assessment_generation','department','quality','approval_required',false,'mode','source_grounded_generation')
 when 'assessable_blocks' then jsonb_build_object('work_type','assessable_content_generation','department','content','approval_required',false,'mode','semantic_generation_then_review')
 when 'derivative_freshness' then jsonb_build_object('work_type','derivative_regeneration','department','content','approval_required',false,'mode','deterministic')
 when 'multimodal_accessibility' then jsonb_build_object('work_type','accessibility_repair','department','quality','approval_required',false,'mode','deterministic_then_review')
 when 'asset_rights' then jsonb_build_object('work_type','asset_rights_review','department','quality','approval_required',true,'mode','human_authority')
 when 'rights_clearance' then jsonb_build_object('work_type','rights_clearance_review','department','quality','approval_required',true,'mode','human_authority')
 when 'research_evidence' then jsonb_build_object('work_type','research_review','department','learning','approval_required',true,'mode','human_authority')
 when 'depth' then jsonb_build_object('work_type','content_depth_revision','department','content','approval_required',true,'mode','draft_then_human_apply')
 when 'interactive' then jsonb_build_object('work_type','vibelab_review','department','content','approval_required',true,'mode','spec_then_human_review')
 else jsonb_build_object('work_type','publication_release_remediation','department','quality','approval_required',true,'mode','human_authority') end;
$$;
revoke all on function public.ce_release_remediation_policy(text) from public,anon,authenticated;
grant execute on function public.ce_release_remediation_policy(text) to service_role;

create or replace function public.ce_plan_release_remediation(p_publication_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r record; pol jsonb; made int:=0; auto_n int:=0; human_n int:=0; sid uuid; st text;
begin
 if current_user not in ('service_role','postgres') and not public.is_platform_owner() then raise exception 'HQ platform owner required'; end if;
 for r in select prc.*,vc.title chapter_title,vp.title publication_title from public.publication_release_checks prc join public.vibe_publications vp on vp.id=prc.publication_id left join public.vibe_chapters vc on vc.id=prc.chapter_id where prc.publication_id=p_publication_id and prc.status='fail' loop
  if r.check_code in ('depth','interactive') then continue; end if;
  pol:=public.ce_release_remediation_policy(r.check_code); sid:=coalesce(r.chapter_id,r.publication_id);
  st:=case when coalesce((pol->>'approval_required')::boolean,true) then 'waiting_approval' else 'open' end;
  insert into public.hq_work_items(department_key,work_type,priority,status,title,summary,source_type,source_id,route,approval_required,evidence)
  values(pol->>'department',pol->>'work_type',case when r.check_code in ('rights_clearance','asset_rights','research_evidence','curriculum_outcomes') then 'high' else 'normal' end,st,'Repair '||replace(r.check_code,'_',' ')||': '||coalesce(r.chapter_title,r.publication_title),'Release certification failed. Clear this check before release.','release_check_'||r.check_code,sid,'/hq/content',coalesce((pol->>'approval_required')::boolean,true),jsonb_build_object('publication_id',r.publication_id,'chapter_id',r.chapter_id,'check_code',r.check_code,'score',r.score,'details',r.details,'remediation_policy',pol,'release_gate_authority','fail_closed')) on conflict do nothing;
  if found then made:=made+1; if coalesce((pol->>'approval_required')::boolean,true) then human_n:=human_n+1; else auto_n:=auto_n+1; end if; end if;
 end loop;
 return jsonb_build_object('created',made,'automatic_preparation',auto_n,'human_authority',human_n);
end $$;
revoke all on function public.ce_plan_release_remediation(uuid) from public,anon,authenticated;
grant execute on function public.ce_plan_release_remediation(uuid) to service_role;

create or replace function public.ce_repair_release_structure(p_publication_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r record; reconciled int:=0; resources int:=0; block_resources int:=0; errs jsonb:='[]'::jsonb; rid uuid;
begin
 if current_user not in ('service_role','postgres') and not public.is_platform_owner() then raise exception 'HQ platform owner required'; end if;
 for r in select distinct vc.id chapter_id,vc.publication_id,vc.title from public.vibe_chapters vc where vc.publication_id=p_publication_id and exists(select 1 from public.publication_release_checks prc where prc.chapter_id=vc.id and prc.status='fail' and prc.check_code in ('canonical_resource','assessable_blocks')) loop
  begin reconciled:=reconciled+public.ce_reconcile_chapter_content_blocks(r.chapter_id); exception when others then errs:=errs||jsonb_build_array(jsonb_build_object('chapter_id',r.chapter_id,'stage','block_reconcile','error',sqlerrm)); end;
  if not exists(select 1 from public.learning_resources lr where lr.chapter_id=r.chapter_id and lr.source_type='chapter' and lr.status='active') then
   begin rid:=public.ce_register_learning_resource('chapter',r.publication_id,r.chapter_id,null,null,r.title,null,'private',null); if rid is not null then resources:=resources+1; end if; exception when others then errs:=errs||jsonb_build_array(jsonb_build_object('chapter_id',r.chapter_id,'stage','chapter_resource','error',sqlerrm)); end;
  end if;
 end loop;
 begin block_resources:=public.ce_sync_block_learning_resources(p_publication_id); exception when others then errs:=errs||jsonb_build_array(jsonb_build_object('publication_id',p_publication_id,'stage','block_resource_sync','error',sqlerrm)); end;
 return jsonb_build_object('content_blocks_reconciled',reconciled,'chapter_resources_created',resources,'block_resources_synced',block_resources,'errors',errs);
end $$;
revoke all on function public.ce_repair_release_structure(uuid) from public,anon,authenticated;
grant execute on function public.ce_repair_release_structure(uuid) to service_role;

create or replace function public.ce_prepare_source_grounded_teacher_guides(p_publication_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r record; rid uuid; did uuid; made int:=0; seq jsonb; assessable int;
begin
 if current_user not in ('service_role','postgres') and not public.is_platform_owner() then raise exception 'HQ platform owner required'; end if;
 for r in select vc.id,vc.publication_id,vc.title,vc.cbc_strand,vc.learning_outcomes,vp.author_id,vp.cbc_subject,vp.cbc_grade from public.vibe_chapters vc join public.vibe_publications vp on vp.id=vc.publication_id where vc.publication_id=p_publication_id and exists(select 1 from public.publication_release_checks prc where prc.chapter_id=vc.id and prc.check_code='teacher_guide' and prc.status='fail') and not exists(select 1 from public.content_derivatives d where d.source_chapter_id=vc.id and d.derivative_type='teacher_notes' and d.audience='teacher' and d.status in ('draft','approved')) loop
  select lr.id into rid from public.learning_resources lr where lr.chapter_id=r.id and lr.source_type='chapter' and lr.status='active' order by lr.created_at limit 1;
  if rid is null then continue; end if;
  select coalesce(jsonb_agg(jsonb_build_object('block_id',cb.id,'sequence',cb.sequence,'type',cb.block_type,'title',cb.title,'text',cb.plain_text) order by cb.sequence),'[]'::jsonb),count(*) filter(where cb.is_assessable) into seq,assessable from public.content_blocks cb where cb.chapter_id=r.id and cb.status in ('draft','published');
  if jsonb_array_length(seq)=0 then continue; end if;
  insert into public.content_derivatives(created_by,derivative_type,audience,title,body,status,source_publication_id,source_chapter_id,source_resource_id,generator,model,quality)
  values(r.author_id,'teacher_notes','teacher',r.title||' — teacher guide',jsonb_build_object('kind','teacher_guide','chapter',r.title,'subject',r.cbc_subject,'grade',r.cbc_grade,'strand',r.cbc_strand,'learning_outcomes',to_jsonb(coalesce(r.learning_outcomes,'{}'::text[])),'source_sequence',seq,'assessment_checkpoints',assessable,'editorial_note','Deterministic source-grounded draft. It reorganizes existing chapter material only and introduces no new factual claims. Human editorial approval is required before release.','approval_required',true),'draft',r.publication_id,r.id,rid,'content-factory','deterministic-source-grounded-v1',jsonb_build_object('source_grounded',true,'new_factual_claims',false,'requires_editorial_approval',true,'generated_at',now())) returning id into did;
  made:=made+1;
  update public.hq_work_items set status='resolved',resolved_at=now(),verification_status='verified',verification_evidence=jsonb_build_object('teacher_guide_derivative_id',did,'source_grounded',true),action_taken=coalesce(action_taken,'{}'::jsonb)||jsonb_build_object('action','prepare_source_grounded_teacher_guide','derivative_id',did),updated_at=now() where source_type='release_check_teacher_guide' and source_id=r.id and status in ('open','in_progress');
 end loop;
 return jsonb_build_object('teacher_guide_drafts_created',made);
end $$;
revoke all on function public.ce_prepare_source_grounded_teacher_guides(uuid) from public,anon,authenticated;
grant execute on function public.ce_prepare_source_grounded_teacher_guides(uuid) to service_role;

create or replace function public.ce_prepare_release_repair_drafts(p_publication_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare structure jsonb; guides jsonb; plan jsonb; depth_n int:=0; lab_n int:=0;
begin
 if current_user not in ('service_role','postgres') and not public.is_platform_owner() then raise exception 'HQ platform owner required'; end if;
 structure:=public.ce_repair_release_structure(p_publication_id);
 perform public.hq_run_publication_release_check(p_publication_id);
 plan:=public.ce_plan_release_remediation(p_publication_id);
 guides:=public.ce_prepare_source_grounded_teacher_guides(p_publication_id);
 insert into public.curriculum_editorial_actions(publication_id,chapter_id,action_type,rationale,status,priority,created_by,output)
 select prc.publication_id,prc.chapter_id,'rewrite_explanation','Release depth failed. Prepare a source-grounded expansion with explanations, worked reasoning or examples appropriate to the subject, evidence interpretation where appropriate, misconception remediation and review questions. Published content must not change until human approval.','queued',80,'release-certification-engine',jsonb_build_object('release_check','depth','current_word_count',prc.details->'word_count','target_word_count',prc.details->'target','draft_policy','prepare_only_do_not_publish','required_sections',jsonb_build_array('concept expansion','subject-appropriate worked reasoning','evidence or data interpretation where appropriate','practical application','misconception remediation','review questions')) from public.publication_release_checks prc where prc.publication_id=p_publication_id and prc.check_code='depth' and prc.status='fail' on conflict do nothing;
 get diagnostics depth_n=row_count;
 insert into public.curriculum_editorial_actions(publication_id,chapter_id,action_type,rationale,status,priority,created_by,output)
 select prc.publication_id,prc.chapter_id,'add_vibelab','Release certification requires an interactive experience. Prepare a source-grounded VibeLab specification and learner-evidence contract; do not expose it before approval.','queued',85,'release-certification-engine',jsonb_build_object('release_check','interactive','draft_policy','prepare_only_do_not_publish','required_contract',jsonb_build_array('learning objective','learner controls','observable model state','guided investigation','prediction','data capture','analysis questions','safety or accessibility note','evidence event mapping')) from public.publication_release_checks prc where prc.publication_id=p_publication_id and prc.check_code='interactive' and prc.status='fail' on conflict do nothing;
 get diagnostics lab_n=row_count;
 perform public.hq_run_publication_release_check(p_publication_id);
 perform public.hq_sync_content_engine_work(p_publication_id);
 return jsonb_build_object('remediation_plan',plan,'structural_repairs',structure,'teacher_guides',guides,'depth_actions_created',depth_n,'vibelab_actions_created',lab_n);
end $$;
revoke all on function public.ce_prepare_release_repair_drafts(uuid) from public,anon,authenticated;
grant execute on function public.ce_prepare_release_repair_drafts(uuid) to service_role;

-- Fix approved revision application: vibe_chapters.blocks is canonical and its trigger rebuilds content_blocks.
create or replace function public.hq_apply_approved_chapter_revision(p_derivative_id uuid,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.content_derivatives%rowtype; ch public.vibe_chapters%rowtype; rev int; snap uuid; proposed jsonb; b jsonb; append_blocks jsonb:='[]'::jsonb; added int:=0; words int:=0; run_id uuid; failed int; work_id uuid; typ text; txt text;
begin
 if not public.is_platform_owner() then raise exception 'HQ platform owner required'; end if;
 select * into d from public.content_derivatives where id=p_derivative_id for update; if not found then raise exception 'Revision draft not found'; end if;
 if d.derivative_type<>'revision_notes' or d.audience<>'student' or d.status<>'approved' then raise exception 'Revision must be approved before apply'; end if;
 if coalesce((d.quality->>'applied')::boolean,false) then raise exception 'Revision already applied'; end if;
 select * into ch from public.vibe_chapters where id=d.source_chapter_id and publication_id=d.source_publication_id for update; if not found then raise exception 'Source chapter not found'; end if;
 proposed:=d.body->'proposed_blocks'; if jsonb_typeof(proposed)<>'array' or jsonb_array_length(proposed)=0 then raise exception 'Revision contains no proposed_blocks'; end if;
 if exists(select 1 from jsonb_array_elements(proposed) x where jsonb_typeof(x->'metadata'->'source_refs')<>'array' or jsonb_array_length(coalesce(x->'metadata'->'source_refs','[]'::jsonb))=0) then raise exception 'Every proposed block requires source_refs'; end if;
 select coalesce(max(revision_number),0)+1 into rev from public.publication_revisions where publication_id=d.source_publication_id;
 insert into public.publication_revisions(publication_id,revision_number,snapshot,created_by,reason) values(d.source_publication_id,rev,jsonb_build_object('publication',(select to_jsonb(vp) from public.vibe_publications vp where vp.id=d.source_publication_id),'chapter',to_jsonb(ch),'content_blocks',(select coalesce(jsonb_agg(to_jsonb(cb) order by cb.sequence),'[]'::jsonb) from public.content_blocks cb where cb.chapter_id=ch.id),'captured_for_derivative_id',d.id),auth.uid(),coalesce(p_reason,'Before applying approved chapter revision')) returning id into snap;
 for b in select value from jsonb_array_elements(proposed) loop
  typ:=case coalesce(b->>'block_type','content') when 'content' then 'paragraph' when 'note' then 'paragraph' when 'media' then 'image' else b->>'block_type' end; txt:=coalesce(b->>'plain_text','');
  append_blocks:=append_blocks||jsonb_build_array(jsonb_build_object('id','revision-'||rev::text||'-'||(added+1)::text,'type',typ,'title',nullif(b->>'title',''),'content',txt,'meta',coalesce(b->'metadata','{}'::jsonb)||jsonb_build_object('revision_derivative_id',d.id,'publication_revision_number',rev,'is_assessable',coalesce((b->>'is_assessable')::boolean,false))));
  added:=added+1; if btrim(txt)<>'' then words:=words+cardinality(regexp_split_to_array(btrim(txt),'\s+')); end if;
 end loop;
 update public.vibe_chapters set blocks=coalesce(blocks,'[]'::jsonb)||append_blocks,word_count=coalesce(word_count,0)+words,reading_time_min=greatest(1,ceil((coalesce(word_count,0)+words)/200.0)::int),updated_at=now() where id=ch.id;
 perform public.ce_sync_block_learning_resources(ch.publication_id);
 update public.content_derivatives set status='stale',updated_at=now(),quality=coalesce(quality,'{}'::jsonb)||jsonb_build_object('stale_reason','source_chapter_revised','source_revision_number',rev) where source_chapter_id=ch.id and id<>d.id and status='approved';
 update public.content_derivatives set quality=coalesce(quality,'{}'::jsonb)||jsonb_build_object('applied',true,'applied_at',now(),'applied_by',auth.uid(),'publication_revision_id',snap,'publication_revision_number',rev),updated_at=now() where id=d.id;
 run_id:=public.run_connected_content_engine(d.source_publication_id,'recovery');
 select count(*) into failed from public.publication_release_checks where publication_id=d.source_publication_id and status='fail';
 update public.hq_work_items set status=case when not exists(select 1 from public.publication_release_checks prc where prc.chapter_id=ch.id and prc.check_code='depth' and prc.status='fail') then 'resolved' else 'in_progress' end,verification_status=case when not exists(select 1 from public.publication_release_checks prc where prc.chapter_id=ch.id and prc.check_code='depth' and prc.status='fail') then 'verified' else 'failed' end,verification_evidence=jsonb_build_object('orchestration_run_id',run_id,'remaining_release_failures',failed,'publication_revision_id',snap,'blocks_added',added,'words_added',words,'canonical_chapter_blocks_updated',true),action_taken=coalesce(action_taken,'{}'::jsonb)||jsonb_build_object('action','apply_chapter_revision','derivative_id',d.id,'publication_revision_number',rev,'canonical_authority','vibe_chapters.blocks'),resolved_at=case when not exists(select 1 from public.publication_release_checks prc where prc.chapter_id=ch.id and prc.check_code='depth' and prc.status='fail') then now() else null end,updated_at=now() where work_type='content_depth_revision' and source_id=ch.id and status in ('open','in_progress','waiting_approval') returning id into work_id;
 return jsonb_build_object('derivative_id',d.id,'publication_revision_id',snap,'revision_number',rev,'blocks_added',added,'words_added',words,'canonical_chapter_blocks_updated',true,'orchestration_run_id',run_id,'remaining_release_failures',failed,'hq_work_item_id',work_id);
end $$;
revoke all on function public.hq_apply_approved_chapter_revision(uuid,text) from public,anon;
grant execute on function public.hq_apply_approved_chapter_revision(uuid,text) to authenticated,service_role;

create or replace function public.run_governed_publication_intelligence(p_publication_id uuid,p_trigger text default 'scheduled')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare rid uuid:=gen_random_uuid(); signals jsonb; proposals int; research_pending int; effectiveness_pending int; release_failures int; release_warnings int; repair jsonb; sync_result jsonb; result jsonb; blockers jsonb:='[]'::jsonb;
begin
 if current_user not in ('service_role','postgres') and not public.is_platform_owner() then raise exception 'not_authorized'; end if;
 insert into public.content_engine_orchestration_runs(id,publication_id,trigger_type,created_by) values(rid,p_publication_id,p_trigger,auth.uid());
 begin signals:=public.hq_refresh_content_health_signals(p_publication_id); exception when others then signals:=jsonb_build_object('warning',sqlerrm); end;
 begin perform public.refresh_reading_health_signals(); exception when others then null; end;
 begin perform public.hq_refresh_teacher_workaround_signals(p_publication_id); exception when others then null; end;
 begin perform public.enqueue_unresearched_proposals(); exception when others then null; end;
 perform public.hq_run_publication_release_check(p_publication_id);
 begin repair:=public.ce_prepare_release_repair_drafts(p_publication_id); exception when others then repair:=jsonb_build_object('warning',sqlerrm); end;
 perform public.hq_run_publication_release_check(p_publication_id);
 begin sync_result:=public.hq_sync_content_engine_work(p_publication_id); exception when others then sync_result:=jsonb_build_object('warning',sqlerrm); end;
 select count(*) into proposals from public.curriculum_intelligence_proposals where publication_id=p_publication_id and status='pending_review';
 select count(*) into research_pending from public.curriculum_research_jobs j join public.curriculum_intelligence_proposals p on p.id=j.proposal_id where p.publication_id=p_publication_id and j.status in ('queued','running','needs_human');
 select count(*) into effectiveness_pending from public.curriculum_editorial_effectiveness where publication_id=p_publication_id and evaluated_at is null;
 select count(*) filter(where status='fail'),count(*) filter(where status='warn') into release_failures,release_warnings from public.publication_release_checks where publication_id=p_publication_id;
 if research_pending>0 then blockers:=blockers||jsonb_build_array('research_pending'); end if; if release_failures>0 then blockers:=blockers||jsonb_build_array('release_gate_failed'); end if;
 result:=jsonb_build_object('publication_id',p_publication_id,'signals',signals,'pending_proposals',proposals,'pending_research',research_pending,'pending_effectiveness',effectiveness_pending,'release_failures',release_failures,'release_warnings',release_warnings,'repair_preparation',repair,'hq_sync',sync_result,'governance','human_approval_required_for_content_change_or_release');
 update public.content_engine_orchestration_runs set status=case when jsonb_array_length(blockers)>0 then 'blocked' else 'completed' end,stages=result,blockers=blockers,completed_at=now() where id=rid;
 return result||jsonb_build_object('run_id',rid);
exception when others then update public.content_engine_orchestration_runs set status='failed',blockers=jsonb_build_array(sqlerrm),completed_at=now() where id=rid; raise;
end $$;
revoke all on function public.run_governed_publication_intelligence(uuid,text) from public,anon,authenticated;
grant execute on function public.run_governed_publication_intelligence(uuid,text) to service_role;

commit;
