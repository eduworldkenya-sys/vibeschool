-- School Engine: join sealed Tier-0 evidence back to the discovery identity corpus.
--
-- Invariant: authoritative reconciliation must not create a parallel discovery
-- identity when an existing directory candidate represents the same government
-- institution. Exact government identifiers may establish the link; name/location
-- evidence is review-only. Canonical mutation remains owner-gated through the
-- existing authoritative promotion gateway.
--
-- Access: owner-read/function-write public.school_authoritative_discovery_links
-- Authorization-test: public.school_authoritative_discovery_links authenticated non-owner SELECT -> zero rows; direct client INSERT/UPDATE/DELETE -> denied; platform owner SELECT -> allowed; writes occur only through the owner-gated reconciliation function or service-role trigger path.

create table if not exists public.school_authoritative_discovery_links (
  source_observation_id uuid not null references public.school_directory_source_observations(id) on delete restrict,
  candidate_id uuid not null references public.school_identity_candidates(id) on delete restrict,
  classification text not null check (classification in ('exact_identifier','review','conflict')),
  match_method text not null,
  evidence jsonb not null default '{}'::jsonb,
  reconciled_at timestamptz not null default now(),
  reconciled_by uuid references public.profiles(id),
  primary key (source_observation_id,candidate_id)
);

create index if not exists school_authoritative_discovery_links_candidate_idx
  on public.school_authoritative_discovery_links(candidate_id,classification);

alter table public.school_authoritative_discovery_links enable row level security;
revoke all on public.school_authoritative_discovery_links from anon,authenticated;
grant select on public.school_authoritative_discovery_links to authenticated;
grant all on public.school_authoritative_discovery_links to service_role;

drop policy if exists school_authoritative_discovery_links_owner_select
  on public.school_authoritative_discovery_links;
create policy school_authoritative_discovery_links_owner_select
  on public.school_authoritative_discovery_links for select to authenticated
  using (public.is_platform_owner());

create or replace function public.hq_reconcile_authoritative_discovery_snapshot(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  v_uid uuid:=auth.uid();
  b record;
  o record;
  d record;
  v_name text;
  v_knec text;
  v_county text;
  v_sub_county text;
  v_exact_count integer;
  v_review_count integer;
  v_exact integer:=0;
  v_review integer:=0;
  v_conflict integer:=0;
  v_unlinked integer:=0;
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

  delete from public.school_authoritative_discovery_links l
  using public.school_directory_source_observations x
  where l.source_observation_id=x.id and x.ingest_batch_id=p_batch_id;

  for o in select * from public.school_directory_source_observations where ingest_batch_id=p_batch_id order by id loop
    v_name:=coalesce(nullif(trim(o.raw_record->>'name'),''),nullif(trim(o.raw_record->>'official_name'),''));
    v_knec:=nullif(trim(o.raw_record->>'knec_code'),'');
    v_county:=nullif(trim(o.raw_record->>'county'),'');
    v_sub_county:=coalesce(nullif(trim(o.raw_record->>'sub_county'),''),nullif(trim(o.raw_record->>'subcounty'),''));

    -- Exclude the directory identity created by this same authoritative observation.
    select count(*) into v_exact_count
    from public.school_identity_candidates c
    join public.schools_directory sd on sd.id=c.directory_school_id
    where c.status in ('pending','new')
      and sd.id<>o.directory_school_id
      and v_knec is not null
      and nullif(trim(sd.knec_code),'')=v_knec;

    if v_exact_count=1 then
      select c.id candidate_id,sd.id directory_school_id into d
      from public.school_identity_candidates c
      join public.schools_directory sd on sd.id=c.directory_school_id
      where c.status in ('pending','new') and sd.id<>o.directory_school_id
        and nullif(trim(sd.knec_code),'')=v_knec
      limit 1;
      insert into public.school_authoritative_discovery_links(
        source_observation_id,candidate_id,classification,match_method,evidence,reconciled_by
      ) values(
        o.id,d.candidate_id,'exact_identifier','exact_knec',
        jsonb_build_object('knec_code',v_knec,'directory_school_id',d.directory_school_id,'authoritative_directory_school_id',o.directory_school_id),v_uid
      );
      v_exact:=v_exact+1;
    elsif v_exact_count>1 then
      for d in
        select c.id candidate_id,sd.id directory_school_id
        from public.school_identity_candidates c join public.schools_directory sd on sd.id=c.directory_school_id
        where c.status in ('pending','new') and sd.id<>o.directory_school_id
          and nullif(trim(sd.knec_code),'')=v_knec
      loop
        insert into public.school_authoritative_discovery_links(
          source_observation_id,candidate_id,classification,match_method,evidence,reconciled_by
        ) values(o.id,d.candidate_id,'conflict','duplicate_discovery_knec',
          jsonb_build_object('knec_code',v_knec,'directory_school_id',d.directory_school_id),v_uid);
      end loop;
      v_conflict:=v_conflict+1;
    else
      select count(*) into v_review_count
      from public.school_identity_candidates c
      join public.schools_directory sd on sd.id=c.directory_school_id
      where c.status in ('pending','new') and sd.id<>o.directory_school_id
        and v_name is not null
        and public.normalize_school_identity_name(sd.name)=public.normalize_school_identity_name(v_name)
        and (v_county is null or sd.county is null or lower(trim(sd.county))=lower(trim(v_county)))
        and (v_sub_county is null or sd.sub_county is null or lower(trim(sd.sub_county))=lower(trim(v_sub_county)));

      if v_review_count>0 then
        for d in
          select c.id candidate_id,sd.id directory_school_id
          from public.school_identity_candidates c join public.schools_directory sd on sd.id=c.directory_school_id
          where c.status in ('pending','new') and sd.id<>o.directory_school_id
            and public.normalize_school_identity_name(sd.name)=public.normalize_school_identity_name(v_name)
            and (v_county is null or sd.county is null or lower(trim(sd.county))=lower(trim(v_county)))
            and (v_sub_county is null or sd.sub_county is null or lower(trim(sd.sub_county))=lower(trim(v_sub_county)))
        loop
          insert into public.school_authoritative_discovery_links(
            source_observation_id,candidate_id,classification,match_method,evidence,reconciled_by
          ) values(o.id,d.candidate_id,'review','name_location_review',
            jsonb_build_object('directory_school_id',d.directory_school_id,'name',v_name,'county',v_county,'sub_county',v_sub_county),v_uid);
        end loop;
        v_review:=v_review+1;
      else
        v_unlinked:=v_unlinked+1;
      end if;
    end if;
  end loop;

  return jsonb_build_object('batch_id',p_batch_id,'exact_identifier_links',v_exact,
    'review_records',v_review,'conflict_records',v_conflict,'unlinked_records',v_unlinked,
    'total',v_exact+v_review+v_conflict+v_unlinked);
end;
$$;

revoke all on function public.hq_reconcile_authoritative_discovery_snapshot(uuid) from public,anon;
grant execute on function public.hq_reconcile_authoritative_discovery_snapshot(uuid) to authenticated;

-- When the existing owner-only promotion gateway assigns a canonical school to a
-- Tier-0 reconciliation row, propagate only uniquely proven exact-identifier links.
create or replace function public.sync_authoritative_discovery_identity_after_promotion()
returns trigger
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  v_link_count integer;
  v_candidate uuid;
begin
  if new.canonical_school_id is null or new.canonical_school_id is not distinct from old.canonical_school_id then
    return new;
  end if;

  select count(*),min(candidate_id::text)::uuid into v_link_count,v_candidate
  from public.school_authoritative_discovery_links
  where source_observation_id=new.source_observation_id and classification='exact_identifier';

  if v_link_count=1 then
    update public.school_identity_candidates
    set canonical_school_id=new.canonical_school_id,
        status='matched',confidence=1,
        match_reason='sealed_tier0_exact_identifier',
        reviewed_by=new.promoted_by,reviewed_at=coalesce(new.promoted_at,now()),updated_at=now()
    where id=v_candidate and status in ('pending','new');

    update public.schools_directory sd
    set is_verified=true
    from public.school_identity_candidates c
    where c.id=v_candidate and sd.id=c.directory_school_id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_authoritative_discovery_identity_after_promotion() from public,anon,authenticated;
grant execute on function public.sync_authoritative_discovery_identity_after_promotion() to service_role;

drop trigger if exists trg_sync_authoritative_discovery_after_promotion on public.school_authoritative_reconciliation;
create trigger trg_sync_authoritative_discovery_after_promotion
after update of canonical_school_id on public.school_authoritative_reconciliation
for each row execute function public.sync_authoritative_discovery_identity_after_promotion();

comment on table public.school_authoritative_discovery_links is
  'Evidence bridge from sealed Tier-0 source observations to pre-existing discovery candidates. Exact identifiers may collapse identity after owner promotion; name/location remains review-only.';
comment on function public.hq_reconcile_authoritative_discovery_snapshot(uuid) is
  'Owner-only reconciliation of sealed Tier-0 observations against the existing discovery corpus. Exact KNEC is deterministic; duplicates conflict; name/location is review-only.';
