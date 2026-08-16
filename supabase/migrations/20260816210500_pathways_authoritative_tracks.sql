begin;

-- Canonical Senior School track taxonomy observed from the Ministry of Education
-- Grade 10 School & Pathway Selection System on 2026-08-16.
-- This migration deliberately creates a separate source/evidence boundary from the
-- earlier top-level pathway seed, whose scope was explicitly limited to pathways.

with source_upsert as (
  insert into public.pathway_sources (
    authority_name,
    source_name,
    source_url,
    source_reference,
    source_kind,
    observed_at,
    effective_from,
    content_checksum,
    status,
    is_public,
    metadata
  ) values (
    'Ministry of Education, Kenya',
    'Grade 10 School & Pathway Selection System — Track Taxonomy',
    'https://selection.education.go.ke/',
    'Official Senior School subject-combination pages expose the canonical track labels under each pathway',
    'official_portal',
    '2026-08-16T00:00:00+00'::timestamptz,
    '2026-01-01'::date,
    'moe-grade10-track-taxonomy-2026-08-16-v1',
    'active',
    true,
    jsonb_build_object(
      'scope', 'pathway_tracks',
      'evidence', jsonb_build_array(
        'STEM: Pure Sciences, Applied Sciences, Technical Studies',
        'Social Sciences: Languages & Literature, Humanities & Business Studies',
        'Arts & Sports Science: Arts, Sports'
      )
    )
  )
  on conflict do nothing
  returning id
), source_row as (
  select id from source_upsert
  union all
  select id
  from public.pathway_sources
  where authority_name = 'Ministry of Education, Kenya'
    and source_name = 'Grade 10 School & Pathway Selection System — Track Taxonomy'
    and content_checksum = 'moe-grade10-track-taxonomy-2026-08-16-v1'
  limit 1
), track_seed(pathway_slug, track_slug, track_name, track_summary) as (
  values
    ('stem', 'pure-sciences', 'Pure Sciences', 'Senior School STEM track focused on pure science subject combinations.'),
    ('stem', 'applied-sciences', 'Applied Sciences', 'Senior School STEM track focused on applied science subject combinations.'),
    ('stem', 'technical-studies', 'Technical Studies', 'Senior School STEM track focused on technical studies subject combinations.'),
    ('social-sciences', 'languages-and-literature', 'Languages & Literature', 'Senior School Social Sciences track focused on languages and literature subject combinations.'),
    ('social-sciences', 'humanities-and-business-studies', 'Humanities & Business Studies', 'Senior School Social Sciences track focused on humanities and business studies subject combinations.'),
    ('arts-and-sports-science', 'arts', 'Arts', 'Senior School Arts & Sports Science track focused on arts subject combinations.'),
    ('arts-and-sports-science', 'sports', 'Sports', 'Senior School Arts & Sports Science track focused on sports subject combinations.')
), inserted_tracks as (
  insert into public.pathway_tracks (
    pathway_id,
    slug,
    official_code,
    name,
    summary,
    source_id,
    verification_state,
    status,
    updated_at
  )
  select
    p.id,
    s.track_slug,
    null,
    s.track_name,
    s.track_summary,
    src.id,
    'verified',
    'published',
    now()
  from track_seed s
  join public.pathways p on p.slug = s.pathway_slug
  cross join source_row src
  on conflict (pathway_id, slug) do update
    set name = excluded.name,
        summary = excluded.summary,
        source_id = excluded.source_id,
        verification_state = 'verified',
        status = 'published',
        updated_at = now()
  returning id, pathway_id, slug, name, source_id
)
insert into public.pathway_source_observations (
  source_id,
  external_key,
  entity_kind,
  observed_payload,
  observed_at,
  content_checksum,
  resolution_state,
  resolved_entity_id
)
select
  t.source_id,
  'track:' || p.slug || ':' || t.slug,
  'track',
  jsonb_build_object(
    'pathway_slug', p.slug,
    'track_slug', t.slug,
    'track_name', t.name
  ),
  '2026-08-16T00:00:00+00'::timestamptz,
  'moe-grade10-track:' || p.slug || ':' || t.slug || ':2026-08-16-v1',
  'resolved',
  t.id
from inserted_tracks t
join public.pathways p on p.id = t.pathway_id
on conflict (source_id, external_key, content_checksum) do update
  set observed_payload = excluded.observed_payload,
      observed_at = excluded.observed_at,
      resolution_state = 'resolved',
      resolved_entity_id = excluded.resolved_entity_id;

-- Fail closed if canonical pathway identity drift would prevent a complete promotion.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.pathway_tracks t
  join public.pathways p on p.id = t.pathway_id
  where t.verification_state = 'verified'
    and t.status = 'published'
    and ((p.slug = 'stem' and t.slug in ('pure-sciences','applied-sciences','technical-studies'))
      or (p.slug = 'social-sciences' and t.slug in ('languages-and-literature','humanities-and-business-studies'))
      or (p.slug = 'arts-and-sports-science' and t.slug in ('arts','sports')));

  if v_count <> 7 then
    raise exception 'Pathways track promotion incomplete: expected 7 canonical verified tracks, found %', v_count;
  end if;
end
$$;

commit;
