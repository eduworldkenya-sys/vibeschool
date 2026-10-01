begin;
-- academic_year is integer on both cbc_assessments and traditional_grades.
-- Validate it numerically; do not apply PostgreSQL text regex operators to integers.
create or replace function public.fn_verify_grade_year()
returns trigger
language plpgsql
set search_path=public,extensions,pg_temp
as $$
begin
  if new.academic_year is null then return new; end if;
  if new.academic_year < 1000 or new.academic_year > 9999 then
    raise exception 'Invalid academic_year: %. Must be a four-digit year.', new.academic_year using errcode='22023';
  end if;
  return new;
end;
$$;
commit;