-- Align the canonical school-offering projector with the provenance trigger.
create or replace function public.hq_verify_pathway_school_offering(p_observation_id uuid,p_school_id uuid,p_pathway_id uuid,p_track_id uuid default null,p_combination_id uuid default null,p_effective_from date default null,p_effective_to date default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare caller uuid:=auth.uid(); obs public.pathway_source_observations%rowtype; offering_id uuid;
begin
  if caller is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
  select * into obs from public.pathway_source_observations where id=p_observation_id for update;
  if not found or obs.entity_kind<>'school_offering' then raise exception 'school_offering_observation_required'; end if;
  if obs.resolution_state<>'resolved' or obs.resolved_entity_id is null then raise exception 'resolved_school_observation_required'; end if;
  if obs.resolved_entity_id<>p_school_id then raise exception 'school_observation_mismatch'; end if;
  if not exists(select 1 from public.schools where id=p_school_id and deleted_at is null and status='active') then raise exception 'canonical_school_required'; end if;
  if not exists(select 1 from public.pathways where id=p_pathway_id and status='published' and verification_state='verified') then raise exception 'verified_pathway_required'; end if;
  if p_track_id is not null and not exists(select 1 from public.pathway_tracks where id=p_track_id and pathway_id=p_pathway_id and status='published' and verification_state='verified') then raise exception 'verified_track_required'; end if;
  if p_combination_id is not null and not exists(select 1 from public.pathway_subject_combinations where id=p_combination_id and pathway_id=p_pathway_id and (p_track_id is null or track_id=p_track_id) and status='published' and verification_state='verified') then raise exception 'verified_combination_required'; end if;
  if p_effective_to is not null and p_effective_from is not null and p_effective_to<p_effective_from then raise exception 'invalid_effective_window'; end if;
  insert into public.pathway_school_offerings(school_id,pathway_id,track_id,combination_id,source_id,source_observation_id,verification_state,observed_at,verified_at,effective_from,effective_to)
  values(p_school_id,p_pathway_id,p_track_id,p_combination_id,obs.source_id,obs.id,'verified',obs.observed_at,now(),p_effective_from,p_effective_to)
  on conflict(source_observation_id) where source_observation_id is not null do update set school_id=excluded.school_id,pathway_id=excluded.pathway_id,track_id=excluded.track_id,combination_id=excluded.combination_id,source_id=excluded.source_id,verification_state='verified',observed_at=excluded.observed_at,verified_at=now(),effective_from=excluded.effective_from,effective_to=excluded.effective_to,updated_at=now()
  returning id into offering_id;
  return jsonb_build_object('ok',true,'offering_id',offering_id,'observation_id',obs.id,'school_id',p_school_id,'verification_state','verified');
end
$$;
revoke all on function public.hq_verify_pathway_school_offering(uuid,uuid,uuid,uuid,uuid,date,date) from public,anon;
grant execute on function public.hq_verify_pathway_school_offering(uuid,uuid,uuid,uuid,uuid,date,date) to authenticated;
