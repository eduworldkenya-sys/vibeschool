-- L0 recovery prerequisite derived from production catalog evidence.
-- Restore the pretracked academic term identity required by FND-002C.

alter table public.scheme_of_work
  add column if not exists academic_term_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'scheme_of_work'
      and c.conname = 'scheme_of_work_academic_term_id_fkey'
  ) then
    alter table public.scheme_of_work
      add constraint scheme_of_work_academic_term_id_fkey
      foreign key (academic_term_id)
      references public.academic_terms(id);
  end if;
end $$;
