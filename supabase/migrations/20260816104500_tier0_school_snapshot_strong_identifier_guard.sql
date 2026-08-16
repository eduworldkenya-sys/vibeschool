-- P0 Tier-0 authoritative school snapshot seal guard.
--
-- The offline preparer rejects duplicate strong government identifiers across
-- KNEC, NEMIS/UIC, MoE registration and TSC. The database must enforce the same
-- invariant because staging/sealing functions are independent mutation
-- boundaries and must not rely on a client-side preparer having run.
--
-- This strengthens the existing ingest-batch immutability trigger. It does not
-- promote schools or alter any staged observation. It only rejects an unsafe
-- staged -> validated transition for an authoritative Tier-0 canonical source.

create or replace function public.guard_school_ingest_batch_seal()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_tier0_authoritative boolean := false;
  v_invalid_records integer := 0;
  v_duplicate_knec integer := 0;
  v_duplicate_nemis integer := 0;
  v_duplicate_moe integer := 0;
  v_duplicate_tsc integer := 0;
begin
  -- Preserve the existing immutability/status-regression contract for batches
  -- that have already been sealed.
  if old.status in ('validated','published') then
    if new.source_name is distinct from old.source_name
       or new.source_url is distinct from old.source_url
       or new.source_version is distinct from old.source_version
       or new.source_observed_at is distinct from old.source_observed_at
       or new.record_count is distinct from old.record_count
       or new.checksum is distinct from old.checksum
       or new.authority_basis is distinct from old.authority_basis
       or new.authority_certified_at is distinct from old.authority_certified_at
       or new.authority_certified_by is distinct from old.authority_certified_by then
      raise exception 'sealed_school_ingest_batch_immutable';
    end if;
    if new.status = 'staged' then
      raise exception 'sealed_school_ingest_batch_status_regression';
    end if;
  end if;

  -- Validate only the seal boundary. Non-authoritative discovery imports keep
  -- their existing lifecycle and cannot acquire Tier-0 authority through this
  -- trigger.
  if old.status = 'staged' and new.status = 'validated' then
    select exists (
      select 1
      from public.school_directory_source_registry sr
      where sr.source_name = new.source_name
        and sr.authority_tier = 0
        and sr.canonical_use
        and sr.active
        and sr.verification_mode = 'authoritative'
    ) into v_tier0_authoritative;

    if v_tier0_authoritative then
      -- Every authoritative identity must have an official name and at least
      -- one government identifier. Identifier namespaces remain distinct.
      select count(*)
      into v_invalid_records
      from public.school_directory_source_observations o
      where o.ingest_batch_id = new.id
        and (
          coalesce(
            nullif(trim(o.raw_record->>'name'), ''),
            nullif(trim(o.raw_record->>'official_name'), ''),
            nullif(trim(o.raw_record->>'school_name'), ''),
            nullif(trim(o.raw_record->>'institution_name'), '')
          ) is null
          or (
            nullif(trim(o.raw_record->>'knec_code'), '') is null
            and coalesce(
              nullif(trim(o.raw_record->>'nemis_uic'), ''),
              nullif(trim(o.raw_record->>'nemis_code'), ''),
              nullif(trim(o.raw_record->>'nemis'), ''),
              nullif(trim(o.raw_record->>'uic'), ''),
              nullif(trim(o.raw_record->>'uic_code'), '')
            ) is null
            and coalesce(
              nullif(trim(o.raw_record->>'moe_registration_no'), ''),
              nullif(trim(o.raw_record->>'moe_registration_number'), ''),
              nullif(trim(o.raw_record->>'moe_code'), '')
            ) is null
            and nullif(trim(o.raw_record->>'tsc_code'), '') is null
          )
        );

      select count(*) into v_duplicate_knec
      from (
        select nullif(trim(o.raw_record->>'knec_code'), '') as identifier
        from public.school_directory_source_observations o
        where o.ingest_batch_id = new.id
          and nullif(trim(o.raw_record->>'knec_code'), '') is not null
        group by 1 having count(*) > 1
      ) q;

      select count(*) into v_duplicate_nemis
      from (
        select coalesce(
          nullif(trim(o.raw_record->>'nemis_uic'), ''),
          nullif(trim(o.raw_record->>'nemis_code'), ''),
          nullif(trim(o.raw_record->>'nemis'), ''),
          nullif(trim(o.raw_record->>'uic'), ''),
          nullif(trim(o.raw_record->>'uic_code'), '')
        ) as identifier
        from public.school_directory_source_observations o
        where o.ingest_batch_id = new.id
          and coalesce(
            nullif(trim(o.raw_record->>'nemis_uic'), ''),
            nullif(trim(o.raw_record->>'nemis_code'), ''),
            nullif(trim(o.raw_record->>'nemis'), ''),
            nullif(trim(o.raw_record->>'uic'), ''),
            nullif(trim(o.raw_record->>'uic_code'), '')
          ) is not null
        group by 1 having count(*) > 1
      ) q;

      select count(*) into v_duplicate_moe
      from (
        select coalesce(
          nullif(trim(o.raw_record->>'moe_registration_no'), ''),
          nullif(trim(o.raw_record->>'moe_registration_number'), ''),
          nullif(trim(o.raw_record->>'moe_code'), '')
        ) as identifier
        from public.school_directory_source_observations o
        where o.ingest_batch_id = new.id
          and coalesce(
            nullif(trim(o.raw_record->>'moe_registration_no'), ''),
            nullif(trim(o.raw_record->>'moe_registration_number'), ''),
            nullif(trim(o.raw_record->>'moe_code'), '')
          ) is not null
        group by 1 having count(*) > 1
      ) q;

      select count(*) into v_duplicate_tsc
      from (
        select nullif(trim(o.raw_record->>'tsc_code'), '') as identifier
        from public.school_directory_source_observations o
        where o.ingest_batch_id = new.id
          and nullif(trim(o.raw_record->>'tsc_code'), '') is not null
        group by 1 having count(*) > 1
      ) q;

      if v_invalid_records > 0 then
        raise exception 'tier0_snapshot_noncertifiable_records count %', v_invalid_records;
      end if;
      if v_duplicate_knec > 0 then
        raise exception 'tier0_snapshot_duplicate_knec groups %', v_duplicate_knec;
      end if;
      if v_duplicate_nemis > 0 then
        raise exception 'tier0_snapshot_duplicate_nemis groups %', v_duplicate_nemis;
      end if;
      if v_duplicate_moe > 0 then
        raise exception 'tier0_snapshot_duplicate_moe_registration groups %', v_duplicate_moe;
      end if;
      if v_duplicate_tsc > 0 then
        raise exception 'tier0_snapshot_duplicate_tsc groups %', v_duplicate_tsc;
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_school_ingest_batch_seal() from public, anon, authenticated;
