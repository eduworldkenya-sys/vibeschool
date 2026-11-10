-- Preserve legacy Grade 9 pilot source and allow genuine original VibeSchool exams.
-- This does not broaden the public-practice audience or weaken assessment validation.
alter table public.assessment_definitions
drop constraint assessment_definitions_school_or_platform_practice_chk;
alter table public.assessment_definitions
add constraint assessment_definitions_school_or_platform_practice_chk
check (
  school_id is not null or (
    assessment_type='practice'
    and class_id is null
    and generation_source in ('owner_authored_pilot','owner_authored_original')
    and generation_metadata->>'audience'='public_practice'
  )
);
