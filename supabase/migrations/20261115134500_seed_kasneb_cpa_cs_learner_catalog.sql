-- Canonical learner-first KASNEB course/paper inventory.
-- Source CPA and CS (versioned April 2026 booklet):
-- https://www.kasneb.or.ke/sites/default/files/2026-04/QUALIFICATIONS%20BOOKLET.pdf
-- Checked 2026-11-15. Official CPA website currently contradicts booklet for some
-- advanced-level paper codes; retain dated booklet codes pending formal reconciliation.
-- This is a COURSE STRUCTURE seed, not a claim of complete unit syllabus,
-- reviewed lessons, assessment questions, or published educational content.
-- Preserve grade/term/week KICD data without forcing professional study into it.

begin;

alter table public.courses
  add column if not exists qualification_code text,
  add column if not exists qualifying_body text,
  add column if not exists syllabus_source_url text,
  add column if not exists syllabus_checked_on date;

alter table public.modules
  add column if not exists qualification_level text,
  add column if not exists qualification_requirement text;

comment on column public.modules.qualification_level is 'Optional professional qualification level; null for conventional non-professional courses.';
comment on column public.modules.qualification_requirement is 'Paper classification: required, specialisation_choice, practical, workshop, conditional_workshop, research_route_choice. Does not imply verified eligibility.';

-- Don't change any existing course's publication state or editorial content.
insert into public.courses
  (slug, title, institution, level, domain, status, badge, description,
   modules_count, qualification_code, qualifying_body, syllabus_source_url, syllabus_checked_on)
values
  ('kasneb-cpa', 'Certified Public Accountants (CPA)', 'KASNEB', 'Professional', 'education', 'coming_soon', 'CPA',
   'Self-paced CPA study by KASNEB level and paper. VibeSchool learner lessons and assessments are in preparation.',
   22, 'CPA', 'KASNEB', 'https://www.kasneb.or.ke/sites/default/files/2026-04/QUALIFICATIONS%20BOOKLET.pdf', date '2026-11-15'),
  ('kasneb-cs', 'Certified Secretaries (CS)', 'KASNEB', 'Professional', 'education', 'coming_soon', 'CS',
   'Self-paced CS study by KASNEB level and paper. Formerly associated with CPS; VibeSchool study content is in preparation.',
   18, 'CS', 'KASNEB', 'https://www.kasneb.or.ke/sites/default/files/2026-04/QUALIFICATIONS%20BOOKLET.pdf', date '2026-11-15')
on conflict (slug) do nothing;

-- Source paper codes are stable module slugs. Topics beneath papers remain
-- unpopulated until source-specific learning scope is independently verified.
with paper_inventory(course_slug, paper_code, paper_title, professional_level, requirement, sequence_number) as (
  values
    ('kasneb-cpa', 'CA11', 'Financial Accounting', 'Foundation', 'required', 1),
    ('kasneb-cpa', 'CA12', 'Communication Skills', 'Foundation', 'required', 2),
    ('kasneb-cpa', 'CA13', 'Introduction to Law and Governance', 'Foundation', 'required', 3),
    ('kasneb-cpa', 'CA14', 'Economics', 'Foundation', 'required', 4),
    ('kasneb-cpa', 'CA15', 'Quantitative Analysis', 'Foundation', 'required', 5),
    ('kasneb-cpa', 'CA16', 'Information Communication Technology', 'Foundation', 'required', 6),
    ('kasneb-cpa', 'CA21', 'Company Law', 'Intermediate', 'required', 7),
    ('kasneb-cpa', 'CA22', 'Financial Management', 'Intermediate', 'required', 8),
    ('kasneb-cpa', 'CA23', 'Financial Reporting and Analysis', 'Intermediate', 'required', 9),
    ('kasneb-cpa', 'CA24', 'Auditing and Assurance', 'Intermediate', 'required', 10),
    ('kasneb-cpa', 'CA25', 'Management Accounting', 'Intermediate', 'required', 11),
    ('kasneb-cpa', 'CA26', 'Public Finance and Taxation', 'Intermediate', 'required', 12),
    ('kasneb-cpa', 'CA31', 'Leadership and Management', 'Advanced', 'required', 13),
    ('kasneb-cpa', 'CA32', 'Advanced Financial Reporting and Analysis', 'Advanced', 'required', 14),
    ('kasneb-cpa', 'CA33', 'Advanced Financial Management', 'Advanced', 'required', 15),
    ('kasneb-cpa', 'CA34', 'Advanced Management Accounting', 'Advanced', 'required', 16),
    ('kasneb-cpa', 'CA35S1', 'Advanced Taxation', 'Advanced', 'specialisation_choice', 17),
    ('kasneb-cpa', 'CA35S2', 'Advanced Auditing and Assurance', 'Advanced', 'specialisation_choice', 18),
    ('kasneb-cpa', 'CA35S3', 'Advanced Public Financial Management', 'Advanced', 'specialisation_choice', 19),
    ('kasneb-cpa', 'CA36P', 'Business Data Analytics', 'Advanced', 'practical', 20),
    ('kasneb-cpa', 'CA37WE', 'Workshop on Ethics', 'Advanced', 'workshop', 21),
    ('kasneb-cpa', 'CA38WP', 'Workshop on Work Simulation', 'Advanced', 'conditional_workshop', 22),
    ('kasneb-cs', 'CS11', 'Management Principles and Practice', 'Foundation', 'required', 1),
    ('kasneb-cs', 'CS12', 'Communication Skills and Records Management', 'Foundation', 'required', 2),
    ('kasneb-cs', 'CS13', 'Introduction to Law and Governance', 'Foundation', 'required', 3),
    ('kasneb-cs', 'CS14', 'Principles of Accounting and Taxation', 'Foundation', 'required', 4),
    ('kasneb-cs', 'CS15', 'Human Resources Management', 'Foundation', 'required', 5),
    ('kasneb-cs', 'CS16', 'Information Communication Technology', 'Foundation', 'required', 6),
    ('kasneb-cs', 'CS21', 'Company Law', 'Intermediate', 'required', 7),
    ('kasneb-cs', 'CS22', 'Public Sector Governance, Policy and Administration', 'Intermediate', 'required', 8),
    ('kasneb-cs', 'CS23', 'Meetings: Compliance and Administration', 'Intermediate', 'required', 9),
    ('kasneb-cs', 'CS24', 'Financial Markets and Specialised Institutions', 'Intermediate', 'required', 10),
    ('kasneb-cs', 'CS25', 'Corporate Governance and Ethics', 'Intermediate', 'required', 11),
    ('kasneb-cs', 'CS26', 'Research, Consultancy and Advisory', 'Intermediate', 'required', 12),
    ('kasneb-cs', 'CS31', 'Strategic Management', 'Advanced', 'required', 13),
    ('kasneb-cs', 'CS32', 'Finance for Decision Making', 'Advanced', 'required', 14),
    ('kasneb-cs', 'CS33', 'Governance and Compliance Audit', 'Advanced', 'required', 15),
    ('kasneb-cs', 'CS34', 'Boardroom Dynamics', 'Advanced', 'required', 16),
    ('kasneb-cs', 'CS35R1', 'Research Project', 'Advanced', 'research_route_choice', 17),
    ('kasneb-cs', 'CS35R2', 'Research Workshop', 'Advanced', 'research_route_choice', 18)
)
insert into public.modules
  (course_id, slug, title, sequence_number, qualification_level, qualification_requirement)
select c.id, lower(p.paper_code), p.paper_code || ' · ' || p.paper_title, p.sequence_number,
       p.professional_level, p.requirement
from paper_inventory p
join public.courses c on c.slug = p.course_slug
where c.qualifying_body = 'KASNEB' and c.qualification_code in ('CPA','CS')
on conflict (course_id, slug) do nothing;

-- Fail closed if either qualification catalog is incomplete or collides with
-- an incompatible pre-existing row. No student data or publishing is changed.
do $verify$
declare
  cpa_count integer;
  cs_count integer;
begin
  select count(*) into cpa_count
  from public.modules m join public.courses c on c.id=m.course_id
  where c.slug='kasneb-cpa' and c.qualifying_body='KASNEB' and c.qualification_code='CPA'
    and m.qualification_level in ('Foundation','Intermediate','Advanced');
  select count(*) into cs_count
  from public.modules m join public.courses c on c.id=m.course_id
  where c.slug='kasneb-cs' and c.qualifying_body='KASNEB' and c.qualification_code='CS'
    and m.qualification_level in ('Foundation','Intermediate','Advanced');
  if exists (select 1 from public.modules m join public.courses c on c.id=m.course_id
             where c.slug in ('kasneb-cpa','kasneb-cs')
               and (m.title <> upper(m.slug) || ' · ' || split_part(m.title, ' · ', 2)
                    or m.sequence_number < 1
                    or m.qualification_level not in ('Foundation','Intermediate','Advanced')
                    or m.qualification_requirement not in ('required','specialisation_choice','practical',
                                                          'workshop','conditional_workshop','research_route_choice'))) then
    raise exception 'KASNEB paper catalogue contains an invalid module row';
  end if;
  if cpa_count <> 22 or cs_count <> 18 then
    raise exception 'KASNEB paper inventory incomplete: CPA %, CS % (expected 22/18)', cpa_count,cs_count;
  end if;
  if exists (
    select 1 from public.topics t
    join public.modules m on m.id = t.module_id
    join public.courses c on c.id = m.course_id
    where c.slug in ('kasneb-cpa', 'kasneb-cs') and t.content_status = 'published'
  ) then
    raise exception 'KASNEB catalog seed must not introduce or overlap published topics';
  end if;
  if exists (
    select 1 from public.courses
    where slug in ('kasneb-cpa','kasneb-cs') and
          (qualifying_body <> 'KASNEB' or
           (slug='kasneb-cpa' and qualification_code <> 'CPA') or
           (slug='kasneb-cs' and qualification_code <> 'CS'))
  ) then
    raise exception 'KASNEB catalog seed slug collides with an unrelated course';
  end if;
  if exists (
    select 1 from public.courses
    where slug in ('kasneb-cpa','kasneb-cs') and status <> 'coming_soon'
  ) then
    raise exception 'KASNEB catalogue cannot seed atop an already live course';
  end if;
end $verify$;

commit;
