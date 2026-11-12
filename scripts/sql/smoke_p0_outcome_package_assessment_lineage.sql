-- Run ONLY after the P0 lineage migration is applied.
-- Requires at least one teacher and active curriculum-linked learning resource.
-- Entire write path is rolled back; no existing learner attempts are touched.
begin;
do $p0$
declare
  t uuid; s uuid; sub uuid; res uuid; outcome uuid;
  practice uuid; exam uuid; item uuid; formal_item uuid; copied_item uuid;
  er text; receipt jsonb;
begin
  select teacher_id, school_id into t,s
    from public.assessment_definitions where teacher_id is not null limit 1;
  select c.global_subject_id,r.id,o.id into sub,res,outcome
    from public.learning_resources r
    join public.curriculum_learning_outcomes o on o.curriculum_id=r.curriculum_id
    join public.curriculum c on c.id=o.curriculum_id
    where r.status='active' and o.status in ('active','verified')
      and c.global_subject_id is not null
      and (r.subject_id is null or r.subject_id=c.global_subject_id)
      and (r.sub_strand_id is null or r.sub_strand_id=o.sub_strand_id)
    limit 1;
  if t is null or res is null then raise exception 'missing_smoke_test_fixture'; end if;
  perform set_config('request.jwt.claim.sub',t::text,true);

  insert into public.assessment_definitions(school_id,teacher_id,subject_id,assessment_type,title,status)
  values(s,t,sub,'practice','P0 transaction test practice','draft')
  returning id into practice;
  insert into public.assessment_items(assessment_id,question_type,prompt,correct_answer,explanation,order_num)
  values(practice,'multiple_choice','P0 smoke: 3 + 4 = ?', '"7"'::jsonb,
    'Three plus four equals seven.',1) returning id into item;

  begin
    update public.assessment_items set lineage_contract_version=1 where id=item;
    raise exception 'FAIL_direct_lineage_upgrade_allowed';
  exception when others then get stacked diagnostics er=message_text;
    if er<>'outcome_package_certification_rpc_required' then
      raise exception 'wrong_direct_upgrade_failure: %',er; end if;
  end;
  receipt:=public.exq_certify_outcome_package_question(
    item,res,outcome,'independent_practice',array['topic_practice'],
    'formative_revealable',
    '{"method":"independent_solution","summary":"Independently solved and checked this test item and explanation."}'::jsonb);
  if receipt->>'checked'<>'true' then raise exception 'formative_not_checked'; end if;
  begin
    update public.assessment_items set eligible_uses=array['topic_practice','quiz'] where id=item;
    raise exception 'FAIL_certified_policy_edit_allowed';
  exception when others then get stacked diagnostics er=message_text;
    if er<>'certified_item_policy_change_requires_review' then
      raise exception 'wrong_policy_edit_failure: %',er; end if;
  end;

  begin
    update public.assessment_items set correct_answer='"8"'::jsonb where id=item;
    raise exception 'FAIL_checked_answer_edited';
  exception when others then get stacked diagnostics er=message_text;
    if er<>'certified_item_content_immutable_create_a_new_variant' then
      raise exception 'wrong_edit_failure: %',er; end if;
  end;

  insert into public.assessment_definitions(school_id,teacher_id,subject_id,assessment_type,title,status)
  values(s,t,sub,'exam','P0 transaction test formal','draft')
  returning id into exam;
  insert into public.assessment_items(assessment_id,question_type,prompt,correct_answer,explanation,order_num)
  values(exam,'multiple_choice','P0 smoke: 3 + 4 = ?', '"7"'::jsonb,
    'Three plus four equals seven.',1) returning id into copied_item;
  begin
    perform public.exq_certify_outcome_package_question(
      copied_item,res,outcome,'formal_exam',array['formal_exam'],
      'protected_until_release',
      '{"method":"independent_solution","summary":"Independent recheck of a copied prompt in the formal setting."}'::jsonb,
      item);
    raise exception 'FAIL_revealed_prompt_reused';
  exception when others then get stacked diagnostics er=message_text;
    if er<>'formal_variant_must_have_a_distinct_prompt' then
      raise exception 'wrong_copy_failure: %',er; end if;
  end;

  insert into public.assessment_items(assessment_id,question_type,prompt,correct_answer,explanation,order_num)
  values(exam,'multiple_choice','P0 smoke: 4 + 3 = ?', '"7"'::jsonb,
    'Four plus three equals seven.',2) returning id into formal_item;
  receipt:=public.exq_certify_outcome_package_question(
    formal_item,res,outcome,'formal_exam',array['formal_exam'],
    'protected_until_release',
    '{"method":"independent_solution","summary":"Independently solved distinct protected formal variant."}'::jsonb,
    item);
  if receipt->>'exposure_policy'<>'protected_until_release' then
    raise exception 'formal_not_protected'; end if;
  begin
    update public.assessment_items set eligible_uses=array['formal_exam','topic_practice'] where id=formal_item;
    raise exception 'FAIL_formal_reused_in_practice';
  exception when others then get stacked diagnostics er=message_text;
    if er<>'certified_item_policy_change_requires_review' then
      raise exception 'wrong_reuse_failure: %',er; end if;
  end;
  begin
    insert into public.assessment_questions(source_assessment_item_id,question_text,question_type,author_id)
    values(formal_item,'P0 smoke bank leak','multiple_choice',t);
    raise exception 'FAIL_formal_promoted_to_bank';
  exception when others then get stacked diagnostics er=message_text;
    if er<>'protected_formal_item_cannot_enter_reusable_question_bank' then
      raise exception 'wrong_bank_failure: %',er; end if;
  end;
  if not exists(select 1 from public.assessment_item_outcomes
    where assessment_item_id=formal_item and outcome_id=outcome) then
    raise exception 'missing_outcome_link'; end if;
end $p0$;

select 'PASS — checked, immutable, mapped, formative/formal boundary and bank isolation' as smoke_result;
rollback;
