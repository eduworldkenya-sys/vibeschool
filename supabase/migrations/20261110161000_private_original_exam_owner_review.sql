-- Grade 4 owner-only review: question/answer data remains in the private
-- schema and is returned only to an authenticated platform owner requesting
-- a specific non-retired paper. This is NOT a public learner endpoint.
create or replace function public.hq_get_original_exam_draft_for_review(p_paper_id text)
returns jsonb language plpgsql security definer
set search_path=public,private,pg_temp
as $fn$
declare v_draft private.original_exam_drafts%rowtype;
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then
    raise exception 'platform_owner_required' using errcode='42501';
  end if;
  select * into v_draft from private.original_exam_drafts d
   where d.paper_id=p_paper_id and d.content_state<>'retired';
  if not found then raise exception 'reviewable_private_exam_not_found'; end if;
  return jsonb_build_object(
    'id',v_draft.paper_id,'status',v_draft.content_state,
    'paper',v_draft.paper,
    'curriculum_status','outcome_mapping_provisional');
end;
$fn$;
revoke all on function public.hq_get_original_exam_draft_for_review(text) from public,anon;
grant execute on function public.hq_get_original_exam_draft_for_review(text) to authenticated;

create or replace function public.hq_review_original_exam_draft(
  p_paper_id text,
  p_confirmed boolean,
  p_curriculum_reference text
) returns jsonb language plpgsql security definer
set search_path=public,private,pg_temp
as $fn$
declare
  v_draft private.original_exam_drafts%rowtype;
  v_item jsonb;
  v_opt jsonb;
  v_keys text[];
  v_idx integer:=0;
  v_reviewed_at timestamptz:=now();
begin
  if auth.uid() is null or not coalesce(public.is_platform_owner(),false) then
    raise exception 'platform_owner_required' using errcode='42501';
  end if;
  if p_confirmed is distinct from true then
    raise exception 'explicit_educational_review_attestation_required' using errcode='42501';
  end if;
  if p_curriculum_reference is null
    or p_curriculum_reference !~ '^https://(www\.)?kicd\.ac\.ke/'
  then
    raise exception 'official_curriculum_reference_required';
  end if;

  select * into v_draft
    from private.original_exam_drafts d
   where d.paper_id=p_paper_id for update;
  if not found or v_draft.content_state='retired' then
    raise exception 'reviewable_private_exam_not_found';
  end if;
  if coalesce(v_draft.review_evidence->>'public_repository_exposure','false')<>'false' then
    raise exception 'exposed_exam_paper_must_be_replaced';
  end if;
  if v_draft.published_at is not null then
    raise exception 'published_exam_review_is_immutable';
  end if;
  if v_draft.grade<>'Grade 4'
    or jsonb_typeof(v_draft.paper->'items')<>'array'
    or jsonb_array_length(v_draft.paper->'items')<1 then
    raise exception 'grade4_review_structure_invalid';
  end if;

  for v_item in select value from jsonb_array_elements(v_draft.paper->'items') loop
    v_idx:=v_idx+1;
    if coalesce((v_item->>'number')::integer,-1)<>v_idx
      or coalesce(v_item->>'correctAnswer','') not in ('A','B','C','D')
      or jsonb_typeof(v_item->'options')<>'array'
      or jsonb_array_length(v_item->'options')<>4
      or length(coalesce(v_item->>'prompt',''))<8
      or length(coalesce(v_item->>'explanation',''))<12
      or coalesce((v_item->>'marks')::integer,0)<1 then
      raise exception 'private_exam_item_invalid_at:%',v_idx;
    end if;
    v_keys:=array[]::text[];
    for v_opt in select value from jsonb_array_elements(v_item->'options') loop
      if coalesce(v_opt->>'value','') not in ('A','B','C','D') then
        raise exception 'private_exam_option_invalid_at:%',v_idx;
      end if;
      if v_opt->>'value'=any(v_keys) then
        raise exception 'private_exam_duplicate_option_at:%',v_idx;
      end if;
      v_keys:=array_append(v_keys,v_opt->>'value');
    end loop;
    if not (v_item->>'correctAnswer'=any(v_keys)) then
      raise exception 'private_exam_key_missing_at:%',v_idx;
    end if;
  end loop;

  update private.original_exam_drafts d
     set content_state='reviewed',
         review_evidence=d.review_evidence||jsonb_build_object(
           'independent_review','passed',
           'reviewed_by',auth.uid(),
           'reviewed_at',v_reviewed_at,
           'official_curriculum_reference',p_curriculum_reference,
           'outcome_mapping','provisional_not_independently_certified',
           'reviewed_question_count',v_idx),
         updated_at=v_reviewed_at
   where d.paper_id=p_paper_id;
  return jsonb_build_object('ok',true,'id',p_paper_id,
    'reviewed',true,'question_count',v_idx,
    'curriculum_verification','provisional');
end;
$fn$;
revoke all on function public.hq_review_original_exam_draft(text,boolean,text) from public,anon;
grant execute on function public.hq_review_original_exam_draft(text,boolean,text) to authenticated;
