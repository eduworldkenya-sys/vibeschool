'use client'

import Link from 'next/link'
import LiveClassroom from '@/components/live-classroom/LiveClassroom'

export default function OnlineTeacherV1() {
  if (process.env.NEXT_PUBLIC_VIBE_LIVE_ENABLED !== 'true') {
    return <main style={{padding:24,fontFamily:'var(--font-jakarta), system-ui, sans-serif'}}><h1>Online teaching</h1><p role="status">Live classroom is not enabled.</p><Link href="/teacher/pulse">Teacher workspace</Link></main>
  }
  // The existing entry form creates the real session and transitions to the
  // live stage without remounting the classroom or navigating to another page.
  // Its canonical room recovery, permissions and end-session flow stay intact.
  return <div style={{minHeight:'100dvh',fontFamily:'var(--font-jakarta), system-ui, sans-serif'}}>
    <LiveClassroom classId={null} teacher={true} back="/teacher/pulse" />
  </div>
}
