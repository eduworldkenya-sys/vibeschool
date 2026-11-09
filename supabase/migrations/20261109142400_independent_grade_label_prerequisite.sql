-- Restore dependency ordering for the canonical independent learner auth functions.
-- The auth access state migration at 20261109142500 reads grade_label, while
-- the original grade-preference migration is deliberately retained at its
-- already-tracked version (20261109235959). Both ADDs are idempotent.
ALTER TABLE public.independent_learner_identities
  ADD COLUMN IF NOT EXISTS grade_label text;
