-- Task 8 — eliminate legacy permissive Storage policies that can OR-bypass
-- the canonical current teacher -> class -> learner authorization rule.
--
-- Production forensics found homework_photos_school_staff_select coexisting
-- with homework_photos_staff_read_v2. PostgreSQL permissive policies combine
-- with OR, so the older same-school role check weakens the hardened policy.
-- Keep only the canonical authenticated policy created by Task 8.

drop policy if exists homework_photos_school_staff_select on storage.objects;
drop policy if exists homework_photos_staff_read on storage.objects;

-- Defensive removal of legacy variants observed across earlier environments.
drop policy if exists "School staff can view homework photos" on storage.objects;
drop policy if exists "Teachers and admins can view homework photos" on storage.objects;
