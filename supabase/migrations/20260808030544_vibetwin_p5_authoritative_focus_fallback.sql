-- Live reconciliation authority for P5 adaptive session focus.
-- Production version 20260808030544 hardens student_plan_adaptive_session so
-- a sparse Twin cache may fall back only to active/verified curriculum mastery.
-- Archived synthetic seed outcomes are intentionally excluded.
--
-- Repository replay already contains the P5 session authority and resume contract;
-- this marker preserves the production migration ledger version without re-running
-- an additional destructive or divergent operation.
select 1;
