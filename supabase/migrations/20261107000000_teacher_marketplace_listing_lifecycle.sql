-- Public marketplace lifecycle: historical vacancies remain read-only; station swaps expire after 90 days.
-- Preserve teacher_swap_interests, messages and underlying listing records.
DROP POLICY IF EXISTS teacher_vacancies_public_read ON public.teacher_vacancies;
CREATE POLICY teacher_vacancies_public_read ON public.teacher_vacancies
  FOR SELECT TO anon, authenticated
  USING (status IN ('published', 'closed'));

DROP POLICY IF EXISTS "swap public discover and own listing" ON public.teacher_swap_listings;
CREATE POLICY "swap public discover and own listing" ON public.teacher_swap_listings
  FOR SELECT TO anon, authenticated
  USING (
    teacher_id = (SELECT auth.uid())
    OR (
      status = 'published'
      AND created_at > now() - interval '90 days'
    )
  );

-- Make owner-reported success terminal without conflating it with TSC approval.
-- State transitions still require authenticated ownership through existing UPDATE RLS.
