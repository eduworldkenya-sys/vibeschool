-- VibeSchool national school-directory read-only coverage audit
-- Run against production using a privileged read-only SQL session.
-- This file deliberately contains SELECT statements only; it never modifies school identities.
-- Coordinates inside broad Kenya bounds are plausible, NOT necessarily verified school pins.
-- Never auto-merge records based on name/county similarity.
--
-- Coverage by source table (tables serve different purposes and must not be summed).
select 'schools_directory' as dataset,
  count(*) as records,
  count(*) filter (where nullif(btrim(name), '') is not null) as with_name,
  count(*) filter (where nullif(btrim(county), '') is not null) as with_county,
  count(*) filter (where nullif(btrim(sub_county), '') is not null) as with_sub_county,
  count(*) filter (where nullif(btrim(type), '') is not null) as with_school_type,
  count(*) filter (where latitude between -5 and 5 and longitude between 33 and 42) as plausible_coordinates,
  count(*) filter (where latitude is null or longitude is null) as missing_coordinates,
  count(*) filter (where latitude is not null and longitude is not null
      and not (latitude between -5 and 5 and longitude between 33 and 42)) as outside_broad_bounds,
  count(*) filter (where nullif(btrim(knec_code), '') is not null) as with_knec_code,
  count(*) filter (where is_verified) as verified,
  count(*) filter (where nullif(btrim(source_name), '') is null) as missing_provenance
from public.schools_directory;

-- Separate operational schools table; do not assume it has a one-to-one relationship
-- with schools_directory before identity reconciliation.
select count(*) as operational_schools,
  count(*) filter (where nullif(btrim(county), '') is not null) as with_county,
  count(*) filter (where gps_lat between -5 and 5 and gps_lng between 33 and 42) as plausible_coordinates,
  count(*) filter (where last_verified_at is not null) as marked_verified
from public.schools where deleted_at is null;

-- Nonblank provenance distribution.
select coalesce(nullif(btrim(source_name), ''), '(missing)') as provenance,
       count(*) as records, count(*) filter (where is_verified) as verified
from public.schools_directory
group by 1 order by records desc;

-- Potential collisions to review; do NOT delete or merge these automatically.
select lower(btrim(name)) as normalized_name,
       lower(btrim(county)) as normalized_county,
       count(*) as records,
       array_agg(id order by id) as directory_ids
from public.schools_directory
where nullif(btrim(name), '') is not null
group by 1,2 having count(*) > 1
order by records desc, normalized_name limit 100;

-- Gilgil is a pilot example: similar names can denote separate institutions.
select id, name, county, sub_county, type, latitude, longitude,
       knec_code, is_verified, source_name
from public.schools_directory
where name ilike '%Gilgil Township%'
order by name;

-- Policy: display a precise school pin only after provenance and school-level
-- coordinate accuracy are established. A geographic bounding-box test is insufficient.
-- Proposed rollout: (1) shared public template; (2) verified field-level provenance;
-- (3) staged enrichment; (4) HQ-reviewed conflicts; (5) verified claims/self-service.
