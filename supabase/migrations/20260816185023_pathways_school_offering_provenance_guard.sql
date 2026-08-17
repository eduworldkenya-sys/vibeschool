alter table public.pathway_school_offerings
  add constraint pathway_school_offerings_verified_requires_observation
  check (verification_state <> 'verified' or source_observation_id is not null) not valid;
alter table public.pathway_school_offerings validate constraint pathway_school_offerings_verified_requires_observation;

create or replace function public.pathways_validate_school_offering_provenance()
returns trigger language plpgsql security definer set search_path=public,extensions as $$
declare
  v_obs public.pathway_source_observations%rowtype;
  v_pathway public.pathways%rowtype;
  v_track public.pathway_tracks%rowtype;
  v_combo public.pathway_subject_combinations%rowtype;
begin
  if new.verification_state='verified' and new.source_observation_id is null then raise exception 'PATHWAY_VERIFIED_OFFERING_REQUIRES_SOURCE_OBSERVATION'; end if;
  if new.source_observation_id is null then return new; end if;
  select * into v_obs from public.pathway_source_observations where id=new.source_observation_id;
  if not found then raise exception 'PATHWAY_OFFERING_SOURCE_OBSERVATION_NOT_FOUND'; end if;
  if v_obs.entity_kind<>'school_offering' then raise exception 'PATHWAY_OFFERING_SOURCE_WRONG_KIND'; end if;
  if v_obs.resolution_state<>'resolved' or v_obs.resolved_entity_id is null then raise exception 'PATHWAY_OFFERING_SOURCE_NOT_RESOLVED'; end if;
  if v_obs.resolved_entity_id<>new.school_id then raise exception 'PATHWAY_OFFERING_SCHOOL_PROVENANCE_MISMATCH'; end if;
  if v_obs.source_id<>new.source_id then raise exception 'PATHWAY_OFFERING_SOURCE_PROVENANCE_MISMATCH'; end if;
  select * into v_pathway from public.pathways where id=new.pathway_id;
  if not found or v_pathway.verification_state<>'verified' or v_pathway.status<>'published' then raise exception 'PATHWAY_OFFERING_PATHWAY_NOT_VERIFIED'; end if;
  if lower(trim(coalesce(v_obs.observed_payload->>'pathway','')))<>lower(trim(v_pathway.name)) then raise exception 'PATHWAY_OFFERING_PATHWAY_PROVENANCE_MISMATCH'; end if;
  if new.track_id is not null then
    select * into v_track from public.pathway_tracks where id=new.track_id;
    if not found or v_track.pathway_id<>new.pathway_id or v_track.verification_state<>'verified' or v_track.status<>'published' then raise exception 'PATHWAY_OFFERING_TRACK_NOT_VERIFIED'; end if;
    if lower(trim(coalesce(v_obs.observed_payload->>'track','')))<>lower(trim(v_track.name)) then raise exception 'PATHWAY_OFFERING_TRACK_PROVENANCE_MISMATCH'; end if;
  end if;
  if new.combination_id is not null then
    select * into v_combo from public.pathway_subject_combinations where id=new.combination_id;
    if not found or v_combo.pathway_id<>new.pathway_id or (new.track_id is not null and v_combo.track_id<>new.track_id) or v_combo.verification_state<>'verified' or v_combo.status<>'published' then raise exception 'PATHWAY_OFFERING_COMBINATION_NOT_VERIFIED'; end if;
    if lower(trim(coalesce(v_obs.observed_payload->>'combination','')))<>lower(trim(v_combo.display_name)) then raise exception 'PATHWAY_OFFERING_COMBINATION_PROVENANCE_MISMATCH'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_pathway_school_offerings_validate_provenance on public.pathway_school_offerings;
create trigger trg_pathway_school_offerings_validate_provenance before insert or update on public.pathway_school_offerings for each row execute function public.pathways_validate_school_offering_provenance();
revoke all on function public.pathways_validate_school_offering_provenance() from public,anon,authenticated;
