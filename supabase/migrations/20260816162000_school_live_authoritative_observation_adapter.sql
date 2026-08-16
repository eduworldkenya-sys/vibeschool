-- School Identity P0: real-time Tier-0 observation adapter.
--
-- Some official government systems are live verification surfaces rather than
-- downloadable national artifacts. This adapter does NOT create a second ingestion
-- gateway: it validates the real-time source contract, creates a deterministic
-- observation snapshot hash, and delegates to the existing stage -> seal ->
-- reconcile functions. Bulk immutable artifacts remain the preferred national path.

create or replace function public.hq_ingest_live_authoritative_school_observation(
  p_source_name text,
  p_source_url text,
  p_observed_at timestamptz,
  p_record jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_registry record;
  v_name text;
  v_strong_id text;
  v_record jsonb;
  v_observed_key text;
  v_checksum text;
  v_stage jsonb;
  v_batch_id uuid;
  v_batch_status text;
  v_seal jsonb;
  v_reconcile jsonb;
begin
  if v_uid is null or not coalesce(public.is_platform_owner(), false) then
    raise exception 'owner_authorization_required';
  end if;

  if p_observed_at is null then
    raise exception 'observed_at_required';
  end if;
  if p_observed_at > now() + interval '5 minutes' then
    raise exception 'observed_at_in_future';
  end if;
  if p_observed_at < now() - interval '30 days' then
    raise exception 'live_observation_too_stale';
  end if;
  if jsonb_typeof(p_record) <> 'object' then
    raise exception 'record_must_be_json_object';
  end if;

  select * into v_registry
  from public.school_directory_source_registry
  where source_name = p_source_name
    and active = true
    and authority_tier = 0
    and canonical_use = true
    and verification_mode = 'authoritative'
    and real_time_verification = true;
  if not found then
    raise exception 'realtime_tier0_source_required';
  end if;

  v_name := coalesce(
    nullif(trim(p_record->>'name'),''),
    nullif(trim(p_record->>'official_name'),'')
  );
  if v_name is null then
    raise exception 'source_record_name_required';
  end if;

  v_strong_id := coalesce(
    nullif(trim(p_record->>'source_record_id'),''),
    case when nullif(trim(p_record->>'knec_code'),'') is not null then 'knec:' || trim(p_record->>'knec_code') end,
    case when coalesce(nullif(trim(p_record->>'nemis_uic'),''),nullif(trim(p_record->>'nemis_code'),''),nullif(trim(p_record->>'uic'),'')) is not null
      then 'nemis:' || coalesce(nullif(trim(p_record->>'nemis_uic'),''),nullif(trim(p_record->>'nemis_code'),''),nullif(trim(p_record->>'uic'),'')) end,
    case when coalesce(nullif(trim(p_record->>'moe_registration_no'),''),nullif(trim(p_record->>'moe_code'),'')) is not null
      then 'moe:' || coalesce(nullif(trim(p_record->>'moe_registration_no'),''),nullif(trim(p_record->>'moe_code'),'')) end,
    case when nullif(trim(p_record->>'tsc_code'),'') is not null then 'tsc:' || trim(p_record->>'tsc_code') end
  );
  if v_strong_id is null then
    raise exception 'tier0_source_record_id_required';
  end if;

  v_record := p_record || jsonb_build_object(
    'name', v_name,
    'source_record_id', v_strong_id,
    'official_source_url', trim(p_source_url),
    'official_observed_at', p_observed_at
  );

  v_observed_key := to_char(p_observed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  v_checksum := encode(digest(
    concat_ws('|', p_source_name, trim(p_source_url), v_observed_key, v_record::text),
    'sha256'
  ), 'hex');

  v_stage := public.hq_stage_school_directory_batch(
    p_source_name,
    trim(p_source_url),
    'live:' || v_observed_key,
    v_checksum,
    jsonb_build_array(v_record)
  );
  v_batch_id := (v_stage->>'batch_id')::uuid;

  select status into v_batch_status
  from public.school_directory_ingest_batches
  where id = v_batch_id;

  if v_batch_status = 'staged' then
    v_seal := public.hq_seal_authoritative_school_snapshot(
      v_batch_id,
      'Real-time Tier-0 observation from ' || trim(p_source_url)
    );
  else
    v_seal := jsonb_build_object('batch_id',v_batch_id,'status',v_batch_status,'idempotent_replay',true);
  end if;

  v_reconcile := public.hq_reconcile_authoritative_school_snapshot(v_batch_id);

  return jsonb_build_object(
    'mode','live_authoritative_observation',
    'source_name',p_source_name,
    'source_url',trim(p_source_url),
    'observed_at',p_observed_at,
    'checksum',v_checksum,
    'stage',v_stage,
    'seal',v_seal,
    'reconciliation',v_reconcile
  );
end;
$$;

revoke all on function public.hq_ingest_live_authoritative_school_observation(text,text,timestamptz,jsonb) from public, anon;
grant execute on function public.hq_ingest_live_authoritative_school_observation(text,text,timestamptz,jsonb) to authenticated;

comment on function public.hq_ingest_live_authoritative_school_observation(text,text,timestamptz,jsonb) is
'Owner-only adapter for a bounded current record observed on an active real-time Tier-0 source. Delegates exclusively to canonical stage/seal/reconcile gateways; requires strong identity and freshness; does not auto-promote canonical schools.';
