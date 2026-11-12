-- HQ curriculum/content coverage: read-only projection of canonical records.
-- No new tables, no curriculum mutation, no content certification or publication.
create or replace function public.hq_content_coverage(
  p_grade text default null,
  p_subject text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_report jsonb;
begin
  perform public.hq_assert_owner();

  with resolved as (
    select
      o.id, o.outcome_text, o.status, o.source_locator, o.source_ref,
      coalesce(nullif(btrim(c.grade), ''), nullif(btrim(cs.grade), '')) as grade,
      coalesce(nullif(btrim(c.subject), ''), nullif(btrim(s.name), '')) as subject,
      coalesce(nullif(btrim(c.strand), ''), nullif(btrim(cs.name), '')) as strand,
      coalesce(nullif(btrim(c.sub_strand), ''), nullif(btrim(cs.sub_strand), '')) as sub_strand,
      coalesce(nullif(btrim(c.topic), ''), nullif(btrim(cs.sub_strand), '')) as topic,
      (o.status = 'verified' and o.verified_at is not null
       and nullif(btrim(o.source_locator), '') is not null
       and o.source_import_id is not null) as source_verified
    from public.curriculum_learning_outcomes o
    left join public.curriculum c on c.id = o.curriculum_id
    left join public.cbc_strands cs on cs.id = o.sub_strand_id
    left join public.subjects s on s.id = cs.subject_id
    where o.status <> 'archived'
  ),
  resource_evidence as (
    select r.curriculum_outcome_id as outcome_id,
      count(*) filter (
        where r.asset_kind <> 'outcome_package'
          and r.owner_type = 'platform'
      )::integer as resources
    from public.learning_resources r
    where r.curriculum_outcome_id is not null
    group by r.curriculum_outcome_id
  ),
  block_evidence as (
    select l.outcome_id, count(*)::integer as blocks
    from public.content_block_outcome_links l
    group by l.outcome_id
  ),
  question_evidence as (
    select q.learning_outcome_id as outcome_id,
      count(*) filter (
        where q.status = 'confirmed' and q.review_status = 'approved'
          and q.school_id is null
      )::integer as approved
    from public.assessment_questions q
    where q.learning_outcome_id is not null
    group by q.learning_outcome_id
  ),
  package_evidence as (
    select r.curriculum_outcome_id as outcome_id,
      count(*) filter (where v.lifecycle_status = 'certified')::integer as certified,
      count(*) filter (
        where v.lifecycle_status = 'certified'
          and r.status = 'active'
          and r.visibility = 'public'
          and v.payload #>> '{release,core}' = 'released'
      )::integer as core_release_claims
    from public.learning_resources r
    left join lateral (
      select lv.lifecycle_status, lv.payload
      from public.learning_resource_versions lv
      where lv.resource_id = r.id
      order by lv.version desc
      limit 1
    ) v on true
    where r.asset_kind = 'outcome_package'
      and r.curriculum_outcome_id is not null
    group by r.curriculum_outcome_id
  ),
  states as (
    select
      o.*,
      coalesce(re.resources, 0) as resources,
      coalesce(be.blocks, 0) as blocks,
      coalesce(qe.approved, 0) as approved_questions,
      coalesce(pe.certified, 0) as certified_packages,
      coalesce(pe.core_release_claims, 0) as core_release_claims,
      case
        when coalesce(pe.core_release_claims, 0) > 0 then 'core_release_declared'
        when coalesce(pe.certified, 0) > 0 then 'package_certified'
        when coalesce(re.resources, 0) + coalesce(be.blocks, 0) > 0 then 'content_recorded'
        when coalesce(qe.approved, 0) > 0 then 'questions_only'
        when o.source_verified then 'mapped_verified'
        else 'mapping_unverified'
      end as progress_state
    from resolved o
    left join resource_evidence re on re.outcome_id = o.id
    left join block_evidence be on be.outcome_id = o.id
    left join question_evidence qe on qe.outcome_id = o.id
    left join package_evidence pe on pe.outcome_id = o.id
  ),
  pairs as (
    select distinct a.grade, a.subject_name as subject
    from public.grade_subject_authority a
    where a.effective_from <= current_date
      and (a.effective_to is null or a.effective_to >= current_date)
    union
    select distinct c.grade, c.subject
    from public.curriculum c
    where nullif(btrim(c.grade), '') is not null
      and nullif(btrim(c.subject), '') is not null
    union
    select distinct o.grade, o.subject
    from resolved o
    where o.grade is not null and o.subject is not null
  ),
  course_counts as (
    select lower(btrim(c.grade)) as g, lower(btrim(c.subject)) as s,
      count(*)::integer as curriculum_rows,
      count(distinct c.strand)::integer as strands,
      count(distinct c.sub_strand)::integer as sub_strands,
      count(distinct c.topic)::integer as topics
    from public.curriculum c
    group by lower(btrim(c.grade)), lower(btrim(c.subject))
  ),
  outcome_counts as (
    select lower(btrim(o.grade)) as g, lower(btrim(o.subject)) as s,
      count(*)::integer as outcomes,
      count(*) filter (where o.source_verified)::integer as verified_outcomes,
      count(*) filter (where o.resources + o.blocks > 0)::integer as authored_outcomes,
      count(*) filter (where o.approved_questions > 0)::integer as question_outcomes,
      count(*) filter (where o.certified_packages > 0)::integer as certified_outcomes,
      count(*) filter (where o.core_release_claims > 0)::integer as core_release_claims,
      sum(o.approved_questions)::integer as approved_questions
    from states o
    where o.grade is not null and o.subject is not null
    group by lower(btrim(o.grade)), lower(btrim(o.subject))
  ),
  subject_rows as (
    select
      p.grade, p.subject,
      a.phase, a.pathway, a.subject_kind, a.source_ref,
      (a.grade is not null) as registered,
      coalesce(cc.curriculum_rows, 0) as curriculum_rows,
      coalesce(cc.strands, 0) as strands,
      coalesce(cc.sub_strands, 0) as sub_strands,
      coalesce(cc.topics, 0) as topics,
      coalesce(oc.outcomes, 0) as outcomes,
      coalesce(oc.verified_outcomes, 0) as verified_outcomes,
      coalesce(oc.authored_outcomes, 0) as authored_outcomes,
      coalesce(oc.question_outcomes, 0) as question_outcomes,
      coalesce(oc.certified_outcomes, 0) as certified_outcomes,
      coalesce(oc.core_release_claims, 0) as core_release_claims,
      coalesce(oc.approved_questions, 0) as approved_questions
    from pairs p
    left join lateral (
      select x.grade, x.phase, x.pathway, x.subject_kind, x.source_ref
      from public.grade_subject_authority x
      where lower(btrim(x.grade)) = lower(btrim(p.grade))
        and lower(btrim(x.subject_name)) = lower(btrim(p.subject))
        and x.effective_from <= current_date
        and (x.effective_to is null or x.effective_to >= current_date)
      order by x.effective_from desc
      limit 1
    ) a on true
    left join course_counts cc
      on cc.g = lower(btrim(p.grade)) and cc.s = lower(btrim(p.subject))
    left join outcome_counts oc
      on oc.g = lower(btrim(p.grade)) and oc.s = lower(btrim(p.subject))
  ),
  selected_outcomes as (
    select o.id, o.grade, o.subject, o.strand, o.sub_strand, o.topic,
      o.outcome_text, o.status as mapping_status, o.source_verified,
      o.progress_state, o.resources, o.blocks,
      o.approved_questions, o.certified_packages, o.core_release_claims
    from states o
    where p_grade is not null and p_subject is not null
      and lower(btrim(o.grade)) = lower(btrim(p_grade))
      and lower(btrim(o.subject)) = lower(btrim(p_subject))
    order by o.strand nulls last, o.sub_strand nulls last,
      o.topic nulls last, o.outcome_text, o.id
    limit 2000
  ),
  topic_records as (
    select c.strand, c.sub_strand, c.topic,
      1::integer as curriculum_rows, null::uuid as outcome_id,
      0::integer as authored, 0::integer as verified, 0::integer as approved_questions
    from public.curriculum c
    where p_grade is not null and p_subject is not null
      and lower(btrim(c.grade)) = lower(btrim(p_grade))
      and lower(btrim(c.subject)) = lower(btrim(p_subject))
    union all
    select o.strand, o.sub_strand, o.topic,
      0::integer, o.id,
      case when o.resources + o.blocks > 0 then 1 else 0 end,
      case when o.source_verified then 1 else 0 end,
      o.approved_questions
    from states o
    where p_grade is not null and p_subject is not null
      and lower(btrim(o.grade)) = lower(btrim(p_grade))
      and lower(btrim(o.subject)) = lower(btrim(p_subject))
  ),
  topic_inventory as (
    select strand, sub_strand, topic,
      sum(curriculum_rows)::integer as curriculum_rows,
      count(outcome_id)::integer as outcomes,
      sum(authored)::integer as authored_outcomes,
      sum(verified)::integer as verified_outcomes,
      sum(approved_questions)::integer as approved_questions
    from topic_records
    group by strand, sub_strand, topic
    order by strand nulls last, sub_strand nulls last, topic nulls last
    limit 2000
  )
  select jsonb_build_object(
    'generated_at', now(),
    'subjects', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.grade, s.subject)
      from subject_rows s
    ), '[]'::jsonb),
    'outcomes', coalesce((
      select jsonb_agg(to_jsonb(o)) from selected_outcomes o
    ), '[]'::jsonb),
    'topics', coalesce((
      select jsonb_agg(to_jsonb(t)) from topic_inventory t
    ), '[]'::jsonb),
    'diagnostics', jsonb_build_object(
      'unlocated_outcomes', (select count(*) from states o where o.grade is null or o.subject is null),
      'archived_outcomes', (select count(*) from public.curriculum_learning_outcomes where status = 'archived'),
      'detail_limit', 2000,
      'detail_truncated', (select count(*) > 2000 from states o
        where p_grade is not null and p_subject is not null
          and lower(btrim(o.grade)) = lower(btrim(p_grade))
          and lower(btrim(o.subject)) = lower(btrim(p_subject)))
    )
  ) into v_report;

  return v_report;
end
$function$;

revoke all on function public.hq_content_coverage(text, text) from public, anon;
grant execute on function public.hq_content_coverage(text, text) to authenticated, service_role;
