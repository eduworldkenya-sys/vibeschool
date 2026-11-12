-- Add visual learning aids to the existing canonical resource identity.
-- No new asset table, publication authority, public storage bucket, or RLS bypass.
-- Depends on 20260818141000_canonical_learning_resource_versions.sql.
begin;
alter table public.learning_resources
  drop constraint if exists learning_resources_asset_kind_check;
alter table public.learning_resources
  add constraint learning_resources_asset_kind_check check (
    asset_kind is null or asset_kind = any (array[
      'lesson_plan','teacher_notes','learner_notes','homework','quiz','exercise',
      'revision','worksheet','assessment','worked_example','project','practical',
      'remedial','enrichment','marking_scheme','rubric','content_block','visual_aid'
    ]::text[])
  );
comment on constraint learning_resources_asset_kind_check on public.learning_resources is
  'Visual aids are canonical learning_resources; files and accessible captions belong to their version payload.';
commit;
