-- Production parity for migration 20261001084628.
-- Repairs teacher-created Kenyan pilot schools that have no administrator and
-- no academic calendar, using the confirmed national 2026 Term III calendar.
-- Existing school calendars and administrator-managed schools are untouched.
--
-- The live generate_term_weeks trigger is intentionally admin-authenticated.
-- A migration has no auth.uid(), so this controlled repair disables that one
-- trigger transactionally, inserts the national term, seeds its weeks
-- explicitly, then restores the trigger.

alter table public.academic_terms disable trigger on_academic_term_created;

with inserted as (
  insert into public.academic_terms
    (school_id,name,term,academic_year,start_date,end_date,status)
  select s.id,'Term 3',3,2026,date '2026-08-24',date '2026-10-23','active'
  from public.schools s
  where s.country_code='KE'
    and s.deleted_at is null
    and s.created_by is not null
    and exists (
      select 1 from public.school_members sm
      where sm.school_id=s.id
        and sm.profile_id=s.created_by
        and sm.role='teacher'
    )
    and not exists (
      select 1 from public.school_members sm
      where sm.school_id=s.id
        and sm.role='admin'
    )
    and not exists (
      select 1 from public.academic_terms at
      where at.school_id=s.id
    )
  on conflict (school_id,term,academic_year) do nothing
  returning id,start_date,end_date
)
insert into public.term_weeks
  (school_id,term_id,week_number,start_date,end_date,week_type)
select null,
       i.id,
       g.n,
       i.start_date + ((g.n-1)*7),
       least(i.start_date + ((g.n*7)-1),i.end_date),
       'normal'
from inserted i
cross join lateral generate_series(
  1,
  ceil(((i.end_date-i.start_date)+1)/7.0)::int
) g(n)
on conflict do nothing;

alter table public.academic_terms enable trigger on_academic_term_created;
