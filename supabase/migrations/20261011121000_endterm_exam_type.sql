-- Existing UI offers end-term as an exam type; align DB validation.
-- Preserve every already supported value. No records are rewritten.
begin;
alter table public.exams drop constraint if exists exams_exam_type_check;
alter table public.exams add constraint exams_exam_type_check
  check (exam_type in ('summative','cat','midterm','opener','endterm'));
commit;
