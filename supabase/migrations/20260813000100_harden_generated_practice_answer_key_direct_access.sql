-- Defense-in-depth: generated adaptive-practice questions contain authoritative answer keys.
-- Clients must never read or mutate this table directly. The SECURITY DEFINER RPCs
-- student_generate_adaptive_practice_question() and
-- student_answer_adaptive_practice_question(...) are the client-facing boundary.
revoke select on table public.student_generated_practice_questions from anon, authenticated;
revoke insert, update, delete on table public.student_generated_practice_questions from anon, authenticated;
alter table public.student_generated_practice_questions enable row level security;
