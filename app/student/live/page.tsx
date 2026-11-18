'use client'
import Link from 'next/link'
import { useStudent } from '@/lib/student-context'
import LiveClassroom from '@/components/live-classroom/LiveClassroom'
export default function StudentLivePage(){
 const {identity,loading,error,retry}=useStudent()
 if(loading)return <p role="status">Opening classroom…</p>
 if(error)return <section role="alert">{error}<button onClick={retry}>Retry</button></section>
 if(process.env.NEXT_PUBLIC_VIBE_LIVE_ENABLED!=='true'||!identity?.classId||!identity.schoolId||identity.independent)return <section><h1>Live Classroom</h1><p>Live classroom is unavailable for this account.</p><Link href="/student">Back</Link></section>
 return <LiveClassroom classId={identity.classId} teacher={false} back="/student"/>
}
