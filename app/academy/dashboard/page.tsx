'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import styles from './dashboard.module.css'

type Tab = 'overview' | 'classes' | 'students' | 'lessons'

export default function AcademyDashboard() {
  const router     = useRouter()
  const [userName, setUserName] = useState<string | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState<Tab>('overview')

  useEffect(() => {
    async function checkSession() {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) { router.replace('/academy/select-role'); return }
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single()
      if (!profile || profile.role !== 'teacher') {
        router.replace('/academy/select-role'); return
      }
      setUserName(profile.full_name ?? user.email ?? null)
      setLoading(false)
    }
    checkSession()
  }, [router])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/academy/select-role')
  }

  if (loading) {
    return (
      <div className={styles.root}>
        <div className={styles.loader} aria-label="Loading" />
      </div>
    )
  }

  return (
    <div className={styles.root}>

      <header className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <svg width="22" height="26" viewBox="0 0 72 84" aria-hidden>
            <path d="M36,4 L68,16 L68,52 Q68,76 36,82 Q4,76 4,52 L4,16 Z" fill="none" stroke="#C8A84B" strokeWidth="1.4" strokeLinejoin="round"/>
            <line x1="36" y1="10.76" x2="36" y2="77.64" stroke="#C8A84B" strokeWidth="1.4"/>
            <line x1="8.56" y1="44" x2="63.44" y2="44" stroke="#C8A84B" strokeWidth="1.4"/>
            <circle cx="36" cy="10.76" r="2.4" fill="#C8A84B"/>
            <circle cx="36" cy="77.64" r="2.4" fill="#C8A84B"/>
            <circle cx="8.56" cy="44" r="2.4" fill="#C8A84B"/>
            <circle cx="63.44" cy="44" r="2.4" fill="#C8A84B"/>
          </svg>
          <span className={styles.topBarTitle}>VIBESCHOOL</span>
        </div>
        <button className={styles.signOutBtn} onClick={handleSignOut}>SIGN OUT</button>
      </header>

      <section className={styles.hero}>
        <p className={styles.heroLabel}>ACADEMY · TEACHER</p>
        <p className={styles.heroName}>{userName}</p>
        <p className={styles.heroSub}>{"What are we building today?"}</p>
      </section>

      <nav className={styles.tabs}>
        {(['overview', 'classes', 'students', 'lessons'] as Tab[]).map(t => (
          <button key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}>
            {t.toUpperCase()}
          </button>
        ))}
      </nav>

      <main className={styles.main}>

        {tab === 'overview' && (
          <div className={styles.grid}>
            <div className={styles.card} onClick={() => setTab('classes')}>
              <p className={styles.cardLabel}>CLASSES</p>
              <p className={styles.cardValue}>—</p>
              <p className={styles.cardHint}>Tap to manage</p>
            </div>
            <div className={styles.card} onClick={() => setTab('students')}>
              <p className={styles.cardLabel}>STUDENTS</p>
              <p className={styles.cardValue}>—</p>
              <p className={styles.cardHint}>Tap to manage</p>
            </div>
            <div className={styles.card} onClick={() => setTab('lessons')}>
              <p className={styles.cardLabel}>LESSON PLANS</p>
              <p className={styles.cardValue}>—</p>
              <p className={styles.cardHint}>Tap to generate</p>
            </div>
          </div>
        )}

        {tab === 'classes' && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTitle}>MY CLASSES</p>
              <button className={styles.addBtn}>+ NEW CLASS</button>
            </div>
            <div className={styles.empty}>
              <p>No classes yet.</p>
              <p>Tap <strong>+ NEW CLASS</strong> to create one.</p>
            </div>
          </div>
        )}

        {tab === 'students' && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTitle}>MY STUDENTS</p>
              <button className={styles.addBtn}>+ ADD STUDENT</button>
            </div>
            <div className={styles.empty}>
              <p>No students yet.</p>
              <p>Create a class first, then add students.</p>
            </div>
          </div>
        )}

        {tab === 'lessons' && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionTitle}>LESSON PLANS</p>
              <button className={styles.addBtn}>+ GENERATE</button>
            </div>
            <div className={styles.empty}>
              <p>No lesson plans yet.</p>
              <p>Tap <strong>+ GENERATE</strong> to create one with AI.</p>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}