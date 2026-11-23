'use client'

import { useEffect, useState } from 'react'
import styles from './VibeChat.module.css'
import { codeFromAvatar, vibeMePath } from '@/lib/vibeme'

/** Reuse the account's own uploaded photo or VibeMe choice; never fetch third-party tracking URLs. */
export function safeVibeChatAvatar(url: string | null | undefined): string | null {
  if (!url) return null
  const vibeMeCode = codeFromAvatar(url)
  if (vibeMeCode) return vibeMePath(vibeMeCode)
  try {
    const target = new URL(url)
    const supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://invalid.invalid')
    if (target.protocol === 'https:' && target.origin === supabase.origin &&
        target.pathname.startsWith('/storage/v1/object/public/avatars/')) return url
  } catch {
    return null
  }
  return null
}

export default function VibeChatAvatar({
  name, avatarUrl, size = 'default',
}: {
  name: string
  avatarUrl?: string | null
  size?: 'default' | 'large'
}) {
  const src = safeVibeChatAvatar(avatarUrl)
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [src])
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || '?'
  return <span className={styles.avatar + (size === 'large' ? ' ' + styles.avatarLarge : '')}
    aria-label={name + ' profile avatar'} role="img">
    {src && !broken ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer"
      onError={() => setBroken(true)} className={styles.avatarImage} /> : initials}
  </span>
}
