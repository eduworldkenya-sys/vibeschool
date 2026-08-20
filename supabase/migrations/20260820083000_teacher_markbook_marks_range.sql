-- Teacher Professional Markbook: enforce the same 0..100 mark contract in PostgreSQL
-- that the Teacher Results client exposes. This prevents invalid marks from direct
-- REST/RPC/client writes and keeps report/analysis calculations trustworthy.

alter table public.exam_results
  drop constraint if exists exam_results_marks_check;

alter table public.exam_results
  add constraint exam_results_marks_check
  check (marks >= 0 and marks <= 100) not valid;

alter table public.exam_results
  validate constraint exam_results_marks_check;
