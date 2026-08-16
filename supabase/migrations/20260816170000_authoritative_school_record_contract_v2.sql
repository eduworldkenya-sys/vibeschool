-- School Engine authoritative raw_record contract v2.
--
-- The offline Tier-0 preparer and live observation adapter historically accepted
-- common Ministry field aliases (ownership, accommodation, gender), while the
-- canonical promotion gateway consumed only *_type keys. A valid observation
-- could therefore promote successfully while silently dropping source metadata.
-- This migration makes the promotion boundary alias-tolerant without widening
-- authority or introducing another canonical mutation gateway.

create or replace function public.hq_promote_authoritative_school_record(
  p_source_observation_id uuid,
  p_note text default null::text
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  o record;
  b record;
  r record;
  v_name text;
  v_knec text;
  v_nemis text;
  v_moe text;
  v_tsc text;
  v_county text;
  v_sub_county text;
  v_school_type text;
  v_ownership text;
  v_accommodation text;
  v_gender text;
  v_cluster text;
  v_school uuid;
  v_collision integer;
  v_subdomain text;
begin
  if v_uid is null or not coalesce(public.is_platform_owner(), false) then
    raise exception 'owner_authorization_required';
  end if;

  select * into o
  from public.school_directory_source_observations
  where id = p_source_observation_id;
  if not found then raise exception 'source_observation_not_found'; end if;

  select ib.*, sr.authority_tier, sr.canonical_use, sr.active, sr.verification_mode
  into b
  from public.school_directory_ingest_batches ib
  join public.school_directory_source_registry sr on sr.source_name = ib.source_name
  where ib.id = o.ingest_batch_id;

  if b.status not in ('validated', 'published')
     or b.authority_certified_at is null
     or b.authority_tier <> 0
     or not b.canonical_use
     or not b.active
     or b.verification_mode <> 'authoritative'
  then
    raise exception 'sealed_tier0_snapshot_required';
  end if;

  select * into r
  from public.school_authoritative_reconciliation
  where source_observation_id = p_source_observation_id
  for update;
  if not found then raise exception 'reconciliation_required'; end if;

  if r.classification = 'matched' and r.canonical_school_id is not null then
    return r.canonical_school_id;
  end if;
  if r.classification <> 'new_candidate' then
    raise exception 'record_not_eligible_for_promotion';
  end if;

  v_name := coalesce(
    nullif(trim(o.raw_record->>'name'), ''),
    nullif(trim(o.raw_record->>'official_name'), '')
  );
  v_knec := nullif(trim(o.raw_record->>'knec_code'), '');
  v_nemis := coalesce(
    nullif(trim(o.raw_record->>'nemis_uic'), ''),
    nullif(trim(o.raw_record->>'nemis_code'), ''),
    nullif(trim(o.raw_record->>'uic'), '')
  );
  v_moe := coalesce(
    nullif(trim(o.raw_record->>'moe_registration_no'), ''),
    nullif(trim(o.raw_record->>'moe_code'), '')
  );
  v_tsc := nullif(trim(o.raw_record->>'tsc_code'), '');
  v_county := nullif(trim(o.raw_record->>'county'), '');
  v_sub_county := coalesce(
    nullif(trim(o.raw_record->>'sub_county'), ''),
    nullif(trim(o.raw_record->>'subcounty'), '')
  );
  v_school_type := coalesce(
    nullif(trim(o.raw_record->>'school_type'), ''),
    nullif(trim(o.raw_record->>'institution_type'), ''),
    nullif(trim(o.raw_record->>'type'), '')
  );
  v_ownership := coalesce(
    nullif(trim(o.raw_record->>'ownership_type'), ''),
    nullif(trim(o.raw_record->>'ownership'), '')
  );
  v_accommodation := coalesce(
    nullif(trim(o.raw_record->>'accommodation_type'), ''),
    nullif(trim(o.raw_record->>'accommodation'), ''),
    nullif(trim(o.raw_record->>'boarding_status'), '')
  );
  v_gender := coalesce(
    nullif(trim(o.raw_record->>'gender_type'), ''),
    nullif(trim(o.raw_record->>'gender'), ''),
    nullif(trim(o.raw_record->>'sex'), '')
  );
  v_cluster := nullif(trim(o.raw_record->>'cluster'), '');

  if v_name is null
     or (v_knec is null and v_nemis is null and v_moe is null and v_tsc is null)
  then
    raise exception 'authoritative_identity_incomplete';
  end if;

  select count(*), min(s.id::text)::uuid
  into v_collision, v_school
  from public.schools s
  where s.deleted_at is null
    and s.status in ('pending', 'active')
    and (
      (v_knec is not null and s.knec_code = v_knec)
      or (v_nemis is not null and s.nemis_code = v_nemis)
      or (v_moe is not null and s.moe_registration_no = v_moe)
      or (v_tsc is not null and s.tsc_code = v_tsc)
      or (
        public.normalize_school_identity_name(s.name) = public.normalize_school_identity_name(v_name)
        and lower(coalesce(s.county, '')) = lower(coalesce(v_county, ''))
        and lower(coalesce(s.sub_county, '')) = lower(coalesce(v_sub_county, ''))
      )
    );

  if v_collision > 0 then
    raise exception 'canonical_identity_changed_rerun_reconciliation';
  end if;

  v_subdomain := trim(both '-' from lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g')))
    || '-' || substr(replace(o.id::text, '-', ''), 1, 8);

  insert into public.schools(
    name, subdomain, timezone, country_code, status, created_by,
    requires_dual_approval, knec_code, nemis_code, moe_registration_no,
    tsc_code, county, sub_county, school_type, ownership_type,
    accommodation_type, gender_type, cluster, directory_source,
    directory_source_ref, last_verified_at
  ) values (
    v_name, v_subdomain, 'Africa/Nairobi', 'KE', 'pending', v_uid,
    true, v_knec, v_nemis, v_moe, v_tsc, v_county, v_sub_county,
    v_school_type, v_ownership, v_accommodation, v_gender, v_cluster,
    'AUTHORITATIVE_SNAPSHOT', o.id::text, now()
  ) returning id into v_school;

  update public.school_authoritative_reconciliation
  set canonical_school_id = v_school,
      classification = 'matched',
      match_method = 'owner_promoted_authoritative_new',
      reason = coalesce(
        nullif(trim(p_note), ''),
        'Platform owner promoted sealed Tier-0 authoritative identity'
      ),
      promoted_at = now(),
      promoted_by = v_uid
  where source_observation_id = p_source_observation_id;

  return v_school;
end;
$function$;

comment on function public.hq_promote_authoritative_school_record(uuid, text) is
  'Owner-only canonical promotion gateway for reconciled sealed Tier-0 school evidence. Accepts canonical v2 raw_record keys and bounded legacy source aliases without widening authority.';

revoke all on function public.hq_promote_authoritative_school_record(uuid, text) from public;
revoke all on function public.hq_promote_authoritative_school_record(uuid, text) from anon;
grant execute on function public.hq_promote_authoritative_school_record(uuid, text) to authenticated;
