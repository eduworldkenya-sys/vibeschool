-- P0.10 National School Identity Engine certification hardening.
--
-- Production predates the canonical coverage-run shape introduced by
-- 20260815120000_national_school_identity_engine_matching_v3.sql. Because that
-- migration used CREATE TABLE IF NOT EXISTS, an existing legacy table was not
-- upgraded. This migration reconciles both histories additively and
-- idempotently without destroying legacy evidence.
--
-- SECURITY DECLARATION: internal platform-owner evidence table. RLS remains
-- enabled; anon/authenticated receive no direct table access except the
-- existing owner-scoped SELECT policy. This migration does not widen authority.

alter table public.school_identity_coverage_runs
  add column if not exists snapshot_label text,
  add column if not exists snapshot_at timestamptz,
  add column if not exists matched_count integer,
  add column if not exists unmatched_count integer,
  add column if not exists duplicate_count integer,
  add column if not exists methodology text,
  add column if not exists metadata jsonb,
  add column if not exists completed_at timestamptz;

-- Reconcile legacy production columns only when they are present. Dynamic SQL
-- is intentional so the migration also succeeds on a clean database where the
-- v3 table already has only the canonical column names.
do $reconcile$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='school_identity_coverage_runs'
      and column_name='source_snapshot_at'
  ) then
    execute $sql$
      update public.school_identity_coverage_runs
      set snapshot_at = coalesce(snapshot_at, source_snapshot_at)
      where snapshot_at is null
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='school_identity_coverage_runs'
      and column_name='matched_canonical_count'
  ) then
    execute $sql$
      update public.school_identity_coverage_runs
      set matched_count = coalesce(matched_count, matched_canonical_count)
      where matched_count is null
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='school_identity_coverage_runs'
      and column_name='unmatched_record_count'
  ) then
    execute $sql$
      update public.school_identity_coverage_runs
      set unmatched_count = coalesce(unmatched_count, unmatched_record_count)
      where unmatched_count is null
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='school_identity_coverage_runs'
      and column_name='coverage_notes'
  ) then
    execute $sql$
      update public.school_identity_coverage_runs
      set methodology = coalesce(methodology, coverage_notes)
      where methodology is null
    $sql$;
  end if;
end
$reconcile$;

update public.school_identity_coverage_runs
set snapshot_at = coalesce(snapshot_at, created_at, now()),
    matched_count = coalesce(matched_count, 0),
    duplicate_count = coalesce(duplicate_count, 0),
    metadata = coalesce(metadata, '{}'::jsonb);

alter table public.school_identity_coverage_runs
  alter column snapshot_at set default now(),
  alter column snapshot_at set not null,
  alter column matched_count set default 0,
  alter column matched_count set not null,
  alter column duplicate_count set default 0,
  alter column duplicate_count set not null,
  alter column metadata set default '{}'::jsonb,
  alter column metadata set not null;

-- Unknown counts are meaningful while a run is only planned. Keep these
-- nullable consistently across upgraded and clean databases instead of
-- coercing "not measured yet" into the false measurement zero.
alter table public.school_identity_coverage_runs
  alter column source_record_count drop not null,
  alter column source_record_count drop default,
  alter column unmatched_count drop not null,
  alter column unmatched_count drop default;

-- Bounded, non-negative evidence. NOT VALID avoids blocking on unknown legacy
-- history; validation below is safe after the reconciliation update.
alter table public.school_identity_coverage_runs
  drop constraint if exists school_identity_coverage_nonnegative_counts;
alter table public.school_identity_coverage_runs
  add constraint school_identity_coverage_nonnegative_counts check (
    (source_record_count is null or source_record_count >= 0)
    and matched_count >= 0
    and (unmatched_count is null or unmatched_count >= 0)
    and conflict_count >= 0
    and duplicate_count >= 0
  ) not valid;
alter table public.school_identity_coverage_runs
  validate constraint school_identity_coverage_nonnegative_counts;

-- Reassert the security contract explicitly after schema reconciliation.
alter table public.school_identity_coverage_runs enable row level security;
revoke all on public.school_identity_coverage_runs from anon, authenticated;
drop policy if exists school_identity_coverage_owner_select on public.school_identity_coverage_runs;
create policy school_identity_coverage_owner_select
  on public.school_identity_coverage_runs
  for select
  to authenticated
  using (public.is_platform_owner());

comment on table public.school_identity_coverage_runs is
  'P0 internal school-identity coverage evidence. Direct client writes are forbidden; identity promotion remains separately owner-gated.';
comment on column public.school_identity_coverage_runs.source_record_count is
  'NULL means the planned source snapshot has not yet been counted; zero means a completed measurement observed zero records.';
comment on column public.school_identity_coverage_runs.unmatched_count is
  'NULL means unmatched coverage has not yet been measured.';
