-- Batch adapter for VibeSchool's existing owner-reviewed canonical publisher.
-- It is NOT a second question bank or a second assessment engine.
create or replace function public.hq_publish_original_topic_batch(
  p_papers jsonb, p_publish boolean default false, p_approved boolean default false
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $$
declare
  v_caller uuid:=auth.uid();
  v_paper jsonb;
  v_result jsonb;
  v_results jsonb:='[]'::jsonb;
  v_topic text;
  v_assessment uuid;
  v_assignment uuid;
  v_count integer;
  v_valid boolean;
  v_index integer:=0;
begin
  if v_caller is null or not coalesce(public.is_platform_owner(),false)
  then raise exception 'platform_owner_required' using errcode='42501'; end if;
  if jsonb_typeof(p_papers)<>'array' then raise exception 'papers_must_be_array'; end if;
  v_count:=jsonb_array_length(p_papers);
  if v_count<1 or v_count>20 then raise exception 'batch_size_must_be_between_1_and_20'; end if;
  if p_publish and not p_approved then raise exception 'explicit_owner_approval_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('vs-grade9-topic-batch',0));
  for v_paper in select value from jsonb_array_elements(p_papers) loop
    v_index:=v_index+1;
    if v_paper->>'grade'<>'Grade 9'
       or v_paper->>'subject'<>'Mathematics'
       or v_paper->>'assessment_type'<>'practice'
       or v_paper->>'visibility'<>'public_practice'
       or jsonb_typeof(v_paper->'items')<>'array'
       or jsonb_array_length(v_paper->'items')<>5
    then raise exception 'invalid_topic_paper_at_%',v_index; end if;
    select min(x->>'topic') into v_topic from jsonb_array_elements(v_paper->'items') x;
    if v_topic not in ('Integers','Cubes and Cube Roots','Indices and Logarithms','Linear Inequalities','Probability')
       or exists(select 1 from jsonb_array_elements(v_paper->'items') x where x->>'topic' is distinct from v_topic)
    then raise exception 'topic_mapping_invalid_at_%',v_index; end if;
    -- Existing HQ publisher requires a duration. Keep 5 in input for validation,
    -- then convert its *new* topic-only assignment to untimed inside this transaction.
    v_result:=public.hq_publish_original_practice(
      v_paper || jsonb_build_object('duration_minutes',5),
      p_publish,p_publish and p_approved
    );
    v_valid:=coalesce((v_result->>'valid')::boolean,false);
    if not v_valid then
      if p_publish then raise exception 'topic_batch_rejected_at_%:%',v_index,v_result; end if;
      v_results:=v_results||jsonb_build_array(jsonb_build_object('index',v_index,'topic',v_topic,'validation',v_result));
      continue;
    end if;
    if p_publish then
      if coalesce((v_result->>'published')::boolean,false)=false
        or nullif(v_result->>'assessment_id','') is null
        or nullif(v_result->>'assignment_id','') is null
      then raise exception 'canonical_publish_failed_at_%',v_index; end if;
      v_assessment:=(v_result->>'assessment_id')::uuid;
      v_assignment:=(v_result->>'assignment_id')::uuid;
      update public.assessment_definitions
      set estimated_minutes=null,
          generation_metadata=generation_metadata||jsonb_build_object(
            'topic_practice',true,
            'topic',v_topic,
            'subject','Mathematics',
            'batch_id',p_papers->0->>'batch_id',
            'source_origin','VibeSchool Original',
            'curriculum_verification','provisional'
          )
      where id=v_assessment and teacher_id=v_caller and assessment_type='practice'
        and school_id is null and class_id is null;
      if not found then raise exception 'invalid_published_assessment_ownership'; end if;
      update public.assessment_assignments
      set time_limit_minutes=null,show_score_policy='immediate',show_explanations=true
      where id=v_assignment and assessment_id=v_assessment and teacher_id=v_caller
        and audience='public_practice' and audience_grade='Grade 9'
        and status='open' and school_id is null and class_id is null;
      if not found then raise exception 'invalid_published_assignment_ownership'; end if;
      if (select count(*) from public.assessment_items where assessment_id=v_assessment
        and status='approved' and source_block_id is not null
        and auto_marking_mode='option_match')<>5
      then raise exception 'canonical_five_item_grounding_failed'; end if;
    end if;
    v_results:=v_results||jsonb_build_array(jsonb_build_object(
      'index',v_index,'topic',v_topic,'validation',v_result
    ));
  end loop;
  return jsonb_build_object('ok',true,'published',p_publish,'batch_count',v_count,
    'results',v_results);
end;
$$;
revoke all on function public.hq_publish_original_topic_batch(jsonb,boolean,boolean) from public,anon;
grant execute on function public.hq_publish_original_topic_batch(jsonb,boolean,boolean) to authenticated;
