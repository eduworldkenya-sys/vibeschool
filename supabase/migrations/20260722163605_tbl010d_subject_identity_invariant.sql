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
