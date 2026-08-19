-- VibeSchool Task 6: ordinary parents must never fabricate canonical learners.
-- Canonical students are school/verified-identity records; family access is
-- established through verified parent claims or school authority.
-- authorization-test: public.create_child_for_parent

begin;

revoke all on function public.create_child_for_parent(text,date,uuid) from public, anon, authenticated;
grant execute on function public.create_child_for_parent(text,date,uuid) to service_role;

comment on function public.create_child_for_parent(text,date,uuid) is
  'Legacy service-only recovery function. Parent self-service canonical learner creation is disabled; parents must use verified family linking.';

commit;
