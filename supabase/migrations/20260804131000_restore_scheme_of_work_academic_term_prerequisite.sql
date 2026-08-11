-- L0 recovery prerequisite: restore the pre-tracked academic term identity
-- required by FND-002C deterministic scheme sequencing.
-- Production catalog confirms this nullable UUID column and FK exist.

alter table public.scheme_of_work
  add column if not exists academic_term_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.scheme_of_work'::regclass
      and conname = 'scheme_of_work_academic_term_id_fkey'
  ) then
    alter table public.scheme_of_work
      add constraint scheme_of_work_academic_term_id_fkey
      foreign key (academic_term_id)
      references public.academic_terms(id);
  end if;
end
$$;
