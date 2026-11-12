-- P0: Canonical outcome-package assessment lineage, answer review and protected variants.
-- Extend assessment_items / assessment_item_outcomes. Do not alter attempt/response or marking history.
-- Existing items stay at lineage_contract_version=0 until explicitly certified.
begin;

alter table public.assessment_items
  add column if not exists outcome_package_resource_id uuid references public.learning_resources(id) on delete restrict,
  add column if not exists intended_learning_use text,
  add column if not exists exposure_policy text,
  add column if not exists eligible_uses text[] not null default '{}'::text[],
  add column if not exists answer_check_status text not null default 'unchecked',
  add column if not exists answer_checked_at timestamptz,
  add column if not exists answer_checked_by uuid references public.profiles(id) on delete set null,
  add column if not exists answer_check_evidence jsonb not null default '{}'::jsonb,
  add column if not exists variant_of_item_id uuid references public.assessment_items(id) on delete restrict,
  add column if not exists lineage_contract_version smallint not null default 0;

alter table public.assessment_items
  add constraint assessment_items_lineage_contract_version_chk check (lineage_contract_version in (0,1)),
  add constraint assessment_items_intended_learning_use_chk check (
    intended_learning_use is null or intended_learning_use in
      ('guided_practice','independent_practice','revision','diagnostic','formal_exam')
  ),
  add constraint assessment_items_exposure_policy_chk check (
    exposure_policy is null or exposure_policy in ('formative_revealable','protected_until_release')
  ),
  add constraint assessment_items_answer_check_status_chk check (answer_check_status in ('unchecked','checked')),
  add constraint assessment_items_eligible_uses_chk check (
    eligible_uses <@ array['exercise','topic_practice','quiz','diagnostic','formal_exam']::text[]
  ),
  add constraint assessment_items_lineage_complete_chk check (
    lineage_contract_version = 0 or (
      outcome_package_resource_id is not null
      and intended_learning_use is not null
      and exposure_policy is not null
      and cardinality(eligible_uses)>0
      and answer_check_status='checked'
      and answer_checked_at is not null
      and answer_checked_by is not null
      and jsonb_typeof(answer_check_evidence)='object'
      and nullif(btrim(coalesce(answer_check_evidence->>'method','')),'') is not null
      and length(btrim(coalesce(answer_check_evidence->>'summary',''))) >= 20
    )
  ),
  add constraint assessment_items_variant_not_self_chk check (
    variant_of_item_id is null or variant_of_item_id <> id
  );

create index if not exists assessment_items_package_resource_idx
  on public.assessment_items(outcome_package_resource_id)
  where lineage_contract_version=1;

comment on column public.assessment_items.outcome_package_resource_id is
  'Canonical learning_resources anchor of the authored outcome package, not a separate question bank.';
comment on column public.assessment_items.lineage_contract_version is
  '0=historical/unreviewed (not certified); 1=checked canonical outcome-package assessment policy.';
comment on column public.assessment_items.variant_of_item_id is
  'Explicit new question identity descended from another; never reuse a revealed item for a protected formal exam.';
comment on column public.assessment_items.exposure_policy is
  'Formative revealable after the existing feedback policy, or protected until the existing formal release policy.';

-- Central row invariant. Protect accepted question/answer versions from silent edits.
create or replace function public.exq_guard_outcome_package_assessment_item()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
declare
  v_type text;
  v_use text;
  v_parent public.assessment_items%rowtype;
begin
  -- RLS ownership alone is not a certification: force the reviewed RPC entrypoint.
  if tg_op='INSERT' and new.lineage_contract_version=1 then
    raise exception 'outcome_package_certification_rpc_required';
  end if;
  if tg_op='UPDATE' and old.lineage_contract_version=0
    and new.lineage_contract_version=1 and
    coalesce(current_setting('vibeschool.certifying_assessment_item',true),'')<>new.id::text then
    raise exception 'outcome_package_certification_rpc_required';
  end if;
  if tg_op='UPDATE' and old.lineage_contract_version=1 and (
       new.outcome_package_resource_id,new.source_resource_id,new.source_block_id,
       new.variant_of_item_id,new.eligible_uses,new.intended_learning_use,
       new.exposure_policy,new.answer_check_evidence,new.answer_checked_at,
       new.answer_checked_by,new.answer_check_status
     ) is distinct from (
       old.outcome_package_resource_id,old.source_resource_id,old.source_block_id,
       old.variant_of_item_id,old.eligible_uses,old.intended_learning_use,
       old.exposure_policy,old.answer_check_evidence,old.answer_checked_at,
       old.answer_checked_by,old.answer_check_status
     ) and coalesce(current_setting('vibeschool.certifying_assessment_item',true),'')<>new.id::text
  then raise exception 'certified_item_policy_change_requires_review'; end if;
  if tg_op='UPDATE' and old.lineage_contract_version=1 then
    if new.lineage_contract_version<>1 then
      raise exception 'certified_item_lineage_cannot_be_removed';
    end if;
    if new.assessment_id is distinct from old.assessment_id then
      raise exception 'certified_item_assessment_immutable';
    end if;
    if old.status='approved' and (
       new.outcome_package_resource_id,new.source_resource_id,new.source_block_id,
       new.variant_of_item_id,new.eligible_uses,new.intended_learning_use,
       new.exposure_policy,new.answer_check_evidence,new.answer_checked_at,
       new.answer_checked_by
     ) is distinct from (
       old.outcome_package_resource_id,old.source_resource_id,old.source_block_id,
       old.variant_of_item_id,old.eligible_uses,old.intended_learning_use,
       old.exposure_policy,old.answer_check_evidence,old.answer_checked_at,
       old.answer_checked_by
     ) then
       raise exception 'approved_package_item_policy_is_immutable';
    end if;
    if (new.prompt,new.options,new.correct_answer,new.accepted_answers,new.marking_guide,
        new.explanation,new.worked_solution,new.question_type,new.marks)
       is distinct from
       (old.prompt,old.options,old.correct_answer,old.accepted_answers,old.marking_guide,
        old.explanation,old.worked_solution,old.question_type,old.marks) then
      if old.status='approved' or new.answer_check_status='checked' then
        raise exception 'certified_item_content_immutable_create_a_new_variant';
      end if;
    end if;
  end if;

  if new.lineage_contract_version<>1 then return new; end if;
  if new.outcome_package_resource_id is null then raise exception 'package_resource_required'; end if;

  select assessment_type into v_type
  from public.assessment_definitions where id=new.assessment_id;
  if v_type is null then raise exception 'assessment_definition_missing'; end if;
  if coalesce(new.answer_check_evidence->>'method','') not in
     ('independent_solution','rubric_review','second_pass_check') then
    raise exception 'documented_answer_check_required';
  end if;
  if exists(select 1 from public.assessment_definitions ad
    join public.subjects s on s.id=ad.subject_id
    where ad.id=new.assessment_id and s.name ilike '%math%'
      and new.question_type in ('numeric','structured')
      and nullif(btrim(coalesce(new.worked_solution,'')),'') is null) then
    raise exception 'mathematics_worked_solution_required';
  end if;

  v_use:=case v_type
    when 'practice' then 'topic_practice'
    when 'exercise' then 'exercise'
    when 'homework' then 'exercise'
    when 'quiz' then 'quiz'
    when 'diagnostic' then 'diagnostic'
    when 'test' then 'formal_exam'
    when 'exam' then 'formal_exam'
    else null end;
  if v_use is null or not (v_use=any(new.eligible_uses)) then
    raise exception 'item_not_eligible_for_assessment_type';
  end if;

  if new.intended_learning_use='formal_exam' then
    if new.exposure_policy<>'protected_until_release'
      or new.eligible_uses<>array['formal_exam']::text[] then
      raise exception 'formal_variant_must_be_protected_and_exclusive';
    end if;
  elsif new.exposure_policy<>'formative_revealable'
     or 'formal_exam'=any(new.eligible_uses) then
    raise exception 'revealed_formative_item_cannot_be_formal_exam_eligible';
  end if;
  if (v_type in ('test','exam')) is distinct from (new.intended_learning_use='formal_exam') then
    raise exception 'assessment_context_and_item_exposure_conflict';
  end if;
  if (new.correct_answer is null or new.correct_answer in ('null'::jsonb,'{}'::jsonb,'[]'::jsonb))
     and coalesce(new.marking_guide,'{}'::jsonb)='{}'::jsonb
     and (case when jsonb_typeof(new.accepted_answers)='array' then jsonb_array_length(new.accepted_answers) else 0 end)=0 then
    raise exception 'checked_answer_or_rubric_required';
  end if;
  if nullif(btrim(coalesce(new.explanation,'')),'') is null then
    raise exception 'checked_answer_explanation_required';
  end if;
  if not exists (
     select 1 from public.assessment_item_outcomes aio
     join public.curriculum_learning_outcomes o on o.id=aio.outcome_id
     join public.learning_resources r on r.id=new.outcome_package_resource_id
     join public.assessment_definitions ad on ad.id=new.assessment_id
     left join public.curriculum c on c.id=o.curriculum_id
     where aio.assessment_item_id=new.id
       and o.status in ('active','verified')
       and r.status='active'
       and (r.subject_id is null or r.subject_id=ad.subject_id)
       and (c.global_subject_id is null or c.global_subject_id=ad.subject_id)
       and (r.subject_id is not null or r.curriculum_id is not null or r.sub_strand_id is not null)
       and (r.curriculum_id is null or r.curriculum_id=o.curriculum_id)
       and (r.sub_strand_id is null or r.sub_strand_id=o.sub_strand_id)
  ) then raise exception 'verified_package_outcome_link_required'; end if;
  if exists (
    select 1 from public.assessment_item_outcomes aio
    join public.curriculum_learning_outcomes o on o.id=aio.outcome_id
    join public.learning_resources r on r.id=new.outcome_package_resource_id
    where aio.assessment_item_id=new.id and (
      o.status not in ('active','verified')
      or (r.curriculum_id is not null and r.curriculum_id is distinct from o.curriculum_id)
      or (r.sub_strand_id is not null and r.sub_strand_id is distinct from o.sub_strand_id)
    )
  ) then raise exception 'all_item_outcomes_must_match_package_scope'; end if;

  if new.intended_learning_use<>'formal_exam' and exists (
    select 1 from public.assessment_items parent
    where parent.id in (new.variant_of_item_id,new.source_item_id)
      and parent.exposure_policy='protected_until_release'
  ) then raise exception 'protected_parent_cannot_become_revealed_formative'; end if;

  if new.intended_learning_use='formal_exam' then
    if exists(select 1 from public.assessment_questions q
      where q.source_assessment_item_id=new.id) then
      raise exception 'protected_variant_already_promoted_to_question_bank';
    end if;
    if new.source_item_id is not null then
      select * into v_parent from public.assessment_items where id=new.source_item_id;
      if v_parent.id is not null and (
        v_parent.exposure_policy='formative_revealable' or exists (
          select 1 from public.assessment_definitions d
          where d.id=v_parent.assessment_id and
            d.assessment_type in ('exercise','homework','quiz','practice','diagnostic')
        )
      ) then raise exception 'revealed_source_item_cannot_be_formal_variant'; end if;
    end if;
    if new.variant_of_item_id is not null then
      select * into v_parent from public.assessment_items where id=new.variant_of_item_id;
      if v_parent.id is null then raise exception 'variant_parent_missing'; end if;
      if lower(btrim(new.prompt))=lower(btrim(v_parent.prompt)) then
        raise exception 'formal_variant_must_have_a_distinct_prompt';
      end if;
    end if;
  end if;

  -- A previously exposed prompt cannot become a formal-exam question through copying.
  -- The reverse direction is also blocked, protecting an already approved formal item.
  if exists (
    select 1 from public.assessment_items other
    join public.assessment_item_outcomes other_link
      on other_link.assessment_item_id=other.id
    join public.assessment_item_outcomes my_link
      on my_link.outcome_id=other_link.outcome_id
    join public.assessment_definitions other_def on other_def.id=other.assessment_id
    where my_link.assessment_item_id=new.id
      and other.id<>new.id
      and lower(btrim(other.prompt))=lower(btrim(new.prompt))
      and (
        (new.intended_learning_use='formal_exam'
          and (other.exposure_policy='formative_revealable'
            or other_def.assessment_type in ('exercise','homework','quiz','practice','diagnostic')))
        or
        (new.intended_learning_use<>'formal_exam'
          and other.exposure_policy='protected_until_release')
      )
  ) then raise exception 'question_prompt_crosses_protected_formative_boundary'; end if;

  return new;
end;
$$;

drop trigger if exists assessment_items_outcome_package_guard on public.assessment_items;
create trigger assessment_items_outcome_package_guard
before insert or update on public.assessment_items
for each row execute function public.exq_guard_outcome_package_assessment_item();

-- An approved or certified item's curricular evidence is immutable.
-- Even a non-last outcome link cannot be silently changed or removed.
create or replace function public.exq_guard_certified_item_outcome_unlink()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_item_id uuid;
begin
  v_item_id:=case when tg_op='INSERT' then new.assessment_item_id else old.assessment_item_id end;
  if exists (
    select 1 from public.assessment_items
    where id=v_item_id and lineage_contract_version=1 and status<>'retired'
  ) then raise exception 'certified_item_outcome_link_immutable'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists assessment_item_outcomes_preserve_certified on public.assessment_item_outcomes;
create trigger assessment_item_outcomes_preserve_certified
before insert or delete or update on public.assessment_item_outcomes
for each row execute function public.exq_guard_certified_item_outcome_unlink();

-- A protected formal item cannot be promoted to the reusable question bank.
-- This closes the alternate historical bank-promotion path without replacing that bank.
create or replace function public.exq_guard_protected_question_bank_promotion()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.source_assessment_item_id is not null and exists (
    select 1 from public.assessment_items i
    where i.id=new.source_assessment_item_id and i.lineage_contract_version=1
      and i.exposure_policy='protected_until_release'
  ) then raise exception 'protected_formal_item_cannot_enter_reusable_question_bank'; end if;
  return new;
end;
$$;
drop trigger if exists assessment_questions_protected_source_guard on public.assessment_questions;
create trigger assessment_questions_protected_source_guard
before insert or update of source_assessment_item_id on public.assessment_questions
for each row execute function public.exq_guard_protected_question_bank_promotion();

-- At publication, the existing engine still owns attempts, marking, release and scoring.
-- This only blocks an assessment that includes certified items with incompatible policy.
create or replace function public.exq_guard_package_assessment_release()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare
  v_expected text;
begin
  if new.status not in ('approved','assigned','open','closed')
     or (tg_op='UPDATE' and old.status=new.status and old.published_at is not distinct from new.published_at) then return new; end if;
  v_expected:=case new.assessment_type
    when 'practice' then 'topic_practice'
    when 'exercise' then 'exercise'
    when 'homework' then 'exercise'
    when 'quiz' then 'quiz'
    when 'diagnostic' then 'diagnostic'
    when 'exam' then 'formal_exam'
    when 'test' then 'formal_exam'
    else null end;
  if exists (
    select 1 from public.assessment_items i
    where i.assessment_id=new.id and i.status<>'retired'
      and i.lineage_contract_version=1
      and (i.status<>'approved'
        or not (v_expected=any(i.eligible_uses))
        or (new.assessment_type in ('exam','test')) is distinct from
           (i.exposure_policy='protected_until_release')
        or not exists (
          select 1 from public.assessment_item_outcomes io
          where io.assessment_item_id=i.id))
  ) then raise exception 'package_assessment_item_policy_not_releasable'; end if;
  -- An explicitly package-owned assessment cannot mix checked items with
  -- uncertified ones: avoid a false "complete" manifest.
  if nullif(new.generation_metadata->>'outcome_package_resource_id','') is not null
     and exists (
       select 1 from public.assessment_items i
       where i.assessment_id=new.id and i.status<>'retired'
         and i.lineage_contract_version<>1
     ) then raise exception 'package_assessment_has_uncertified_items'; end if;
  return new;
end;
$$;
drop trigger if exists assessment_definitions_package_release_guard on public.assessment_definitions;
create trigger assessment_definitions_package_release_guard
before update of status,published_at on public.assessment_definitions
for each row execute function public.exq_guard_package_assessment_release();

-- This command supplies the human/operator's *documented* independent answer check.
-- It does not pretend SQL can determine pedagogical correctness automatically.
create or replace function public.exq_certify_outcome_package_question(
  p_item_id uuid,
  p_package_resource_id uuid,
  p_outcome_id uuid,
  p_intended_learning_use text,
  p_eligible_uses text[],
  p_exposure_policy text,
  p_answer_check_evidence jsonb,
  p_variant_of_item_id uuid default null
)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_caller uuid:=auth.uid();
  v_item public.assessment_items%rowtype;
  v_definition public.assessment_definitions%rowtype;
  v_resource public.learning_resources%rowtype;
  v_outcome public.curriculum_learning_outcomes%rowtype;
  v_subject_name text;
begin
  if v_caller is null then raise exception 'not_authenticated'; end if;
  select * into v_item from public.assessment_items where id=p_item_id for update;
  if not found then raise exception 'assessment_item_not_found'; end if;
  select * into v_definition from public.assessment_definitions
    where id=v_item.assessment_id;
  if not found then raise exception 'assessment_definition_missing'; end if;
  if v_definition.teacher_id is distinct from v_caller
     and not coalesce(public.is_platform_owner(),false) then
    raise exception 'assessment_item_not_owned';
  end if;
  if v_definition.status not in ('draft','review','approved')
     or v_item.status='retired' then
    raise exception 'assessment_item_locked_for_lineage_change';
  end if;
  if v_definition.published_at is not null then
    raise exception 'published_assessment_item_cannot_be_recertified';
  end if;
  if exists(select 1 from public.assessment_responses
      where assessment_item_id=v_item.id) then
    raise exception 'existing_attempt_requires_new_question_variant';
  end if;

  select * into v_resource from public.learning_resources
    where id=p_package_resource_id and status='active';
  if not found then raise exception 'active_package_resource_required'; end if;
  select * into v_outcome from public.curriculum_learning_outcomes
    where id=p_outcome_id and status in ('active','verified');
  if not found then raise exception 'canonical_active_outcome_required'; end if;
  if v_resource.subject_id is null and v_resource.curriculum_id is null
     and v_resource.sub_strand_id is null then
    raise exception 'unscoped_package_resource_not_certifiable';
  end if;
  if exists(select 1 from public.curriculum c where c.id=v_outcome.curriculum_id
    and c.global_subject_id is not null and c.global_subject_id<>v_definition.subject_id) then
    raise exception 'canonical_outcome_subject_mismatch';
  end if;
  if v_resource.subject_id is not null
     and v_resource.subject_id is distinct from v_definition.subject_id then
    raise exception 'package_resource_subject_mismatch';
  end if;
  if v_resource.curriculum_id is not null and
     v_resource.curriculum_id is distinct from v_outcome.curriculum_id then
    raise exception 'package_outcome_curriculum_mismatch';
  end if;
  if v_resource.sub_strand_id is not null and
     v_resource.sub_strand_id is distinct from v_outcome.sub_strand_id then
    raise exception 'package_outcome_sub_strand_mismatch';
  end if;
  if nullif(btrim(coalesce(v_outcome.source_locator,v_outcome.source_ref,'')),'') is null then
    raise exception 'curriculum_source_locator_required';
  end if;
  if jsonb_typeof(p_answer_check_evidence)<>'object'
     or coalesce(p_answer_check_evidence->>'method','') not in
        ('independent_solution','rubric_review','second_pass_check')
     or length(btrim(coalesce(p_answer_check_evidence->>'summary','')))<20 then
    raise exception 'documented_answer_check_required';
  end if;
  if p_intended_learning_use='formal_exam' and p_variant_of_item_id is not null
     and not exists(select 1 from public.assessment_items
       where id=p_variant_of_item_id and id<>p_item_id) then
    raise exception 'variant_parent_missing';
  end if;
  select name into v_subject_name from public.subjects where id=v_definition.subject_id;
  if (v_subject_name ilike '%math%') and v_item.question_type in ('numeric','structured')
    and nullif(btrim(coalesce(v_item.worked_solution,'')),'') is null then
    raise exception 'mathematics_worked_solution_required';
  end if;

  -- Preserve previously associated outcomes: no rewrite of history or old mastery.
  if not exists(select 1 from public.assessment_item_outcomes
     where assessment_item_id=p_item_id and outcome_id=p_outcome_id) then
    insert into public.assessment_item_outcomes(assessment_item_id,outcome_id,weight)
    values (p_item_id,p_outcome_id,1);
  end if;

  perform set_config('vibeschool.certifying_assessment_item',p_item_id::text,true);
  update public.assessment_items set
    outcome_package_resource_id=p_package_resource_id,
    source_resource_id=coalesce(source_resource_id,p_package_resource_id),
    intended_learning_use=p_intended_learning_use,
    eligible_uses=p_eligible_uses,
    exposure_policy=p_exposure_policy,
    answer_check_status='checked',
    answer_checked_at=now(),
    answer_checked_by=v_caller,
    answer_check_evidence=p_answer_check_evidence,
    variant_of_item_id=p_variant_of_item_id,
    lineage_contract_version=1,
    updated_at=now()
  where id=p_item_id;
  perform set_config('vibeschool.certifying_assessment_item','',true);

  return jsonb_build_object(
    'ok',true,'assessment_item_id',p_item_id,
    'outcome_id',p_outcome_id,'package_resource_id',p_package_resource_id,
    'lineage_contract_version',1,'checked',true,
    'publication_changed',false,'exposure_policy',p_exposure_policy
  );
end;
$$;

revoke all on function public.exq_certify_outcome_package_question(
  uuid,uuid,uuid,text,text[],text,jsonb,uuid) from public,anon;
grant execute on function public.exq_certify_outcome_package_question(
  uuid,uuid,uuid,text,text[],text,jsonb,uuid) to authenticated,service_role;

comment on function public.exq_certify_outcome_package_question(
  uuid,uuid,uuid,text,text[],text,jsonb,uuid) is
  'Documented answer/rubric check, verified package and outcome link, and mutually exclusive formative/formal eligibility. Never publishes or marks learner attempts.';

commit;
