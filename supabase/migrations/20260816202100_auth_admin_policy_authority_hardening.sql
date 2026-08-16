begin;

-- Privileged policy decisions must resolve through the canonical access function,
-- not profiles.role directly. get_my_role() now fails closed for an admin profile
-- that lacks admin/owner school membership.

drop policy if exists curriculum_insert on public.curriculum;
create policy curriculum_insert
on public.curriculum
for insert
to authenticated
with check (
  public.get_my_role() = 'admin'
  or coalesce(public.is_platform_owner(), false)
);

drop policy if exists curriculum_update on public.curriculum;
create policy curriculum_update
on public.curriculum
for update
to authenticated
using (
  public.get_my_role() = 'admin'
  or coalesce(public.is_platform_owner(), false)
)
with check (
  public.get_my_role() = 'admin'
  or coalesce(public.is_platform_owner(), false)
);

drop policy if exists exam_bank_insert on public.exam_question_bank;
create policy exam_bank_insert
on public.exam_question_bank
for insert
to authenticated
with check (
  public.get_my_role() in ('teacher','admin')
  or coalesce(public.is_platform_owner(), false)
);

drop policy if exists exam_bank_update on public.exam_question_bank;
create policy exam_bank_update
on public.exam_question_bank
for update
to authenticated
using (
  public.get_my_role() in ('teacher','admin')
  or coalesce(public.is_platform_owner(), false)
)
with check (
  public.get_my_role() in ('teacher','admin')
  or coalesce(public.is_platform_owner(), false)
);

-- Provisioning-failure evidence contains identity/security diagnostics and is not
-- a school-admin data surface. Keep it owner-only in interactive authenticated use.
drop policy if exists signup_provisioning_failures_staff_select on public.signup_provisioning_failures;
create policy signup_provisioning_failures_staff_select
on public.signup_provisioning_failures
for select
to authenticated
using (coalesce(public.is_platform_owner(), false));

commit;
