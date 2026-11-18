'use client'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import LiveClassroom from '@/components/live-classroom/LiveClassroom'
export default function TeacherLivePage(){
 const {id}=useParams<{id:string}>()
 const back='/teacher/classhub/'+id
 if(process.env.NEXT_PUBLIC_VIBE_LIVE_ENABLED!=='true')return <section><h1>Live Classroom</h1><p>Live classroom is not enabled yet.</p><Link href={back}>Back to class</Link></section>
 return <LiveClassroom classId={id} teacher={true} back={back}/>
}
