-- Artifact-backed HQ publishing review contract.
-- Owner-gated reads render the actual immutable review target; mutations fail closed
-- when the target has changed since the decision was issued.

create or replace function public.hq_get_publishing_review(p_work_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  w public.hq_work_items%rowtype;
  d public.content_derivatives%rowtype;
  a public.generated_assessments%rowtype;
  v_chapter public.vibe_chapters%rowtype;
  v_publication public.vibe_publications%rowtype;
  v_derivative_id uuid;
  v_items jsonb := '[]'::jsonb;
  v_reviewable boolean := false;
  v_reason text;
begin
  perform public.hq_assert_owner();
  select * into w from public.hq_work_items where id=p_work_item_id;
  if not found then raise exception 'Publishing decision not found'; end if;

  if w.work_type in ('teacher_guide_review','content_depth_revision') then
    v_derivative_id := case when w.source_type='content_derivative' then w.source_id else null end;
    if w.work_type='content_depth_revision' then v_derivative_id := nullif(w.evidence->>'revision_derivative_id','')::uuid; end if;
  elsif w.work_type='vibelab_review' then
    v_derivative_id := nullif(w.evidence->>'vibelab_spec_derivative_id','')::uuid;
  end if;

  if v_derivative_id is not null then
    select * into d from public.content_derivatives where id=v_derivative_id;
    if found then
      select * into v_chapter from public.vibe_chapters where id=d.source_chapter_id;
      select * into v_publication from public.vibe_publications where id=d.source_publication_id;
      v_reviewable := w.status='waiting_approval' and d.status='draft';
      v_reason := case when w.status<>'waiting_approval' then 'Decision is not waiting for approval.' when d.status<>'draft' then 'Artifact is no longer the reviewable draft.' else null end;
      return jsonb_build_object(
        'decision',jsonb_build_object('id',w.id,'type',w.work_type,'status',w.status,'title',w.title,'summary',w.summary,'priority',w.priority,'updated_at',w.updated_at),
        'artifact',jsonb_build_object('id',d.id,'type',d.derivative_type,'title',d.title,'body',d.body,'quality',d.quality,'status',d.status,'version_token',d.updated_at::text,'updated_at',d.updated_at),
        'publication',case when v_publication.id is null then null else jsonb_build_object('id',v_publication.id,'title',v_publication.title,'grade',v_publication.cbc_grade,'subject',v_publication.cbc_subject,'framework',v_publication.curriculum_framework) end,
        'chapter',case when v_chapter.id is null then null else jsonb_build_object('id',v_chapter.id,'title',v_chapter.title,'strand',v_chapter.cbc_strand,'learning_outcomes',v_chapter.learning_outcomes,'alignment_status',v_chapter.alignment_status) end,
        'reviewable',v_reviewable,'blocked_reason',v_reason,'technical_evidence',w.evidence);
    end if;
    return jsonb_build_object('decision',jsonb_build_object('id',w.id,'type',w.work_type,'status',w.status,'title',w.title),'artifact',null,'reviewable',false,'blocked_reason','The artifact required for this decision is missing.','technical_evidence',w.evidence);
  end if;

  if w.work_type='assessment_moderation' then
    select * into a from public.generated_assessments where id=w.source_id;
    if not found then return jsonb_build_object('decision',jsonb_build_object('id',w.id,'type',w.work_type,'status',w.status,'title',w.title),'artifact',null,'reviewable',false,'blocked_reason','The assessment required for this decision is missing.','technical_evidence',w.evidence); end if;
    select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'sequence',i.sequence,'type',i.question_type,'prompt',i.prompt,'options',i.options,'answer_key',i.answer_key,'marks',i.marks,'difficulty',i.difficulty,'bloom_level',i.bloom_level,'outcome_id',i.outcome_id) order by i.sequence),'[]'::jsonb) into v_items from public.generated_assessment_items i where i.assessment_id=a.id;
    v_reviewable := w.status='waiting_approval' and a.status='moderation' and jsonb_array_length(v_items)>0;
    v_reason := case when w.status<>'waiting_approval' then 'Decision is not waiting for approval.' when a.status<>'moderation' then 'Assessment is no longer in moderation.' when jsonb_array_length(v_items)=0 then 'Assessment has no reviewable questions.' else null end;
    return jsonb_build_object('decision',jsonb_build_object('id',w.id,'type',w.work_type,'status',w.status,'title',w.title,'summary',w.summary,'priority',w.priority,'updated_at',w.updated_at),'artifact',jsonb_build_object('id',a.id,'type','assessment','title',w.title,'status',a.status,'version',a.version,'version_token',a.generated_at::text,'total_marks',a.total_marks,'items',v_items),'reviewable',v_reviewable,'blocked_reason',v_reason,'technical_evidence',w.evidence);
  end if;

  return jsonb_build_object('decision',jsonb_build_object('id',w.id,'type',w.work_type,'status',w.status,'title',w.title),'artifact',null,'reviewable',false,'blocked_reason','This decision type does not yet have a reviewable artifact.','technical_evidence',w.evidence);
end;
$$;

create or replace function public.hq_review_publishing_artifact(p_work_item_id uuid,p_action text,p_expected_version text,p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare w public.hq_work_items%rowtype; d public.content_derivatives%rowtype; a public.generated_assessments%rowtype; v_derivative_id uuid; v_result jsonb;
begin
 perform public.hq_assert_owner();
 if p_action not in ('approve','needs_changes','reject') then raise exception 'Invalid review action'; end if;
 select * into w from public.hq_work_items where id=p_work_item_id for update;
 if not found or w.status<>'waiting_approval' then raise exception 'Decision is no longer waiting for approval'; end if;
 if w.work_type in ('teacher_guide_review','content_depth_revision') then v_derivative_id:=case when w.work_type='content_depth_revision' then nullif(w.evidence->>'revision_derivative_id','')::uuid else w.source_id end;
 elsif w.work_type='vibelab_review' then v_derivative_id:=nullif(w.evidence->>'vibelab_spec_derivative_id','')::uuid; end if;
 if v_derivative_id is not null then
   select * into d from public.content_derivatives where id=v_derivative_id for update;
   if not found then raise exception 'Review artifact is missing'; end if;
   if d.updated_at::text<>p_expected_version then raise exception 'Artifact changed after this review was opened; reload and review the new version'; end if;
   if p_action='needs_changes' then
     update public.hq_work_items set status='open',action_taken=jsonb_build_object('action','needs_changes','artifact_id',d.id,'artifact_version',p_expected_version,'note',p_note),verification_status='pending',updated_at=now() where id=w.id;
     update public.content_derivatives set quality=coalesce(quality,'{}'::jsonb)||jsonb_build_object('editorial_status','changes_requested','changes_requested_by',auth.uid(),'changes_requested_at',now(),'changes_requested_note',p_note) where id=d.id;
     return jsonb_build_object('status','changes_requested','work_item_id',w.id,'artifact_id',d.id);
   end if;
   if w.work_type='teacher_guide_review' then return public.hq_review_teacher_guide(d.id,p_action='approve',p_note); end if;
   if w.work_type='vibelab_review' then return public.hq_review_vibelab_spec(d.id,p_action='approve',p_note); end if;
   if w.work_type='content_depth_revision' then return public.hq_review_chapter_revision(d.id,p_action='approve',p_note); end if;
 end if;
 if w.work_type='assessment_moderation' then
   select * into a from public.generated_assessments where id=w.source_id for update;
   if not found then raise exception 'Review assessment is missing'; end if;
   if a.generated_at::text<>p_expected_version then raise exception 'Assessment changed after this review was opened; reload and review the new version'; end if;
   if p_action='needs_changes' then update public.hq_work_items set status='open',action_taken=jsonb_build_object('action','needs_changes','assessment_id',a.id,'assessment_version',p_expected_version,'note',p_note),verification_status='pending',updated_at=now() where id=w.id; return jsonb_build_object('status','changes_requested','work_item_id',w.id,'assessment_id',a.id); end if;
   return public.hq_review_generated_assessment(a.id,p_action='approve',p_note);
 end if;
 raise exception 'Decision has no reviewable artifact';
end;
$$;

revoke all on function public.hq_get_publishing_review(uuid) from public, anon;
revoke all on function public.hq_review_publishing_artifact(uuid,text,text,text) from public, anon;
grant execute on function public.hq_get_publishing_review(uuid) to authenticated;
grant execute on function public.hq_review_publishing_artifact(uuid,text,text,text) to authenticated;
