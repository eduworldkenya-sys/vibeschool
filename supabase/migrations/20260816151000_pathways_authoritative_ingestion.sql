-- Pathways authoritative ingestion control plane.
-- Separates raw official observations from verified product claims.

create or replace function public.hq_stage_pathway_observation(
  p_source_id uuid,
  p_external_key text,
  p_entity_kind text,
  p_payload jsonb,
  p_observed_at timestamptz,
  p_content_checksum text
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare caller uuid:=auth.uid(); observation_id uuid;
begin
  if caller is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
  if p_entity_kind not in ('pathway','track','subject_combination','career','school_offering') then raise exception 'invalid_entity_kind'; end if;
  if p_external_key is null or length(trim(p_external_key))<2 or length(p_external_key)>500 then raise exception 'invalid_external_key'; end if;
  if p_content_checksum is null or length(trim(p_content_checksum))<8 or length(p_content_checksum)>256 then raise exception 'invalid_checksum'; end if;
  if pg_column_size(coalesce(p_payload,'{}'::jsonb))>262144 then raise exception 'payload_too_large'; end if;
  if not exists(select 1 from public.pathway_sources where id=p_source_id and status='active' and source_kind in ('official_portal','official_document','professional_body','institution_verified')) then raise exception 'authoritative_source_required'; end if;

  insert into public.pathway_source_observations(source_id,external_key,entity_kind,observed_payload,observed_at,content_checksum,resolution_state)
  values(p_source_id,trim(p_external_key),p_entity_kind,coalesce(p_payload,'{}'::jsonb),coalesce(p_observed_at,now()),trim(p_content_checksum),'unresolved')
  on conflict(source_id,external_key,content_checksum) do update set observed_at=excluded.observed_at
  returning id into observation_id;

  return jsonb_build_object('ok',true,'observation_id',observation_id,'resolution_state','unresolved');
end $$;
revoke all on function public.hq_stage_pathway_observation(uuid,text,text,jsonb,timestamptz,text) from public,anon;
grant execute on function public.hq_stage_pathway_observation(uuid,text,text,jsonb,timestamptz,text) to authenticated;

create or replace function public.hq_verify_pathway_school_offering(
  p_observation_id uuid,
  p_school_id uuid,
  p_pathway_id uuid,
  p_track_id uuid default null,
  p_combination_id uuid default null,
  p_effective_from date default null,
  p_effective_to date default null
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare caller uuid:=auth.uid(); obs public.pathway_source_observations%rowtype; offering_id uuid;
begin
  if caller is null or not coalesce(public.is_platform_owner(),false) then raise exception 'owner_authorization_required'; end if;
  select * into obs from public.pathway_source_observations where id=p_observation_id for update;
  if not found or obs.entity_kind<>'school_offering' then raise exception 'school_offering_observation_required'; end if;
  if obs.resolution_state='disputed' or obs.resolution_state='retired' then raise exception 'observation_not_promotable'; end if;
  if not exists(select 1 from public.schools where id=p_school_id and deleted_at is null and status='active') then raise exception 'canonical_school_required'; end if;
  if not exists(select 1 from public.pathways where id=p_pathway_id and status='published' and verification_state='verified') then raise exception 'verified_pathway_required'; end if;
  if p_track_id is not null and not exists(select 1 from public.pathway_tracks where id=p_track_id and pathway_id=p_pathway_id and status='published' and verification_state='verified') then raise exception 'verified_track_required'; end if;
  if p_combination_id is not null and not exists(select 1 from public.pathway_subject_combinations where id=p_combination_id and pathway_id=p_pathway_id and status='published' and verification_state='verified') then raise exception 'verified_combination_required'; end if;
  if p_effective_to is not null and p_effective_from is not null and p_effective_to<p_effective_from then raise exception 'invalid_effective_window'; end if;

  insert into public.pathway_school_offerings(school_id,pathway_id,track_id,combination_id,source_id,verification_state,observed_at,verified_at,effective_from,effective_to)
  values(p_school_id,p_pathway_id,p_track_id,p_combination_id,obs.source_id,'verified',obs.observed_at,now(),p_effective_from,p_effective_to)
  on conflict(school_id,pathway_id,combination_id,source_id) do update set track_id=excluded.track_id,verification_state='verified',observed_at=excluded.observed_at,verified_at=now(),effective_from=excluded.effective_from,effective_to=excluded.effective_to,updated_at=now()
  returning id into offering_id;

  update public.pathway_source_observations set resolution_state='resolved',resolved_entity_id=offering_id where id=obs.id;
  return jsonb_build_object('ok',true,'offering_id',offering_id,'observation_id',obs.id,'verification_state','verified');
end $$;
revoke all on function public.hq_verify_pathway_school_offering(uuid,uuid,uuid,uuid,uuid,date,date) from public,anon;
grant execute on function public.hq_verify_pathway_school_offering(uuid,uuid,uuid,uuid,uuid,date,date) to authenticated;

-- Record the official high-level pathway evidence behind the seed claims.
insert into public.pathway_source_observations(source_id,external_key,entity_kind,observed_payload,observed_at,content_checksum,resolution_state,resolved_entity_id)
values
('bdb736d5-fc4f-4f42-aec8-7cda7f4b0091','official-pathway:stem','pathway',jsonb_build_object('name','STEM','source_scope','Grade 10 School & Pathway Selection System'),'2026-08-16T00:00:00Z','seed-official-pathway-stem-v1','resolved','34476b83-1aad-4f94-a958-c2996311079e'),
('bdb736d5-fc4f-4f42-aec8-7cda7f4b0091','official-pathway:social-sciences','pathway',jsonb_build_object('name','Social Sciences','source_scope','Grade 10 School & Pathway Selection System'),'2026-08-16T00:00:00Z','seed-official-pathway-social-v1','resolved','d9a19fd7-4f15-45de-9131-f0de50c376a0'),
('bdb736d5-fc4f-4f42-aec8-7cda7f4b0091','official-pathway:arts-and-sports-science','pathway',jsonb_build_object('name','Arts & Sports Science','source_scope','Grade 10 School & Pathway Selection System'),'2026-08-16T00:00:00Z','seed-official-pathway-arts-v1','resolved','74d3d667-e0a1-4b48-8904-31203208d139')
on conflict(source_id,external_key,content_checksum) do nothing;
