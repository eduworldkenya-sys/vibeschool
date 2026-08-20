-- Pilot-demand coverage and deterministic mapping materialization.
-- No fuzzy/title/semantic match is used here.
begin;

-- Seed human review work for exact metadata that is not itself verified authority.
insert into public.curriculum_resource_mapping_reviews(
  resource_id,target_type,target_id,proposed_curriculum_id,proposed_sub_strand_id,
  matching_method,confidence,evidence,provenance,state
)
select lr.id,'curriculum',lr.curriculum_id,lr.curriculum_id,lr.sub_strand_id,
       'exact_resource_metadata',1.0,
       jsonb_build_object('resource_curriculum_id',lr.curriculum_id,'chapter_id',lr.chapter_id,'chapter_alignment_status',vc.alignment_status),
       jsonb_build_object('source','learning_resources','source_type',lr.source_type),
       'PROPOSED'
from public.learning_resources lr
left join public.vibe_chapters vc on vc.id=lr.chapter_id
where lr.curriculum_id is not null
  and lr.status='active'
  and (vc.id is null or vc.alignment_status is distinct from 'verified')
  and not exists (
    select 1 from public.curriculum_resource_mapping_reviews r
    where r.resource_id=lr.id and r.target_type='curriculum' and r.target_id=lr.curriculum_id and r.state='PROPOSED'
  );

-- Deterministically materialize only resources whose chapter alignment was human-verified,
-- whose publication/chapter is published, and whose exact immutable resource version is certified.
-- Exact lesson-plan curriculum identity is required. Nothing inferred from text participates.
insert into public.teaching_resource_links(
  resource_id,resource_version_id,target_type,lesson_plan_id,usage_role,sequence,
  created_by,curriculum_id,sub_strand_id,mapping_method,verification_state,provenance,
  reviewed_by,reviewed_at,lifecycle_status
)
select lr.id,rv.id,'lesson_plan',lp.id,'source',1,
       lp.teacher_id,lp.curriculum_id,coalesce(lr.sub_strand_id,vc.sub_strand_id),
       'exact_curriculum_id','VERIFIED',
       jsonb_build_object(
         'source','deterministic_backfill',
         'chapter_id',vc.id,
         'chapter_verified_at',vc.verified_at,
         'curriculum_id',lp.curriculum_id,
         'resource_version_id',rv.id
       ),
       vc.verified_by,vc.verified_at,'active'
from public.lesson_plans lp
join public.learning_resources lr on lr.curriculum_id=lp.curriculum_id and lr.status='active'
join public.vibe_chapters vc on vc.id=lr.chapter_id
join public.vibe_publications vp on vp.id=vc.publication_id
join public.learning_resource_versions rv on rv.resource_id=lr.id and rv.lifecycle_status='certified'
where lp.curriculum_id is not null
  and vc.status='published'
  and vc.alignment_status='verified'
  and vc.verified_by is not null and vc.verified_at is not null
  and vp.status='published'
  and not exists (
    select 1 from public.teaching_resource_links t
    where t.resource_id=lr.id and t.target_type='lesson_plan' and t.lesson_plan_id=lp.id
      and t.verification_state='VERIFIED' and t.lifecycle_status='active'
  );

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

  with nodes as (
    select c.id,c.grade,c.subject,c.strand,c.sub_strand,
      exists(select 1 from public.scheme_of_work s where s.curriculum_id=c.id) as in_scheme,
      exists(select 1 from public.lesson_plans lp where lp.curriculum_id=c.id) as in_lesson_plan,
      exists(select 1 from public.curriculum_learning_outcomes o where o.curriculum_id=c.id and o.source_type='official' and o.status='active') as has_official_outcome
    from public.curriculum c
  ), verified as (
    select distinct t.curriculum_id
    from public.teaching_resource_links t
    join public.learning_resources lr on lr.id=t.resource_id and lr.status='active'
    join public.learning_resource_versions rv on rv.id=t.resource_version_id and rv.resource_id=lr.id and rv.lifecycle_status='certified'
    where t.verification_state='VERIFIED' and t.lifecycle_status='active' and t.curriculum_id is not null
  ), candidate as (
    select distinct lr.curriculum_id
    from public.learning_resources lr
    where lr.curriculum_id is not null and lr.status='active'
  ), review as (
    select distinct proposed_curriculum_id as curriculum_id
    from public.curriculum_resource_mapping_reviews where state='PROPOSED' and proposed_curriculum_id is not null
  ), classified as (
    select n.*,
      case
        when v.curriculum_id is not null then 'FULL'
        when r.curriculum_id is not null then 'AMBIGUOUS'
        when ca.curriculum_id is not null then 'UNMAPPED'
        else 'MISSING'
      end as coverage_state
    from nodes n
    left join verified v on v.curriculum_id=n.id
    left join candidate ca on ca.curriculum_id=n.id
    left join review r on r.curriculum_id=n.id
  ), rollup as (
    select grade,subject,
      count(*) total,
      count(*) filter(where coverage_state='FULL') covered,
      count(*) filter(where coverage_state='MISSING') missing,
      count(*) filter(where coverage_state='UNMAPPED') unmapped,
      count(*) filter(where coverage_state='AMBIGUOUS') ambiguous,
      count(*) filter(where in_scheme or in_lesson_plan) pilot_demand,
      count(*) filter(where (in_scheme or in_lesson_plan) and coverage_state='FULL') pilot_covered,
      count(*) filter(where has_official_outcome) official_evidence_nodes
    from classified group by grade,subject
  ), totals as (
    select count(*) total_nodes,
      count(*) filter(where coverage_state='FULL') covered_nodes,
      count(*) filter(where coverage_state='MISSING') missing_nodes,
      count(*) filter(where coverage_state='UNMAPPED') unmapped_nodes,
      count(*) filter(where coverage_state='AMBIGUOUS') ambiguous_nodes,
      count(*) filter(where in_scheme or in_lesson_plan) pilot_nodes,
      count(*) filter(where (in_scheme or in_lesson_plan) and coverage_state='FULL') pilot_covered_nodes
    from classified
  )
  select jsonb_build_object(
    'total_curriculum_nodes',t.total_nodes,
    'fully_covered',t.covered_nodes,
    'missing',t.missing_nodes,
    'unmapped',t.unmapped_nodes,
    'ambiguous',t.ambiguous_nodes,
    'coverage_percent',case when t.total_nodes=0 then 0 else round((100.0*t.covered_nodes/t.total_nodes)::numeric,1) end,
    'pilot_nodes',t.pilot_nodes,
    'pilot_covered',t.pilot_covered_nodes,
    'pilot_coverage_percent',case when t.pilot_nodes=0 then 0 else round((100.0*t.pilot_covered_nodes/t.pilot_nodes)::numeric,1) end,
    'by_grade_subject',coalesce((select jsonb_agg(jsonb_build_object(
      'grade',grade,'subject',subject,'total',total,'covered',covered,'missing',missing,
      'unmapped',unmapped,'ambiguous',ambiguous,'pilot_demand',pilot_demand,
      'pilot_covered',pilot_covered,'official_evidence_nodes',official_evidence_nodes
    ) order by pilot_demand desc,missing desc,grade,subject) from rollup),'[]'::jsonb)
  ) into result from totals t;
  return result;
end;
$$;
revoke all on function public.hq_teacher_content_coverage_snapshot() from public,anon,authenticated;
grant execute on function public.hq_teacher_content_coverage_snapshot() to authenticated,service_role;

commit;
