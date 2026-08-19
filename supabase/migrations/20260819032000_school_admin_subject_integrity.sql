-- Task 7: stable school subject identity.
-- Production audit before authoring: 0 duplicate normalized school subject groups.

create unique index if not exists uq_subjects_school_normalized_name
  on public.subjects (school_id, lower(btrim(name)))
  where school_id is not null;

comment on index public.uq_subjects_school_normalized_name is
  'Task 7: prevents a school from creating parallel subject identities through casing/whitespace variations.';
