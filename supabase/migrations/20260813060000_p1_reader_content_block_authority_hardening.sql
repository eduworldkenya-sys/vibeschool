-- Public content blocks must be served through the reader authority layer.
-- Direct table reads bypass reader_sanitize_blocks(), teacher-only filtering,
-- and freemium/paywall decisions in get_public_vibetextbook_reader_raw().
-- The existing author policy remains the authenticated author workflow.

DROP POLICY IF EXISTS content_blocks_public_read ON public.content_blocks;
REVOKE SELECT ON TABLE public.content_blocks FROM anon;

-- Do not grant a replacement public SELECT policy. The canonical public reader
-- RPC remains the only public content-block discovery path.
