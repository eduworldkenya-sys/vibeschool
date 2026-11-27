'use client'

import Link from 'next/link'
import LiveClassroom from '@/components/live-classroom/LiveClassroom'

export default function OnlineTeacherLivePage() {
  if (process.env.NEXT_PUBLIC_VIBE_LIVE_ENABLED !== 'true') {
    return <main><h1>Live classroom unavailable</h1><Link href="/onlineteacherv1">Return to dashboard</Link></main>
  }
  return <LiveClassroom classId={null} teacher={true} back="/onlineteacherv1" />
}
