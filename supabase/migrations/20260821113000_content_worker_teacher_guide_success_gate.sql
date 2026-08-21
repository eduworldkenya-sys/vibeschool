begin;

create or replace function public.ce_prepare_source_grounded_teacher_guides(p_publication_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  r record;
  rid uuid;
  did uuid;
  made int:=0;
  candidates int:=0;
  blocked int:=0;
  seq jsonb;
  assessable int;
  guide_body jsonb;
  guide_quality jsonb;
  review jsonb;
begin
  if current_user not in ('service_role','postgres') and not public.is_platform_owner() then
    raise exception 'HQ platform owner required';
  end if;

  for r in
    select vc.id,vc.publication_id,vc.title,vc.cbc_strand,vc.learning_outcomes,
           vp.author_id,vp.cbc_subject,vp.cbc_grade
    from public.vibe_chapters vc
    join public.vibe_publications vp on vp.id=vc.publication_id
    where vc.publication_id=p_publication_id
      and exists(
        select 1 from public.publication_release_checks prc
        where prc.chapter_id=vc.id and prc.check_code='teacher_guide' and prc.status='fail'
      )
      and not exists(
        select 1 from public.content_derivatives d
        where d.source_chapter_id=vc.id
          and d.derivative_type='teacher_notes'
          and d.audience='teacher'
          and d.status in ('draft','approved')
      )
  loop
    select lr.id into rid
    from public.learning_resources lr
    where lr.chapter_id=r.id and lr.source_type='chapter' and lr.status='active'
    order by lr.created_at limit 1;
    if rid is null then continue; end if;

    select
      coalesce(jsonb_agg(jsonb_build_object(
        'block_id',cb.id,'sequence',cb.sequence,'type',cb.block_type,'title',cb.title,'text',cb.plain_text
      ) order by cb.sequence),'[]'::jsonb),
      count(*) filter(where cb.is_assessable)
    into seq,assessable
    from public.content_blocks cb
    where cb.chapter_id=r.id and cb.status in ('draft','published');
    if jsonb_array_length(seq)=0 then continue; end if;

    guide_body:=jsonb_build_object(
      'kind','teacher_guide',
      'chapter',r.title,
      'subject',r.cbc_subject,
      'grade',r.cbc_grade,
      'strand',r.cbc_strand,
      'learning_outcomes',to_jsonb(coalesce(r.learning_outcomes,'{}'::text[])),
      'source_sequence',seq,
      'assessment_checkpoints',assessable,
      'editorial_note','Deterministic source-grounded preparation only. Classroom readiness is separately quality-gated and human publication authority remains required.',
      'approval_required',true
    );
    guide_quality:=jsonb_build_object(
      'source_grounded',true,
      'new_factual_claims',false,
      'requires_editorial_approval',true,
      'professional_profile','senior-educational-content-developer@2',
      'subject_profile',case when lower(coalesce(r.cbc_subject,''))='chemistry' and r.cbc_grade::text~'10' then 'chemistry-grade10-author@2' else null end,
      'quality_contract','teacher-guide-quality-contract@2',
      'evaluation_suite','chemistry-content-worker-evaluation@2',
      'generated_at',now()
    );

    review:=public.content_worker_teacher_guide_self_review(guide_body,guide_quality);
    guide_quality:=guide_quality||jsonb_build_object(
      'professional_self_review',review,
      'quality_candidate',coalesce((review->>'passed')::boolean,false)
    );

    insert into public.content_derivatives(
      created_by,derivative_type,audience,title,body,status,
      source_publication_id,source_chapter_id,source_resource_id,generator,model,quality
    ) values (
      r.author_id,'teacher_notes','teacher',r.title||' — teacher guide',guide_body,'draft',
      r.publication_id,r.id,rid,'content-factory','deterministic-source-grounded-v2',guide_quality
    ) returning id into did;
    made:=made+1;

    if coalesce((review->>'passed')::boolean,false) then
      candidates:=candidates+1;
      update public.hq_work_items
      set status='resolved',resolved_at=now(),verification_status='verified',
          verification_evidence=jsonb_build_object(
            'teacher_guide_derivative_id',did,'source_grounded',true,'quality_candidate',true,'self_review',review
          ),
          action_taken=coalesce(action_taken,'{}'::jsonb)||jsonb_build_object(
            'action','prepare_source_grounded_teacher_guide','derivative_id',did,'quality_candidate',true
          ),
          updated_at=now()
      where source_type='release_check_teacher_guide' and source_id=r.id and status in ('open','in_progress');
    else
      blocked:=blocked+1;
      update public.hq_work_items
      set status='in_progress',resolved_at=null,verification_status='failed',
          verification_evidence=jsonb_build_object(
            'teacher_guide_derivative_id',did,'source_grounded',true,'quality_candidate',false,'self_review',review
          ),
          action_taken=coalesce(action_taken,'{}'::jsonb)||jsonb_build_object(
            'action','teacher_guide_draft_created_quality_blocked','derivative_id',did,'quality_candidate',false
          ),
          updated_at=now()
      where source_type='release_check_teacher_guide' and source_id=r.id and status in ('open','in_progress','resolved');
    end if;
  end loop;

  return jsonb_build_object(
    'teacher_guide_drafts_created',made,
    'quality_candidates',candidates,
    'quality_blocked',blocked,
    'success_definition','draft_created_is_not_job_success'
  );
end $$;
revoke all on function public.ce_prepare_source_grounded_teacher_guides(uuid) from public,anon,authenticated;
grant execute on function public.ce_prepare_source_grounded_teacher_guides(uuid) to service_role;

commit;
