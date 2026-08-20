-- Teacher Content Coverage — governed mapping review authority.
-- A VERIFIED teacher mapping must be backed by a real platform-owner review.

begin;

create or replace function public.teacher_content_validate_verified_link()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  r public.learning_resources%rowtype;
  o public.curriculum_learning_outcomes%rowtype;
begin
  if new.verification_state <> 'VERIFIED' then return new; end if;

  if new.reviewed_by is null or not exists (
    select 1 from public.platform_owners po where po.profile_id=new.reviewed_by
  ) then
    raise exception using errcode='42501', message='TEACHER_CONTENT_OWNER_REVIEW_REQUIRED';
  end if;

  select * into r from public.learning_resources where id=new.resource_id;
  if not found or r.status <> 'active' then
    raise exception using errcode='23514', message='TEACHER_CONTENT_RESOURCE_NOT_ACTIVE';
  end if;

  if new.curriculum_id is not null and r.curriculum_id is not null and new.curriculum_id <> r.curriculum_id then
    raise exception using errcode='23514', message='TEACHER_CONTENT_CURRICULUM_MISMATCH';
  end if;
  if new.sub_strand_id is not null and r.sub_strand_id is not null and new.sub_strand_id <> r.sub_strand_id then
    raise exception using errcode='23514', message='TEACHER_CONTENT_SUBSTRAND_MISMATCH';
  end if;

  if new.learning_outcome_id is not null then
    select * into o from public.curriculum_learning_outcomes where id=new.learning_outcome_id;
    if not found or o.status <> 'active' or o.source_type <> 'official' then
      raise exception using errcode='23514', message='TEACHER_CONTENT_OUTCOME_NOT_OFFICIAL_ACTIVE';
    end if;
    if new.curriculum_id is not null and o.curriculum_id is distinct from new.curriculum_id then
      raise exception using errcode='23514', message='TEACHER_CONTENT_OUTCOME_CURRICULUM_MISMATCH';
    end if;
    if new.sub_strand_id is not null and o.sub_strand_id is distinct from new.sub_strand_id then
      raise exception using errcode='23514', message='TEACHER_CONTENT_OUTCOME_SUBSTRAND_MISMATCH';
    end if;
  end if;

  if new.mapping_method='exact_learning_outcome_id' and new.learning_outcome_id is null then
    raise exception using errcode='23514', message='TEACHER_CONTENT_EXACT_OUTCOME_REQUIRED';
  end if;
  if new.mapping_method='exact_sub_strand_id' and new.sub_strand_id is null then
    raise exception using errcode='23514', message='TEACHER_CONTENT_EXACT_SUBSTRAND_REQUIRED';
  end if;
  if new.mapping_method='exact_curriculum_id' and new.curriculum_id is null then
    raise exception using errcode='23514', message='TEACHER_CONTENT_EXACT_CURRICULUM_REQUIRED';
  end if;
  return new;
end;
$$;
revoke all on function public.teacher_content_validate_verified_link() from public,anon,authenticated;

-- authorization-test: owner-only mapping decision; authenticated non-owners and service_role cannot impersonate a human reviewer because auth.uid()+platform_owners is required.
create or replace function public.hq_review_curriculum_resource_mapping(
  p_review_id uuid,
  p_decision text,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path='public','auth'
as $$
declare
  v_actor uuid := auth.uid();
  v_review public.curriculum_resource_mapping_reviews%rowtype;
  v_version uuid;
begin
  if v_actor is null or not public.is_platform_owner() then
    raise exception using errcode='42501', message='owner_authorization_required';
  end if;
  if p_decision not in ('VERIFIED','REJECTED') then
    raise exception using errcode='22023', message='invalid_mapping_decision';
  end if;
  if nullif(btrim(p_reason),'') is null then
    raise exception using errcode='22023', message='mapping_decision_reason_required';
  end if;

  select * into v_review
  from public.curriculum_resource_mapping_reviews
  where id=p_review_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='mapping_review_not_found';
  end if;
  if v_review.state <> 'PROPOSED' then
    raise exception using errcode='23514', message='mapping_review_not_proposed';
  end if;

  if p_decision='VERIFIED' then
    if v_review.proposed_curriculum_id is null
       and v_review.proposed_sub_strand_id is null
       and v_review.proposed_learning_outcome_id is null then
      raise exception using errcode='23514', message='mapping_review_has_no_canonical_target';
    end if;

    select rv.id into v_version
    from public.learning_resource_versions rv
    where rv.resource_id=v_review.resource_id and rv.lifecycle_status='certified'
    order by rv.version_number desc
    limit 1;
    if v_version is null then
      raise exception using errcode='23514', message='mapping_resource_not_certified';
    end if;
  end if;

  update public.curriculum_resource_mapping_reviews
  set state=p_decision,
      reviewer_id=v_actor,
      decision_reason=p_reason,
      reviewed_at=now(),
      updated_at=now()
  where id=p_review_id;

  -- Materialize exact current lesson targets only after human verification and resource certification.
  if p_decision='VERIFIED' and v_review.proposed_curriculum_id is not null then
    insert into public.teaching_resource_links(
      resource_id,resource_version_id,target_type,lesson_plan_id,usage_role,sequence,
      created_by,curriculum_id,sub_strand_id,learning_outcome_id,mapping_method,
      verification_state,provenance,reviewed_by,reviewed_at,lifecycle_status
    )
    select v_review.resource_id,v_version,'lesson_plan',lp.id,'source',1,
      v_actor,v_review.proposed_curriculum_id,v_review.proposed_sub_strand_id,
      v_review.proposed_learning_outcome_id,'human_verified','VERIFIED',
      jsonb_build_object('mapping_review_id',v_review.id,'matching_method',v_review.matching_method,'evidence',v_review.evidence,'provenance',v_review.provenance),
      v_actor,now(),'active'
    from public.lesson_plans lp
    where lp.curriculum_id=v_review.proposed_curriculum_id
      and not exists (
        select 1 from public.teaching_resource_links t
        where t.resource_id=v_review.resource_id
          and t.target_type='lesson_plan'
          and t.lesson_plan_id=lp.id
          and t.verification_state='VERIFIED'
          and t.lifecycle_status='active'
      );
  end if;

  return jsonb_build_object('ok',true,'review_id',p_review_id,'decision',p_decision,'resource_version_id',v_version);
end;
$$;
revoke all on function public.hq_review_curriculum_resource_mapping(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.hq_review_curriculum_resource_mapping(uuid,text,text) to authenticated;

-- Newly-created lesson plans deterministically inherit previously human-verified exact curriculum mappings.
create or replace function public.teacher_content_materialize_reviewed_links_for_lesson()
returns trigger
language plpgsql
security definer
set search_path='public','auth'
as $$
begin
  if new.curriculum_id is null then return new; end if;

  insert into public.teaching_resource_links(
    resource_id,resource_version_id,target_type,lesson_plan_id,usage_role,sequence,
    created_by,curriculum_id,sub_strand_id,learning_outcome_id,mapping_method,
    verification_state,provenance,reviewed_by,reviewed_at,lifecycle_status
  )
  select r.resource_id,rv.id,'lesson_plan',new.id,'source',1,
    r.reviewer_id,r.proposed_curriculum_id,r.proposed_sub_strand_id,r.proposed_learning_outcome_id,
    'human_verified','VERIFIED',
    jsonb_build_object('mapping_review_id',r.id,'matching_method',r.matching_method,'evidence',r.evidence,'provenance',r.provenance),
    r.reviewer_id,r.reviewed_at,'active'
  from public.curriculum_resource_mapping_reviews r
  join lateral (
    select x.id
    from public.learning_resource_versions x
    where x.resource_id=r.resource_id and x.lifecycle_status='certified'
    order by x.version_number desc limit 1
  ) rv on true
  where r.state='VERIFIED'
    and r.proposed_curriculum_id=new.curriculum_id
    and r.reviewer_id is not null
    and exists(select 1 from public.platform_owners po where po.profile_id=r.reviewer_id)
    and not exists (
      select 1 from public.teaching_resource_links t
      where t.resource_id=r.resource_id and t.target_type='lesson_plan'
        and t.lesson_plan_id=new.id and t.verification_state='VERIFIED' and t.lifecycle_status='active'
    );
  return new;
end;
$$;
revoke all on function public.teacher_content_materialize_reviewed_links_for_lesson() from public,anon,authenticated;

drop trigger if exists teacher_content_materialize_reviewed_links_for_lesson on public.lesson_plans;
create trigger teacher_content_materialize_reviewed_links_for_lesson
after insert or update of curriculum_id on public.lesson_plans
for each row execute function public.teacher_content_materialize_reviewed_links_for_lesson();

commit;
