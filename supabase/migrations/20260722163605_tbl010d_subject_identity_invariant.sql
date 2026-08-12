-- Duplicate ledger entry retained for production parity. The preceding
-- migration owns the constraint; this entry verifies rather than recreates it.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.subjects'::regclass
      and conname = 'chk_school_subject_requires_global_link'
      and convalidated
  ) then
    raise exception 'tbl010d_abort: validated subject identity constraint missing';
  end if;
end $$;
