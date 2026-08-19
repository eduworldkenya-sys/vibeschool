-- Task 7 least-privilege closure for School OS operational and finance relations.
-- These relations are authenticated school/parent/teacher surfaces. Anonymous table
-- DML is neither required by their RLS policies nor an acceptable authority boundary.
-- authorization-test: public.academic_terms
-- authorization-test: public.exams
-- authorization-test: public.finance_invoices
-- authorization-test: public.finance_payments
-- authorization-test: public.subjects
-- authorization-test: public.timetable_slots

begin;

revoke all privileges on table public.academic_terms from anon;
revoke all privileges on table public.exams from anon;
revoke all privileges on table public.finance_invoices from anon;
revoke all privileges on table public.finance_payments from anon;
revoke all privileges on table public.subjects from anon;
revoke all privileges on table public.timetable_slots from anon;

-- PUBLIC must not be an alternate path back to these authenticated relations.
revoke all privileges on table public.academic_terms from public;
revoke all privileges on table public.exams from public;
revoke all privileges on table public.finance_invoices from public;
revoke all privileges on table public.finance_payments from public;
revoke all privileges on table public.subjects from public;
revoke all privileges on table public.timetable_slots from public;

-- Authenticated and service-role grants are intentionally not broadened here.
-- Existing row-level policies/RPC contracts continue to decide authenticated scope.

commit;
