'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TeacherWorkspace } from '@/components/teacher/ui'
import { Search, Plus, Users, ArrowUpRight, BookOpen } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type OperatingClass = { class_id: string; class_name: string; stream: string | null; subject_id: string; subject_name: string }
type OperatingContext = { school_id: string | null; state: 'ready' | 'needs_school' | 'needs_class' | 'needs_curriculum_reconciliation'; classes: OperatingClass[] }
type ClassRow = { id: string; name: string; stream: string | null; subject: string | null }

export default function ClassHubPage() {
  const router = useRouter()
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) {
        router.replace('/academy/signin?role=teacher')
        return
      }

      const { data: contextData, error: contextError } = await supabase.rpc('teacher_get_operating_context')
      if (contextError) {
        if (!cancelled) { setError('We could not load your teaching context. Please try again.'); setLoading(false) }
        return
      }

      const context = contextData as OperatingContext
      const activeSchoolId = context.school_id
      if (!activeSchoolId || context.state === 'needs_school') {
        if (!cancelled) { setError('Connect or select your active school before opening classes.'); setLoading(false) }
        return
      }

      const unique = new Map<string, ClassRow>()
      for (const assignment of context.classes ?? []) {
        const existing = unique.get(assignment.class_id)
        if (!existing) {
          unique.set(assignment.class_id, {
            id: assignment.class_id,
            name: assignment.class_name,
            stream: assignment.stream,
            subject: assignment.subject_name,
          })
        } else if (assignment.subject_name && !existing.subject?.split(' · ').includes(assignment.subject_name)) {
          existing.subject = [existing.subject, assignment.subject_name].filter(Boolean).join(' · ')
        }
      }
      const loadedClasses = Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name))
      const classIds = loadedClasses.map(row => row.id)
      if (classIds.length === 0) {
        if (!cancelled) {
          setClasses([])
          setCounts({})
          setLoading(false)
        }
        return
      }

      const enrollmentResult = await supabase
        .from('student_classes')
        .select('class_id')
        .eq('school_id', activeSchoolId)
        .in('class_id', classIds)
        .eq('is_current', true)

      if (enrollmentResult.error) {
        if (!cancelled) {
          setError('We found your classes but could not load their current learner rosters.')
          setLoading(false)
        }
        return
      }
      const nextCounts: Record<string, number> = {}
      for (const row of enrollmentResult.data ?? []) {
        if (row.class_id) nextCounts[row.class_id] = (nextCounts[row.class_id] ?? 0) + 1
      }

      if (!cancelled) {
        setClasses(loadedClasses)
        setCounts(nextCounts)
        setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [router, retry])

  const visible = classes.filter(cls => `${cls.name} ${cls.stream ?? ''} ${cls.subject ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()))
  const total = Object.values(counts).reduce((sum,count)=>sum+count,0)
  return <TeacherWorkspace title="My classes" eyebrow="Classes" actions={<Link href="/teacher/classhub/add" className="teacher-btn"><Plus size={18} aria-hidden="true"/>Add class</Link>}>
    {loading ? <div role="status" aria-label="Loading your classes" className="teacher-class-grid">{[1,2,3].map(i=><div key={i} className="teacher-skeleton" style={{height:160}}/>)}</div> : error ? <div role="alert" className="teacher-panel teacher-state"><div className="teacher-state__icon"><BookOpen size={24}/></div><h2>Classes unavailable</h2><p>{error}</p><button type="button" className="teacher-btn" onClick={()=>setRetry(value=>value+1)}>Try again</button><Link href="/teacher/profile" className="teacher-btn teacher-btn--secondary">Check school context</Link></div> : classes.length===0 ? <div className="teacher-panel teacher-state"><div className="teacher-state__icon"><Users size={24}/></div><h2>Your classroom starts here</h2><p>Add or join the class and subject you teach.</p><Link href="/teacher/classhub/add" className="teacher-btn"><Plus size={18}/>Add or join class</Link></div> : <>
      <div className="teacher-class-summary"><span><strong>{classes.length}</strong> classes</span><span><strong>{total}</strong> learners</span></div>
      <label className="teacher-tools-search"><Search size={19} aria-hidden="true"/><input type="search" aria-label="Search classes and subjects" placeholder="Find a class or subject…" value={query} onChange={event=>setQuery(event.target.value)}/></label>
      <div className="teacher-class-grid">{visible.map(cls=><article className="teacher-class-card" key={cls.id}>
        <div className="teacher-class-card__identity"><span className="teacher-state__icon"><SchoolIcon/></span><span className="teacher-class-card__count"><Users size={14} aria-hidden="true"/>{counts[cls.id]??0}</span></div>
        <h2>{cls.name}{cls.stream ? ` ${cls.stream}` : ''}</h2><p>{cls.subject || 'Class workspace'}</p>
        <div className="teacher-class-card__actions"><Link href={`/teacher/classhub/${cls.id}`} className="teacher-btn">Open class<ArrowUpRight size={16}/></Link><Link href={`/teacher/classhub/${cls.id}/progress`} className="teacher-btn teacher-btn--secondary" aria-label={`Student progress for ${cls.name}${cls.stream ? ` ${cls.stream}` : ''}`}>Progress</Link></div>
      </article>)}</div>
      {visible.length===0 && <div className="teacher-state"><h2>No matching classes</h2><p>Try a different class or subject name.</p><button type="button" className="teacher-btn teacher-btn--secondary" onClick={()=>setQuery('')}>Clear search</button></div>}
    </>}
  </TeacherWorkspace>
}
function SchoolIcon(){return <BookOpen size={24} aria-hidden="true"/>}
