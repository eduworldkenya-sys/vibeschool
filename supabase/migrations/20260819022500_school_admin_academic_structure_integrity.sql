-- Task 7: pilot-critical academic structure integrity.
-- Current production audit before authoring this migration:
--   duplicate normalized class groups: 0
--   classes without school_id: 0 of 41
--   current enrollment/class school mismatches: 0
-- Repository-first; production application is deferred until exact-candidate gates pass.

alter table public.classes
  alter column school_id set not null;

create unique index if not exists uq_classes_school_normalized_name_stream
  on public.classes (
    school_id,
    lower(btrim(name)),
    coalesce(lower(btrim(stream)), '')
  );

comment on index public.uq_classes_school_normalized_name_stream is
  'Task 7: prevents duplicate active operational class/stream identities within one school.';
