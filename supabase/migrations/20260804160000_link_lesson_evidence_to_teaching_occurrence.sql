alter table public.lesson_evidence
  add column if not exists teaching_occurrence_id uuid;

alter table public.lesson_evidence
  drop constraint if exists
    lesson_evidence_teaching_occurrence_id_fkey;

alter table public.lesson_evidence
  add constraint lesson_evidence_teaching_occurrence_id_fkey
  foreign key (teaching_occurrence_id)
  references public.teaching_occurrences(id)
  on delete cascade;

create index if not exists
  lesson_evidence_teaching_occurrence_id_idx
  on public.lesson_evidence(teaching_occurrence_id)
  where teaching_occurrence_id is not null;

comment on column
  public.lesson_evidence.teaching_occurrence_id is
  'Exact teaching occurrence where this classroom evidence was captured.';
