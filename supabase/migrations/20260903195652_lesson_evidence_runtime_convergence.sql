begin;

-- Production ledger reconciliation for the runtime convergence applied on
-- 2026-09-03. The substantive idempotent contract is defined by
-- 20260903190000_lesson_evidence_runtime_convergence.sql and was applied to
-- production under this exact Supabase migration version. Keep this no-op marker
-- so repository migration history reconstructs the live ledger exactly without
-- replaying a second divergent implementation.
select 1;

commit;
