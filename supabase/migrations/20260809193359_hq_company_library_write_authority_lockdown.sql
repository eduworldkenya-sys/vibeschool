-- Force Company Library relational mutations through governed RPCs.

revoke insert, update, delete, truncate, references, trigger on public.hq_artifacts from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.hq_artifact_versions from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.hq_artifact_provenance from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.hq_artifact_links from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.hq_artifact_approvals from authenticated;

grant select on public.hq_artifacts to authenticated;
grant select on public.hq_artifact_versions to authenticated;
grant select on public.hq_artifact_provenance to authenticated;
grant select on public.hq_artifact_links to authenticated;
grant select on public.hq_artifact_approvals to authenticated;
