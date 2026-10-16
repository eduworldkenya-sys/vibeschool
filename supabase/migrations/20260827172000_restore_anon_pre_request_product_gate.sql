begin;

-- PostgREST invokes this hook before every Data API request. Anonymous requests
-- must be allowed to execute the hook itself; the function immediately returns
-- when auth.uid() is null and remains SECURITY DEFINER for its policy reads.
grant execute on function public.hq_data_api_product_gate() to anon;

-- Keep the chapter entitlement helper internal. Public textbook access goes
-- through the SECURITY DEFINER get_public_vibetextbook_reader RPC instead.
revoke execute on function public.can_viewer_read_chapter(uuid, uuid) from anon;
revoke execute on function public.can_viewer_read_chapter(uuid, uuid) from authenticated;

commit;
