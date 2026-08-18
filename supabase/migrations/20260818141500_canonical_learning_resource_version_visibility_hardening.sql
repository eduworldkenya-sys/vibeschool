-- R3.2 security hardening: a visible resource root must never expose
-- candidate/verified/rejected/retired version payloads through the Data API.

begin;

drop policy if exists learning_resource_versions_read_visible_parent
  on public.learning_resource_versions;

create policy learning_resource_versions_read_certified_visible_parent
  on public.learning_resource_versions
  for select
  to authenticated
  using (
    lifecycle_status = 'certified'
    and public.fn_learning_resource_visible(resource_id)
  );

comment on policy learning_resource_versions_read_certified_visible_parent
  on public.learning_resource_versions is
  'Authenticated clients may read only certified versions whose parent resource is visible. Draft/review/retired payloads remain governance-only.';

commit;
