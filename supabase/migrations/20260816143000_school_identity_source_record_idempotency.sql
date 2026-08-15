-- P0.10 authoritative school source ingestion hardening.
--
-- The source-adapter contract requires a repeated observation of the same
-- external school record to resolve to the same discovery identity. Previously
-- batch-level checksum uniqueness prevented exact duplicate batches, but the
-- staging RPC raised a unique violation on replay and a later snapshot could
-- create a second schools_directory row for the same source record.
--
-- This migration separates stable discovery identity from immutable source
-- observations. It does not write to public.schools and does not widen any
-- canonical-school authority.
--
-- SECURITY DECLARATION: source observations and ingest metadata are internal
-- platform-owner evidence. RLS is enabled and anon/authenticated have no direct
-- table privileges. The owner-only staging RPC remains the sole write surface.

alter table public.schools_directory
  add column if not exists source_name text,
  add column if not exists source_record_id text,
  add column if not exists source_record_hash text;

create unique index if not exists schools_directory_source_record_uidx
  on public.schools_directory(source_name, source_record_id)
  where source_name is not null and source_record_id is not null;

create table if not exists public.school_directory_source_observations (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_record_id text not null,
  ingest_batch_id uuid not null references public.school_directory_ingest_batches(id) on delete restrict,
  directory_school_id uuid not null references public.schools_directory(id) on delete restrict,
  record_hash text not null,
  raw_record jsonb not null,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint school_directory_source_observations_record_hash_format
    check (record_hash ~ '^[0-9a-f]{64}$')
);

create unique index if not exists school_directory_source_observations_batch_record_uidx
  on public.school_directory_source_observations(ingest_batch_id, source_record_id);

create index if not exists school_directory_source_observations_identity_idx
  on public.school_directory_source_observations(source_name, source_record_id, observed_at desc);

alter table public.school_directory_source_observations enable row level security;
revoke all on public.school_directory_source_observations from anon, authenticated;

comment on table public.school_directory_source_observations is
  'Append-only raw observations for external school source records. Stable discovery identity remains in schools_directory; canonical promotion remains separately owner-gated.';
comment on column public.schools_directory.source_record_id is
  'Stable source-owned identifier mapped by the source adapter. For Tier-0 sources this is required; an official KNEC/NEMIS/MOE identifier may be used when it is the source record key.';

create or replace function public.hq_stage_school_directory_batch(
  p_source_name text,
  p_source_url text,
  p_source_version text,
  p_checksum text,
  p_records jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
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
begin
  if v_uid is null or not coalesce(public.is_platform_owner(),false) then
    raise exception 'owner_authorization_required';
  end if;

  select authority_tier, source_url
    into v_authority_tier, v_registry_url
  from public.school_directory_source_registry
  where source_name=p_source_name and active=true;

  if not found then
    raise exception 'unknown_or_inactive_source';
  end if;

  if jsonb_typeof(p_records) <> 'array' then
    raise exception 'records_must_be_json_array';
  end if;

  if nullif(trim(p_checksum),'') is null
     or lower(trim(p_checksum)) !~ '^[0-9a-f]{64}$' then
    raise exception 'sha256_checksum_required';
  end if;

  -- Exact snapshot replay is idempotent: return the existing batch rather than
  -- raising the checksum unique constraint or inserting duplicate observations.
  select id into v_existing_batch
  from public.school_directory_ingest_batches
  where source_name=p_source_name and checksum=lower(trim(p_checksum))
  order by created_at
  limit 1;

  if v_existing_batch is not null then
    return jsonb_build_object(
      'batch_id',v_existing_batch,
      'source_name',p_source_name,
      'staged_records',(select coalesce(record_count,0) from public.school_directory_ingest_batches where id=v_existing_batch),
      'status','replayed',
      'idempotent_replay',true
    );
  end if;

  -- Tier-0 evidence must originate from the registered official host. This
  -- rejects a third-party mirror being passed under an authoritative source_name.
  if v_authority_tier = 0 then
    if nullif(trim(p_source_url),'') is null then
      raise exception 'tier0_source_url_required';
    end if;

    v_source_host := lower(substring(trim(p_source_url) from '^https?://([^/:?#]+)'));
    v_registry_host := lower(substring(coalesce(v_registry_url,'') from '^https?://([^/:?#]+)'));

    if v_source_host is null
       or v_registry_host is null
       or not (
         v_source_host = v_registry_host
         or v_source_host like '%.' || v_registry_host
         or v_registry_host like '%.' || v_source_host
       ) then
      raise exception 'tier0_source_host_mismatch';
    end if;
  end if;

  insert into public.school_directory_ingest_batches(
    source_name,source_url,source_version,source_observed_at,
    record_count,checksum,status,created_by,metadata
  )
  values(
    p_source_name,trim(p_source_url),p_source_version,now(),
    0,lower(trim(p_checksum)),'staged',v_uid,
    jsonb_build_object(
      'engine','national_school_identity_engine',
      'authority_tier',v_authority_tier,
      'checksum_algorithm','sha256',
      'stable_source_identity',true,
      'immutable_observations',true
    )
  )
  returning id into v_batch;

  for v_item in select value from jsonb_array_elements(p_records) loop
    v_name := nullif(trim(v_item->>'name'),'');
    v_knec := nullif(trim(v_item->>'knec_code'),'');
    v_source_record_id := coalesce(
      nullif(trim(v_item->>'source_record_id'),''),
      v_knec,
      nullif(trim(v_item->>'nemis_code'),''),
      nullif(trim(v_item->>'moe_code'),'')
    );

    if v_name is null then
      raise exception 'source_record_name_required';
    end if;

    if v_authority_tier = 0 and v_source_record_id is null then
      raise exception 'tier0_source_record_id_required';
    end if;

    -- Lower-tier legacy/discovery adapters may lack a native ID. Give the
    -- observation a deterministic adapter-local identity without representing
    -- it as government authority.
    if v_source_record_id is null then
      v_source_record_id := encode(digest(
        concat_ws('|',
          public.normalize_school_identity_name(v_name),
          lower(coalesce(trim(v_item->>'county'),'')),
          lower(coalesce(trim(v_item->>'sub_county'),'')),
          lower(coalesce(trim(v_item->>'type'),''))
        ), 'sha256'
      ), 'hex');
    end if;

    v_record_hash := encode(digest(v_item::text,'sha256'),'hex');

    insert into public.schools_directory(
      id,name,county,sub_county,type,status,latitude,longitude,is_verified,
      ingest_batch_id,knec_code,source_name,source_record_id,source_record_hash
    )
    values(
      gen_random_uuid(),v_name,
      nullif(trim(v_item->>'county'),''),
      nullif(trim(v_item->>'sub_county'),''),
      nullif(trim(v_item->>'type'),''),
      'active',
      nullif(v_item->>'latitude','')::numeric,
      nullif(v_item->>'longitude','')::numeric,
      false,v_batch,v_knec,p_source_name,v_source_record_id,v_record_hash
    )
    on conflict (source_name,source_record_id)
      where source_name is not null and source_record_id is not null
    do update set
      name=excluded.name,
      county=excluded.county,
      sub_county=excluded.sub_county,
      type=excluded.type,
      status=excluded.status,
      latitude=excluded.latitude,
      longitude=excluded.longitude,
      knec_code=excluded.knec_code,
      ingest_batch_id=excluded.ingest_batch_id,
      source_record_hash=excluded.source_record_hash
    returning id into v_directory_school_id;

    insert into public.school_directory_source_observations(
      source_name,source_record_id,ingest_batch_id,directory_school_id,
      record_hash,raw_record,observed_at
    ) values (
      p_source_name,v_source_record_id,v_batch,v_directory_school_id,
      v_record_hash,v_item,now()
    );

    v_count := v_count + 1;
  end loop;

  update public.school_directory_ingest_batches
  set record_count=v_count
  where id=v_batch;

  return jsonb_build_object(
    'batch_id',v_batch,
    'source_name',p_source_name,
    'staged_records',v_count,
    'status','staged',
    'idempotent_replay',false
  );
end;
$$;

revoke all on function public.hq_stage_school_directory_batch(text,text,text,text,jsonb) from public;
grant execute on function public.hq_stage_school_directory_batch(text,text,text,text,jsonb) to authenticated;

comment on function public.hq_stage_school_directory_batch(text,text,text,text,jsonb) is
  'Owner-only discovery ingestion. Exact snapshot replays return the existing batch; stable source_record_id preserves one discovery identity across later snapshots. Tier-0 records require official-host provenance and a stable official identifier. Does not promote to public.schools.';
