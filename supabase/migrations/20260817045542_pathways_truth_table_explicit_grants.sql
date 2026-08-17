-- Public catalogue tables are read-only to clients; authoritative ingestion/provenance tables are RPC-only.
revoke all on table public.pathways from anon, authenticated;
grant select on table public.pathways to anon, authenticated;
revoke all on table public.pathway_tracks from anon, authenticated;
grant select on table public.pathway_tracks to anon, authenticated;
revoke all on table public.pathway_subject_combinations from anon, authenticated;
grant select on table public.pathway_subject_combinations to anon, authenticated;
revoke all on table public.pathway_combination_subject_claims from anon, authenticated;
grant select on table public.pathway_combination_subject_claims to anon, authenticated;
revoke all on table public.pathway_careers from anon, authenticated;
grant select on table public.pathway_careers to anon, authenticated;
revoke all on table public.pathway_career_links from anon, authenticated;
grant select on table public.pathway_career_links to anon, authenticated;

revoke all on table public.pathway_sources from anon, authenticated;
revoke all on table public.pathway_source_observations from anon, authenticated;
revoke all on table public.pathway_school_offerings from anon, authenticated;
