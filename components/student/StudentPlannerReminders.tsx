'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useStudent } from '@/lib/student-context'
import { dueReminders, type DueReminder, type ReminderItem } from '@/lib/student/planner-reminders'

/** Mounted once across Student OS. In-app alerts work only while the app is open. */
export default function StudentPlannerReminders() {
  const { identity } = useStudent()
  const owner = identity?.profileId
  const router = useRouter()
  const pathname = usePathname()
  const [due, setDue] = useState<DueReminder[]>([])
  const [error, setError] = useState('')
  const [browserEnabled, setBrowserEnabled] = useState(false)
  const notified = useRef(new Set<string>())
  const active = due[0]

  const poll = useCallback(async () => {
    if (!owner) return
    const { data, error: loadError } = await supabase.from('student_personal_planner')
      .select('id,title,kind,starts_at,due_at,repeat_rule,completed_at,reminder_minutes,reminder_seen_occurrence_at')
      .eq('owner_user_id', owner)
      .not('reminder_minutes','is',null)
      .is('completed_at',null)
      .limit(500)
    if (loadError) { setError('Reminders could not be checked.'); return }
    setError('')
    const reminders = dueReminders((data ?? []) as ReminderItem[])
    setDue(reminders)
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      for (const reminder of reminders) {
        const key = reminder.item.id + ':' + reminder.occurrence.toISOString()
        if (notified.current.has(key)) continue
        notified.current.add(key)
        if (document.visibilityState !== 'visible') {
          try { new Notification('VibeSchool study reminder', { body: reminder.item.title, tag: key }) }
          catch { /* Browser/device may not support the notification constructor. */ }
        }
      }
    }
  }, [owner])

  useEffect(() => {
    if (!owner) { setDue([]); notified.current.clear(); return }
    notified.current.clear()
    void poll()
    const timer = window.setInterval(() => { void poll() }, 60_000)
    const onFocus = () => { void poll() }
    const onVisible = () => { if (document.visibilityState === 'visible') void poll() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.clearInterval(timer);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisible) }
  }, [owner,poll])

  useEffect(() => {
    setBrowserEnabled(typeof Notification !== 'undefined' && Notification.permission === 'granted')
  }, [])

  async function acknowledge(reminder: DueReminder, open: boolean) {
    if (!owner) return
    const { data, error: saveError } = await supabase.from('student_personal_planner')
      .update({ reminder_seen_occurrence_at: reminder.occurrence.toISOString() })
      .eq('id',reminder.item.id).eq('owner_user_id',owner).select('id').single()
    if (saveError || !data) { setError('Could not dismiss this reminder.'); return }
    setDue(previous => previous.filter(row=>!(row.item.id===reminder.item.id && row.occurrence.getTime()===reminder.occurrence.getTime())))
    if (open) router.push('/student/tasks')
  }

  // Study reminders remain accessible from Tasks, but must not cover exam choices,
  // answer controls or result-review actions. The planner is still polled in the background.
  const examFocused = pathname?.startsWith('/student/vibelearn/exams') ||
    pathname?.startsWith('/student/assessment/') || pathname?.startsWith('/student/results/')
  if (!owner || examFocused) return null
  return <>
    {active && <aside role="status" aria-live="polite" style={{position:'fixed',right:12,bottom:'calc(84px + env(safe-area-inset-bottom, 0px))',width:'min(360px,calc(100vw - 24px))',zIndex:900,padding:15,borderRadius:14,background:'#fff',color:'var(--vs-text)',border:'1px solid var(--vs-border)',boxShadow:'0 14px 42px rgba(15,23,42,.22)',display:'grid',gap:9}}>
      <div style={{display:'flex',alignItems:'center',gap:8}}><Bell size={19} color="var(--vs-accent)"/><strong style={{flex:1}}>Study reminder</strong><button type="button" aria-label="Dismiss reminder" onClick={()=>void acknowledge(active,false)} style={{border:0,background:'transparent',padding:8,cursor:'pointer'}}><X size={18}/></button></div>
      <p style={{margin:0,fontSize:14,overflowWrap:'anywhere'}}>{active.item.title}</p>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}><span style={{fontSize:12,color:'var(--vs-muted)'}}>{due.length>1?due.length+' pending reminders':'Scheduled activity'}</span><button type="button" onClick={()=>void acknowledge(active,true)} style={{border:0,padding:'10px 14px',borderRadius:9,color:'#fff',background:'var(--vs-accent)',cursor:'pointer',minHeight:44}}>Open planner</button></div>
      {error && <p role="alert" style={{fontSize:12,color:'#b91c1c',margin:0}}>{error}</p>}
    </aside>}
    {/* Permission is requested only from a deliberate user action on the Tasks screen. */}
    <span hidden data-browser-reminders={browserEnabled?'enabled':'disabled'}/>
  </>
}
