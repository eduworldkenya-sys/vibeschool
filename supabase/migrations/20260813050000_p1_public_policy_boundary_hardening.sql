-- P1 security hardening: narrow authenticated read surfaces that currently expose
-- internal/pending or school-scoped records without an authority predicate.
-- This migration intentionally preserves existing public educational/reference
-- behavior where records are global, while enforcing school boundaries for
-- school-scoped resources.

-- system_config contains internal operational thresholds and retention settings.
-- It is not a public application contract.
REVOKE ALL ON TABLE public.system_config FROM anon, authenticated;

-- curriculum_content contains lesson_context and parent_brief and has pending
-- records. Pending content must not be readable merely because a caller is
-- authenticated.
DROP POLICY IF EXISTS curriculum_content_read ON public.curriculum_content;
CREATE POLICY curriculum_content_read_confirmed
ON public.curriculum_content
FOR SELECT
TO authenticated
USING (status = 'confirmed');

-- School-scoped reference resources must not cross school boundaries. Global
-- records (school_id IS NULL) remain available to authenticated users.
DROP POLICY IF EXISTS past_papers_read ON public.past_papers;
CREATE POLICY past_papers_read_authorized
ON public.past_papers
FOR SELECT
TO authenticated
USING (
  school_id IS NULL
  OR school_id IN (
    SELECT p.school_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

DROP POLICY IF EXISTS flashcards_read ON public.flashcards;
CREATE POLICY flashcards_read_authorized
ON public.flashcards
FOR SELECT
TO authenticated
USING (
  school_id IS NULL
  OR school_id IN (
    SELECT p.school_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

DROP POLICY IF EXISTS formula_sheets_read ON public.formula_sheets;
CREATE POLICY formula_sheets_read_authorized
ON public.formula_sheets
FOR SELECT
TO authenticated
USING (
  school_id IS NULL
  OR school_id IN (
    SELECT p.school_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);
