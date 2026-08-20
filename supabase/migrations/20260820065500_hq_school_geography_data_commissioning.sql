begin;

-- National Intelligence geography data commissioning.
-- Safety contract:
--   * never fuzzy-match canonical schools;
--   * only sealed Tier-0 identity evidence may become verified;
--   * unique exact-name discovery matches remain inferred;
--   * every unresolved school is quarantined for review;
--   * no browser role receives direct table access.

insert into public.geo_countries (
  iso2, official_name, normalized_name, status,
  source_key, source_version, verification_state
)
values (
  'KE', 'Kenya', 'kenya', 'active',
  'kenya_constitution_2010_first_schedule',
  'Constitution of Kenya 2010 Article 6(1) First Schedule',
  'verified'
)
on conflict (iso2) do update set
  official_name = excluded.official_name,
  normalized_name = excluded.normalized_name,
  status = excluded.status,
  source_key = excluded.source_key,
  source_version = excluded.source_version,
  verification_state = excluded.verification_state,
  updated_at = now();

with kenya as (
  select id from public.geo_countries where iso2 = 'KE'
), counties(official_code, official_name) as (
  values
    ('001','Mombasa'),('002','Kwale'),('003','Kilifi'),('004','Tana River'),
    ('005','Lamu'),('006','Taita/Taveta'),('007','Garissa'),('008','Wajir'),
    ('009','Mandera'),('010','Marsabit'),('011','Isiolo'),('012','Meru'),
    ('013','Tharaka-Nithi'),('014','Embu'),('015','Kitui'),('016','Machakos'),
    ('017','Makueni'),('018','Nyandarua'),('019','Nyeri'),('020','Kirinyaga'),
    ('021','Murang''a'),('022','Kiambu'),('023','Turkana'),('024','West Pokot'),
    ('025','Samburu'),('026','Trans Nzoia'),('027','Uasin Gishu'),('028','Elgeyo/Marakwet'),
    ('029','Nandi'),('030','Baringo'),('031','Laikipia'),('032','Nakuru'),
    ('033','Narok'),('034','Kajiado'),('035','Kericho'),('036','Bomet'),
    ('037','Kakamega'),('038','Vihiga'),('039','Bungoma'),('040','Busia'),
    ('041','Siaya'),('042','Kisumu'),('043','Homa Bay'),('044','Migori'),
    ('045','Kisii'),('046','Nyamira'),('047','Nairobi City')
)
insert into public.geo_counties (
  country_id, official_code, official_name, normalized_name, status,
  source_key, source_version, verification_state
)
select
  k.id,
  c.official_code,
  c.official_name,
  lower(regexp_replace(c.official_name, '[^A-Za-z0-9]+', '', 'g')),
  'active',
  'kenya_constitution_2010_first_schedule',
  'Constitution of Kenya 2010 Article 6(1) First Schedule',
  'verified'
from kenya k
cross join counties c
on conflict (country_id, official_code) do update set
  official_name = excluded.official_name,
  normalized_name = excluded.normalized_name,
  status = excluded.status,
  source_key = excluded.source_key,
  source_version = excluded.source_version,
  verification_state = excluded.verification_state,
  updated_at = now();

create table if not exists public.school_geography_reconciliation_queue (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null unique references public.schools(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','reviewed','resolved','ignored')),
  reason text not null,
  candidate_count integer not null default 0 check (candidate_count >= 0),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.school_geography_reconciliation_queue enable row level security;
revoke all on public.school_geography_reconciliation_queue from public, anon, authenticated;

-- Candidate construction is deliberately deterministic. Exact KNEC identifiers win only
-- when the directory has a single match. Exact names are eligible only when normalized
-- names are unique on both sides. Ambiguous matches never enter the promotion set.
with canonical as (
  select
    s.*,
    lower(regexp_replace(trim(s.name), '[^A-Za-z0-9]+', '', 'g')) as name_key,
    count(*) over (
      partition by lower(regexp_replace(trim(s.name), '[^A-Za-z0-9]+', '', 'g'))
    ) as canonical_name_count
  from public.schools s
  where s.deleted_at is null
), directory as (
  select
    d.*,
    lower(regexp_replace(trim(d.name), '[^A-Za-z0-9]+', '', 'g')) as name_key,
    count(*) over (
      partition by lower(regexp_replace(trim(d.name), '[^A-Za-z0-9]+', '', 'g'))
    ) as directory_name_count
  from public.schools_directory d
), knec_ranked as (
  select
    s.id as school_id,
    d.id as directory_id,
    row_number() over (
      partition by s.id
      order by d.is_verified desc, d.created_at desc, d.id
    ) as rank_no,
    count(*) over (partition by s.id) as match_count
  from canonical s
  join directory d
    on nullif(btrim(s.knec_code), '') = nullif(btrim(d.knec_code), '')
  where s.knec_code is not null and btrim(s.knec_code) <> ''
), safe_name as (
  select s.id as school_id, d.id as directory_id
  from canonical s
  join directory d on d.name_key = s.name_key
  where s.canonical_name_count = 1
    and d.directory_name_count = 1
    and not exists (
      select 1 from knec_ranked k
      where k.school_id = s.id and k.match_count = 1
    )
), selected as (
  select school_id, directory_id, 'exact_knec'::text as tier
  from knec_ranked
  where rank_no = 1 and match_count = 1
  union all
  select school_id, directory_id, 'unique_exact_name'::text
  from safe_name
), rows_to_map as (
  select
    x.school_id,
    x.tier,
    d.*,
    lower(regexp_replace(trim(d.county), '[^A-Za-z0-9]+', '', 'g')) as county_key,
    lower(regexp_replace(trim(coalesce(d.sub_county, '')), '[^A-Za-z0-9]+', '', 'g')) as subcounty_key
  from selected x
  join public.schools_directory d on d.id = x.directory_id
)
insert into public.geo_subcounties (
  county_id, official_name, normalized_name, status,
  source_key, source_version, source_checksum, verification_state
)
select distinct
  c.id,
  r.sub_county,
  r.subcounty_key,
  'active',
  'schools_directory_discovery',
  'production-directory-2026-08-20',
  md5(concat_ws('|', r.county, r.sub_county)),
  'unverified'
from rows_to_map r
join public.geo_counties c on c.normalized_name = r.county_key
where nullif(btrim(r.sub_county), '') is not null
on conflict (county_id, normalized_name) do update set
  official_name = excluded.official_name,
  status = excluded.status,
  updated_at = now();

with canonical as (
  select
    s.*,
    lower(regexp_replace(trim(s.name), '[^A-Za-z0-9]+', '', 'g')) as name_key,
    count(*) over (
      partition by lower(regexp_replace(trim(s.name), '[^A-Za-z0-9]+', '', 'g'))
    ) as canonical_name_count
  from public.schools s
  where s.deleted_at is null
), directory as (
  select
    d.*,
    lower(regexp_replace(trim(d.name), '[^A-Za-z0-9]+', '', 'g')) as name_key,
    count(*) over (
      partition by lower(regexp_replace(trim(d.name), '[^A-Za-z0-9]+', '', 'g'))
    ) as directory_name_count
  from public.schools_directory d
), knec_ranked as (
  select
    s.id as school_id,
    d.id as directory_id,
    row_number() over (
      partition by s.id
      order by d.is_verified desc, d.created_at desc, d.id
    ) as rank_no,
    count(*) over (partition by s.id) as match_count
  from canonical s
  join directory d
    on nullif(btrim(s.knec_code), '') = nullif(btrim(d.knec_code), '')
  where s.knec_code is not null and btrim(s.knec_code) <> ''
), safe_name as (
  select s.id as school_id, d.id as directory_id
  from canonical s
  join directory d on d.name_key = s.name_key
  where s.canonical_name_count = 1
    and d.directory_name_count = 1
    and not exists (
      select 1 from knec_ranked k
      where k.school_id = s.id and k.match_count = 1
    )
), selected as (
  select school_id, directory_id, 'exact_knec'::text as tier
  from knec_ranked
  where rank_no = 1 and match_count = 1
  union all
  select school_id, directory_id, 'unique_exact_name'::text
  from safe_name
), rows_to_map as (
  select
    x.school_id,
    x.tier,
    d.*,
    lower(regexp_replace(trim(d.county), '[^A-Za-z0-9]+', '', 'g')) as county_key,
    lower(regexp_replace(trim(coalesce(d.sub_county, '')), '[^A-Za-z0-9]+', '', 'g')) as subcounty_key
  from selected x
  join public.schools_directory d on d.id = x.directory_id
), resolved as (
  select
    r.*,
    g.id as country_id,
    c.id as county_id,
    sc.id as subcounty_id
  from rows_to_map r
  join public.geo_countries g on g.iso2 = 'KE'
  join public.geo_counties c
    on c.country_id = g.id and c.normalized_name = r.county_key
  left join public.geo_subcounties sc
    on sc.county_id = c.id
   and sc.normalized_name = nullif(r.subcounty_key, '')
)
insert into public.school_geography (
  school_id, country_id, county_id, subcounty_id,
  latitude, longitude, location_precision, verification_state,
  source_key, source_version, source_ref, source_checksum,
  confidence, last_verified_at, updated_at
)
select
  school_id,
  country_id,
  county_id,
  subcounty_id,
  case when latitude between -90 and 90 and longitude between -180 and 180
    then latitude::numeric else null end,
  case when latitude between -90 and 90 and longitude between -180 and 180
    then longitude::numeric else null end,
  case when latitude is not null and longitude is not null then 'approximate' else null end,
  'inferred',
  case when tier = 'exact_knec'
    then 'schools_directory_unique_exact_identifier'
    else 'schools_directory_unique_exact_name' end,
  'production-directory-2026-08-20',
  id::text,
  coalesce(
    source_record_hash,
    md5(concat_ws('|', id::text, name, county, sub_county, latitude::text, longitude::text))
  ),
  case when tier = 'exact_knec' then 0.9500 else 0.8500 end,
  null,
  now()
from resolved
on conflict (school_id) do update set
  country_id = excluded.country_id,
  county_id = excluded.county_id,
  subcounty_id = excluded.subcounty_id,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  location_precision = excluded.location_precision,
  verification_state = excluded.verification_state,
  source_key = excluded.source_key,
  source_version = excluded.source_version,
  source_ref = excluded.source_ref,
  source_checksum = excluded.source_checksum,
  confidence = excluded.confidence,
  last_verified_at = excluded.last_verified_at,
  updated_at = now()
where public.school_geography.verification_state in ('unresolved','inferred');

-- A sealed Tier-0 identity decision is stronger than discovery matching. Only this
-- existing canonical proof may upgrade a row to verified in this migration.
with sealed as (
  select
    c.canonical_school_id as school_id,
    d.id as directory_id,
    d.county,
    d.sub_county,
    d.latitude,
    d.longitude,
    d.source_record_hash,
    lower(regexp_replace(trim(d.county), '[^A-Za-z0-9]+', '', 'g')) as county_key,
    lower(regexp_replace(trim(coalesce(d.sub_county, '')), '[^A-Za-z0-9]+', '', 'g')) as subcounty_key
  from public.school_identity_candidates c
  join public.schools_directory d on d.id = c.directory_school_id
  where c.status = 'matched'
    and c.confidence = 1.0000
    and c.match_reason = 'sealed_tier0_exact_identifier'
    and d.is_verified = true
), resolved as (
  select
    x.*,
    g.id as country_id,
    co.id as county_id,
    sc.id as subcounty_id
  from sealed x
  join public.geo_countries g on g.iso2 = 'KE'
  join public.geo_counties co
    on co.country_id = g.id and co.normalized_name = x.county_key
  left join public.geo_subcounties sc
    on sc.county_id = co.id
   and sc.normalized_name = nullif(x.subcounty_key, '')
)
insert into public.school_geography (
  school_id, country_id, county_id, subcounty_id,
  latitude, longitude, location_precision, verification_state,
  source_key, source_version, source_ref, source_checksum,
  confidence, last_verified_at, updated_at
)
select
  school_id,
  country_id,
  county_id,
  subcounty_id,
  case when latitude between -90 and 90 and longitude between -180 and 180
    then latitude::numeric else null end,
  case when latitude between -90 and 90 and longitude between -180 and 180
    then longitude::numeric else null end,
  case when latitude is not null and longitude is not null then 'approximate' else null end,
  'verified',
  'school_identity_sealed_tier0',
  'production-identity-2026-08-20',
  directory_id::text,
  coalesce(source_record_hash, md5(concat_ws('|', directory_id::text, county, sub_county))),
  1.0000,
  now(),
  now()
from resolved
on conflict (school_id) do update set
  country_id = excluded.country_id,
  county_id = excluded.county_id,
  subcounty_id = excluded.subcounty_id,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  location_precision = excluded.location_precision,
  verification_state = 'verified',
  source_key = excluded.source_key,
  source_version = excluded.source_version,
  source_ref = excluded.source_ref,
  source_checksum = excluded.source_checksum,
  confidence = 1.0000,
  last_verified_at = now(),
  updated_at = now();

-- Quarantine every active school that still lacks deterministic geography.
with canonical as (
  select
    s.id,
    s.name,
    s.knec_code,
    s.county,
    s.sub_county,
    s.ward,
    lower(regexp_replace(trim(s.name), '[^A-Za-z0-9]+', '', 'g')) as name_key,
    count(*) over (
      partition by lower(regexp_replace(trim(s.name), '[^A-Za-z0-9]+', '', 'g'))
    ) as canonical_name_count
  from public.schools s
  where s.deleted_at is null
), directory as (
  select
    d.*,
    lower(regexp_replace(trim(d.name), '[^A-Za-z0-9]+', '', 'g')) as name_key
  from public.schools_directory d
), unresolved as (
  select
    s.*,
    (select count(*) from directory d where d.name_key = s.name_key) as directory_name_count,
    (select count(*) from directory d
      where s.knec_code is not null
        and btrim(s.knec_code) <> ''
        and d.knec_code = s.knec_code) as directory_knec_count,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'directory_id', d.id,
          'name', d.name,
          'county', d.county,
          'sub_county', d.sub_county,
          'knec_code', d.knec_code,
          'verified', d.is_verified
        ) order by d.is_verified desc, d.name
      )
      from directory d
      where d.name_key = s.name_key
    ), '[]'::jsonb) as candidates
  from canonical s
  left join public.school_geography sg on sg.school_id = s.id
  where sg.school_id is null
)
insert into public.school_geography_reconciliation_queue (
  school_id, status, reason, candidate_count, evidence, updated_at
)
select
  id,
  'pending',
  case
    when canonical_name_count > 1 then 'duplicate_canonical_name_requires_identity_review'
    when directory_knec_count > 1 then 'multiple_directory_identifier_matches'
    when directory_name_count = 0 then 'no_deterministic_directory_match'
    when directory_name_count > 1 then 'multiple_directory_name_matches'
    else 'insufficient_authoritative_evidence'
  end,
  greatest(directory_name_count, directory_knec_count),
  jsonb_build_object(
    'school_name', name,
    'knec_code', knec_code,
    'legacy_county', county,
    'legacy_sub_county', sub_county,
    'legacy_ward', ward,
    'canonical_same_name_count', canonical_name_count,
    'directory_same_name_count', directory_name_count,
    'directory_same_knec_count', directory_knec_count,
    'candidates', candidates
  ),
  now()
from unresolved
on conflict (school_id) do update set
  status = 'pending',
  reason = excluded.reason,
  candidate_count = excluded.candidate_count,
  evidence = excluded.evidence,
  updated_at = now();

-- A school must never be both safely mapped and pending review.
delete from public.school_geography_reconciliation_queue q
using public.school_geography sg
where q.school_id = sg.school_id
  and sg.verification_state in ('verified','inferred');

commit;
