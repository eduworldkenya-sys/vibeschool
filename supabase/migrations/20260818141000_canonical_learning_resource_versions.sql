-- R3.2 Canonical Learning Assets
-- Stable root: public.learning_resources
-- Exact immutable certified payloads: public.learning_resource_versions
--
-- Additive only. Existing learning_resources remain legacy/unclassified until
-- explicitly promoted through the governed Content Factory path.

begin;

alter table public.learning_resources
  add column if not exists asset_kind text,
  add column if not exists purpose text,
  add column if not exists identity_key_version integer,
  add column if not exists language_code text,
  add column if not exists material_variant text;

alter table public.learning_resources
  drop constraint if exists learning_resources_asset_kind_check,
  add constraint learning_resources_asset_kind_check
    check (
      asset_kind is null
      or asset_kind = any (array[
        'lesson_plan'::text,
        'teacher_notes'::text,
        'learner_notes'::text,
        'homework'::text,
        'quiz'::text,
        'exercise'::text,
        'revision'::text,
        'worksheet'::text,
        'assessment'::text,
        'worked_example'::text,
        'project'::text,
        'practical'::text,
        'remedial'::text,
        'enrichment'::text,
        'marking_scheme'::text,
        'rubric'::text,
        'content_block'::text
      ])
    ),
  drop constraint if exists learning_resources_purpose_check,
  add constraint learning_resources_purpose_check
    check (
      purpose is null
      or purpose = any (array[
        'teach'::text,
        'practise'::text,
        'assess'::text,
        'revise'::text,
        'remediate'::text,
        'enrich'::text,
        'reference'::text
      ])
    ),
  drop constraint if exists learning_resources_identity_key_version_check,
  add constraint learning_resources_identity_key_version_check
    check (identity_key_version is null or identity_key_version > 0),
  drop constraint if exists learning_resources_language_code_nonempty,
  add constraint learning_resources_language_code_nonempty
    check (language_code is null or btrim(language_code) <> ''),
  drop constraint if exists learning_resources_material_variant_nonempty,
  add constraint learning_resources_material_variant_nonempty
    check (material_variant is null or btrim(material_variant) <> '');

create index if not exists learning_resources_asset_lookup_idx
  on public.learning_resources (
    identity_key_version,
    asset_kind,
    purpose,
    language_code
  )
  where identity_key_version is not null;

create table if not exists public.learning_resource_versions (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null
    references public.learning_resources(id) on delete restrict,
  version integer not null check (version > 0),
  previous_version_id uuid
    references public.learning_resource_versions(id) on delete restrict,
  lifecycle_status text not null default 'candidate'
    check (lifecycle_status = any (array[
      'candidate'::text,
      'verified'::text,
      'certified'::text,
      'retired'::text,
      'rejected'::text
    ])),
  payload_format text not null default 'json'
    check (btrim(payload_format) <> ''),
  payload jsonb not null,
  content_sha256 text not null
    check (content_sha256 ~ '^[0-9a-f]{64}$'),
  provenance jsonb not null default '{}'::jsonb
    check (jsonb_typeof(provenance) = 'object'),
  rights_status text not null default 'pending'
    check (rights_status = any (array[
      'pending'::text,
      'cleared'::text,
      'not_applicable'::text,
      'blocked'::text
    ])),
  certification_policy_version text,
  certification_evidence jsonb not null default '{}'::jsonb
    check (jsonb_typeof(certification_evidence) = 'object'),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  certified_at timestamptz,
  retired_at timestamptz,
  constraint learning_resource_versions_resource_version_unique
    unique (resource_id, version),
  constraint learning_resource_versions_previous_not_self
    check (previous_version_id is null or previous_version_id <> id),
  constraint learning_resource_versions_certified_contract
    check (
      lifecycle_status <> 'certified'
      or (
        certified_at is not null
        and certification_policy_version is not null
        and btrim(certification_policy_version) <> ''
        and rights_status = any (array['cleared'::text, 'not_applicable'::text])
        and certification_evidence <> '{}'::jsonb
      )
    ),
  constraint learning_resource_versions_retired_contract
    check (lifecycle_status <> 'retired' or retired_at is not null)
);

create unique index if not exists learning_resource_versions_one_certified_uidx
  on public.learning_resource_versions(resource_id)
  where lifecycle_status = 'certified';

create unique index if not exists learning_resource_versions_one_inflight_uidx
  on public.learning_resource_versions(resource_id)
  where lifecycle_status = any (array['candidate'::text, 'verified'::text]);

create index if not exists learning_resource_versions_resource_status_idx
  on public.learning_resource_versions(resource_id, lifecycle_status, version desc);

create or replace function public.cla_validate_resource_version_lineage()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_resource_id uuid;
  parent_version integer;
begin
  if new.previous_version_id is null then
    if new.version <> 1 then
      raise exception using
        errcode = '23514',
        message = 'CLA_VERSION_LINEAGE_INVALID',
        detail = 'Only version 1 may omit previous_version_id.';
    end if;
    return new;
  end if;

  select v.resource_id, v.version
    into parent_resource_id, parent_version
  from public.learning_resource_versions v
  where v.id = new.previous_version_id;

  if parent_resource_id is null then
    raise exception using
      errcode = '23503',
      message = 'CLA_PREVIOUS_VERSION_NOT_FOUND';
  end if;

  if parent_resource_id <> new.resource_id then
    raise exception using
      errcode = '23514',
      message = 'CLA_VERSION_LINEAGE_CROSS_RESOURCE';
  end if;

  if parent_version <> new.version - 1 then
    raise exception using
      errcode = '23514',
      message = 'CLA_VERSION_LINEAGE_NOT_SEQUENTIAL';
  end if;

  return new;
end;
$$;

revoke all on function public.cla_validate_resource_version_lineage() from public, anon, authenticated;

drop trigger if exists cla_validate_resource_version_lineage
  on public.learning_resource_versions;
create trigger cla_validate_resource_version_lineage
before insert or update of resource_id, version, previous_version_id
on public.learning_resource_versions
for each row
execute function public.cla_validate_resource_version_lineage();

create or replace function public.cla_guard_resource_version_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using
      errcode = '42501',
      message = 'CLA_VERSION_DELETE_FORBIDDEN',
      detail = 'Canonical learning resource versions are retired or rejected, never deleted.';
  end if;

  if old.lifecycle_status = 'certified' then
    if new.lifecycle_status = 'retired'
       and new.retired_at is not null
       and new.id = old.id
       and new.resource_id = old.resource_id
       and new.version = old.version
       and new.previous_version_id is not distinct from old.previous_version_id
       and new.payload_format = old.payload_format
       and new.payload = old.payload
       and new.content_sha256 = old.content_sha256
       and new.provenance = old.provenance
       and new.rights_status = old.rightights_status
       and new.certification_policy_version is not distinct from old.certification_policy_version
       and new.certification_evidence = old.certification_evidence
       and new.created_by is not distinct from old.created_by
       and new.created_at = old.created_at
       and new.verified_at is not distinct from old.verified_at
       and new.certified_at is not distinct from old.certified_at
    then
      return new;
    end if;

    raise exception using
      errcode = '42501',
      message = 'CLA_CERTIFIED_VERSION_IMMUTABLE',
      detail = 'Certified payload/evidence is immutable. Create a new version or retire this version.';
  end if;

  if old.lifecycle_status = 'retired' then
    raise exception using
      errcode = '42501',
      message = 'CLA_RETIRED_VERSION_IMMUTABLE';
  end if;

  return new;
end;
$$;

revoke all on function public.cla_guard_resource_version_mutation() from public, anon, authenticated;

drop trigger if exists cla_guard_resource_version_mutation
  on public.learning_resource_versions;
create trigger cla_guard_resource_version_mutation
before update or delete
on public.learning_resource_versions
for each row
execute function public.cla_guard_resource_version_mutation();

alter table public.learning_resource_versions enable row level security;

revoke all on table public.learning_resource_versions from anon, authenticated;
revoke delete on table public.learning_resource_versions from service_role;
grant select, insert, update on table public.learning_resource_versions to service_role;
grant select on table public.learning_resource_versions to authenticated;

drop policy if exists learning_resource_versions_read_visible_parent
  on public.learning_resource_versions;
create policy learning_resource_versions_read_visible_parent
  on public.learning_resource_versions
  for select
  to authenticated
  using (public.fn_learning_resource_visible(resource_id));

alter table public.teaching_resource_links
  add column if not exists resource_version_id uuid
    references public.learning_resource_versions(id) on delete restrict;

create index if not exists teaching_resource_links_resource_version_idx
  on public.teaching_resource_links(resource_version_id)
  where resource_version_id is not null;

create or replace function public.cla_validate_teaching_resource_version_pin()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  pinned_resource_id uuid;
begin
  if new.resource_version_id is null then
    return new;
  end if;

  select v.resource_id
    into pinned_resource_id
  from public.learning_resource_versions v
  where v.id = new.resource_version_id;

  if pinned_resource_id is null then
    raise exception using
      errcode = '23503',
      message = 'CLA_RESOURCE_VERSION_PIN_NOT_FOUND';
  end if;

  if pinned_resource_id <> new.resource_id then
    raise exception using
      errcode = '23514',
      message = 'CLA_RESOURCE_VERSION_PIN_MISMATCH';
  end if;

  return new;
end;
$$;

revoke all on function public.cla_validate_teaching_resource_version_pin() from public, anon, authenticated;

drop trigger if exists cla_validate_teaching_resource_version_pin
  on public.teaching_resource_links;
create trigger cla_validate_teaching_resource_version_pin
before insert or update of resource_id, resource_version_id
on public.teaching_resource_links
for each row
execute function public.cla_validate_teaching_resource_version_pin();

create or replace function public.cla_get_certified_learning_resource(
  p_family_key text
)
returns table (
  resource_id uuid,
  resource_version_id uuid,
  version integer,
  family_key text,
  asset_kind text,
  purpose text,
  payload_format text,
  payload jsonb,
  content_sha256 text,
  certification_policy_version text,
  certified_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    r.id,
    v.id,
    v.version,
    r.canonical_key,
    r.asset_kind,
    r.purpose,
    v.payload_format,
    v.payload,
    v.content_sha256,
    v.certification_policy_version,
    v.certified_at
  from public.learning_resources r
  join public.learning_resource_versions v
    on v.resource_id = r.id
   and v.lifecycle_status = 'certified'
  where r.canonical_key = p_family_key
    and r.status = 'active'
    and public.fn_learning_resource_visible(r.id)
  limit 1;
$$;

revoke all on function public.cla_get_certified_learning_resource(text) from public, anon;
grant execute on function public.cla_get_certified_learning_resource(text) to authenticated, service_role;

comment on table public.learning_resource_versions is
  'Immutable exact versions of reusable canonical learning resources. Candidate/verified rows are not globally reusable; only certified rows are selected by canonical lookup.';

comment on column public.learning_resources.asset_kind is
  'Educational artifact kind. Separate from source_type, which records provenance/origin.';
comment on column public.learning_resources.identity_key_version is
  'Version of the deterministic canonical family-key algorithm used for this resource root.';
comment on column public.teaching_resource_links.resource_version_id is
  'Exact canonical resource version used by this teaching occurrence/link. Nullable during legacy transition.';

commit;
