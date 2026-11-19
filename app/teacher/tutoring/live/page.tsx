'use client'
import Link from 'next/link'
import LiveClassroom from '@/components/live-classroom/LiveClassroom'
export default function LiveHostPage(){
 if(process.env.NEXT_PUBLIC_VIBE_LIVE_ENABLED!=='true')return <section><h1>Live Classroom</h1><p>Live classroom is not enabled yet.</p><Link href="/teacher/tutoring">Back</Link></section>
 return <LiveClassroom classId={null} teacher={true} back="/teacher/tutoring" hostModes={['tuition','open']}/>
}
