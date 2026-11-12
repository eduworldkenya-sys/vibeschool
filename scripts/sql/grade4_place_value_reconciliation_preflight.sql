-- Grade 4 Mathematics 1.1(a): READ-ONLY production reconciliation preflight.
-- This is a diagnostic, NOT source authority, approval, content creation or PASS.
-- Scope: KICD Revised 2024, printed pages 1-3; assessment rubric printed p17.
-- Official source: https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.MATHEMATICS.pdf
-- Re-run at the current source/database head before any genuine content publishing.
-- No tenant/teacher records are written. Do not substitute this output for the
-- authenticated curriculum-authority pipeline or vs_curriculum_package_gate.
with scope as (
  select '0f130af0-8f3c-433a-a0df-453927dece7f'::uuid sub_strand_id,
         '28d19c48-f6a0-455f-b8b3-6c29081a52b0'::uuid kicd_draft_outcome_id,
         'c600f693-6242-45b3-b6f2-0211447e579c'::uuid vibeschool_guide_outcome_id,
         'https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.MATHEMATICS.pdf'::text official_source_url
), checks as (
  select
   (select count(*) from public.curriculum_authority_sources s, scope t
     where s.grade in ('4','Grade 4') and s.subject_label ilike '%math%'
       and s.source_url=t.official_source_url and s.source_status='approved'
       and s.approved_at is not null) approved_official_sources,
   (select count(*) from public.curriculum_authority_snapshots n
     join public.curriculum_authority_sources s on s.id=n.source_id, scope t
     where s.source_url=t.official_source_url and n.status='promoted') promoted_official_snapshots,
   (select count(*) from public.curriculum_learning_outcomes o, scope t
     where o.id=t.kicd_draft_outcome_id and o.sub_strand_id=t.sub_strand_id
       and o.status='verified' and o.verified_at is not null
       and nullif(o.source_locator,'') is not null) verified_official_outcomes,
   (select count(*) from public.vs_curriculum_package_scopes ps, scope t
     where ps.sub_strand_id=t.sub_strand_id and ps.source_url=t.official_source_url) reconciled_package_scopes,
   (select count(*) from public.vs_curriculum_alias_outcomes ao
     join public.vs_curriculum_package_scopes ps on ps.package_id=ao.package_id, scope t
     where ps.sub_strand_id=t.sub_strand_id
       and ao.manuscript_alias='VS-G04-MA-1.1-L01') explicit_manuscript_aliases,
   (select count(*) from public.scheme_of_work sw, scope t
     where sw.sub_strand_id=t.sub_strand_id) existing_scheme_rows,
   (select count(*) from public.scheme_of_work sw, scope t
     where sw.sub_strand_id=t.sub_strand_id
       and sw.curriculum_outcome_id is null) scheme_rows_without_exact_outcome,
   (select count(*) from public.learning_resources r, scope t
     where r.sub_strand_id=t.sub_strand_id) existing_resource_roots,
   (select count(*) from public.learning_resource_versions v
     join public.learning_resources r on r.id=v.resource_id, scope t
     where r.sub_strand_id=t.sub_strand_id
       and v.lifecycle_status='certified') certified_resource_versions,
   (select count(*) from public.learning_resources r
     where r.asset_kind='visual_aid' and r.status='active'
       and r.visibility='public') released_visual_roots,
   (select count(*) from public.assessment_questions q, scope t
     where q.learning_outcome_id in
       (t.kicd_draft_outcome_id,t.vibeschool_guide_outcome_id)) linked_assessment_questions,
   (select count(*) from public.content_blocks b
     where b.id in (
       '02b9a7e6-87ac-4471-a5ce-549997be9781'::uuid,
       '2cae20c4-7908-4a56-8134-a3521f1852c1'::uuid
     ) and b.is_assessable=true) exposed_worked_examples_marked_assessable
)
select
  case
    when approved_official_sources=0 or promoted_official_snapshots=0
      or verified_official_outcomes=0 or reconciled_package_scopes=0
      or explicit_manuscript_aliases=0
      then 'BLOCKED_CURRICULUM_RECONCILIATION'
    else 'REQUIRES_AUTHORIZED_PACKAGE_GATE_AND_EXACT_READBACK'
  end as preflight_state,
  to_jsonb(checks) as observed_evidence
from checks;
