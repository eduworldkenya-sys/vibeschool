'use client'
import Link from 'next/link'
import LiveClassroom from '@/components/live-classroom/LiveClassroom'

export default function LiveStudioPage(){
 if(process.env.NEXT_PUBLIC_VIBE_LIVE_ENABLED!=='true')return <section><h1>Live Studio</h1><p>Live classroom is not enabled yet.</p><Link href="/teacher/teach-today">Back</Link></section>
 return <><nav aria-label="Teaching destinations" style={{display:'flex',gap:12,flexWrap:'wrap',padding:12}}><Link href="/teacher/classhub">School classes</Link><Link href="/teacher/tutoring">My tutoring</Link></nav><LiveClassroom classId={null} teacher={true} back="/teacher/teach-today" initialStudio/></>
}
