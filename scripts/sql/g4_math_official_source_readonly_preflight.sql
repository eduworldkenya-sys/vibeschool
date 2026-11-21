-- Grade 4 Mathematics: read-only authority and package preflight.
-- No mutations, service-role impersonation, invented IDs, or grant changes.
-- Source: content/curriculum/production/grade4-math-numbers-source-crosswalk.v1.observed.json
-- Use trusted existing operations for formal source intake and promotion; never
-- infer release from results of this observational query.
with sources as (
  select s.id, s.source_status, s.approved_at
  from public.curriculum_authority_sources s
  where lower(btrim(s.grade))='grade 4'
    and lower(btrim(s.subject_label))='mathematics'
), source_stats as (
  select count(*) as total_sources,
    count(*) filter (where source_status='approved' and approved_at is not null) as approved_sources
  from sources
), snapshots as (
  select count(*) as total_snapshots,
    count(*) filter (where snap.promoted_at is not null) as promoted_snapshots
  from public.curriculum_authority_snapshots snap
  join sources s on s.id=snap.source_id
), outcome_stats as (
  select count(*) as recorded_outcome_rows,
    count(*) filter (where o.verified_at is not null and o.source_type='official'
                     and nullif(btrim(o.source_locator),'') is not null) as verified_official_rows
  from public.curriculum_learning_outcomes o
  join public.curriculum c on c.id=o.curriculum_id
  where lower(btrim(c.grade))='grade 4'
    and lower(btrim(c.subject))='mathematics'
)
select 'Grade 4' as grade, 'Mathematics' as subject,
  source_stats.total_sources, source_stats.approved_sources,
  snapshots.total_snapshots,snapshots.promoted_snapshots,
  outcome_stats.recorded_outcome_rows,outcome_stats.verified_official_rows,
  case
    when source_stats.approved_sources=0 then 'BLOCKED_SOURCE_APPROVAL'
    when snapshots.promoted_snapshots=0 then 'BLOCKED_SNAPSHOT_PROMOTION'
    when outcome_stats.verified_official_rows=0 then 'BLOCKED_OUTCOME_VERIFICATION'
    else 'MANUAL_EXACT_OUTCOME_RECONCILIATION_REQUIRED'
  end as preflight_result
from source_stats cross join snapshots cross join outcome_stats;
