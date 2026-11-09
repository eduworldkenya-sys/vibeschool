-- Canonical platform-authored assessments need no school assignment.
-- Existing classroom assessments retain their school IDs.
alter table public.assessment_definitions alter column school_id drop not null;
-- Restrict null-school assessments to platform-owned original practice.
alter table public.assessment_definitions
  add constraint assessment_definitions_school_or_platform_practice_chk
  check (school_id is not null or (
    assessment_type='practice'
    and class_id is null
    and generation_source='owner_authored_pilot'
    and generation_metadata->>'audience'='public_practice'
  ));
