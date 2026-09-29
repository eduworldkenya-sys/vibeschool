-- Teacher Content Coverage — deterministic curriculum -> resource authority.
-- Extends Canonical Learning Assets; does not create a second content root.
-- Requires 20260818141000_canonical_learning_resource_versions.sql.

begin;

alter table public.teaching_resource_links
  add column if not exists curriculum_id uuid references public.curriculum(id) on delete restrict,
  add column if not exists sub_strand_id uuid references public.cbc_strands(id) on delete restrict,
  add column if not exists learning_outcome_id uuid references public.curriculum_learning_outcomes(id) on delete restrict,
  add column if not exists mapping_method text not null default 'manual_unverified',
  add column if not exists verification_state text not null default 'PROPOSED',
  add column if not exists provenance jsonb not null default '{}'::jsonb,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists lifecycle_status text not null default 'active';

alter table public.teaching_resource_links
  drop constraint if exists teaching_resource_links_mapping_method_check,
  add constraint teaching_resource_links_mapping_method_check check (
    mapping_method = any(array[
      'exact_curriculum_id','exact_sub_strand_id','exact_learning_outcome_id',
      'exact_publication_metadata','human_verified','manual_unverified'
    ]::text[])
  ),
  drop constraint if exists teaching_resource_links_verification_state_check,
  add constraint teaching_resource_links_verification_state_check check (
    verification_state = any(array['PROPOSED','VERIFIED','REJECTED','SUPERSEDED']::text[])
  ),
  drop constraint if exists teaching_resource_links_lifecycle_status_check,
  add constraint teaching_resource_links_lifecycle_status_check check (
    lifecycle_status = any(array['active','inactive','retired']::text[])
  ),
  drop constraint if exists teaching_resource_links_verified_review_check,
  add constraint teaching_resource_links_verified_review_check check (
    verification_state <> 'VERIFIED'
    or (
      mapping_method <> 'manual_unverified'
      and reviewed_by is not null
      and reviewed_at is not null
      and provenance <> '{}'::jsonb
    )
  );

create index if not exists teaching_resource_links_curriculum_idx
  on public.teaching_resource_links(curriculum_id, sub_strand_id, learning_outcome_id)
  where verification_state='VERIFIED' and lifecycle_status='active';

-- authorization-test: public.curriculum_resource_mapping_reviews owner read is policy-gated; anon/auth direct writes are revoked; service writes only create review work and may not publish teacher-authoritative links.
create table if not exists public.curriculum_resource_mapping_reviews (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.learning_resources(id) on delete restrict,
  target_type text not null,
  target_id uuid not null,
  proposed_curriculum_id uuid references public.curriculum(id) on delete restrict,
  proposed_sub_strand_id uuid references public.cbc_strands(id) on delete restrict,
  proposed_learning_outcome_id uuid references public.curriculum_learning_outcomes(id) on delete restrict,
  matching_method text not null,
  confidence numeric(5,4),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object'),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance)='object'),
  state text not null default 'PROPOSED' check (state=any(array['PROPOSED','VERIFIED','REJECTED','SUPERSEDED']::text[])),
  reviewer_id uuid references public.profiles(id) on delete set null,
  decision_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_resource_mapping_reviews_decision_check check (
    state='PROPOSED' or (reviewer_id is not null and reviewed_at is not null and decision_reason is not null)
  )
);

create unique index if not exists curriculum_resource_mapping_reviews_open_uidx
  on public.curriculum_resource_mapping_reviews(resource_id,target_type,target_id)
  where state='PROPOSED';

alter table public.curriculum_resource_mapping_reviews enable row level security;
revoke all on table public.curriculum_resource_mapping_reviews from public, anon, authenticated;
grant select,insert,update on table public.curriculum_resource_mapping_reviews to service_role;

create policy curriculum_resource_mapping_reviews_owner_read
  on public.curriculum_resource_mapping_reviews for select to authenticated
  using (public.is_platform_owner());

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

drop trigger if exists teacher_content_validate_verified_link on public.teaching_resource_links;
create trigger teacher_content_validate_verified_link
before insert or update of resource_id,curriculum_id,sub_strand_id,learning_outcome_id,mapping_method,verification_state,lifecycle_status
on public.teaching_resource_links
for each row execute function public.teacher_content_validate_verified_link();

-- Only VERIFIED links with a currently certified exact resource version are teacher-authoritative.
create or replace function public.list_teaching_resources(
  p_target_type text,
  p_target_id uuid
) returns jsonb
language plpgsql
security definer
set search_path='public','auth'
as $$
declare
  v_scheme uuid; v_lesson uuid; v_homework uuid; v_project uuid; v_exam uuid; v_assignment uuid;
  v_result jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'error','auth_required'); end if;
  if p_target_type='scheme_lesson' then v_scheme:=p_target_id;
  elsif p_target_type='lesson_plan' then v_lesson:=p_target_id;
  elsif p_target_type='homework' then v_homework:=p_target_id;
  elsif p_target_type='project' then v_project:=p_target_id;
  elsif p_target_type='exam' then v_exam:=p_target_id;
  elsif p_target_type='chapter_assignment' then v_assignment:=p_target_id;
  else return jsonb_build_object('ok',false,'error','invalid_target_type'); end if;

  if not public.fn_content_os_target_authorized(p_target_type,v_scheme,v_lesson,v_homework,v_project,v_exam,v_assignment,false) then
    return jsonb_build_object('ok',false,'error','forbidden');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'link_id',t.id,'resource_id',lr.id,'resource_version_id',rv.id,
    'source_type',lr.source_type,'title',lr.title,'description',lr.description,
    'publication_id',lr.publication_id,'chapter_id',lr.chapter_id,'content_id',lr.content_id,
    'curriculum_id',t.curriculum_id,'sub_strand_id',t.sub_strand_id,'learning_outcome_id',t.learning_outcome_id,
    'mapping_method',t.mapping_method,'verification_state',t.verification_state,'provenance',t.provenance,
    'usage_role',t.usage_role,'sequence',t.sequence,'page_start',t.page_start,'page_end',t.page_end,
    'section_refs',t.section_refs,'exercise_refs',t.exercise_refs,'created_at',t.created_at
  ) order by t.sequence,t.created_at),'[]'::jsonb)
  into v_result
  from public.teaching_resource_links t
  join public.learning_resources lr on lr.id=t.resource_id and lr.status='active'
  join public.learning_resource_versions rv
    on rv.id=t.resource_version_id and rv.resource_id=lr.id and rv.lifecycle_status='certified'
  where t.verification_state='VERIFIED' and t.lifecycle_status='active'
    and t.target_type=p_target_type and (
      (p_target_type='scheme_lesson' and t.scheme_lesson_id=p_target_id)
      or (p_target_type='lesson_plan' and t.lesson_plan_id=p_target_id)
      or (p_target_type='homework' and t.homework_id=p_target_id)
      or (p_target_type='project' and t.project_id=p_target_id)
      or (p_target_type='exam' and t.exam_id=p_target_id)
      or (p_target_type='chapter_assignment' and t.chapter_assignment_id=p_target_id)
    );
  return jsonb_build_object('ok',true,'resources',v_result);
end;
$$;
revoke all on function public.list_teaching_resources(text,uuid) from public,anon;
grant execute on function public.list_teaching_resources(text,uuid) to authenticated,service_role;

-- Owner-only deterministic coverage snapshot. It intentionally counts only official active outcomes
-- and verified/certified resource mappings; creator-claimed or fuzzy mappings never improve coverage.
create or replace function public.hq_teacher_content_coverage_snapshot()
returns jsonb
language plpgsql
security definer
set search_path='public','auth'
as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.is_platform_owner() then
    raise exception using errcode='42501', message='owner_authorization_required';
  end if;
  with official as (
    select o.id,o.curriculum_id,o.sub_strand_id,c.grade,c.subject,c.strand,c.sub_strand
    from public.curriculum_learning_outcomes o
    left join public.curriculum c on c.id=o.curriculum_id
    where o.source_type='official' and o.status='active'
  ), covered as (
    select distinct t.learning_outcome_id
    from public.teaching_resource_links t
    join public.learning_resource_versions rv on rv.id=t.resource_version_id and rv.lifecycle_status='certified'
    where t.verification_state='VERIFIED' and t.lifecycle_status='active' and t.learning_outcome_id is not null
  ), rows as (
    select o.grade,o.subject,count(*) as total_nodes,
      count(*) filter(where c.learning_outcome_id is not null) as covered_nodes
    from official o left join covered c on c.learning_outcome_id=o.id
    group by o.grade,o.subject
  )
  select jsonb_build_object(
    'total_curriculum_nodes',coalesce(sum(total_nodes),0),
    'fully_covered',coalesce(sum(covered_nodes),0),
    'missing',coalesce(sum(total_nodes-covered_nodes),0),
    'coverage_percent',case when coalesce(sum(total_nodes),0)=0 then 0 else round((100.0*sum(covered_nodes)/sum(total_nodes))::numeric,1) end,
    'by_grade_subject',coalesce(jsonb_agg(jsonb_build_object('grade',grade,'subject',subject,'total',total_nodes,'covered',covered_nodes,'missing',total_nodes-covered_nodes) order by grade,subject),'[]'::jsonb)
  ) into result from rows;
  return result;
end;
$$;
revoke all on function public.hq_teacher_content_coverage_snapshot() from public,anon,authenticated;
grant execute on function public.hq_teacher_content_coverage_snapshot() to authenticated,service_role;

comment on table public.curriculum_resource_mapping_reviews is
  'Human review queue for ambiguous curriculum-to-resource mappings. Only VERIFIED decisions may become authoritative teaching links.';
comment on column public.teaching_resource_links.verification_state is
  'Authority state for curriculum-resource relationship. Teacher-authoritative reads require VERIFIED.';

commit;
