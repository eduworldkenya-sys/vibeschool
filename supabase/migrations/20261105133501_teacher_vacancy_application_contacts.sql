-- Owner-authorised vacancy import: support the application contacts supplied in adverts.
-- authorization-test: public.teacher_vacancies
-- Existing owner-only writes and public published/current reads remain unchanged.
alter table public.teacher_vacancies add column if not exists description text;
alter table public.teacher_vacancies drop constraint if exists teacher_vacancies_application_url_check;
alter table public.teacher_vacancies add constraint teacher_vacancies_application_url_check check (
 application_url is null
 or application_url ~* '^https://[^[:space:]]+$'
 or application_url ~* '^mailto:[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
 or application_url ~ '^tel:\+?[0-9]{9,15}$'
);
notify pgrst, 'reload schema';
