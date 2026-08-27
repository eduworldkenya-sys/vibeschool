begin;

-- Form 4 History & Government (8-4-4 / KCSE) manual-production intake.
-- This migration seeds curriculum structure only. It does NOT create publication
-- chapters, publish learner content, mark any source as verified, or interact
-- with the Grade 10 CBE History & Citizenship curriculum.

insert into public.subjects (id, name)
select '8f4f4000-0000-4000-8000-000000000311'::uuid, 'History & Government'
where not exists (
  select 1 from public.subjects
  where school_id is null
    and lower(btrim(name)) = 'history & government'
);

insert into public.curriculum (
  id, curriculum, grade, subject, term, week, strand, sub_strand, topic,
  periods, reference, global_subject_id
)
select
  '8f4f4024-0000-4000-8000-000000000001'::uuid,
  '8-4-4 Secondary History & Government',
  'Form 4',
  'History & Government',
  0,
  0,
  '24.0.0 World Wars',
  '24.1.0 Specific Objectives',
  'World Wars curriculum authority',
  null,
  'Kenya Secondary History & Government Syllabus, Form IV, sections 24.0.0-24.2.3',
  s.id
from public.subjects s
where s.school_id is null
  and lower(btrim(s.name)) = 'history & government'
  and not exists (
    select 1 from public.curriculum c
    where c.id = '8f4f4024-0000-4000-8000-000000000001'::uuid
  )
limit 1;

insert into public.curriculum (
  id, curriculum, grade, subject, term, week, strand, sub_strand, topic,
  periods, reference, global_subject_id
)
select v.id, v.curriculum, v.grade, v.subject, v.term, v.week, v.strand,
       v.sub_strand, v.topic, null, v.reference, s.id
from public.subjects s
cross join (values
  (
    '8f4f4024-0001-4000-8000-000000000001'::uuid,
    '8-4-4 Secondary History & Government'::text,
    'Form 4'::text,
    'History & Government'::text,
    0::integer,
    1::integer,
    '24.0.0 World Wars'::text,
    '24.2.1 The First World War (1914-1918)'::text,
    'Causes; Course; Results'::text,
    'Kenya Secondary History & Government Syllabus, Form IV, section 24.2.1'::text
  ),
  (
    '8f4f4024-0002-4000-8000-000000000001'::uuid,
    '8-4-4 Secondary History & Government'::text,
    'Form 4'::text,
    'History & Government'::text,
    0::integer,
    2::integer,
    '24.0.0 World Wars'::text,
    '24.2.2 The League of Nations'::text,
    'Formation; Organization; Performance'::text,
    'Kenya Secondary History & Government Syllabus, Form IV, section 24.2.2'::text
  ),
  (
    '8f4f4024-0003-4000-8000-000000000001'::uuid,
    '8-4-4 Secondary History & Government'::text,
    'Form 4'::text,
    'History & Government'::text,
    0::integer,
    3::integer,
    '24.0.0 World Wars'::text,
    '24.2.3 The Second World War (1939-1945)'::text,
    'Causes; Course; Results'::text,
    'Kenya Secondary History & Government Syllabus, Form IV, section 24.2.3'::text
  )
) as v(id,curriculum,grade,subject,term,week,strand,sub_strand,topic,reference)
where s.school_id is null
  and lower(btrim(s.name)) = 'history & government'
  and not exists (select 1 from public.curriculum c where c.id=v.id);

insert into public.curriculum_learning_outcomes (
  id, curriculum_id, outcome_text, outcome_code, source_type, source_ref,
  source_locator, competency_tags, status
)
values
  (
    '8f4f4024-1001-4000-8000-000000000001'::uuid,
    '8f4f4024-0000-4000-8000-000000000001'::uuid,
    'explain the causes of the First and the Second World Wars',
    '24.1.0(a)',
    'official',
    'Kenya Secondary History & Government Syllabus, Form IV',
    '24.1.0 Specific Objectives, item (a)',
    '{}'::text[],
    'draft'
  ),
  (
    '8f4f4024-1002-4000-8000-000000000001'::uuid,
    '8f4f4024-0000-4000-8000-000000000001'::uuid,
    'describe the course of the First and the Second World Wars',
    '24.1.0(b)',
    'official',
    'Kenya Secondary History & Government Syllabus, Form IV',
    '24.1.0 Specific Objectives, item (b)',
    '{}'::text[],
    'draft'
  ),
  (
    '8f4f4024-1003-4000-8000-000000000001'::uuid,
    '8f4f4024-0000-4000-8000-000000000001'::uuid,
    'discuss the results of the First and the Second World Wars',
    '24.1.0(c)',
    'official',
    'Kenya Secondary History & Government Syllabus, Form IV',
    '24.1.0 Specific Objectives, item (c)',
    '{}'::text[],
    'draft'
  ),
  (
    '8f4f4024-1004-4000-8000-000000000001'::uuid,
    '8f4f4024-0000-4000-8000-000000000001'::uuid,
    'explain the reasons for the formation of the League of Nations',
    '24.1.0(d)',
    'official',
    'Kenya Secondary History & Government Syllabus, Form IV',
    '24.1.0 Specific Objectives, item (d)',
    '{}'::text[],
    'draft'
  ),
  (
    '8f4f4024-1005-4000-8000-000000000001'::uuid,
    '8f4f4024-0000-4000-8000-000000000001'::uuid,
    'describe the organisation of the League of Nations',
    '24.1.0(e)',
    'official',
    'Kenya Secondary History & Government Syllabus, Form IV',
    '24.1.0 Specific Objectives, item (e)',
    '{}'::text[],
    'draft'
  ),
  (
    '8f4f4024-1006-4000-8000-000000000001'::uuid,
    '8f4f4024-0000-4000-8000-000000000001'::uuid,
    'analyse the performance of the League of Nations',
    '24.1.0(f)',
    'official',
    'Kenya Secondary History & Government Syllabus, Form IV',
    '24.1.0 Specific Objectives, item (f)',
    '{}'::text[],
    'draft'
  )
on conflict (id) do nothing;

do $$
begin
  if exists (
    select 1
    from public.curriculum c
    where c.id in (
      '8f4f4024-0000-4000-8000-000000000001'::uuid,
      '8f4f4024-0001-4000-8000-000000000001'::uuid,
      '8f4f4024-0002-4000-8000-000000000001'::uuid,
      '8f4f4024-0003-4000-8000-000000000001'::uuid
    )
      and (
        c.grade <> 'Form 4'
        or c.subject <> 'History & Government'
        or c.curriculum <> '8-4-4 Secondary History & Government'
      )
  ) then
    raise exception 'FORM4_HISTORY_CURRICULUM_SCOPE_COLLISION';
  end if;

  if (select count(*) from public.curriculum_learning_outcomes
      where id in (
        '8f4f4024-1001-4000-8000-000000000001'::uuid,
        '8f4f4024-1002-4000-8000-000000000001'::uuid,
        '8f4f4024-1003-4000-8000-000000000001'::uuid,
        '8f4f4024-1004-4000-8000-000000000001'::uuid,
        '8f4f4024-1005-4000-8000-000000000001'::uuid,
        '8f4f4024-1006-4000-8000-000000000001'::uuid
      )) <> 6 then
    raise exception 'FORM4_HISTORY_WORLD_WARS_OUTCOME_SEED_INCOMPLETE';
  end if;
end $$;

commit;
