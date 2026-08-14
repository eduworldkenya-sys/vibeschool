begin;

-- Production audit found additional parent-owned tables outside the first child-hub pass.
-- These include share tokens and child identity/autonomy data, so revocation must be
-- relationship-aware here too.

drop policy if exists "parent owns autonomy log" on public.child_autonomy_log;
drop policy if exists "parent owns share links" on public.child_share_links;
drop policy if exists "parent owns child streaks" on public.child_streaks;
drop policy if exists "parent owns vibe id" on public.child_vibe_id;
drop policy if exists "parent owns family members" on public.family_members;

create policy parent_autonomy_current_link on public.child_autonomy_log for all to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_autonomy_log.student_id and coalesce(psl.access_level,'full') <> 'none'))
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_autonomy_log.student_id and coalesce(psl.access_level,'full') = 'full'));

create policy parent_share_links_current_link on public.child_share_links for all to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_share_links.student_id and coalesce(psl.access_level,'full') = 'full'))
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_share_links.student_id and coalesce(psl.access_level,'full') = 'full'));

create policy parent_streaks_current_link on public.child_streaks for all to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_streaks.student_id and coalesce(psl.access_level,'full') <> 'none'))
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_streaks.student_id and coalesce(psl.access_level,'full') = 'full'));

create policy parent_vibe_id_current_link on public.child_vibe_id for all to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_vibe_id.student_id and coalesce(psl.access_level,'full') <> 'none'))
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_vibe_id.student_id and coalesce(psl.access_level,'full') = 'full'));

create policy parent_family_members_current_link on public.family_members for all to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=family_members.student_id and coalesce(psl.access_level,'full') <> 'none'))
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=family_members.student_id and coalesce(psl.access_level,'full') = 'full'));

commit;
