begin;

-- Public discovery may expose the existence/title of verified concepts, but the
-- richer outcome → concept → misconception/correction graph is authenticated
-- product intelligence and must not be anonymously enumerable.
revoke execute on function public.curriculum_get_outcome_semantic_context(uuid) from anon;
grant execute on function public.curriculum_get_outcome_semantic_context(uuid) to authenticated,service_role;

comment on function public.curriculum_get_outcome_semantic_context(uuid) is
'Authenticated semantic enrichment projection for an active curriculum outcome. Public concept discovery is intentionally narrower and does not expose misconception/correction intelligence.';

commit;
