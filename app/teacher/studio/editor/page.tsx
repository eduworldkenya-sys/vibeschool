"use client"

import React, { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { PublicationEditor } from '@/components/global/publish/PublicationEditor'
import type { PublicationFormat } from '@/lib/publishTypes'

export default function ContentStudioEditorPage() {
  const router = useRouter()
  const search = useSearchParams()
  const [userId, setUserId] = useState<string | null>(null)

  const rawFormat = search.get('format')
  const format: PublicationFormat = rawFormat === 'ebook' ? 'ebook' : 'vibetextbook'
  const publicationId = search.get('publication') ?? undefined

  useEffect(() => {
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/?role=teacher'); return }
      const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle()
      if (!profile || !['teacher', 'admin'].includes(profile.role)) { router.replace('/'); return }
      setUserId(user.id)
    })
  }, [router])

  if (!userId) return null
  return <PublicationEditor authorId={userId} format={format} publicationId={publicationId} />
}
