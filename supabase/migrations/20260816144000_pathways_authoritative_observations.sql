-- Pathways authoritative observation layer.
-- Official source records land here before they are allowed to become canonical
-- Pathways facts. This mirrors the School Engine rule: observe -> match -> verify
-- -> publish, never source page -> silent canonical mutation.

begin;

create table public.pathway_source_observations (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.pathway_sources(id),
  observation_kind text not null check (observation_kind in ('pathway','track','subject_combination','career_link','school_offering')),
  external_record_id text not null,
  external_parent_id text,
  observed_label text not null,
  observed_payload jsonb not null default '{}'::jsonb,
  evidence_url text,
  observed_at timestamptz not null default now(),
  content_hash text not null,
  reconciliation_status text not null default 'pending' check (reconciliation_status in ('pending','matched','ambiguous','rejected','superseded')),
  canonical_pathway_id uuid references public.pathways(id),
  canonical_track_id uuid references public.pathway_tracks(id),
  canonical_combination_id uuid references public.pathway_subject_combinations(id),
  canonical_school_id uuid references public.schools(id),
  reconciled_at timestamptz,
  reconciliation_note text,
  created_at timestamptz not null default now(),
  unique(source_id,observation_kind,external_record_id,content_hash)
);
alter table public.pathway_source_observations enable row level security;
revoke all on table public.pathway_source_observations from public, anon, authenticated;
grant select, insert, update, delete on table public.pathway_source_observations to service_role;
-- authorization-test: source observations are internal evidence; no anon/authenticated access.

create index pathway_source_observations_pending_idx
on public.pathway_source_observations(reconciliation_status,observation_kind,observed_at desc);
create index pathway_source_observations_school_idx
on public.pathway_source_observations(canonical_school_id,reconciliation_status)
where canonical_school_id is not null;
create index pathway_source_observations_combination_idx
on public.pathway_source_observations(canonical_combination_id,reconciliation_status)
where canonical_combination_id is not null;

create or replace function public.pathways_ingest_source_observation(
  p_source_id uuid,
  p_observation_kind text,
  p_external_record_id text,
  p_external_parent_id text,
  p_observed_label text,
  p_observed_payload jsonb,
  p_evidence_url text,
  p_observed_at timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_id uuid;
  v_hash text;
begin
  -- This function is service-only by grant. Validate again at the data boundary.
  if p_source_id is null or not exists (
    select 1 from public.pathway_sources s where s.id=p_source_id and s.status='active'
  ) then raise exception 'active_pathway_source_required'; end if;
  if p_observation_kind not in ('pathway','track','subject_combination','career_link','school_offering') then raise exception 'invalid_observation_kind'; end if;
  if p_external_record_id is null or length(trim(p_external_record_id))=0 or length(p_external_record_id)>500 then raise exception 'invalid_external_record_id'; end if;
  if p_observed_label is null or length(trim(p_observed_label))=0 or length(p_observed_label)>1000 then raise exception 'invalid_observed_label'; end if;
  if pg_column_size(coalesce(p_observed_payload,'{}'::jsonb))>262144 then raise exception 'observation_payload_too_large'; end if;

  v_hash := encode(digest(convert_to(jsonb_build_object(
    'kind',p_observation_kind,
    'external_record_id',trim(p_external_record_id),
    'external_parent_id',nullif(trim(coalesce(p_external_parent_id,'')),''),
    'label',trim(p_observed_label),
    'payload',coalesce(p_observed_payload,'{}'::jsonb),
    'evidence_url',nullif(trim(coalesce(p_evidence_url,'')),'')
  )::text,'UTF8'),'sha256'),'hex');

  insert into public.pathway_source_observations(
    source_id,observation_kind,external_record_id,external_parent_id,observed_label,
    observed_payload,evidence_url,observed_at,content_hash
  ) values (
    p_source_id,p_observation_kind,trim(p_external_record_id),nullif(trim(coalesce(p_external_parent_id,'')),''),trim(p_observed_label),
    coalesce(p_observed_payload,'{}'::jsonb),nullif(trim(coalesce(p_evidence_url,'')),''),coalesce(p_observed_at,now()),v_hash
  ) on conflict (source_id,observation_kind,external_record_id,content_hash)
    do update set observed_at=greatest(public.pathway_source_observations.observed_at,excluded.observed_at)
  returning id into v_id;

  return v_id;
end;
$function$;
revoke all on function public.pathways_ingest_source_observation(uuid,text,text,text,text,jsonb,text,timestamptz) from public, anon, authenticated;
grant execute on function public.pathways_ingest_source_observation(uuid,text,text,text,text,jsonb,text,timestamptz) to service_role;

-- Promotion from observation to a verified school offering is intentionally not
-- automated here. It requires a matched canonical school, matched canonical
-- combination/pathway, active source evidence and explicit reconciliation.

commit;
