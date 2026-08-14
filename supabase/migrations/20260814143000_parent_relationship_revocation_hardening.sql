begin;

-- Ownership by parent_id is not sufficient: a revoked/removed parent-child link
-- must immediately revoke access. Replace broad legacy parent-owned policies with
-- current parent_student_links checks.

drop policy if exists "parent owns health records" on public.health_records;
drop policy if exists "parent owns vaccinations" on public.health_vaccinations;
drop policy if exists "parent owns pocket money" on public.finance_pocket_money;
drop policy if exists "parent owns savings contributions" on public.finance_savings_contributions;
drop policy if exists "parent owns savings goals" on public.finance_savings_goals;
drop policy if exists "parent owns child growth" on public.child_growth;
drop policy if exists "parent owns child goals" on public.child_goals;
drop policy if exists "parent owns milestones" on public.child_goal_milestones;
drop policy if exists "parent owns child skills" on public.child_skills;
drop policy if exists "parent owns child books" on public.child_books;
drop policy if exists "parent owns child events" on public.child_events;
drop policy if exists "parent owns child profile" on public.child_profiles;
drop policy if exists "parent owns change requests" on public.child_change_requests;
drop policy if exists "parent owns child media" on public.child_media;

-- Replace finance fee parent policies as well: retained parent_id alone must not
-- survive a revoked relationship.
drop policy if exists finance_fee_payments_parent_select on public.finance_fee_payments;
drop policy if exists finance_fee_payments_parent_insert on public.finance_fee_payments;

create policy parent_health_records_current_link on public.health_records for all to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=health_records.student_id and coalesce(psl.access_level,'full') <> 'none'))
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=health_records.student_id and coalesce(psl.access_level,'full') <> 'none'));

create policy parent_health_vaccinations_current_link on public.health_vaccinations for all to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=health_vaccinations.student_id and coalesce(psl.access_level,'full') <> 'none'))
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=health_vaccinations.student_id and coalesce(psl.access_level,'full') <> 'none'));

create policy parent_fee_current_link on public.finance_fee_payments for select to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=finance_fee_payments.student_id and psl.school_id=finance_fee_payments.school_id and coalesce(psl.access_level,'full') <> 'none'));
create policy parent_fee_current_link_insert on public.finance_fee_payments for insert to authenticated
with check (parent_id=auth.uid() and amount > 0 and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=finance_fee_payments.student_id and psl.school_id=finance_fee_payments.school_id and coalesce(psl.access_level,'full') <> 'none'));

create policy parent_pocket_current_link on public.finance_pocket_money for all to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=finance_pocket_money.student_id and coalesce(psl.access_level,'full') <> 'none'))
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=finance_pocket_money.student_id and coalesce(psl.access_level,'full') <> 'none'));

create policy parent_savings_contribution_current_link on public.finance_savings_contributions for all to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=finance_savings_contributions.student_id and coalesce(psl.access_level,'full') <> 'none'))
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=finance_savings_contributions.student_id and coalesce(psl.access_level,'full') <> 'none'));

create policy parent_savings_goal_current_link on public.finance_savings_goals for all to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=finance_savings_goals.student_id and coalesce(psl.access_level,'full') <> 'none'))
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=finance_savings_goals.student_id and coalesce(psl.access_level,'full') <> 'none'));

create policy parent_growth_current_link on public.child_growth for all to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_growth.student_id and coalesce(psl.access_level,'full') <> 'none'))
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_growth.student_id and coalesce(psl.access_level,'full') <> 'none'));

create policy parent_goals_current_link on public.child_goals for all to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_goals.student_id and coalesce(psl.access_level,'full') <> 'none'))
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_goals.student_id and coalesce(psl.access_level,'full') <> 'none'));

create policy parent_milestones_current_link on public.child_goal_milestones for all to authenticated
using (exists (select 1 from public.child_goals cg join public.parent_student_links psl on psl.student_id=cg.student_id and psl.parent_id=auth.uid() where cg.id=child_goal_milestones.goal_id and cg.parent_id=auth.uid() and coalesce(psl.access_level,'full') <> 'none'))
with check (exists (select 1 from public.child_goals cg join public.parent_student_links psl on psl.student_id=cg.student_id and psl.parent_id=auth.uid() where cg.id=child_goal_milestones.goal_id and cg.parent_id=auth.uid() and coalesce(psl.access_level,'full') <> 'none'));

create policy parent_skills_current_link on public.child_skills for all to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_skills.student_id and coalesce(psl.access_level,'full') <> 'none'))
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_skills.student_id and coalesce(psl.access_level,'full') <> 'none'));

create policy parent_books_current_link on public.child_books for all to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_books.student_id and coalesce(psl.access_level,'full') <> 'none'))
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_books.student_id and coalesce(psl.access_level,'full') <> 'none'));

create policy parent_events_current_link on public.child_events for all to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_events.student_id and coalesce(psl.access_level,'full') <> 'none'))
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_events.student_id and coalesce(psl.access_level,'full') <> 'none'));

create policy parent_profile_current_link on public.child_profiles for all to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_profiles.student_id and coalesce(psl.access_level,'full') <> 'none'))
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_profiles.student_id and coalesce(psl.access_level,'full') <> 'none'));

create policy parent_change_requests_current_link on public.child_change_requests for all to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_change_requests.student_id and coalesce(psl.access_level,'full') <> 'none'))
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_change_requests.student_id and coalesce(psl.access_level,'full') <> 'none'));

create policy parent_media_current_link on public.child_media for all to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_media.student_id and coalesce(psl.access_level,'full') <> 'none'))
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_media.student_id and coalesce(psl.access_level,'full') <> 'none'));

commit;
