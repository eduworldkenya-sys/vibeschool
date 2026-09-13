-- Teacher Content Coverage — complete corpus-state matrix and repeatable integrity diagnostics.
-- UNAUTHORIZED is deliberately an access state resolved at teacher read time; it is never used
-- to disguise a corpus mapping/publication/integrity defect.
begin;

create or replace function public.hq_teacher_content_integrity_snapshot()
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

  with broken as (
    select lr.curriculum_id,
      count(*) filter(where lr.chapter_id is not null and vc.id is null) as orphan_chapter,
      count(*) filter(where lr.publication_id is not null and vp.id is null) as orphan_publication,
      count(*) filter(where lr.chapter_id is not null and lr.publication_id is not null and vc.publication_id<>lr.publication_id) as chapter_publication_mismatch,
      count(*) filter(where vc.status='published' and vp.status is distinct from 'published') as published_chapter_under_nonpublished_publication
    from public.learning_resources lr
    left join public.vibe_chapters vc on vc.id=lr.chapter_id
    left join public.vibe_publications vp on vp.id=coalesce(lr.publication_id,vc.publication_id)
    group by lr.curriculum_id
  ), duplicate_links as (
    select curriculum_id,count(*) as duplicates from (
      select curriculum_id,target_type,resource_id,lesson_plan_id,scheme_lesson_id,homework_id,project_id,exam_id,chapter_assignment_id,count(*)
      from public.teaching_resource_links
      where verification_state='VERIFIED' and lifecycle_status='active'
      group by curriculum_id,target_type,resource_id,lesson_plan_id,scheme_lesson_id,homework_id,project_id,exam_id,chapter_assignment_id
      having count(*)>1
    ) d group by curriculum_id
  ), incomplete_plans as (
    select curriculum_id,count(*) as n from public.lesson_plans
    where curriculum_id is null or scheme_id is null
    group by curriculum_id
  )
  select jsonb_build_object(
    'orphan_resource_links',(select count(*) from public.teaching_resource_links t left join public.learning_resources lr on lr.id=t.resource_id where lr.id is null),
    'chapter_publication_mismatch',coalesce((select sum(chapter_publication_mismatch) from broken),0),
    'published_chapter_under_unpublished_publication',coalesce((select sum(published_chapter_under_nonpublished_publication) from broken),0),
    'verified_links_to_uncertified_versions',(select count(*) from public.teaching_resource_links t left join public.learning_resource_versions rv on rv.id=t.resource_version_id where t.verification_state='VERIFIED' and t.lifecycle_status='active' and (rv.id is null or rv.lifecycle_status<>'certified')),
    'duplicate_verified_links',coalesce((select sum(duplicates) from duplicate_links),0),
    'incomplete_lesson_plan_identity',(select count(*) from public.lesson_plans where curriculum_id is null or scheme_id is null),
    'verified_links_to_nonactive_resources',(select count(*) from public.teaching_resource_links t join public.learning_resources lr on lr.id=t.resource_id where t.verification_state='VERIFIED' and t.lifecycle_status='active' and lr.status<>'active'),
    'verified_links_to_unpublished_chapters',(select count(*) from public.teaching_resource_links t join public.learning_resources lr on lr.id=t.resource_id join public.vibe_chapters vc on vc.id=lr.chapter_id where t.verification_state='VERIFIED' and t.lifecycle_status='active' and vc.status<>'published'),
    'verified_links_to_unverified_chapters',(select count(*) from public.teaching_resource_links t join public.learning_resources lr on lr.id=t.resource_id join public.vibe_chapters vc on vc.id=lr.chapter_id where t.verification_state='VERIFIED' and t.lifecycle_status='active' and vc.alignment_status<>'verified')
  ) into result;
  return result;
end;
$$;
revoke all on function public.hq_teacher_content_integrity_snapshot() from public,anon,authenticated;
grant execute on function public.hq_teacher_content_integrity_snapshot() to authenticated,service_role;

create or replace function public.hq_teacher_content_coverage_matrix()
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

  with resource_facts as (
    select c.id as curriculum_id,
      count(lr.id) filter(where lr.status='active') as candidates,
      count(lr.id) filter(where lr.status='active' and (
        (vc.id is not null and vc.status<>'published') or
        (vp.id is not null and vp.status<>'published') or
        not exists(select 1 from public.learning_resource_versions rv where rv.resource_id=lr.id and rv.lifecycle_status='certified')
      )) as unpublished_or_uncertified,
      count(lr.id) filter(where lr.chapter_id is not null and vc.id is not null and lr.publication_id is not null and lr.publication_id<>vc.publication_id) as broken,
      count(distinct lr.id) filter(where exists(
        select 1 from public.teaching_resource_links t
        join public.learning_resource_versions rv on rv.id=t.resource_version_id and rv.lifecycle_status='certified'
        where t.resource_id=lr.id and t.curriculum_id=c.id and t.verification_state='VERIFIED' and t.lifecycle_status='active'
      )) as verified_resources,
      bool_or(coalesce(lr.asset_kind,'') in ('teacher_notes','lesson_plan')) filter(where exists(
        select 1 from public.teaching_resource_links t join public.learning_resource_versions rv on rv.id=t.resource_version_id and rv.lifecycle_status='certified'
        where t.resource_id=lr.id and t.curriculum_id=c.id and t.verification_state='VERIFIED' and t.lifecycle_status='active'
      )) as has_notes,
      bool_or(coalesce(lr.asset_kind,'') in ('content_block','worked_example','practical','project')) filter(where exists(
        select 1 from public.teaching_resource_links t join public.learning_resource_versions rv on rv.id=t.resource_version_id and rv.lifecycle_status='certified'
        where t.resource_id=lr.id and t.curriculum_id=c.id and t.verification_state='VERIFIED' and t.lifecycle_status='active'
      )) as has_teaching_material,
      bool_or(coalesce(lr.asset_kind,'') in ('exercise','worksheet','homework')) filter(where exists(
        select 1 from public.teaching_resource_links t join public.learning_resource_versions rv on rv.id=t.resource_version_id and rv.lifecycle_status='certified'
        where t.resource_id=lr.id and t.curriculum_id=c.id and t.verification_state='VERIFIED' and t.lifecycle_status='active'
      )) as has_practice,
      bool_or(coalesce(lr.asset_kind,'') in ('quiz','assessment')) filter(where exists(
        select 1 from public.teaching_resource_links t join public.learning_resource_versions rv on rv.id=t.resource_version_id and rv.lifecycle_status='certified'
        where t.resource_id=lr.id and t.curriculum_id=c.id and t.verification_state='VERIFIED' and t.lifecycle_status='active'
      )) as has_assessment
    from public.curriculum c
    left join public.learning_resources lr on lr.curriculum_id=c.id
    left join public.vibe_chapters vc on vc.id=lr.chapter_id
    left join public.vibe_publications vp on vp.id=coalesce(lr.publication_id,vc.publication_id)
    group by c.id
  ), review as (
    select proposed_curriculum_id as curriculum_id,count(*) as proposals
    from public.curriculum_resource_mapping_reviews
    where state='PROPOSED' and proposed_curriculum_id is not null
    group by proposed_curriculum_id
  ), nodes as (
    select c.id,c.grade,c.subject,c.strand,c.sub_strand,
      exists(select 1 from public.scheme_of_work s where s.curriculum_id=c.id) as in_scheme,
      exists(select 1 from public.lesson_plans lp where lp.curriculum_id=c.id) as in_lesson_plan,
      coalesce(f.candidates,0) candidates,coalesce(f.verified_resources,0) verified_resources,
      coalesce(f.unpublished_or_uncertified,0) unpublished_or_uncertified,coalesce(f.broken,0) broken,
      coalesce(r.proposals,0) proposals,
      coalesce(f.has_notes,false) has_notes,coalesce(f.has_teaching_material,false) has_teaching_material,
      coalesce(f.has_practice,false) has_practice,coalesce(f.has_assessment,false) has_assessment,
      case
        when coalesce(f.broken,0)>0 then 'BROKEN'
        when coalesce(r.proposals,0)>0 then 'AMBIGUOUS'
        when coalesce(f.verified_resources,0)>0 and coalesce(f.has_notes,false) and coalesce(f.has_teaching_material,false) and coalesce(f.has_practice,false) and coalesce(f.has_assessment,false) then 'FULL'
        when coalesce(f.verified_resources,0)>0 then 'PARTIAL'
        when coalesce(f.unpublished_or_uncertified,0)>0 then 'UNPUBLISHED'
        when coalesce(f.candidates,0)>0 then 'UNMAPPED'
        else 'MISSING'
      end as coverage_state
    from public.curriculum c
    left join resource_facts f on f.curriculum_id=c.id
    left join review r on r.curriculum_id=c.id
  ), state_counts as (
    select coverage_state,count(*) n from nodes group by coverage_state
  )
  select jsonb_build_object(
    'states',jsonb_build_object(
      'FULL',coalesce((select n from state_counts where coverage_state='FULL'),0),
      'PARTIAL',coalesce((select n from state_counts where coverage_state='PARTIAL'),0),
      'MISSING',coalesce((select n from state_counts where coverage_state='MISSING'),0),
      'UNMAPPED',coalesce((select n from state_counts where coverage_state='UNMAPPED'),0),
      'AMBIGUOUS',coalesce((select n from state_counts where coverage_state='AMBIGUOUS'),0),
      'UNPUBLISHED',coalesce((select n from state_counts where coverage_state='UNPUBLISHED'),0),
      'UNAUTHORIZED',0,
      'BROKEN',coalesce((select n from state_counts where coverage_state='BROKEN'),0)
    ),
    'unauthorized_semantics','UNAUTHORIZED is resolved per authenticated teacher/resource through the canonical reader entitlement contract; it is not a corpus-quality state.',
    'nodes',coalesce((select jsonb_agg(jsonb_build_object(
      'curriculum_id',id,'grade',grade,'subject',subject,'strand',strand,'sub_strand',sub_strand,
      'state',coverage_state,'pilot_demand',(in_scheme or in_lesson_plan),
      'has_notes',has_notes,'has_teaching_material',has_teaching_material,'has_practice',has_practice,'has_assessment',has_assessment,
      'verified_resources',verified_resources,'candidate_resources',candidates,'review_proposals',proposals
    ) order by (in_scheme or in_lesson_plan) desc,grade,subject,strand,sub_strand from nodes),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.hq_teacher_content_coverage_matrix() from public,anon,authenticated;
grant execute on function public.hq_teacher_content_coverage_matrix() to authenticated,service_role;

commit;
