begin;

alter table public.child_badges enable row level security;

create policy parent_child_badges_select on public.child_badges for select to authenticated
using (exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_badges.student_id and coalesce(psl.access_level,'full') <> 'none'));

-- Parent-created badges are still relationship-scoped; system/teacher awards can use their existing policies.
create policy parent_child_badges_insert on public.child_badges for insert to authenticated
with check (exists (select 1 from public.parent_student_links psl where psl.parent_id=auth.uid() and psl.student_id=child_badges.student_id and coalesce(psl.access_level,'full') = 'full'));

commit;
