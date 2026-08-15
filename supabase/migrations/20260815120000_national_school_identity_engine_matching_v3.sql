-- National School Identity Engine: matching, coverage, ingestion and gap controls.
-- Safe to re-run: indexes/functions/view are idempotent; writes remain owner-gated.

create index if not exists schools_identity_name_trgm_idx
  on public.schools using gin (name_normalized gin_trgm_ops)
  where deleted_at is null;

create index if not exists schools_identity_county_name_idx
  on public.schools (county, sub_county, name_normalized)
  where deleted_at is null;

create index if not exists schools_directory_name_trgm_idx
  on public.schools_directory using gin (public.normalize_school_identity_name(name) gin_trgm_ops);

create index if not exists schools_directory_location_name_idx
  on public.schools_directory (county, sub_county, name);

create unique index if not exists schools_active_knec_unique_idx
  on public.schools(knec_code)
  where deleted_at is null and knec_code is not null;

create table if not exists public.school_identity_coverage_runs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  snapshot_label text,
  snapshot_at timestamptz not null default now(),
  source_record_count integer not null default 0,
  matched_count integer not null default 0,
  unmatched_count integer not null default 0,
  conflict_count integer not null default 0,
  duplicate_count integer not null default 0,
  status text not null default 'planned',
  methodology text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists school_identity_coverage_runs_source_idx
  on public.school_identity_coverage_runs(source_name, snapshot_at desc);

alter table public.school_identity_coverage_runs enable row level security;
revoke all on public.school_identity_coverage_runs from anon, authenticated;
drop policy if exists school_identity_coverage_owner_select on public.school_identity_coverage_runs;
create policy school_identity_coverage_owner_select
  on public.school_identity_coverage_runs for select to authenticated
  using (public.is_platform_owner());

create or replace function public.canonical_school_name_is_ambiguous(p_school_id uuid)
returns boolean
language sql stable security invoker set search_path=public
as $$
  select count(*) > 1
  from public.schools s
  where s.deleted_at is null
    and public.normalize_school_identity_name(s.name) =
        public.normalize_school_identity_name((select name from public.schools where id=p_school_id));
$$;

create or replace function public.school_identity_match_allowed(p_candidate_id uuid, p_canonical_school_id uuid)
returns boolean
language plpgsql stable security invoker set search_path=public
as $$
declare c record; s record; v_name_matches integer;
begin
  select d.name,d.county,d.sub_county,d.knec_code into c
  from public.school_identity_candidates ic
  join public.schools_directory d on d.id=ic.directory_school_id
  where ic.id=p_candidate_id;

  select name,county,sub_county,knec_code into s
  from public.schools where id=p_canonical_school_id and deleted_at is null;

  if not found or c is null then return false; end if;
  if c.knec_code is not null and s.knec_code is not null and c.knec_code=s.knec_code then return true; end if;

  select count(*) into v_name_matches
  from public.schools x
  where x.deleted_at is null
    and public.normalize_school_identity_name(x.name)=public.normalize_school_identity_name(s.name);

  if v_name_matches > 1 then
    return c.county is not null and s.county is not null
      and lower(c.county)=lower(s.county)
      and (c.sub_county is null or s.sub_county is null or lower(c.sub_county)=lower(s.sub_county));
  end if;

  return public.normalize_school_identity_name(c.name)=public.normalize_school_identity_name(s.name);
end;
$$;

create or replace function public.hq_score_pending_school_identity_candidates(p_limit integer default 500)
returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp
as $$
declare v_uid uuid:=auth.uid(); v_limit integer:=greatest(1,least(coalesce(p_limit,500),5000)); v_candidates integer:=0; v_evidence integer:=0; r record; m record; v_score numeric;
begin
  if v_uid is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
  for r in select c.id candidate_id,d.name,d.county,d.sub_county,d.latitude,d.longitude
    from public.school_identity_candidates c join public.schools_directory d on d.id=c.directory_school_id
    where c.status='pending' order by c.created_at limit v_limit loop
    v_candidates:=v_candidates+1;
    for m in select s.id school_id,s.name,s.county,s.sub_county,s.gps_lat,s.gps_lng,
      similarity(public.normalize_school_identity_name(r.name),coalesce(s.name_normalized,public.normalize_school_identity_name(s.name))) name_similarity,
      case when r.county is not null and s.county is not null and lower(r.county)=lower(s.county) then 1 else 0 end county_match,
      case when r.sub_county is not null and s.sub_county is not null and lower(r.sub_county)=lower(s.sub_county) then 1 else 0 end subcounty_match,
      case when r.latitude is not null and r.longitude is not null and s.gps_lat is not null and s.gps_lng is not null and abs(r.latitude-s.gps_lat)<=0.02 and abs(r.longitude-s.gps_lng)<=0.02 then 1 else 0 end geo_match
      from public.schools s where s.deleted_at is null
      order by similarity(public.normalize_school_identity_name(r.name),coalesce(s.name_normalized,public.normalize_school_identity_name(s.name))) desc limit 3 loop
      v_score:=least(1,0.65*m.name_similarity+0.15*m.county_match+0.10*m.subcounty_match+0.10*m.geo_match);
      if v_score>=0.70 then
        insert into public.school_identity_match_evidence(candidate_id,canonical_school_id,match_method,score,evidence)
        values(r.candidate_id,m.school_id,'composite_name_location',v_score,
          jsonb_build_object('name_similarity',m.name_similarity,'county_match',m.county_match,'subcounty_match',m.subcounty_match,'geo_match',m.geo_match,'threshold','candidate_review'));
        v_evidence:=v_evidence+1;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('candidates_scored',v_candidates,'evidence_rows_created',v_evidence);
end;
$$;
revoke all on function public.hq_score_pending_school_identity_candidates(integer) from public;
grant execute on function public.hq_score_pending_school_identity_candidates(integer) to authenticated;

create or replace view public.school_identity_gap_report as
select coalesce(nullif(trim(d.county),''),'Unknown') county,
       coalesce(nullif(lower(trim(d.type)),''),'unknown') school_level,
       count(*) filter(where c.status='pending') pending_candidates,
       count(*) filter(where c.status='pending' and nullif(trim(d.knec_code),'') is not null) pending_with_knec,
       count(*) filter(where c.status='matched') reconciled_candidates,
       count(*) filter(where c.status='review') review_candidates
from public.school_identity_candidates c
join public.schools_directory d on d.id=c.directory_school_id
group by 1,2;
alter view public.school_identity_gap_report set (security_invoker=true);
revoke all on public.school_identity_gap_report from anon,authenticated;
grant select on public.school_identity_gap_report to authenticated;

create or replace function public.get_school_identity_gap_summary()
returns jsonb language sql stable security invoker set search_path=public
as $$
select jsonb_build_object(
 'canonical_active',(select count(*) from public.schools where deleted_at is null),
 'directory_records',(select count(*) from public.schools_directory),
 'pending_candidates',(select count(*) from public.school_identity_candidates where status='pending'),
 'matched_candidates',(select count(*) from public.school_identity_candidates where status='matched'),
 'review_candidates',(select count(*) from public.school_identity_candidates where status='review'),
 'pending_with_knec',(select count(*) from public.school_identity_candidates c join public.schools_directory d on d.id=c.directory_school_id where c.status='pending' and nullif(trim(d.knec_code),'') is not null),
 'duplicate_canonical_name_groups',(select count(*) from (select public.normalize_school_identity_name(name) n from public.schools where deleted_at is null group by 1 having count(*)>1) q)
);
$$;
revoke all on function public.get_school_identity_gap_summary() from public;
grant execute on function public.get_school_identity_gap_summary() to authenticated;

create or replace function public.hq_stage_school_directory_batch(p_source_name text,p_source_url text,p_source_version text,p_checksum text,p_records jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp
as $$
declare v_uid uuid:=auth.uid(); v_batch uuid; v_count integer:=0; v_item jsonb; v_name text; v_knec text;
begin
  if v_uid is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
  if not exists(select 1 from public.school_directory_source_registry where source_name=p_source_name and active=true) then raise exception 'unknown_or_inactive_source'; end if;
  if jsonb_typeof(p_records)<>'array' then raise exception 'records_must_be_json_array'; end if;
  insert into public.school_directory_ingest_batches(source_name,source_url,source_version,source_observed_at,record_count,checksum,status,created_by,metadata)
  values(p_source_name,p_source_url,p_source_version,now(),jsonb_array_length(p_records),p_checksum,'staged',v_uid,jsonb_build_object('engine','national_school_identity_engine'))
  returning id into v_batch;
  for v_item in select value from jsonb_array_elements(p_records) loop
    v_name:=nullif(trim(v_item->>'name'),''); v_knec:=nullif(trim(v_item->>'knec_code'),'');
    if v_name is null then continue; end if;
    insert into public.schools_directory(id,name,county,sub_county,type,status,latitude,longitude,is_verified,ingest_batch_id,knec_code)
    values(gen_random_uuid(),v_name,nullif(trim(v_item->>'county'),''),nullif(trim(v_item->>'sub_county'),''),nullif(trim(v_item->>'type'),''),'active',nullif(v_item->>'latitude','')::numeric,nullif(v_item->>'longitude','')::numeric,false,v_batch,v_knec);
    v_count:=v_count+1;
  end loop;
  update public.school_directory_ingest_batches set record_count=v_count where id=v_batch;
  return jsonb_build_object('batch_id',v_batch,'source_name',p_source_name,'staged_records',v_count,'status','staged');
end;
$$;
revoke all on function public.hq_stage_school_directory_batch(text,text,text,text,jsonb) from public;
grant execute on function public.hq_stage_school_directory_batch(text,text,text,text,jsonb) to authenticated;
