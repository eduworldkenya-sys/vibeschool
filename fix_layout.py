path = 'app/teacher/layout.tsx'
with open(path) as f:
    src = f.read()

old = """      const { data: participation } = await supabase
        .from('vc_participants')
        .select('thread_id, last_read_at')
        .eq('profile_id', user.id)
      const unread = (participation ?? []).filter((p: { last_read_at: string | null }) =>
        p.last_read_at === null
      ).length
      setUnreadConnect(unread)"""

new = """      const { data: participation } = await supabase
        .from('vc_participants')
        .select('thread_id, last_read_at')
        .eq('profile_id', user.id)

      const threadIds = (participation ?? []).map((p: { thread_id: string }) => p.thread_id)
      let unread = 0
      if (threadIds.length > 0) {
        const readMap: Record<string, string> = {}
        ;(participation ?? []).forEach((p: { thread_id: string; last_read_at: string | null }) => {
          readMap[p.thread_id] = p.last_read_at ?? '1970-01-01T00:00:00Z'
        })
        const counts = await Promise.all(
          threadIds.map(async (tid: string) => {
            const { count } = await supabase
              .from('vc_messages')
              .select('id', { count: 'exact', head: true })
              .eq('thread_id', tid)
              .neq('sender_id', user.id)
              .gt('created_at', readMap[tid])
            return (count ?? 0) > 0 ? 1 : 0
          })
        )
        unread = counts.reduce((a: number, b: number) => a + b, 0)
      }
      setUnreadConnect(unread)"""

assert old in src, 'BLOCK NOT FOUND'
src = src.replace(old, new)
with open(path, 'w') as f:
    f.write(src)
print('Done: layout.tsx patched')
