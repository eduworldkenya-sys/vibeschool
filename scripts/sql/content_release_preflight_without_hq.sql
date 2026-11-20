-- Read-only preflight. Change only the requested canonical sub-strand and prefix.
-- This is NOT approval, certification, a source capture, or a publication operation.
with requested as (
  select '0f130af0-8f3c-433a-a0df-453927dece7f'::uuid as sub_strand_id,
         'vs:g4:mathematics:whole-numbers:'::text as resource_key_prefix
), roots as (
  select r.* from public.learning_resources r cross join requested p
  where r.sub_strand_id=p.sub_strand_id
    and left(r.canonical_key,length(p.resource_key_prefix))=p.resource_key_prefix
    and r.owner_type='platform' and r.source_type='platform_authored'
), versions as (
  select v.*,r.status as root_status,r.visibility,r.asset_kind
  from public.learning_resource_versions v join roots r on r.id=v.resource_id
), sources as (
  select distinct s.id,s.source_status from public.curriculum_authority_sources s
  join roots r on r.subject_id=s.canonical_subject_id and r.grade=s.grade
), scopes as (
  select s.* from public.vs_curriculum_package_scopes s cross join requested p
  where s.sub_strand_id=p.sub_strand_id and s.resource_key_prefix=p.resource_key_prefix
), facts as (
  select
    (select count(*) from roots) as roots,
    (select count(*) from versions where lifecycle_status='candidate') as candidates,
    (select count(*) from versions where lifecycle_status='certified' and root_status='active' and visibility='public' and asset_kind not in ('marking_scheme','teacher_notes')) as public_certified_components,
    (select count(*) from versions where rights_status='pending') as rights_pending,
    (select count(*) from versions where lifecycle_status='candidate' and nullif(btrim(provenance->>'package_id'),'') is null) as candidates_missing_package_id,
    (select count(*) from versions where lifecycle_status='candidate' and jsonb_typeof(payload->'curriculum_outcome_aliases') is distinct from 'array') as candidates_missing_aliases,
    (select count(*) from sources where source_status='approved') as approved_sources,
    (select count(*) from public.curriculum_authority_artifacts a join sources s on s.id=a.source_id where s.source_status='approved') as approved_source_artifacts,
    (select count(*) from public.curriculum_authority_snapshots t join sources s on s.id=t.source_id where s.source_status='approved' and t.status='promoted') as promoted_snapshots,
    (select count(*) from scopes) as registered_packages,
    (select coalesce(jsonb_agg(public.vs_curriculum_package_gate(package_id) order by package_id),'[]'::jsonb) from scopes) as package_gate_results,
    (select auth.uid()) is not null as session_has_authenticated_actor
)
select jsonb_build_object('scope',to_jsonb(p),'facts',to_jsonb(f),'publication_verified',false,
  'reason','Preflight only: verify exact source/outcome/version authority, evidence, rights, approved release and actual reader separately. Public certified components are not chapter visibility.')
from requested p cross join facts f;
