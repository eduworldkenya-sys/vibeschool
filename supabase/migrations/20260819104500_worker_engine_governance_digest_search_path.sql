-- The governance trigger hashes immutable task payload snapshots with pgcrypto.
-- Supabase installs pgcrypto in the protected extensions schema; include that schema
-- explicitly in this SECURITY DEFINER function search_path.
alter function public.hq_workforce_content_governance_transition()
  set search_path = public, extensions, pg_temp;
