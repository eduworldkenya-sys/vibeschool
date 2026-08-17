create or replace function public.hq_stage_school_directory_batch(p_source_name text, p_source_url text, p_source_version text, p_checksum text, p_records jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_batch uuid;
  v_existing_batch uuid;
  v_count integer := 0;
  v_item jsonb;
  v_name text;
  v_knec text;
  v_source_record_id text;
  v_record_hash text;
  v_directory_school_id uuid;
  v_authority_tier smallint;
  v_registry_url text;
  v_source_host text;
  v_registry_host text;
  v_identity_basis text;
begin
  if v_uid is null or not coalesce(public.is_platform_owner(),false) then
    raise exception 'owner_authorization_required';
  end if;

  select authority_tier, source_url
    into v_authority_tier, v_registry_url
  from public.school_directory_source_registry
  where source_name=p_source_name and active=true;
  if not found then raise exception 'unknown_or_inactive_source'; end if;

  if jsonb_typeof(p_records) <> 'array' then raise exception 'records_must_be_json_array'; end if;
  if nullif(trim(p_checksum),'') is null or lower(trim(p_checksum)) !~ '^[0-9a-f]{64}$' then
    raise exception 'sha256_checksum_required';
  end if;

  select id into v_existing_batch
  from public.school_directory_ingest_batches
  where source_name=p_source_name and checksum=lower(trim(p_checksum))
  order by created_at limit 1;
  if v_existing_batch is not null then
    return jsonb_build_object('batch_id',v_existing_batch,'source_name',p_source_name,
      'staged_records',(select coalesce(record_count,0) from public.school_directory_ingest_batches where id=v_existing_batch),
      'status','replayed','idempotent_replay',true);
  end if;

  if v_authority_tier = 0 then
    if nullif(trim(p_source_url),'') is null then raise exception 'tier0_source_url_required'; end if;
    v_source_host := lower(substring(trim(p_source_url) from '^https?://([^/:?#]+)'));
    v_registry_host := lower(substring(coalesce(v_registry_url,'') from '^https?://([^/:?#]+)'));
    if v_source_host is null or v_registry_host is null or not (
      v_source_host = v_registry_host or v_source_host like '%.' || v_registry_host or v_registry_host like '%.' || v_source_host
    ) then raise exception 'tier0_source_host_mismatch'; end if;
  end if;

  insert into public.school_directory_ingest_batches(
    source_name,source_url,source_version,source_observed_at,record_count,checksum,status,created_by,metadata
  ) values (
    p_source_name,trim(p_source_url),p_source_version,now(),0,lower(trim(p_checksum)),'staged',v_uid,
    jsonb_build_object('engine','national_school_identity_engine','authority_tier',v_authority_tier,
      'checksum_algorithm','sha256','stable_source_identity',true,'immutable_observations',true,
      'capture_without_strong_identifier',true)
  ) returning id into v_batch;

  for v_item in select value from jsonb_array_elements(p_records) loop
    v_name := nullif(trim(v_item->>'name'),'');
    v_knec := nullif(trim(v_item->>'knec_code'),'');
    if v_name is null then raise exception 'source_record_name_required'; end if;

    v_source_record_id := coalesce(
      nullif(trim(v_item->>'source_record_id'),''),
      case when v_knec is not null then 'knec:'||v_knec end,
      case when nullif(trim(v_item->>'nemis_code'),'') is not null then 'nemis:'||trim(v_item->>'nemis_code') end,
      case when nullif(trim(v_item->>'moe_code'),'') is not null then 'moe:'||trim(v_item->>'moe_code') end,
      case when nullif(trim(v_item->>'tsc_code'),'') is not null then 'tsc:'||trim(v_item->>'tsc_code') end
    );

    if v_source_record_id is null then
      v_identity_basis := concat_ws('|',
        'observed-name-location-v1',
        public.normalize_school_identity_name(v_name),
        lower(coalesce(trim(v_item->>'county'),'')),
        lower(coalesce(trim(coalesce(v_item->>'sub_county',v_item->>'subcounty')),'')),
        lower(coalesce(trim(v_item->>'type'),''))
      );
      v_source_record_id := 'observed:' || encode(digest(v_identity_basis,'sha256'),'hex');
    end if;

    v_record_hash := encode(digest(v_item::text,'sha256'),'hex');

    insert into public.schools_directory(
      id,name,county,sub_county,type,status,latitude,longitude,is_verified,
      ingest_batch_id,knec_code,source_name,source_record_id,source_record_hash
    ) values (
      gen_random_uuid(),v_name,nullif(trim(v_item->>'county'),''),
      coalesce(nullif(trim(v_item->>'sub_county'),''),nullif(trim(v_item->>'subcounty'),'')),
      nullif(trim(v_item->>'type'),''),'active',nullif(v_item->>'latitude','')::numeric,
      nullif(v_item->>'longitude','')::numeric,false,v_batch,v_knec,p_source_name,v_source_record_id,v_record_hash
    )
    on conflict (source_name,source_record_id) where source_name is not null and source_record_id is not null
    do update set name=excluded.name,county=excluded.county,sub_county=excluded.sub_county,type=excluded.type,
      status=excluded.status,latitude=excluded.latitude,longitude=excluded.longitude,knec_code=excluded.knec_code,
      ingest_batch_id=excluded.ingest_batch_id,source_record_hash=excluded.source_record_hash
    returning id into v_directory_school_id;

    insert into public.school_directory_source_observations(
      source_name,source_record_id,ingest_batch_id,directory_school_id,record_hash,raw_record,observed_at
    ) values (p_source_name,v_source_record_id,v_batch,v_directory_school_id,v_record_hash,v_item,now());
    v_count := v_count + 1;
  end loop;

  update public.school_directory_ingest_batches set record_count=v_count where id=v_batch;
  return jsonb_build_object('batch_id',v_batch,'source_name',p_source_name,'staged_records',v_count,
    'status','staged','idempotent_replay',false);
end;
$$;

create or replace function public.hq_ingest_live_authoritative_school_observation(p_source_name text,p_source_url text,p_observed_at timestamptz,p_record jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid := auth.uid(); v_registry record; v_name text; v_record jsonb; v_observed_key text;
  v_checksum text; v_stage jsonb; v_batch_id uuid; v_batch_status text; v_seal jsonb; v_reconcile jsonb;
begin
  if v_uid is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
  if p_observed_at is null then raise exception 'observed_at_required'; end if;
  if p_observed_at > now()+interval '5 minutes' then raise exception 'observed_at_in_future'; end if;
  if p_observed_at < now()-interval '30 days' then raise exception 'live_observation_too_stale'; end if;
  if jsonb_typeof(p_record)<>'object' then raise exception 'record_must_be_json_object'; end if;

  select * into v_registry from public.school_directory_source_registry
  where source_name=p_source_name and active=true and authority_tier=0 and canonical_use=true
    and verification_mode='authoritative' and real_time_verification=true;
  if not found then raise exception 'realtime_tier0_source_required'; end if;

  v_name:=coalesce(nullif(trim(p_record->>'name'),''),nullif(trim(p_record->>'official_name'),''));
  if v_name is null then raise exception 'source_record_name_required'; end if;
  v_record:=p_record||jsonb_build_object('name',v_name,'official_source_url',trim(p_source_url),'official_observed_at',p_observed_at);
  v_observed_key:=to_char(p_observed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  v_checksum:=encode(digest(concat_ws('|',p_source_name,trim(p_source_url),v_observed_key,v_record::text),'sha256'),'hex');
  v_stage:=public.hq_stage_school_directory_batch(p_source_name,trim(p_source_url),'live:'||v_observed_key,v_checksum,jsonb_build_array(v_record));
  v_batch_id:=(v_stage->>'batch_id')::uuid;
  select status into v_batch_status from public.school_directory_ingest_batches where id=v_batch_id;
  if v_batch_status='staged' then
    v_seal:=public.hq_seal_authoritative_school_snapshot(v_batch_id,'Real-time Tier-0 observation from '||trim(p_source_url));
  else
    v_seal:=jsonb_build_object('batch_id',v_batch_id,'status',v_batch_status,'idempotent_replay',true);
  end if;
  v_reconcile:=public.hq_reconcile_authoritative_school_snapshot(v_batch_id);
  return jsonb_build_object('mode','live_authoritative_observation','source_name',p_source_name,'source_url',trim(p_source_url),
    'observed_at',p_observed_at,'checksum',v_checksum,'stage',v_stage,'seal',v_seal,'reconciliation',v_reconcile);
end;
$$;

revoke all on function public.hq_stage_school_directory_batch(text,text,text,text,jsonb) from public,anon;
revoke all on function public.hq_ingest_live_authoritative_school_observation(text,text,timestamptz,jsonb) from public,anon;
grant execute on function public.hq_stage_school_directory_batch(text,text,text,text,jsonb) to authenticated;
grant execute on function public.hq_ingest_live_authoritative_school_observation(text,text,timestamptz,jsonb) to authenticated;
