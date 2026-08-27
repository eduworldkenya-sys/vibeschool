begin;

-- Complete top-level Form 4 History & Government (8-4-4 / KCSE) authority skeleton.
-- Topic 24.0.0 World Wars is expanded in the preceding migration. Topics 25-32
-- are intentionally index-only shells: we materialize their exact subtopics and
-- objectives only when each topic is selected for manual production.
--
-- This keeps curriculum authority separate from teaching content and avoids
-- inventing subtopics/objectives before their source transcription is reviewed.

insert into public.curriculum (
  id, curriculum, grade, subject, term, week, strand, sub_strand, topic,
  periods, reference, global_subject_id
)
select v.id,
       '8-4-4 Secondary History & Government',
       'Form 4',
       'History & Government',
       0,
       0,
       v.heading,
       v.heading,
       'Form IV curriculum index authority shell',
       null,
       'Kenya Secondary History & Government Syllabus, Form IV index; detailed intake not yet materialized',
       s.id
from public.subjects s
cross join (values
  ('8f4f4025-0000-4000-8000-000000000001'::uuid, '25.0.0 International Relations'::text),
  ('8f4f4026-0000-4000-8000-000000000001'::uuid, '26.0.0 Co-Operation in Africa'::text),
  ('8f4f4027-0000-4000-8000-000000000001'::uuid, '27.0.0 National Philosophies (Kenya)'::text),
  ('8f4f4028-0000-4000-8000-000000000001'::uuid, '28.0.0 Social, Economic and Political Developments and Challenges in Kenya Since Independence'::text),
  ('8f4f4029-0000-4000-8000-000000000001'::uuid, '29.0.0 Social, Economic and Political Developments and Challenges in Africa Since Independence'::text),
  ('8f4f4030-0000-4000-8000-000000000001'::uuid, '30.0.0 Local Authorities in Kenya'::text),
  ('8f4f4031-0000-4000-8000-000000000001'::uuid, '31.1.1 Government Revenue and Expenditure in Kenya'::text),
  ('8f4f4032-0000-4000-8000-000000000001'::uuid, '32.0.0 The Electoral Process and Functions of Governments in Other Parts of the World'::text)
) as v(id,heading)
where s.school_id is null
  and lower(btrim(s.name)) = 'history & government'
  and not exists (select 1 from public.curriculum c where c.id=v.id);

do $$
begin
  if not exists (
    select 1 from public.subjects
    where school_id is null and lower(btrim(name))='history & government'
  ) then
    raise exception 'FORM4_HISTORY_GLOBAL_SUBJECT_REQUIRED';
  end if;

  if (select count(*)
      from public.curriculum c
      where c.curriculum='8-4-4 Secondary History & Government'
        and c.grade='Form 4'
        and c.subject='History & Government'
        and c.week=0
        and c.strand in (
          '24.0.0 World Wars',
          '25.0.0 International Relations',
          '26.0.0 Co-Operation in Africa',
          '27.0.0 National Philosophies (Kenya)',
          '28.0.0 Social, Economic and Political Developments and Challenges in Kenya Since Independence',
          '29.0.0 Social, Economic and Political Developments and Challenges in Africa Since Independence',
          '30.0.0 Local Authorities in Kenya',
          '31.1.1 Government Revenue and Expenditure in Kenya',
          '32.0.0 The Electoral Process and Functions of Governments in Other Parts of the World'
        )) <> 9 then
    raise exception 'FORM4_HISTORY_TOPIC_SKELETON_INCOMPLETE';
  end if;
end $$;

commit;
