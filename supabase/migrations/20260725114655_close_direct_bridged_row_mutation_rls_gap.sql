-- Closes the direct-REST bypass of the textbook lifecycle RPCs.
--
-- Boundary used: vibe_publication_id IS NULL, not type <> 'textbook'.
-- Blocks direct mutation of ANY publication-backed row, protecting
-- against a future bridged content type reopening this same class of bug.
--
-- All lifecycle RPCs are SECURITY DEFINER, owned by `postgres`, which has
-- rolbypassrls = true — they bypass RLS entirely regardless of these
-- policies. Verified empirically (not just inspected) before relying on
-- this: direct UPDATE/DELETE on a bridged row now affects 0 rows as the
-- real authenticated owner; reconcile_textbook_index still succeeds under
-- the identical simulated session; native (non-bridged) INSERT/UPDATE/
-- DELETE all still work.
--
-- SELECT is untouched: vibelearn_content_read already allows any
-- authenticated user to read any row (required for cross-teacher
-- Discover) and has no ownership/type restriction.

drop policy if exists "vibelearn_content_own_manage" on public.vibelearn_content;
drop policy if exists "vibelearn_content_insert" on public.vibelearn_content;

create policy "vibelearn_content_insert_native_only"
  on public.vibelearn_content
  for insert
  with check (
    submitted_by = auth.uid()
    and vibe_publication_id is null
    and exists (
      select 1 from public.school_members sm
      where sm.profile_id = auth.uid()
        and sm.role = any (array['teacher'::member_role, 'admin'::member_role])
    )
  );

create policy "vibelearn_content_update_native_only"
  on public.vibelearn_content
  for update
  using (submitted_by = auth.uid() and vibe_publication_id is null)
  with check (submitted_by = auth.uid() and vibe_publication_id is null);

create policy "vibelearn_content_delete_native_only"
  on public.vibelearn_content
  for delete
  using (submitted_by = auth.uid() and vibe_publication_id is null);
