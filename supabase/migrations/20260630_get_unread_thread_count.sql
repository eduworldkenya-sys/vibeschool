-- RPC: get_unread_thread_count
-- Replaces the layout.tsx client-side waterfall (vc_participants -> vc_messages,
-- 2 sequential round trips) with a single round trip. Counts threads, not
-- raw messages, matching existing client-side semantics in app/teacher/layout.tsx
-- and app/parent/messages/page.tsx.

CREATE OR REPLACE FUNCTION public.get_unread_thread_count(p_profile_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(DISTINCT m.thread_id)::integer
  FROM public.vc_participants p
  JOIN public.vc_messages m
    ON m.thread_id = p.thread_id
  WHERE p.profile_id = p_profile_id
    AND m.sender_id  != p_profile_id
    AND m.created_at > COALESCE(p.last_read_at, '1970-01-01T00:00:00Z'::timestamptz)
    AND m.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.get_unread_thread_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_unread_thread_count(uuid) TO authenticated;
