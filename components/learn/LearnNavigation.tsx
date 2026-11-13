'use client'

import { Suspense, useEffect, useState, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PublicBottomNav } from '@/components/public/PublicBottomNav'
import StudentBottomNav from '@/components/student/BottomNav'
import styles from './LearnNavigation.module.css'
import {DEFAULT_LEARNER_APPEARANCE,LEARNER_APPEARANCE_EVENT,readLearnerAppearance,learnerAppearanceStyle,type LearnerAppearance} from '@/lib/student-appearance'

/**
 * Use one existing public or student navigation on Learn discovery surfaces.
 * Auth role is only a display hint. Protected destinations keep their own checks.
 */
function useStudentNavigation(enabled: boolean): boolean | null {
  const [student, setStudent] = useState<boolean | null>(null)
  useEffect(() => {
    if (!enabled) return
    let mounted = true
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!mounted) return
        if (!user) { setStudent(false); return }
        // One email may hold learner, teacher and guardian relationships.
        // The old single profiles.role hint must not hide learner navigation.
        const { data: learner } = await supabase.from('students')
          .select('id').eq('profile_id',user.id).is('deleted_at',null).limit(1).maybeSingle()
        if (learner?.id) { if(mounted)setStudent(true); return }
        const { data: { session } } = await supabase.auth.getSession()
        if(session){
          try{
            const response=await fetch('/api/learner/independent/home',{
              headers:{Authorization:'Bearer '+session.access_token}
            })
            if(response.ok){
              const payload=await response.json() as {kind?:string}
              if(payload.kind==='independent'){if(mounted)setStudent(true);return}
            }
          }catch{/* The role hint below is still safe for display. */}
        }
        const { data, error } = await supabase.rpc('get_my_role')
        if (mounted) setStudent(!error && data === 'student')
      } catch {
        if (mounted) setStudent(false)
      }
    })()
    return () => { mounted = false }
  }, [enabled])
  return student
}

/** Only shared discovery pages own the Learn header; subject/course readers own theirs. */
export function isLearnDiscoveryPath(pathname: string): boolean {
  return pathname === '/learn'
    || pathname === '/learn/visuals'
    || pathname === '/learn/stories'
    || /^\/learn\/stories\/[^/]+$/.test(pathname)
}

export function isStoryReadingPath(pathname: string): boolean {
  return /^\/learn\/stories\/[^/]+\/read$/.test(pathname)
}

/** Course pages need the same bottom navigation, not the old two-button career dock. */
function usesLearnBottomNav(pathname: string): boolean {
  return isLearnDiscoveryPath(pathname)
    || (/^\/learn\/[^/]+(?:\/.*)?$/.test(pathname)
      && !pathname.startsWith('/learn/grade-')
      && !pathname.startsWith('/learn/stories/')
      && !pathname.startsWith('/learn/purchase/')
      && pathname !== '/learn/careers')
}

function LearnHeader() {
  const pathname = usePathname()
  const search = useSearchParams()
  const reading = pathname === '/learn' && search.get('view') === 'reading'
  const courses = pathname === '/learn' && search.get('view') === 'courses'
  const stories = pathname === '/learn/stories' || pathname.startsWith('/learn/stories/')
  const subjects = pathname === '/learn' && !reading && !courses

  return <header className={styles.header}>
    <a href="#main-content" className={styles.skip}>Skip to learning content</a>
    <div className={styles.top}>
      <Link href="/" aria-label="VibeSchool website home" className={styles.logo}>
        <Image src="/brand/vibeschool-wordmark.svg" alt="VibeSchool" width={620} height={160} priority/>
      </Link>
      <Link href="/learn" className={styles.learnHome} aria-label="VibeSchool Learn home">Learn</Link>
    </div>
    <nav className={styles.sections} aria-label="VibeSchool Learn sections">
      <Link href="/learn" aria-current={subjects ? 'page' : undefined}>School subjects</Link>
      <Link href="/learn?view=reading" aria-current={reading ? 'page' : undefined}>All reading</Link>
      <Link href="/learn/stories" aria-current={stories ? 'page' : undefined}>Stories &amp; Series</Link>
      <Link href="/learn?view=courses" aria-current={courses ? 'page' : undefined}>College &amp; courses</Link>
      <Link href="/student/study">My learning</Link>
    </nav>
  </header>
}

function LearnPublicBottomNav() {
  const search = useSearchParams()
  return <PublicBottomNav forceVisible mode="learn" activeView={search.get('view')}/>
}

export function LearnRouteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const showHeader = isLearnDiscoveryPath(pathname)
  const showBottom = usesLearnBottomNav(pathname) && !isStoryReadingPath(pathname)
  const student = useStudentNavigation(showBottom || isStoryReadingPath(pathname))
  const [appearance,setAppearance]=useState<LearnerAppearance>(DEFAULT_LEARNER_APPEARANCE)
  const [systemDark,setSystemDark]=useState(false)
  useEffect(()=>{
    if(!student)return
    let active=true
    let studentId:string|null=null
    const media=window.matchMedia('(prefers-color-scheme: dark)')
    const updateMedia=()=>setSystemDark(media.matches)
    updateMedia();media.addEventListener('change',updateMedia)
    const update=()=>{if(active&&studentId)setAppearance(readLearnerAppearance(studentId))}
    void (async()=>{
      const {data:{user}}=await supabase.auth.getUser()
      if(!user||!active)return
      const {data}=await supabase.from('students').select('id')
        .eq('profile_id',user.id).is('deleted_at',null).limit(1).maybeSingle()
      studentId=data?.id??null
      update()
    })()
    window.addEventListener(LEARNER_APPEARANCE_EVENT,update)
    return()=>{active=false;window.removeEventListener(LEARNER_APPEARANCE_EVENT,update);media.removeEventListener('change',updateMedia)}
  },[student])

  return <div className={student?styles.studentLearnRoot:undefined}
    data-study-mode={student?appearance.studyMode:undefined}
    style={student?learnerAppearanceStyle(appearance,systemDark):undefined}>
    {showHeader && <Suspense fallback={null}><LearnHeader/></Suspense>}
    {showBottom ? <div className={student ? styles.studentLearnMain : undefined}>{children}</div> : children}
    {showBottom && (student === null
      ? <div className={styles.navReserve} aria-hidden="true"/>
      : student
        ? <div className={styles.studentNavTheme}><StudentBottomNav/><div className={styles.navReserve} aria-hidden="true"/></div>
        : <Suspense fallback={<div className={styles.navReserve} aria-hidden="true"/>}><LearnPublicBottomNav/></Suspense>)}
  </div>
}
