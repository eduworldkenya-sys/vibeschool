-- Retire 'kicd' as a curriculum_content source_type value.
-- KICD authors curriculum STRUCTURE (cbc_strands), never CONTENT.
-- Idempotent: safe whether live DB still has 'kicd' or was already
-- patched ad-hoc to 'vibeschool'.

update curriculum_content
  set source_type = 'vibeschool'
  where source_type = 'kicd';

alter table curriculum_content
  alter column source_type drop default;

alter table curriculum_content
  drop constraint if exists curriculum_content_source_type_check;

alter table curriculum_content
  add constraint curriculum_content_source_type_check
  check (source_type in ('vibeschool','publisher','school_authored'));

alter table curriculum_content
  alter column source_type set default 'vibeschool';

drop index if exists uq_curriculum_content_kicd_default;

create unique index if not exists uq_curriculum_content_vibeschool_default
  on curriculum_content(curriculum_id) where source_type = 'vibeschool';
