-- Restore the canonical subject relationship required by PostgREST embeds on
-- progress_records. subject_id is nullable and existing rows are already valid.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.progress_records'::regclass
      and confrelid = 'public.subjects'::regclass
      and contype = 'f'
      and conkey = array[
        (select attnum
         from pg_attribute
         where attrelid = 'public.progress_records'::regclass
           and attname = 'subject_id')
      ]::smallint[]
  ) then
    alter table public.progress_records
      add constraint progress_records_subject_id_fkey
      foreign key (subject_id)
      references public.subjects(id)
      on delete set null;
  end if;
end
$$;
