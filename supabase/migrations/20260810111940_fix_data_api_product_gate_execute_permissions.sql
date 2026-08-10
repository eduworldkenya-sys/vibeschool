-- Restore the explicit Data API execution contract for the pre-request product gate.
-- This function is invoked by PostgREST for both public and authenticated requests.
-- Keep this grant explicit because schema default EXECUTE privileges are intentionally locked down.
grant execute on function public.hq_data_api_product_gate() to anon;
grant execute on function public.hq_data_api_product_gate() to authenticated;
