-- P0 authoritative school runtime repair.
--
-- Root cause: PostgreSQL has no min(uuid) aggregate. The certification functions
-- compiled successfully but failed only when reconciliation/promotion executed.
-- Use min(uuid::text)::uuid only as a deterministic representative row when the
-- accompanying count proves whether zero, one, or multiple identities matched.
-- No authority, grant, RLS, or promotion semantics are widened here.

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
    select count(distinct s.id),min(s.id::text)::uuid into v_match_count,v_school
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

  select count(*),min(s.id::text)::uuid into v_collision,v_school
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

-- Preserve the existing authenticated execute surface; both functions perform
-- their own platform-owner authorization and remain SECURITY DEFINER.
revoke all on function public.hq_reconcile_authoritative_school_snapshot(uuid) from public,anon;
grant execute on function public.hq_reconcile_authoritative_school_snapshot(uuid) to authenticated;
revoke all on function public.hq_promote_authoritative_school_record(uuid,text) from public,anon;
grant execute on function public.hq_promote_authoritative_school_record(uuid,text) to authenticated;
