-- Grade 4 Mathematics / Whole Numbers — canonical release readiness.
-- Read-only evidence. No approval, privilege, lifecycle, resource, release or HQ writes.
-- Keep marking schemes and teacher-only versions private even after certification.
with target as (
 select
  'VS-G04-MA-1.1-WHOLE-NUMBERS-20261120'::text package_id,
  '6fc551d7-c9ae-4402-ac52-3d0a46461e87'::uuid publication_id,
  'b23413c2-f7ae-44c2-9f5e-98f3cdeeeb8a'::uuid chapter_id,
  '0f130af0-8f3c-433a-a0df-453927dece7f'::uuid sub_strand_id,
  'f430f8b3-9d8d-4845-8904-a3e597191ab6'::uuid subject_id,
  'https://kicd.ac.ke/wp-content/uploads/2024/02/GRADE.4.MATHEMATICS.pdf'::text source_url
), book as (
 select vp.id,vp.status,vp.author_id,vp.format,vp.cbc_grade,vp.cbc_subject
 from public.vibe_publications vp join target t on vp.id=t.publication_id
), chapter as (
 select vc.id,vc.status,vc.word_count,vc.blocks
 from public.vibe_chapters vc join target t on vc.id=t.chapter_id and vc.publication_id=t.publication_id
), source as (
 select count(*) filter(where s.source_status='approved')::integer approved,
   count(distinct a.id)::integer artifacts,
   count(distinct sn.id) filter(where sn.status='promoted')::integer promoted_snapshots
 from target t
 left join public.curriculum_authority_sources s
  on s.grade='Grade 4' and s.canonical_subject_id=t.subject_id and s.source_url=t.source_url
 left join public.curriculum_authority_artifacts a on a.source_id=s.id
 left join public.curriculum_authority_snapshots sn on sn.source_id=s.id
), outcome as (
 select count(*)::integer mapped,
   count(*) filter(where o.status='active')::integer active,
   count(*) filter(where o.source_locator is not distinct from req.source_locator)::integer locator_matches
 from target t
 join public.vs_curriculum_alias_outcomes ao on ao.package_id=t.package_id
 join public.vs_curriculum_manuscript_aliases al on al.package_id=ao.package_id and al.manuscript_alias=ao.manuscript_alias
 join public.vs_curriculum_source_requirements req on req.package_id=al.package_id and req.requirement_code=al.requirement_code
 join public.curriculum_learning_outcomes o on o.id=ao.outcome_id and o.sub_strand_id=t.sub_strand_id
), roots as (
 select r.*,v.id as version_id,v.version,v.lifecycle_status,v.rights_status,v.verified_at,v.certified_at,
 v.content_sha256,v.payload,v.provenance
 from target t join public.learning_resources r
   on r.sub_strand_id=t.sub_strand_id and r.canonical_key like 'vs:g4:mathematics:whole-numbers:%'
 join lateral (select x.* from public.learning_resource_versions x where x.resource_id=r.id order by x.version desc limit 1) v on true
), resources as (
 select count(*)::integer total,
   count(*) filter(where lifecycle_status='candidate')::integer candidate,
   count(*) filter(where lifecycle_status='verified' and verified_at is not null)::integer verified,
   count(*) filter(where lifecycle_status='certified' and certified_at is not null)::integer certified,
   count(*) filter(where rights_status='pending')::integer pending_rights,
   count(*) filter(where rights_status='cleared')::integer rights_cleared,
   count(*) filter(where status='active')::integer active_roots,
   count(*) filter(where visibility='public' and status='active' and lifecycle_status='certified' and asset_kind not in ('marking_scheme','teacher_notes'))::integer public_learnable,
   count(*) filter(where asset_kind in ('marking_scheme','teacher_notes') and visibility='private')::integer protected_sensitive,
   count(*) filter(where content_sha256=encode(extensions.digest(convert_to(payload::text,'UTF8'),'sha256'),'hex'))::integer verified_payload_hashes
 from roots
), teacher_guide as (
 select count(*) filter(where d.status='approved')::integer approved,
  count(*) filter(where d.status='draft')::integer drafts,
  max(jsonb_array_length(d.body->'source_sequence'))::integer source_blocks
 from public.content_derivatives d join target t on d.source_chapter_id=t.chapter_id
 where d.derivative_type='teacher_notes' and d.audience='teacher'
), assessment as (
 select coalesce(max(ga.status),'missing')::text state,
  count(distinct gai.id)::integer items,
  coalesce(sum(gai.marks),0)::integer marks,
  count(distinct gai.id) filter(where ga.status in ('approved','published'))::integer approved_items
 from target t join public.content_assessment_blueprints cab on true
 join public.generated_assessments ga on ga.blueprint_id=cab.id
 join public.generated_assessment_items gai on gai.assessment_id=ga.id
 where cab.title='Whole Numbers — Grade 4 Mathematics (v3 moderation)'
 and exists (select 1 from public.content_assessment_sources cas join public.learning_resources lr
   on lr.id=cas.resource_id and lr.chapter_id=t.chapter_id and lr.publication_id=t.publication_id
   where cas.blueprint_id=cab.id)
), rights as (
 select (select count(*) from public.vibelearn_content v join target t on v.vibe_publication_id=t.publication_id and v.status='live')::integer live_catalogue_rows,
 (select count(*) from public.vibe_chapters c join target t on c.publication_id=t.publication_id and c.status='published')::integer published_chapters,
 (select count(*) from public.publication_release_approvals x join target t on x.publication_id=t.publication_id and x.status='approved')::integer final_release_approvals,
 (select count(*) from public.publication_release_approvals x join target t on x.publication_id=t.publication_id and x.status='approved' and x.content_fingerprint=public.publication_release_fingerprint(t.publication_id))::integer current_fingerprint_approvals,
 (select count(*) from public.hq_workforce_capability_authority_grants g where g.status='active' and (g.capability_key ilike '%content%' or g.capability_key ilike '%publish%'))::integer active_content_grants
), package_gate as (
 select public.vs_curriculum_package_gate(t.package_id) as value from target t
), facts as (
 select
  jsonb_build_object('book_status',b.status,'book_format',b.format,'grade',b.cbc_grade,'subject',b.cbc_subject,
    'chapter_status',c.status,'chapter_words',c.word_count,'chapter_blocks',jsonb_array_length(c.blocks),
    'interactive_blocks',(select count(*) from public.content_blocks cb join target t on cb.chapter_id=t.chapter_id and cb.block_type='interactive'),
    'official_source',to_jsonb(s),'outcomes',to_jsonb(o),'resources',to_jsonb(rs),
    'guide',to_jsonb(g),'assessment',to_jsonb(a),
    'release',to_jsonb(ri),
    'curriculum_gate',cg.value,
    'app_actor_attached_to_this_connection',auth.uid() is not null) state,
  array_remove(array[
    case when coalesce(s.approved,0)=0 or coalesce(s.artifacts,0)=0 then 'official_source_review_pending' end,
    case when coalesce(s.promoted_snapshots,0)=0 then 'official_source_hierarchy_pending' end,
    case when coalesce(cg.value->>'state','')<>'PASS' then 'curriculum_package_gate_not_pass' end,
    case when o.mapped<>11 or o.locator_matches<>11 or o.active<>11 then 'curriculum_outcomes_not_all_active_and_reconciled' end,
    case when rs.total<>6 or rs.verified_payload_hashes<>6 then 'resource_manifest_or_hash_mismatch' end,
    case when rs.pending_rights>0 or rs.rights_cleared<>6 then 'original_resource_rights_pending' end,
    case when rs.certified<>6 then 'resource_certification_pending' end,
    case when rs.public_learnable<4 then 'learner_resource_activation_pending' end,
    case when rs.protected_sensitive<2 then 'sensitive_resources_must_remain_private' end,
    case when g.source_blocks<>59 then 'teacher_guide_source_lineage_incomplete' end,
    case when g.approved=0 then 'teacher_guide_independent_approval_pending' end,
    case when a.items<>11 or a.marks<>16 then 'assessment_content_lineage_incomplete' end,
    case when a.approved_items<6 then 'assessment_moderation_pending' end,
    case when b.status='draft' and ri.current_fingerprint_approvals=0 then 'publication_release_approval_pending' end,
    case when b.status='published' and ri.final_release_approvals=0 then 'historical_publication_release_approval_missing' end,
    case when b.status='draft' and auth.uid() is null then 'authenticated_publisher_identity_unavailable_in_this_connection' end,
    case when ri.published_chapters=0 or ri.live_catalogue_rows=0 then 'student_catalogue_publication_pending' end
  ],null)::text[] blockers
 from target t cross join book b cross join chapter c cross join source s cross join outcome o cross join resources rs
 cross join teacher_guide g cross join assessment a cross join rights ri cross join package_gate cg
)
select jsonb_build_object(
 'package_id',(select package_id from target),
 'publication_id',(select publication_id from target),
 'scope','Grade 4 Mathematics / Whole Numbers only',
 'checked_at',clock_timestamp(),
 'status',case when cardinality(blockers)=0 and state->>'book_status'='published' then 'CATALOGUE_VISIBLE'
               when blockers=ARRAY['student_catalogue_publication_pending']::text[] and state->>'book_status'='draft' then 'READY_TO_PUBLISH'
               else 'BLOCKED' end,
 'ready_to_publish',blockers=ARRAY['student_catalogue_publication_pending']::text[] and state->>'book_status'='draft',
 'post_publication_fingerprint_requires_revision_audit',state->>'book_status'='published',
 'catalogue_visibility_verified',coalesce((state->'release'->>'published_chapters')::integer,0)>0
     and coalesce((state->'release'->>'live_catalogue_rows')::integer,0)>0,
 'blockers',to_jsonb(blockers),
 'facts',state,
 'no_mutation_performed',true
) as release_preflight from facts;
