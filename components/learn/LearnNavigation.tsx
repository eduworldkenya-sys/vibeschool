'use client'

import { Suspense, useEffect, useState, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PublicBottomNav } from '@/components/public/PublicBottomNav'
import StudentBottomNav from '@/components/student/BottomNav'
import styles from './LearnNavigation.module.css'

/**
 * Use one existing public or student navigation on Learn discovery surfaces.
 * Auth role is only a display hint. Protected destinations keep their own checks.
 */
function useStudentNavigation(): boolean | null {
  const [student, setStudent] = useState<boolean | null>(null)
  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!mounted) return
        if (!user) { setStudent(false); return }
        const { data, error } = await supabase.rpc('get_my_role')
        if (mounted) setStudent(!error && data === 'student')
      } catch {
        if (mounted) setStudent(false)
      }
    })()
    return () => { mounted = false }
  }, [])
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
      <Link href="/" className={styles.websiteHome}>Website home</Link>
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

export function LearnRouteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const showHeader = isLearnDiscoveryPath(pathname)
  const showBottom = usesLearnBottomNav(pathname) && !isStoryReadingPath(pathname)
  const student = useStudentNavigation()

  return <>
    {showHeader && <Suspense fallback={null}><LearnHeader/></Suspense>}
    {children}
    {showBottom && (student === null
      ? <div className={styles.navReserve} aria-hidden="true"/>
      : student
        ? <div className={styles.studentNavTheme}><StudentBottomNav/><div className={styles.navReserve} aria-hidden="true"/></div>
        : <PublicBottomNav forceVisible/>)}
  </>
}
