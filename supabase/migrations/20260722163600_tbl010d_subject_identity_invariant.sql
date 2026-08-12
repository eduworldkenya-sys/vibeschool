-- TBL-010D: ongoing invariant — every school subject must carry a
-- linked global parent. TBL-010B backfilled this and guarded it with a
-- BEFORE INSERT/UPDATE trigger; this CHECK constraint closes the loop
-- as a durable, declarative guarantee that survives even if a future
-- trigger is dropped or bypassed by a superuser/service-role write.
--
-- Preflight: abort the whole migration if live data would violate the
-- constraint (should be impossible after TBL-010B, but this is the
-- required proof-before-enforce discipline, not a formality).
do $$
begin
  if exists (
    select 1
    from public.subjects
    where school_id is not null
      and global_subject_id is null
  ) then
    raise exception 'tbl010d_abort: unlinked school subjects exist';
  end if;
end $$;

alter table public.subjects
  add constraint chk_school_subject_requires_global_link
  check (school_id is null or global_subject_id is not null);
