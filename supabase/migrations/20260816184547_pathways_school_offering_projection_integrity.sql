alter table public.pathway_school_offerings
  add column if not exists source_observation_id uuid references public.pathway_source_observations(id);

create unique index if not exists uq_pathway_school_offerings_source_observation
  on public.pathway_school_offerings(source_observation_id)
  where source_observation_id is not null;

create unique index if not exists uq_pathway_school_offerings_canonical_claim
  on public.pathway_school_offerings(
    school_id, pathway_id,
    coalesce(track_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(combination_id, '00000000-0000-0000-0000-000000000000'::uuid),
    source_id,
    coalesce(effective_from, '0001-01-01'::date),
    coalesce(effective_to, '9999-12-31'::date)
  );

create or replace function public.pathways_project_verified_school_offering(p_observation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_obs public.pathway_source_observations%rowtype;
  v_school_id uuid; v_pathway_id uuid; v_track_id uuid; v_combination_id uuid; v_offering_id uuid;
  v_pathway_name text; v_track_name text; v_combination_name text;
begin
  select * into v_obs from public.pathway_source_observations where id=p_observation_id for update;
  if not found then raise exception 'PATHWAY_OBSERVATION_NOT_FOUND'; end if;
  if v_obs.entity_kind <> 'school_offering' then raise exception 'PATHWAY_OBSERVATION_WRONG_KIND'; end if;
  if v_obs.resolution_state <> 'resolved' or v_obs.resolved_entity_id is null then raise exception 'PATHWAY_OBSERVATION_NOT_RESOLVED'; end if;
  v_school_id := v_obs.resolved_entity_id;
  if not exists(select 1 from public.schools where id=v_school_id) then raise exception 'PATHWAY_OBSERVATION_RESOLVED_ENTITY_NOT_SCHOOL'; end if;
  v_pathway_name := nullif(trim(v_obs.observed_payload->>'pathway'),'');
  v_track_name := nullif(trim(v_obs.observed_payload->>'track'),'');
  v_combination_name := nullif(trim(v_obs.observed_payload->>'combination'),'');
  if v_pathway_name is null then raise exception 'PATHWAY_OBSERVATION_MISSING_PATHWAY'; end if;
  select id into v_pathway_id from public.pathways where lower(name)=lower(v_pathway_name) and verification_state='verified' and status='published' order by created_at limit 1;
  if v_pathway_id is null then raise exception 'PATHWAY_NOT_VERIFIED_OR_NOT_FOUND'; end if;
  if v_track_name is not null then
    select id into v_track_id from public.pathway_tracks where pathway_id=v_pathway_id and lower(name)=lower(v_track_name) and verification_state='verified' and status='published' order by created_at limit 1;
    if v_track_id is null then raise exception 'PATHWAY_TRACK_NOT_VERIFIED_OR_NOT_FOUND'; end if;
  end if;
  if v_combination_name is not null then
    select id into v_combination_id from public.pathway_subject_combinations where pathway_id=v_pathway_id and (v_track_id is null or track_id=v_track_id) and lower(display_name)=lower(v_combination_name) and verification_state='verified' and status='published' order by created_at limit 1;
    if v_combination_id is null then raise exception 'PATHWAY_COMBINATION_NOT_VERIFIED_OR_NOT_FOUND'; end if;
  end if;
  insert into public.pathway_school_offerings(school_id,pathway_id,track_id,combination_id,source_id,source_observation_id,verification_state,observed_at,verified_at,effective_from,effective_to)
  values(v_school_id,v_pathway_id,v_track_id,v_combination_id,v_obs.source_id,v_obs.id,'verified',v_obs.observed_at,now(),null,null)
  on conflict(source_observation_id) where source_observation_id is not null do update set
    school_id=excluded.school_id,pathway_id=excluded.pathway_id,track_id=excluded.track_id,combination_id=excluded.combination_id,source_id=excluded.source_id,verification_state='verified',observed_at=excluded.observed_at,verified_at=coalesce(public.pathway_school_offerings.verified_at,now()),updated_at=now()
  returning id into v_offering_id;
  return v_offering_id;
end;
$$;
revoke all on function public.pathways_project_verified_school_offering(uuid) from public, anon, authenticated;
grant execute on function public.pathways_project_verified_school_offering(uuid) to service_role;
