begin;

-- Extend the same parent-child authorization contract to the remaining child hub data.
alter table public.child_growth enable row level security;
alter table public.child_goals enable row level security;
alter table public.child_goal_milestones enable row level security;
alter table public.child_skills enable row level security;
alter table public.child_books enable row level security;
alter table public.child_events enable row level security;
alter table public.child_profiles enable row level security;
alter table public.child_change_requests enable row level security;

create policy parent_child_growth_select on public.child_growth for select to authenticated
using (exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_growth.student_id and coalesce(psl.access_level,'full') <> 'none'));
create policy parent_child_growth_insert on public.child_growth for insert to authenticated
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_growth.student_id and coalesce(psl.access_level,'full') <> 'none'));
create policy parent_child_growth_update on public.child_growth for update to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_growth.student_id and coalesce(psl.access_level,'full') <> 'none'))
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_growth.student_id and coalesce(psl.access_level,'full') <> 'none'));

create policy parent_child_goals_select on public.child_goals for select to authenticated
using (exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_goals.student_id and coalesce(psl.access_level,'full') <> 'none'));
create policy parent_child_goals_insert on public.child_goals for insert to authenticated
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_goals.student_id and coalesce(psl.access_level,'full') <> 'none'));
create policy parent_child_goals_update on public.child_goals for update to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_goals.student_id and coalesce(psl.access_level,'full') <> 'none'))
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_goals.student_id and coalesce(psl.access_level,'full') <> 'none'));

create policy parent_child_milestones_select on public.child_goal_milestones for select to authenticated
using (exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_goal_milestones.student_id and coalesce(psl.access_level,'full') <> 'none'));
create policy parent_child_milestones_update on public.child_goal_milestones for update to authenticated
using (exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_goal_milestones.student_id and coalesce(psl.access_level,'full') <> 'none'))
with check (exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_goal_milestones.student_id and coalesce(psl.access_level,'full') <> 'none'));

create policy parent_child_skills_select on public.child_skills for select to authenticated
using (exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_skills.student_id and coalesce(psl.access_level,'full') <> 'none'));
create policy parent_child_skills_insert on public.child_skills for insert to authenticated
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_skills.student_id and coalesce(psl.access_level,'full') <> 'none'));
create policy parent_child_skills_update on public.child_skills for update to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_skills.student_id and coalesce(psl.access_level,'full') <> 'none'))
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_skills.student_id and coalesce(psl.access_level,'full') <> 'none'));

create policy parent_child_books_select on public.child_books for select to authenticated
using (exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_books.student_id and coalesce(psl.access_level,'full') <> 'none'));
create policy parent_child_books_insert on public.child_books for insert to authenticated
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_books.student_id and coalesce(psl.access_level,'full') <> 'none'));
create policy parent_child_books_update on public.child_books for update to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_books.student_id and coalesce(psl.access_level,'full') <> 'none'))
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_books.student_id and coalesce(psl.access_level,'full') <> 'none'));

create policy parent_child_events_select on public.child_events for select to authenticated
using (exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_events.student_id and coalesce(psl.access_level,'full') <> 'none'));
create policy parent_child_events_insert on public.child_events for insert to authenticated
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_events.student_id and coalesce(psl.access_level,'full') <> 'none'));
create policy parent_child_events_update on public.child_events for update to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_events.student_id and coalesce(psl.access_level,'full') <> 'none'))
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_events.student_id and coalesce(psl.access_level,'full') <> 'none'));

create policy parent_child_profiles_select on public.child_profiles for select to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_profiles.student_id and coalesce(psl.access_level,'full') <> 'none'));
create policy parent_child_profiles_insert on public.child_profiles for insert to authenticated
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_profiles.student_id and coalesce(psl.access_level,'full') <> 'none'));
create policy parent_child_profiles_update on public.child_profiles for update to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_profiles.student_id and coalesce(psl.access_level,'full') <> 'none'))
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_profiles.student_id and coalesce(psl.access_level,'full') <> 'none'));

create policy parent_child_change_requests_select on public.child_change_requests for select to authenticated
using (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_change_requests.student_id and coalesce(psl.access_level,'full') <> 'none'));
create policy parent_child_change_requests_insert on public.child_change_requests for insert to authenticated
with check (parent_id=auth.uid() and exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_change_requests.student_id and coalesce(psl.access_level,'full') <> 'none'));

commit;
