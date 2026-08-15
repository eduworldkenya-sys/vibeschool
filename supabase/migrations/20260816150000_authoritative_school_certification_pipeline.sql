-- P0.10 authoritative school certification pipeline.
--
-- This migration deliberately reuses the existing school_directory_source_registry
-- and school_directory_source_observations contracts. It does not create a second
-- source-authority registry. Discovery observations remain separate from canonical
-- school identity; only a sealed Tier-0 batch may reach the owner-gated promotion
-- path.

alter table public.school_directory_ingest_batches
  add column if not exists authority_basis text,
  add column if not exists authority_certified_at timestamptz,
  add column if not exists authority_certified_by uuid references public.profiles(id);

alter table public.schools
  add column if not exists moe_registration_no varchar,
  add column if not exists tsc_code varchar;

create unique index if not exists schools_active_nemis_unique_idx
  on public.schools(nemis_code)
  where deleted_at is null and nemis_code is not null and status in ('pending','active');
create unique index if not exists schools_active_moe_registration_unique_idx
  on public.schools(moe_registration_no)
  where deleted_at is null and moe_registration_no is not null and status in ('pending','active');
create unique index if not exists schools_active_tsc_unique_idx
  on public.schools(tsc_code)
  where deleted_at is null and tsc_code is not null and status in ('pending','active');

create table public.school_authoritative_reconciliation (
  source_observation_id uuid primary key references public.school_directory_source_observations(id) on delete restrict,
  ingest_batch_id uuid not null references public.school_directory_ingest_batches(id) on delete restrict,
  canonical_school_id uuid references public.schools(id),
  classification text not null check (classification in ('matched','new_candidate','review','rejected')),
  match_method text not null,
  reason text not null,
  evidence jsonb not null default '{}'::jsonb,
  reconciled_at timestamptz not null default now(),
  reconciled_by uuid references public.profiles(id),
  promoted_at timestamptz,
  promoted_by uuid references public.profiles(id)
);

create index school_authoritative_reconciliation_batch_idx
  on public.school_authoritative_reconciliation(ingest_batch_id,classification,reconciled_at desc);

-- Access: owner-read/function-write public.school_authoritative_reconciliation
-- Authorization-test: public.school_authoritative_reconciliation authenticated non-owner SELECT -> zero rows; direct client INSERT/UPDATE/DELETE -> denied; platform owner SELECT -> allowed; SECURITY DEFINER functions still require platform-owner authorization.
alter table public.school_authoritative_reconciliation enable row level security;
revoke all on table public.school_authoritative_reconciliation from anon, authenticated;
grant select on table public.school_authoritative_reconciliation to authenticated;
grant all on table public.school_authoritative_reconciliation to service_role;
create policy school_authoritative_reconciliation_owner_select
  on public.school_authoritative_reconciliation for select to authenticated
  using (public.is_platform_owner());

create or replace function public.guard_school_source_observation_immutable()
returns trigger
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
begin
  raise exception 'school_source_observation_immutable';
end;
$$;

revoke all on function public.guard_school_source_observation_immutable() from public, anon, authenticated;
grant execute on function public.guard_school_source_observation_immutable() to service_role;

drop trigger if exists trg_school_source_observation_immutable on public.school_directory_source_observations;
create trigger trg_school_source_observation_immutable
before update or delete on public.school_directory_source_observations
for each row execute function public.guard_school_source_observation_immutable();

create or replace function public.guard_school_ingest_batch_seal()
returns trigger
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
begin
  if old.status in ('validated','published') then
    if new.source_name is distinct from old.source_name
       or new.source_url is distinct from old.source_url
       or new.source_version is distinct from old.source_version
       or new.source_observed_at is distinct from old.source_observed_at
       or new.record_count is distinct from old.record_count
       or new.checksum is distinct from old.checksum
       or new.authority_basis is distinct from old.authority_basis
       or new.authority_certified_at is distinct from old.authority_certified_at
       or new.authority_certified_by is distinct from old.authority_certified_by then
      raise exception 'sealed_school_ingest_batch_immutable';
    end if;
    if new.status = 'staged' then
      raise exception 'sealed_school_ingest_batch_status_regression';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_school_ingest_batch_seal() from public, anon, authenticated;
grant execute on function public.guard_school_ingest_batch_seal() to service_role;

drop trigger if exists trg_guard_school_ingest_batch_seal on public.school_directory_ingest_batches;
create trigger trg_guard_school_ingest_batch_seal
before update on public.school_directory_ingest_batches
for each row execute function public.guard_school_ingest_batch_seal();

create or replace function public.hq_seal_authoritative_school_snapshot(
  p_batch_id uuid,
  p_authority_basis text
)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  b record;
  v_observation_count integer;
  v_duplicate_knec integer;
  v_duplicate_nemis integer;
begin
  if v_uid is null or not coalesce(public.is_platform_owner(),false) then
    raise exception 'owner_authorization_required';
  end if;
  if nullif(trim(coalesce(p_authority_basis,'')),'') is null then
    raise exception 'authority_basis_required';
  end if;

  select ib.*,sr.authority_tier,sr.canonical_use,sr.active,sr.verification_mode
    into b
  from public.school_directory_ingest_batches ib
  join public.school_directory_source_registry sr on sr.source_name=ib.source_name
  where ib.id=p_batch_id
  for update of ib;

  if not found then raise exception 'ingest_batch_not_found'; end if;
  if b.status <> 'staged' then raise exception 'snapshot_not_staged'; end if;
  if b.authority_tier <> 0 or not b.canonical_use or not b.active or b.verification_mode <> 'authoritative' then
    raise exception 'tier0_canonical_authority_required';
  end if;
  if nullif(trim(coalesce(b.source_url,'')),'') is null then raise exception 'source_url_required'; end if;
  if nullif(trim(coalesce(b.checksum,'')),'') is null or lower(trim(b.checksum)) !~ '^[0-9a-f]{64}$' then
    raise exception 'sha256_checksum_required';
  end if;

  select count(*) into v_observation_count
  from public.school_directory_source_observations o
  where o.ingest_batch_id=p_batch_id;
  if v_observation_count < 1 then raise exception 'authoritative_snapshot_empty'; end if;
  if coalesce(b.record_count,-1) <> v_observation_count then
    raise exception 'snapshot_record_count_mismatch expected %, observed %',b.record_count,v_observation_count;
  end if;

  select count(*) into v_duplicate_knec from (
    select nullif(trim(o.raw_record->>'knec_code'),'') v
    from public.school_directory_source_observations o
    where o.ingest_batch_id=p_batch_id and nullif(trim(o.raw_record->>'knec_code'),'') is not null
    group by 1 having count(*)>1
  ) q;
  select count(*) into v_duplicate_nemis from (
    select coalesce(nullif(trim(o.raw_record->>'nemis_uic'),''),nullif(trim(o.raw_record->>'nemis_code'),''),nullif(trim(o.raw_record->>'uic'),'')) v
    from public.school_directory_source_observations o
    where o.ingest_batch_id=p_batch_id
      and coalesce(nullif(trim(o.raw_record->>'nemis_uic'),''),nullif(trim(o.raw_record->>'nemis_code'),''),nullif(trim(o.raw_record->>'uic'),'')) is not null
    group by 1 having count(*)>1
  ) q;

  update public.school_directory_ingest_batches
  set status='validated',
      authority_basis=trim(p_authority_basis),
      authority_certified_at=now(),
      authority_certified_by=v_uid,
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
        'authoritative_snapshot_sealed',true,
        'duplicate_knec_groups',v_duplicate_knec,
        'duplicate_nemis_groups',v_duplicate_nemis
      )
  where id=p_batch_id;

  return jsonb_build_object(
    'batch_id',p_batch_id,
    'status','validated',
    'record_count',v_observation_count,
    'duplicate_knec_groups',v_duplicate_knec,
    'duplicate_nemis_groups',v_duplicate_nemis
  );
end;
$$;

revoke all on function public.hq_seal_authoritative_school_snapshot(uuid,text) from public, anon;
grant execute on function public.hq_seal_authoritative_school_snapshot(uuid,text) to authenticated;

create or replace function public.hq_reconcile_authoritative_school_snapshot(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  b record;
  o record;
  v_name text;
  v_knec text;
  v_nemis text;
  v_moe text;
  v_tsc text;
  v_county text;
  v_sub_county text;
  v_school uuid;
  v_match_count integer;
  v_knec_dupes integer;
  v_nemis_dupes integer;
  v_name_collision integer;
  v_class text;
  v_method text;
  v_reason text;
  v_matched integer:=0;
  v_new integer:=0;
  v_review integer:=0;
begin
  if v_uid is null or not coalesce(public.is_platform_owner(),false) then
    raise exception 'owner_authorization_required';
  end if;

  select ib.*,sr.authority_tier,sr.canonical_use,sr.active,sr.verification_mode into b
  from public.school_directory_ingest_batches ib
  join public.school_directory_source_registry sr on sr.source_name=ib.source_name
  where ib.id=p_batch_id;
  if not found then raise exception 'ingest_batch_not_found'; end if;
  if b.status not in ('validated','published') or b.authority_certified_at is null then
    raise exception 'sealed_snapshot_required';
  end if;
  if b.authority_tier<>0 or not b.canonical_use or not b.active or b.verification_mode<>'authoritative' then
    raise exception 'tier0_canonical_authority_required';
  end if;

  for o in
    select * from public.school_directory_source_observations
    where ingest_batch_id=p_batch_id order by id
  loop
    v_name:=coalesce(nullif(trim(o.raw_record->>'name'),''),nullif(trim(o.raw_record->>'official_name'),''));
    v_knec:=nullif(trim(o.raw_record->>'knec_code'),'');
    v_nemis:=coalesce(nullif(trim(o.raw_record->>'nemis_uic'),''),nullif(trim(o.raw_record->>'nemis_code'),''),nullif(trim(o.raw_record->>'uic'),''));
    v_moe:=coalesce(nullif(trim(o.raw_record->>'moe_registration_no'),''),nullif(trim(o.raw_record->>'moe_code'),''));
    v_tsc:=nullif(trim(o.raw_record->>'tsc_code'),'');
    v_county:=nullif(trim(o.raw_record->>'county'),'');
    v_sub_county:=nullif(trim(o.raw_record->>'sub_county'),'');

    select count(*) into v_knec_dupes
    from public.school_directory_source_observations x
    where x.ingest_batch_id=p_batch_id and v_knec is not null
      and nullif(trim(x.raw_record->>'knec_code'),'')=v_knec;
    select count(*) into v_nemis_dupes
    from public.school_directory_source_observations x
    where x.ingest_batch_id=p_batch_id and v_nemis is not null
      and coalesce(nullif(trim(x.raw_record->>'nemis_uic'),''),nullif(trim(x.raw_record->>'nemis_code'),''),nullif(trim(x.raw_record->>'uic'),''))=v_nemis;

    v_school:=null;
    select count(distinct s.id),min(s.id) into v_match_count,v_school
    from public.schools s
    where s.deleted_at is null and s.status in ('pending','active') and (
      (v_knec is not null and s.knec_code=v_knec) or
      (v_nemis is not null and s.nemis_code=v_nemis) or
      (v_moe is not null and s.moe_registration_no=v_moe) or
      (v_tsc is not null and s.tsc_code=v_tsc)
    );

    select count(*) into v_name_collision
    from public.schools s
    where s.deleted_at is null and s.status in ('pending','active')
      and v_name is not null
      and public.normalize_school_identity_name(s.name)=public.normalize_school_identity_name(v_name)
      and lower(coalesce(s.county,''))=lower(coalesce(v_county,''))
      and lower(coalesce(s.sub_county,''))=lower(coalesce(v_sub_county,''));

    if v_name is null then
      v_class:='review'; v_method:='invalid_authoritative_record'; v_reason:='Authoritative record has no official school name'; v_school:=null;
    elsif v_knec_dupes>1 or v_nemis_dupes>1 then
      v_class:='review'; v_method:='source_identifier_conflict'; v_reason:='Duplicate strong identifier inside authoritative snapshot'; v_school:=null;
    elsif v_match_count>1 then
      v_class:='review'; v_method:='canonical_identifier_conflict'; v_reason:='Strong government identifiers resolve to multiple canonical schools'; v_school:=null;
    elsif v_match_count=1 then
      if exists(
        select 1 from public.schools s where s.id=v_school and (
          (v_knec is not null and s.knec_code is not null and s.knec_code<>v_knec) or
          (v_nemis is not null and s.nemis_code is not null and s.nemis_code<>v_nemis) or
          (v_moe is not null and s.moe_registration_no is not null and s.moe_registration_no<>v_moe) or
          (v_tsc is not null and s.tsc_code is not null and s.tsc_code<>v_tsc)
        )
      ) then
        v_class:='review'; v_method:='strong_identifier_disagreement'; v_reason:='Matched canonical school carries a conflicting strong identifier'; v_school:=null;
      else
        v_class:='matched'; v_method:='exact_authoritative_identifier'; v_reason:='Exactly one canonical school matched by a government identifier';
      end if;
    elsif v_knec is null and v_nemis is null and v_moe is null and v_tsc is null then
      v_class:='review'; v_method:='missing_strong_identifier'; v_reason:='Authoritative record has no strong institution identifier'; v_school:=null;
    elsif v_name_collision>0 then
      v_class:='review'; v_method:='name_location_collision'; v_reason:='No identifier match but canonical name/location already exists'; v_school:=null;
    else
      v_class:='new_candidate'; v_method:='authoritative_absence'; v_reason:='Sealed Tier-0 record has a strong identifier and no canonical identity collision'; v_school:=null;
    end if;

    insert into public.school_authoritative_reconciliation(
      source_observation_id,ingest_batch_id,canonical_school_id,classification,
      match_method,reason,evidence,reconciled_at,reconciled_by
    ) values(
      o.id,p_batch_id,v_school,v_class,v_method,v_reason,
      jsonb_build_object(
        'source_name',b.source_name,'snapshot_sha256',b.checksum,
        'source_record_id',o.source_record_id,'record_sha256',o.record_hash,
        'knec_code',v_knec,'nemis_uic',v_nemis,'moe_registration_no',v_moe,'tsc_code',v_tsc
      ),now(),v_uid
    )
    on conflict (source_observation_id) do update set
      ingest_batch_id=excluded.ingest_batch_id,
      canonical_school_id=excluded.canonical_school_id,
      classification=excluded.classification,
      match_method=excluded.match_method,
      reason=excluded.reason,
      evidence=excluded.evidence,
      reconciled_at=excluded.reconciled_at,
      reconciled_by=excluded.reconciled_by;

    if v_class='matched' then v_matched:=v_matched+1;
    elsif v_class='new_candidate' then v_new:=v_new+1;
    else v_review:=v_review+1;
    end if;
  end loop;

  return jsonb_build_object(
    'batch_id',p_batch_id,
    'matched',v_matched,
    'new_candidates',v_new,
    'review',v_review,
    'total',v_matched+v_new+v_review
  );
end;
$$;

revoke all on function public.hq_reconcile_authoritative_school_snapshot(uuid) from public, anon;
grant execute on function public.hq_reconcile_authoritative_school_snapshot(uuid) to authenticated;

create or replace function public.hq_promote_authoritative_school_record(
  p_source_observation_id uuid,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
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
  if v_uid is null or not coalesce(public.is_platform_owner(),false) then
    raise exception 'owner_authorization_required';
  end if;

  select * into o from public.school_directory_source_observations where id=p_source_observation_id;
  if not found then raise exception 'source_observation_not_found'; end if;

  select ib.*,sr.authority_tier,sr.canonical_use,sr.active,sr.verification_mode into b
  from public.school_directory_ingest_batches ib
  join public.school_directory_source_registry sr on sr.source_name=ib.source_name
  where ib.id=o.ingest_batch_id;
  if b.status not in ('validated','published') or b.authority_certified_at is null
     or b.authority_tier<>0 or not b.canonical_use or not b.active or b.verification_mode<>'authoritative' then
    raise exception 'sealed_tier0_snapshot_required';
  end if;

  select * into r
  from public.school_authoritative_reconciliation
  where source_observation_id=p_source_observation_id
  for update;
  if not found then raise exception 'reconciliation_required'; end if;
  if r.classification='matched' and r.canonical_school_id is not null then
    return r.canonical_school_id;
  end if;
  if r.classification<>'new_candidate' then raise exception 'record_not_eligible_for_promotion'; end if;

  v_name:=coalesce(nullif(trim(o.raw_record->>'name'),''),nullif(trim(o.raw_record->>'official_name'),''));
  v_knec:=nullif(trim(o.raw_record->>'knec_code'),'');
  v_nemis:=coalesce(nullif(trim(o.raw_record->>'nemis_uic'),''),nullif(trim(o.raw_record->>'nemis_code'),''),nullif(trim(o.raw_record->>'uic'),''));
  v_moe:=coalesce(nullif(trim(o.raw_record->>'moe_registration_no'),''),nullif(trim(o.raw_record->>'moe_code'),''));
  v_tsc:=nullif(trim(o.raw_record->>'tsc_code'),'');
  v_county:=nullif(trim(o.raw_record->>'county'),'');
  v_sub_county:=nullif(trim(o.raw_record->>'sub_county'),'');
  v_school_type:=coalesce(nullif(trim(o.raw_record->>'school_type'),''),nullif(trim(o.raw_record->>'type'),''));
  v_ownership:=nullif(trim(o.raw_record->>'ownership_type'),'');
  v_accommodation:=nullif(trim(o.raw_record->>'accommodation_type'),'');
  v_gender:=nullif(trim(o.raw_record->>'gender_type'),'');
  v_cluster:=nullif(trim(o.raw_record->>'cluster'),'');

  if v_name is null or (v_knec is null and v_nemis is null and v_moe is null and v_tsc is null) then
    raise exception 'authoritative_identity_incomplete';
  end if;

  select count(*),min(s.id) into v_collision,v_school
  from public.schools s
  where s.deleted_at is null and s.status in ('pending','active') and (
    (v_knec is not null and s.knec_code=v_knec) or
    (v_nemis is not null and s.nemis_code=v_nemis) or
    (v_moe is not null and s.moe_registration_no=v_moe) or
    (v_tsc is not null and s.tsc_code=v_tsc) or
    (public.normalize_school_identity_name(s.name)=public.normalize_school_identity_name(v_name)
      and lower(coalesce(s.county,''))=lower(coalesce(v_county,''))
      and lower(coalesce(s.sub_county,''))=lower(coalesce(v_sub_county,'')))
  );
  if v_collision>0 then raise exception 'canonical_identity_changed_rerun_reconciliation'; end if;

  v_subdomain:=trim(both '-' from lower(regexp_replace(v_name,'[^a-zA-Z0-9]+','-','g')))
    ||'-'||substr(replace(o.id::text,'-',''),1,8);

  insert into public.schools(
    name,subdomain,timezone,country_code,status,created_by,requires_dual_approval,
    knec_code,nemis_code,moe_registration_no,tsc_code,county,sub_county,school_type,
    ownership_type,accommodation_type,gender_type,cluster,directory_source,directory_source_ref,last_verified_at
  ) values(
    v_name,v_subdomain,'Africa/Nairobi','KE','pending',v_uid,true,
    v_knec,v_nemis,v_moe,v_tsc,v_county,v_sub_county,v_school_type,
    v_ownership,v_accommodation,v_gender,v_cluster,'AUTHORITATIVE_SNAPSHOT',o.id::text,now()
  ) returning id into v_school;

  update public.school_authoritative_reconciliation
  set canonical_school_id=v_school,
      classification='matched',
      match_method='owner_promoted_authoritative_new',
      reason=coalesce(nullif(trim(p_note),''),'Platform owner promoted sealed Tier-0 authoritative identity'),
      promoted_at=now(),
      promoted_by=v_uid
  where source_observation_id=p_source_observation_id;

  return v_school;
end;
$$;

revoke all on function public.hq_promote_authoritative_school_record(uuid,text) from public, anon;
grant execute on function public.hq_promote_authoritative_school_record(uuid,text) to authenticated;

comment on table public.school_authoritative_reconciliation is
  'Deterministic classification evidence for immutable Tier-0 source observations. Discovery evidence is never canonical authority by itself.';
comment on function public.hq_seal_authoritative_school_snapshot(uuid,text) is
  'Owner-only Tier-0 snapshot seal. Requires authoritative/canonical-use registry classification, SHA-256 provenance already staged, and exact observation count.';
comment on function public.hq_reconcile_authoritative_school_snapshot(uuid) is
  'Owner-only deterministic reconciliation. Exact government identifiers may match; missing/conflicting identifiers and name/location collisions fail closed to review.';
comment on function public.hq_promote_authoritative_school_record(uuid,text) is
  'Owner-only promotion for a reconciled Tier-0 new_candidate. Rechecks identity at mutation time and creates only a pending dual-approval canonical school; no membership or operational ownership is granted.';
