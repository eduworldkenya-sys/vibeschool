-- Final assembled lesson-package cache.
--
-- Safety invariant:
--   * ordinary teacher writes are always Scheme-scoped;
--   * global reuse is visible only after explicit package certification;
--   * publication/active status of a source is never sufficient for global reuse;
--   * exact source fingerprints and duration are part of every cache lookup.

create table if not exists public.lesson_package_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null,
  scheme_id uuid references public.scheme_of_work(id) on delete cascade,
  reuse_scope text not null default 'scheme'
    check (reuse_scope in ('scheme', 'global')),
  certification_status text not null default 'scheme_scoped'
    check (certification_status in ('scheme_scoped', 'certified')),
  duration_minutes integer not null check (duration_minutes > 0 and duration_minutes <= 600),
  source_fingerprint text not null,
  source_resource_ids uuid[] not null default '{}',
  source_resource_version_ids uuid[] not null default '{}',
  source_hashes text[] not null default '{}',
  source_provenance jsonb not null default '{}'::jsonb,
  sections jsonb not null,
  generation_mode text not null default 'deterministic'
    check (generation_mode in ('deterministic', 'ai_assisted')),
  certification_policy_version text,
  certified_at timestamptz,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (
      reuse_scope = 'scheme'
      and scheme_id is not null
      and certification_status = 'scheme_scoped'
      and certification_policy_version is null
      and certified_at is null
    )
    or
    (
      reuse_scope = 'global'
      and scheme_id is null
      and certification_status = 'certified'
      and certification_policy_version is not null
      and certified_at is not null
    )
  )
);

create unique index if not exists lesson_package_cache_exact_identity_uidx
  on public.lesson_package_cache (
    cache_key,
    source_fingerprint,
    duration_minutes,
    reuse_scope,
    coalesce(scheme_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists lesson_package_cache_scheme_idx
  on public.lesson_package_cache (scheme_id, updated_at desc)
  where reuse_scope = 'scheme';

create index if not exists lesson_package_cache_global_idx
  on public.lesson_package_cache (cache_key, source_fingerprint, duration_minutes)
  where reuse_scope = 'global' and certification_status = 'certified';

alter table public.lesson_package_cache enable row level security;

revoke all on public.lesson_package_cache from anon;
revoke all on public.lesson_package_cache from authenticated;
grant select, insert, update, delete on public.lesson_package_cache to authenticated;

-- Certified global packages are reusable by authenticated teachers. The row
-- constraint requires package-level certification metadata; source publication
-- alone can never satisfy this predicate.
drop policy if exists lesson_package_cache_select on public.lesson_package_cache;
create policy lesson_package_cache_select
  on public.lesson_package_cache
  for select
  to authenticated
  using (
    (
      reuse_scope = 'global'
      and certification_status = 'certified'
      and certification_policy_version is not null
      and certified_at is not null
    )
    or
    (
      reuse_scope = 'scheme'
      and scheme_id is not null
      and exists (
        select 1
        from public.scheme_of_work s
        where s.id = lesson_package_cache.scheme_id
          and s.teacher_id = auth.uid()
      )
    )
  );

-- Teachers may deposit only a package for their own Scheme row. They cannot
-- mark it certified or globally reusable through a normal authenticated write.
drop policy if exists lesson_package_cache_insert_scheme on public.lesson_package_cache;
create policy lesson_package_cache_insert_scheme
  on public.lesson_package_cache
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and reuse_scope = 'scheme'
    and certification_status = 'scheme_scoped'
    and certification_policy_version is null
    and certified_at is null
    and scheme_id is not null
    and exists (
      select 1
      from public.scheme_of_work s
      where s.id = lesson_package_cache.scheme_id
        and s.teacher_id = auth.uid()
    )
  );

drop policy if exists lesson_package_cache_update_scheme on public.lesson_package_cache;
create policy lesson_package_cache_update_scheme
  on public.lesson_package_cache
  for update
  to authenticated
  using (
    reuse_scope = 'scheme'
    and created_by = auth.uid()
    and scheme_id is not null
    and exists (
      select 1
      from public.scheme_of_work s
      where s.id = lesson_package_cache.scheme_id
        and s.teacher_id = auth.uid()
    )
  )
  with check (
    reuse_scope = 'scheme'
    and certification_status = 'scheme_scoped'
    and certification_policy_version is null
    and certified_at is null
    and created_by = auth.uid()
    and scheme_id is not null
    and exists (
      select 1
      from public.scheme_of_work s
      where s.id = lesson_package_cache.scheme_id
        and s.teacher_id = auth.uid()
    )
  );

drop policy if exists lesson_package_cache_delete_scheme on public.lesson_package_cache;
create policy lesson_package_cache_delete_scheme
  on public.lesson_package_cache
  for delete
  to authenticated
  using (
    reuse_scope = 'scheme'
    and created_by = auth.uid()
    and scheme_id is not null
    and exists (
      select 1
      from public.scheme_of_work s
      where s.id = lesson_package_cache.scheme_id
        and s.teacher_id = auth.uid()
    )
  );

-- Package promotion is deliberately service-role only. Certification copies a
-- Scheme-scoped package into a new context-free global row; it never mutates
-- the teacher's Scheme package into global authority.
create or replace function public.certify_lesson_package_cache(
  p_source_package_id uuid,
  p_global_cache_key text,
  p_policy_version text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.lesson_package_cache%rowtype;
  v_id uuid;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'lesson_package_certification_forbidden' using errcode = '42501';
  end if;

  if nullif(btrim(p_global_cache_key), '') is null
     or nullif(btrim(p_policy_version), '') is null then
    raise exception 'lesson_package_certification_metadata_required' using errcode = '22023';
  end if;

  select * into v_source
  from public.lesson_package_cache
  where id = p_source_package_id
    and reuse_scope = 'scheme'
    and certification_status = 'scheme_scoped';

  if not found then
    raise exception 'lesson_package_source_not_found' using errcode = 'P0002';
  end if;

  insert into public.lesson_package_cache (
    cache_key,
    scheme_id,
    reuse_scope,
    certification_status,
    duration_minutes,
    source_fingerprint,
    source_resource_ids,
    source_resource_version_ids,
    source_hashes,
    source_provenance,
    sections,
    generation_mode,
    certification_policy_version,
    certified_at,
    created_by
  ) values (
    p_global_cache_key,
    null,
    'global',
    'certified',
    v_source.duration_minutes,
    v_source.source_fingerprint,
    v_source.source_resource_ids,
    v_source.source_resource_version_ids,
    v_source.source_hashes,
    v_source.source_provenance || jsonb_build_object(
      'certified_from_scheme_package_id', v_source.id
    ),
    v_source.sections,
    v_source.generation_mode,
    btrim(p_policy_version),
    now(),
    v_source.created_by
  )
  on conflict (
    cache_key,
    source_fingerprint,
    duration_minutes,
    reuse_scope,
    (coalesce(scheme_id, '00000000-0000-0000-0000-000000000000'::uuid))
  ) do update set
    sections = excluded.sections,
    source_resource_ids = excluded.source_resource_ids,
    source_resource_version_ids = excluded.source_resource_version_ids,
    source_hashes = excluded.source_hashes,
    source_provenance = excluded.source_provenance,
    generation_mode = excluded.generation_mode,
    certification_policy_version = excluded.certification_policy_version,
    certified_at = excluded.certified_at,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.certify_lesson_package_cache(uuid, text, text) from public, anon, authenticated;
grant execute on function public.certify_lesson_package_cache(uuid, text, text) to service_role;

comment on table public.lesson_package_cache is
  'Exact assembled lesson packages. Scheme-scoped teacher cache is separated from package-certified global reuse.';
