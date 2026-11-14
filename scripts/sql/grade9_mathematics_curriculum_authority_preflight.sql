-- Grade 9 Mathematics official-curriculum certification PRE-FLIGHT (read-only).
-- This script is evidence collection only, not certification or source promotion.
-- Use existing official KICD authority source and current live database.
-- Do not substitute an editorial manifest for immutable official observations.
with registered_source as (
  select id,source_status,source_version,source_url
  from public.curriculum_authority_sources
  where grade='Grade 9' and subject_label='Mathematics'
    and authority_name ilike '%Kenya Institute of Curriculum Development%'
),
artifacts as (
  select count(*)::int n from public.curriculum_authority_artifacts a
  where a.source_id in(select id from registered_source)
),
snapshots as (
  select count(*)::int n,
         count(*) filter(where sealed_at is not null)::int sealed,
         count(*) filter(where promoted_at is not null)::int promoted
  from public.curriculum_authority_snapshots
  where source_id in(select id from registered_source)
),
observations as (
  select count(*)::int n from public.curriculum_authority_observations
  where snapshot_id in(select id from public.curriculum_authority_snapshots
                       where source_id in(select id from registered_source))
),
promotions as (
  select count(*)::int n from public.curriculum_authority_promotions
  where snapshot_id in(select id from public.curriculum_authority_snapshots
                       where source_id in(select id from registered_source))
),
grade9_math_sub_strands as (
  select c.id from public.cbc_strands c
  join public.subjects s on s.id=c.subject_id and s.school_id is null
  where c.grade='Grade 9' and s.name='Mathematics'
),
canonical_outcomes as (
  select count(*)::int n,
    count(*) filter(where o.verified_at is not null)::int dated_verified,
    count(*) filter(where nullif(btrim(o.source_locator),'') is not null)::int source_located
  from public.curriculum_learning_outcomes o
  where o.sub_strand_id in(select id from grade9_math_sub_strands)
)
select
  (select count(*)::int from registered_source) as registered_sources,
  (select count(*)::int from registered_source where source_status='approved') as approved_source_registry_rows,
  (select n from artifacts) as authoritative_artifact_records,
  (select n from snapshots) as source_snapshots,
  (select sealed from snapshots) as sealed_snapshots,
  (select promoted from snapshots) as promoted_snapshots,
  (select n from observations) as source_observations,
  (select n from promotions) as promoted_source_observations,
  (select count(*)::int from grade9_math_sub_strands) as canonical_sub_strand_rows,
  (select n from canonical_outcomes) as canonical_outcome_rows,
  (select dated_verified from canonical_outcomes) as dated_verified_outcomes,
  (select source_located from canonical_outcomes) as source_located_outcomes,
  case
    when (select count(*) from registered_source where source_status='approved') <> 1 then 'BLOCKED_SOURCE_REGISTRATION'
    when (select n from artifacts) = 0 then 'BLOCKED_OFFICIAL_ARTIFACT_MISSING'
    when (select sealed from snapshots) = 0 then 'BLOCKED_OFFICIAL_OBSERVATIONS_UNSEALED'
    when (select n from observations) = 0 then 'BLOCKED_SOURCE_OBSERVATIONS_MISSING'
    when (select n from promotions) < (select n from observations) then 'BLOCKED_OUTCOMES_NOT_FULLY_PROMOTED'
    when (select n from canonical_outcomes) = 0 then 'BLOCKED_CANONICAL_OUTCOMES_MISSING'
    when (select dated_verified from canonical_outcomes) < (select n from canonical_outcomes) then 'BLOCKED_OUTCOME_VERIFICATION_INCOMPLETE'
    when (select source_located from canonical_outcomes) < (select n from canonical_outcomes) then 'BLOCKED_OUTCOME_SOURCE_LOCATORS_MISSING'
    else 'EVIDENCE_PRESENT_REQUIRES_INDEPENDENT_CURRICULUM_AND_QUALITY_REVIEW'
  end as preflight_state;
