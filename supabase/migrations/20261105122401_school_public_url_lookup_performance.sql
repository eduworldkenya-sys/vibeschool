-- Keep the private SQL projection inlineable: resolver predicates can then use
-- the slug/identity indexes instead of materializing all 28k public records.
-- Every relation in the projection is schema-qualified. It is called only by
-- the bounded public RPCs under their definer; no additional privilege grant.
alter function public.school_url_public_rows() security invoker;
alter function public.school_url_public_rows() reset search_path;
