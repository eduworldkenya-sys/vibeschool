'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import styles from './dashboard.module.css'

export default function GlobalDashboard() {
  const router = useRouter()
  const [userName, setUserName] = useState<string | null>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function checkSession() {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) { router.replace('/global/signin'); return }
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()
      setUserName(profile?.full_name ?? user.email ?? null)
      setLoading(false)
    }
    checkSession()
  }, [router])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/global/signin')
  }

  if (loading) {
    return (
      <div id="global-dashboard-root" className={styles.root}>
        <div className={styles.loader} aria-label="Loading" />
      </div>
    )
  }

  return (
    <div id="global-dashboard-root" className={styles.root}>
      <div className={styles.content}>
        <p className={styles.world}>GLOBAL</p>
        <p className={styles.welcome}>Welcome,</p>
        <p className={styles.name}>{userName}</p>
        <button className={styles.signOut} onClick={handleSignOut}>SIGN OUT</button>
      </div>
    </div>
  )
}