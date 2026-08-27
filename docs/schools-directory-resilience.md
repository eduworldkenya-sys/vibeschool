# Schools directory resilience

The County selector is intentionally backed by a local canonical list of Kenya's 47 counties so the first filter never becomes empty because of a transient browser/PostgREST failure. Sub-county and ward options remain sourced from the governed Supabase reference data.

Directory search uses the ward-aware v2 RPC first and falls back to the previously certified v1 public search contract if the v2 endpoint is temporarily unavailable through PostgREST.
