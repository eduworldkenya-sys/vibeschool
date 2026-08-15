-- P0.10 authoritative school snapshot + reconciliation contract.
-- Discovery data is not canonical authority. Only sealed Tier-0 snapshots may
-- feed the authoritative reconciliation and promotion path.

alter table public.school_directory_ingest_batches
  add column if not exists source_registry_key text,
  add column if not exists authority_tier text not null default 'discovery',
  add column if not exists authority_basis text,
  add column if not exists authority_certified_at timestamptz,
  add column if not exists authority_certified_by uuid references public.profiles(id);

alter table public.school_directory_ingest_batches
  drop constraint if exists school_directory_ingest_batches_authority_tier_check;
alter table public.school_directory_ingest_batches
  add constraint school_directory_ingest_batches_authority_tier_check
  check (authority_tier in ('tier0','tier1','discovery'));

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

create table public.school_identity_source_registry (
  source_key text primary key,
  display_name text not null,
  authority_tier text not null check (authority_tier in ('tier0','tier1','discovery')),
  operator_name text not null,
  source_domain text,
  canonical_identity_eligible boolean not null default false,
  evidence_requirements jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not canonical_identity_eligible or authority_tier = 'tier0')
);

-- Access: owner-read/service-write public.school_identity_source_registry
-- Authorization-test: public.school_identity_source_registry authenticated non-owner SELECT -> zero rows; client INSERT/UPDATE/DELETE -> denied; platform owner SELECT -> allowed; service_role migration/ingest -> allowed.
alter table public.school_identity_source_registry enable row level security;
revoke all on table public.school_identity_source_registry from anon, authenticated;
grant select on table public.school_identity_source_registry to authenticated;
grant all on table public.school_identity_source_registry to service_role;
create policy school_identity_source_registry_owner_select
  on public.school_identity_source_registry for select to authenticated
  using (public.is_platform_owner());

insert into public.school_identity_source_registry(
  source_key,display_name,authority_tier,operator_name,source_domain,
  canonical_identity_eligible,evidence_requirements
) values
  ('kenya_moe_selection_senior_schools','Kenya Ministry of Education Senior Schools Selection','tier0','Kenya Ministry of Education','selection.education.go.ke',true,
   jsonb_build_object('required_identifiers',jsonb_build_array('knec_code'),'preserve_separately',jsonb_build_array('nemis_uic','moe_registration_no','tsc_code','knec_code'))),
  ('kenya_nemis_public_institution_listing','NEMIS Public Institution Listing','tier0','Kenya Ministry of Education','nemis.education.go.ke',true,
   jsonb_build_object('required_identifiers',jsonb_build_array('nemis_uic'),'preserve_separately',jsonb_build_array('nemis_uic','moe_registration_no','tsc_code','knec_code'))),
  ('kenya_2024_school_census','Kenya 2024 School Census','tier0','Kenya Ministry of Education','nemis.education.go.ke',true,
   jsonb_build_object('preserve_separately',jsonb_build_array('nemis_uic','moe_registration_no','tsc_code','knec_code')))
on conflict (source_key) do update set
  display_name=excluded.display_name,
  authority_tier=excluded.authority_tier,
  operator_name=excluded.operator_name,
  source_domain=excluded.source_domain,
  canonical_identity_eligible=excluded.canonical_identity_eligible,
  evidence_requirements=excluded.evidence_requirements,
  updated_at=now();

alter table public.school_directory_ingest_batches
  drop constraint if exists school_directory_ingest_batches_source_registry_fk;
alter table public.school_directory_ingest_batches
  add constraint school_directory_ingest_batches_source_registry_fk
  foreign key (source_registry_key) references public.school_identity_source_registry(source_key);

create table public.school_authoritative_source_records (
  id uuid primary key default gen_random_uuid(),
  ingest_batch_id uuid not null references public.school_directory_ingest_batches(id),
  source_record_key text not null,
  official_name text not null,
  nemis_uic text,
  moe_registration_no text,
  tsc_code text,
  knec_code text,
  region text,
  county text,
  sub_county text,
  school_level text,
  school_type text,
  ownership_type text,
  accommodation_type text,
  gender_type text,
  cluster text,
  raw_record jsonb not null,
  record_sha256 text not null check (record_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (ingest_batch_id, source_record_key),
  unique (ingest_batch_id, record_sha256)
);

create index school_authoritative_records_batch_idx
  on public.school_authoritative_source_records(ingest_batch_id,id);
create index school_authoritative_records_knec_idx
  on public.school_authoritative_source_records(knec_code)
  where knec_code is not null;
create index school_authoritative_records_nemis_idx
  on public.school_authoritative_source_records(nemis_uic)
  where nemis_uic is not null;

-- Access: owner-read/service-ingest public.school_authoritative_source_records
-- Authorization-test: public.school_authoritative_source_records authenticated non-owner SELECT -> zero rows; client INSERT/UPDATE/DELETE -> denied; platform owner SELECT -> allowed; service_role staged INSERT -> allowed; UPDATE/DELETE -> immutable trigger denial.
alter table public.school_authoritative_source_records enable row level security;
revoke all on table public.school_authoritative_source_records from anon, authenticated;
grant select on table public.school_authoritative_source_records to authenticated;
grant all on table public.school_authoritative_source_records to service_role;
create policy school_authoritative_source_records_owner_select
  on public.school_authoritative_source_records for select to authenticated
  using (public.is_platform_owner());

create table public.school_authoritative_reconciliation (
  source_record_id uuid primary key references public.school_authoritative_source_records(id),
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

create index school_authoritative_reconciliation_class_idx
  on public.school_authoritative_reconciliation(classification,reconciled_at desc);

-- Access: owner-read/function-write public.school_authoritative_reconciliation
-- Authorization-test: public.school_authoritative_reconciliation authenticated non-owner SELECT -> zero rows; direct client INSERT/UPDATE/DELETE -> denied; platform owner SELECT -> allowed; SECURITY DEFINER reconciliation/promotion functions enforce owner authorization.
alter table public.school_authoritative_reconciliation enable row level security;
revoke all on table public.school_authoritative_reconciliation from anon, authenticated;
grant select on table public.school_authoritative_reconciliation to authenticated;
grant all on table public.school_authoritative_reconciliation to service_role;
create policy school_authoritative_reconciliation_owner_select
  on public.school_authoritative_reconciliation for select to authenticated
  using (public.is_platform_owner());

create or replace function public.guard_authoritative_school_record_immutability()
returns trigger language plpgsql security definer
set search_path=public,extensions,pg_temp
as $$
declare b record;
begin
  if tg_op in ('UPDATE','DELETE') then
    raise exception 'authoritative_source_record_immutable';
  end if;
  select ib.status,ib.authority_tier,ib.source_registry_key,r.canonical_identity_eligible,r.authority_tier registry_tier
    into b
  from public.school_directory_ingest_batches ib
  left join public.school_identity_source_registry r on r.source_key=ib.source_registry_key
  where ib.id=new.ingest_batch_id;
  if not found then raise exception 'ingest_batch_not_found'; end if;
  if b.status <> 'staged' then raise exception 'authoritative_snapshot_not_staged'; end if;
  if b.authority_tier <> 'tier0' or b.registry_tier <> 'tier0' or not coalesce(b.canonical_identity_eligible,false) then
    raise exception 'tier0_authority_required';
  end if;
  return new;
end; $$;

revoke all on function public.guard_authoritative_school_record_immutability() from public, anon, authenticated;
grant execute on function public.guard_authoritative_school_record_immutability() to service_role;

drop trigger if exists trg_guard_authoritative_school_record_immutability on public.school_authoritative_source_records;
create trigger trg_guard_authoritative_school_record_immutability
before insert or update or delete on public.school_authoritative_source_records
for each row execute function public.guard_authoritative_school_record_immutability();

create or replace function public.guard_school_ingest_batch_seal()
returns trigger language plpgsql security definer
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
       or new.source_registry_key is distinct from old.source_registry_key
       or new.authority_tier is distinct from old.authority_tier
       or new.authority_basis is distinct from old.authority_basis
       or new.authority_certified_at is distinct from old.authority_certified_at
       or new.authority_certified_by is distinct from old.authority_certified_by then
      raise exception 'sealed_ingest_batch_immutable';
    end if;
    if new.status = 'staged' then raise exception 'sealed_ingest_batch_status_regression'; end if;
  end if;
  return new;
end; $$;

revoke all on function public.guard_school_ingest_batch_seal() from public, anon, authenticated;
grant execute on function public.guard_school_ingest_batch_seal() to service_role;

drop trigger if exists trg_guard_school_ingest_batch_seal on public.school_directory_ingest_batches;
create trigger trg_guard_school_ingest_batch_seal
before update on public.school_directory_ingest_batches
for each row execute function public.guard_school_ingest_batch_seal();

create or replace function public.hq_seal_authoritative_school_snapshot(
  p_batch_id uuid,
  p_sha256 text,
  p_expected_record_count integer
) returns jsonb
language plpgsql security definer
set search_path=public,extensions,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  b record;
  v_count integer;
  v_duplicate_knec integer;
  v_duplicate_nemis integer;
begin
  if v_uid is null or not coalesce(public.is_platform_owner(),false) then
    raise exception 'owner_authorization_required';
  end if;
  if p_sha256 is null or lower(p_sha256) !~ '^[0-9a-f]{64}$' then raise exception 'invalid_sha256'; end if;
  if p_expected_record_count is null or p_expected_record_count < 1 then raise exception 'invalid_record_count'; end if;

  select ib.*,r.canonical_identity_eligible,r.authority_tier registry_tier
    into b
  from public.school_directory_ingest_batches ib
  join public.school_identity_source_registry r on r.source_key=ib.source_registry_key
  where ib.id=p_batch_id for update of ib;
  if not found then raise exception 'ingest_batch_not_found'; end if;
  if b.status <> 'staged' then raise exception 'snapshot_not_staged'; end if;
  if b.authority_tier <> 'tier0' or b.registry_tier <> 'tier0' or not b.canonical_identity_eligible then
    raise exception 'tier0_authority_required';
  end if;
  if nullif(trim(coalesce(b.source_url,'')),'') is null or nullif(trim(coalesce(b.authority_basis,'')),'') is null then
    raise exception 'authority_provenance_incomplete';
  end if;

  select count(*) into v_count from public.school_authoritative_source_records where ingest_batch_id=p_batch_id;
  if v_count <> p_expected_record_count then raise exception 'snapshot_record_count_mismatch expected %, actual %',p_expected_record_count,v_count; end if;

  select count(*) into v_duplicate_knec from (
    select knec_code from public.school_authoritative_source_records
    where ingest_batch_id=p_batch_id and knec_code is not null
    group by knec_code having count(*)>1
  ) d;
  select count(*) into v_duplicate_nemis from (
    select nemis_uic from public.school_authoritative_source_records
    where ingest_batch_id=p_batch_id and nemis_uic is not null
    group by nemis_uic having count(*)>1
  ) d;

  update public.school_directory_ingest_batches
    set checksum=lower(p_sha256),record_count=v_count,status='validated',
        authority_certified_at=now(),authority_certified_by=v_uid,
        metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
          'authoritative_snapshot_sealed',true,
          'duplicate_knec_groups',v_duplicate_knec,
          'duplicate_nemis_groups',v_duplicate_nemis
        )
  where id=p_batch_id;

  return jsonb_build_object('batch_id',p_batch_id,'status','validated','record_count',v_count,
    'duplicate_knec_groups',v_duplicate_knec,'duplicate_nemis_groups',v_duplicate_nemis);
end; $$;

revoke all on function public.hq_seal_authoritative_school_snapshot(uuid,text,integer) from public, anon;
grant execute on function public.hq_seal_authoritative_school_snapshot(uuid,text,integer) to authenticated;

create or replace function public.hq_reconcile_authoritative_school_snapshot(p_batch_id uuid)
returns jsonb
language plpgsql security definer
set search_path=public,extensions,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  b record;
  r record;
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
  if v_uid is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
  select ib.*,sr.canonical_identity_eligible,sr.authority_tier registry_tier into b
  from public.school_directory_ingest_batches ib
  join public.school_identity_source_registry sr on sr.source_key=ib.source_registry_key
  where ib.id=p_batch_id;
  if not found then raise exception 'ingest_batch_not_found'; end if;
  if b.status not in ('validated','published') or b.checksum is null then raise exception 'sealed_snapshot_required'; end if;
  if b.authority_tier<>'tier0' or b.registry_tier<>'tier0' or not b.canonical_identity_eligible then raise exception 'tier0_authority_required'; end if;

  for r in select * from public.school_authoritative_source_records where ingest_batch_id=p_batch_id order by id loop
    select count(*) into v_knec_dupes from public.school_authoritative_source_records x
      where x.ingest_batch_id=p_batch_id and r.knec_code is not null and x.knec_code=r.knec_code;
    select count(*) into v_nemis_dupes from public.school_authoritative_source_records x
      where x.ingest_batch_id=p_batch_id and r.nemis_uic is not null and x.nemis_uic=r.nemis_uic;

    v_school:=null; v_match_count:=0;
    select count(distinct s.id),min(s.id) into v_match_count,v_school
    from public.schools s
    where s.deleted_at is null and s.status in ('pending','active') and (
      (r.knec_code is not null and s.knec_code=r.knec_code) or
      (r.nemis_uic is not null and s.nemis_code=r.nemis_uic) or
      (r.moe_registration_no is not null and s.moe_registration_no=r.moe_registration_no) or
      (r.tsc_code is not null and s.tsc_code=r.tsc_code)
    );

    select count(*) into v_name_collision from public.schools s
    where s.deleted_at is null and s.status in ('pending','active')
      and public.normalize_school_identity_name(s.name)=public.normalize_school_identity_name(r.official_name)
      and lower(coalesce(s.county,''))=lower(coalesce(r.county,''))
      and lower(coalesce(s.sub_county,''))=lower(coalesce(r.sub_county,''));

    if v_knec_dupes>1 or v_nemis_dupes>1 then
      v_class:='review'; v_method:='source_identifier_conflict'; v_reason:='Duplicate strong identifier inside authoritative snapshot'; v_school:=null;
    elsif v_match_count>1 then
      v_class:='review'; v_method:='canonical_identifier_conflict'; v_reason:='Strong identifiers resolve to multiple canonical schools'; v_school:=null;
    elsif v_match_count=1 then
      if exists(select 1 from public.schools s where s.id=v_school and (
        (r.knec_code is not null and s.knec_code is not null and s.knec_code<>r.knec_code) or
        (r.nemis_uic is not null and s.nemis_code is not null and s.nemis_code<>r.nemis_uic) or
        (r.moe_registration_no is not null and s.moe_registration_no is not null and s.moe_registration_no<>r.moe_registration_no) or
        (r.tsc_code is not null and s.tsc_code is not null and s.tsc_code<>r.tsc_code)
      )) then
        v_class:='review'; v_method:='strong_identifier_disagreement'; v_reason:='Matched canonical school has a conflicting strong identifier'; v_school:=null;
      else
        v_class:='matched'; v_method:='exact_authoritative_identifier'; v_reason:='One canonical school matched by an exact government identifier';
      end if;
    elsif r.knec_code is null and r.nemis_uic is null and r.moe_registration_no is null and r.tsc_code is null then
      v_class:='review'; v_method:='missing_strong_identifier'; v_reason:='Authoritative record has no strong institution identifier'; v_school:=null;
    elsif v_name_collision>0 then
      v_class:='review'; v_method:='name_location_collision'; v_reason:='No identifier match but an existing canonical school has the same normalized name/location'; v_school:=null;
    else
      v_class:='new_candidate'; v_method:='authoritative_absence'; v_reason:='Tier-0 record has a strong identifier and no canonical identifier or name/location collision'; v_school:=null;
    end if;

    insert into public.school_authoritative_reconciliation(source_record_id,canonical_school_id,classification,match_method,reason,evidence,reconciled_at,reconciled_by)
    values(r.id,v_school,v_class,v_method,v_reason,jsonb_build_object('batch_id',p_batch_id,'snapshot_sha256',b.checksum,'knec_code',r.knec_code,'nemis_uic',r.nemis_uic,'moe_registration_no',r.moe_registration_no,'tsc_code',r.tsc_code),now(),v_uid)
    on conflict (source_record_id) do update set
      canonical_school_id=excluded.canonical_school_id,classification=excluded.classification,
      match_method=excluded.match_method,reason=excluded.reason,evidence=excluded.evidence,
      reconciled_at=excluded.reconciled_at,reconciled_by=excluded.reconciled_by;

    if v_class='matched' then v_matched:=v_matched+1;
    elsif v_class='new_candidate' then v_new:=v_new+1;
    else v_review:=v_review+1;
    end if;
  end loop;

  return jsonb_build_object('batch_id',p_batch_id,'matched',v_matched,'new_candidates',v_new,'review',v_review,
    'total',v_matched+v_new+v_review);
end; $$;

revoke all on function public.hq_reconcile_authoritative_school_snapshot(uuid) from public, anon;
grant execute on function public.hq_reconcile_authoritative_school_snapshot(uuid) to authenticated;

create or replace function public.hq_promote_authoritative_school_record(p_source_record_id uuid,p_note text default null)
returns uuid
language plpgsql security definer
set search_path=public,extensions,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  r record;
  rec record;
  b record;
  v_school uuid;
  v_subdomain text;
  v_collision integer;
begin
  if v_uid is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;

  select * into rec from public.school_authoritative_source_records where id=p_source_record_id;
  if not found then raise exception 'authoritative_record_not_found'; end if;
  select ib.*,sr.canonical_identity_eligible,sr.authority_tier registry_tier into b
  from public.school_directory_ingest_batches ib join public.school_identity_source_registry sr on sr.source_key=ib.source_registry_key
  where ib.id=rec.ingest_batch_id;
  if b.status not in ('validated','published') or b.checksum is null or b.authority_tier<>'tier0' or b.registry_tier<>'tier0' or not b.canonical_identity_eligible then
    raise exception 'sealed_tier0_snapshot_required';
  end if;

  select * into r from public.school_authoritative_reconciliation where source_record_id=p_source_record_id for update;
  if not found then raise exception 'reconciliation_required'; end if;
  if r.classification='matched' and r.canonical_school_id is not null then return r.canonical_school_id; end if;
  if r.classification<>'new_candidate' then raise exception 'record_not_eligible_for_promotion'; end if;

  select count(*),min(s.id) into v_collision,v_school from public.schools s
  where s.deleted_at is null and s.status in ('pending','active') and (
    (rec.knec_code is not null and s.knec_code=rec.knec_code) or
    (rec.nemis_uic is not null and s.nemis_code=rec.nemis_uic) or
    (rec.moe_registration_no is not null and s.moe_registration_no=rec.moe_registration_no) or
    (rec.tsc_code is not null and s.tsc_code=rec.tsc_code) or
    (public.normalize_school_identity_name(s.name)=public.normalize_school_identity_name(rec.official_name)
      and lower(coalesce(s.county,''))=lower(coalesce(rec.county,''))
      and lower(coalesce(s.sub_county,''))=lower(coalesce(rec.sub_county,'')))
  );
  if v_collision>0 then raise exception 'canonical_identity_changed_rerun_reconciliation'; end if;

  v_subdomain:=trim(both '-' from lower(regexp_replace(rec.official_name,'[^a-zA-Z0-9]+','-','g')))||'-'||substr(replace(rec.id::text,'-',''),1,8);

  insert into public.schools(
    name,subdomain,timezone,country_code,status,created_by,requires_dual_approval,
    knec_code,nemis_code,moe_registration_no,tsc_code,county,sub_county,school_type,
    ownership_type,accommodation_type,gender_type,cluster,directory_source,directory_source_ref,last_verified_at
  ) values(
    rec.official_name,v_subdomain,'Africa/Nairobi','KE','pending',v_uid,true,
    rec.knec_code,rec.nemis_uic,rec.moe_registration_no,rec.tsc_code,rec.county,rec.sub_county,rec.school_type,
    rec.ownership_type,rec.accommodation_type,rec.gender_type,rec.cluster,'AUTHORITATIVE_SNAPSHOT',rec.id::text,now()
  ) returning id into v_school;

  update public.school_authoritative_reconciliation
    set canonical_school_id=v_school,classification='matched',match_method='owner_promoted_authoritative_new',
        reason=coalesce(nullif(trim(p_note),''),'Platform owner promoted sealed Tier-0 authoritative identity'),
        promoted_at=now(),promoted_by=v_uid
  where source_record_id=p_source_record_id;

  return v_school;
end; $$;

revoke all on function public.hq_promote_authoritative_school_record(uuid,text) from public, anon;
grant execute on function public.hq_promote_authoritative_school_record(uuid,text) to authenticated;

comment on table public.school_identity_source_registry is 'Authority registry for school identity sources. canonical_identity_eligible requires Tier-0 authority.';
comment on table public.school_authoritative_source_records is 'Immutable row-level records from a staged Tier-0 school snapshot. Government identifiers are preserved in separate fields.';
comment on table public.school_authoritative_reconciliation is 'Deterministic classification evidence linking immutable Tier-0 source records to canonical school identity.';
comment on function public.hq_seal_authoritative_school_snapshot(uuid,text,integer) is 'Owner-only snapshot seal. Requires Tier-0 registry authority, artifact SHA-256, provenance and exact staged record count.';
comment on function public.hq_reconcile_authoritative_school_snapshot(uuid) is 'Owner-only deterministic Tier-0 reconciliation. Exact government identifiers may match; ambiguity and collisions fail closed to review.';
comment on function public.hq_promote_authoritative_school_record(uuid,text) is 'Owner-only promotion of a reconciled Tier-0 new_candidate. Creates pending dual-approval canonical identity and rechecks collisions at mutation time.';
