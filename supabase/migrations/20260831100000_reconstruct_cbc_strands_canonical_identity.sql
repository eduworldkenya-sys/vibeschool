-- Reconstruct the production canonical cbc_strands identity before later
-- hierarchy-binding migrations rely on ON CONFLICT for this exact key.
-- Production already carries this constraint; clean migration history did not.

do $$
begin
  if to_regclass('public.cbc_strands') is null then
    raise exception 'cbc_strands must exist before canonical identity reconstruction';
  end if;

  if not exists (
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'cbc_strands'
      and con.conname = 'cbc_strands_subject_id_grade_name_sub_strand_key'
      and con.contype = 'u'
  ) then
    if exists (
      select 1
      from public.cbc_strands
      group by subject_id, grade, name, sub_strand
      having count(*) > 1
    ) then
      raise exception 'cannot reconstruct cbc_strands canonical identity: duplicate subject/grade/strand/sub-strand rows exist';
    end if;

    alter table public.cbc_strands
      add constraint cbc_strands_subject_id_grade_name_sub_strand_key
      unique (subject_id, grade, name, sub_strand);
  end if;
end;
$$;
