"use client";
export const dynamic = "force-dynamic";

import { useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  getMeeting,
  upsertAgendaItem,
  upsertAttendee,
  upsertAction,
  upsertMinutes,
  approveMinutes,
} from '@/lib/meetings'

const C = {
  hero:    '#0a1628',
  emerald: '#10b981',
  navy3:   '#0f5fa8',
  bg:      '#f0f4f8',
  border:  '#e2e8f0',
  muted:   '#64748b',
  white:   '#ffffff',
  red:     '#ef4444',
  surface: '#ffffff',
  text:    '#0f172a',
  textSm:  '#475569',
  amber:   '#f59e0b',
}

type TabId = 'agenda' | 'attendees' | 'actions' | 'minutes'
type AgendaStatus = 'pending' | 'in_progress' | 'done' | 'carried_forward'
type RsvpStatus = 'pending' | 'attending' | 'declined'
type ActionStatus = 'pending' | 'in_progress' | 'done' | 'overdue'
type ActionPriority = 'low' | 'medium' | 'high'
type MinutesStatus = 'draft' | 'review' | 'approved' | 'distributed'
type MeetingStatus = 'scheduled' | 'live' | 'completed' | 'cancelled'

interface Profile { id: string; full_name: string }

interface AgendaItem {
  id: string
  title: string
  description?: string
  duration_mins?: number
  order_index: number
  presenter_id?: string
  status: AgendaStatus
  notes?: string
}

interface Attendee {
  id: string
  profile_id: string
  role: string
  is_mandatory: boolean
  rsvp: RsvpStatus
  attended: boolean
  profiles?: Profile
}

interface Action {
  id: string
  title: string
  description?: string
  owner_id?: string
  due_date?: string
  priority: ActionPriority
  status: ActionStatus
  agenda_item_id?: string
}

interface Minutes {
  id: string
  content: string
  status: MinutesStatus
  drafted_by?: string
  approved_by?: string
  approved_at?: string
  created_at: string
  updated_at: string
}

interface Meeting {
  id: string
  title: string
  description?: string
  meeting_type: string
  status: MeetingStatus
  confidentiality: string
  chair_id?: string
  secretary_id?: string
  venue?: string
  meeting_link?: string
  scheduled_at: string
  duration_mins?: number
  started_at?: string
  ended_at?: string
  agenda_items?: AgendaItem[]
  attendees?: Attendee[]
  actions?: Action[]
  minutes?: Minutes[]
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block',
      width: 16, height: 16,
      border: '2px solid rgba(255,255,255,0.35)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 700,
      color,
      background: bg,
      letterSpacing: '0.04em',
    }}>
      {label}
    </span>
  )
}

const TYPE_BADGE: Record<string, { color: string; bg: string }> = {
  staff:      { color: '#1d4ed8', bg: '#eff6ff' },
  department: { color: '#7c3aed', bg: '#f5f3ff' },
  parents:    { color: '#0891b2', bg: '#ecfeff' },
  board:      { color: '#b45309', bg: '#fffbeb' },
  emergency:  { color: '#dc2626', bg: '#fef2f2' },
}

const STATUS_BADGE: Record<string, { color: string; bg: string; label: string }> = {
  scheduled:  { color: '#0891b2', bg: '#ecfeff',  label: 'Scheduled' },
  live:       { color: '#10b981', bg: '#ecfdf5',  label: '🔴 Live' },
  completed:  { color: '#64748b', bg: '#f1f5f9',  label: 'Completed' },
  cancelled:  { color: '#dc2626', bg: '#fef2f2',  label: 'Cancelled' },
}

const AGENDA_STATUS_CYCLE: AgendaStatus[] = ['pending', 'in_progress', 'done', 'carried_forward']
const AGENDA_STATUS_META: Record<AgendaStatus, { label: string; color: string; bg: string }> = {
  pending:          { label: 'Pending',          color: '#64748b', bg: '#f1f5f9' },
  in_progress:      { label: 'In Progress',      color: '#0891b2', bg: '#ecfeff' },
  done:             { label: 'Done',             color: '#10b981', bg: '#ecfdf5' },
  carried_forward:  { label: 'Carried Forward',  color: '#f59e0b', bg: '#fffbeb' },
}

const RSVP_META: Record<RsvpStatus, { label: string; color: string; bg: string }> = {
  pending:   { label: 'No Response', color: '#64748b', bg: '#f1f5f9' },
  attending: { label: 'Attending',   color: '#10b981', bg: '#ecfdf5' },
  declined:  { label: 'Declined',    color: '#dc2626', bg: '#fef2f2' },
}

const PRIORITY_META: Record<ActionPriority, { label: string; color: string; bg: string }> = {
  low:    { label: 'Low',    color: '#64748b', bg: '#f1f5f9' },
  medium: { label: 'Medium', color: '#f59e0b', bg: '#fffbeb' },
  high:   { label: 'High',   color: '#dc2626', bg: '#fef2f2' },
}

const ACTION_STATUS_META: Record<ActionStatus, { label: string; color: string; bg: string }> = {
  pending:     { label: 'Pending',     color: '#64748b', bg: '#f1f5f9' },
  in_progress: { label: 'In Progress', color: '#0891b2', bg: '#ecfeff' },
  done:        { label: 'Done',        color: '#10b981', bg: '#ecfdf5' },
  overdue:     { label: 'Overdue',     color: '#dc2626', bg: '#fef2f2' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-KE', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
}

export default function MeetingDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('agenda')
  const [profiles, setProfiles] = useState<Profile[]>([])

  // Agenda state
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([])
  const [showAddAgenda, setShowAddAgenda] = useState(false)
  const [newAgendaTitle, setNewAgendaTitle] = useState('')
  const [newAgendaDuration, setNewAgendaDuration] = useState('')
  const [newAgendaPresenter, setNewAgendaPresenter] = useState('')
  const [savingAgenda, setSavingAgenda] = useState(false)

  // Attendees state
  const [attendees, setAttendees] = useState<Attendee[]>([])

  // Actions state
  const [actions, setActions] = useState<Action[]>([])
  const [showAddAction, setShowAddAction] = useState(false)
  const [newActionTitle, setNewActionTitle] = useState('')
  const [newActionOwner, setNewActionOwner] = useState('')
  const [newActionDue, setNewActionDue] = useState('')
  const [newActionPriority, setNewActionPriority] = useState<ActionPriority>('medium')
  const [savingAction, setSavingAction] = useState(false)

  // Minutes state
  const [minutes, setMinutes] = useState<Minutes | null>(null)
  const [minutesContent, setMinutesContent] = useState('')
  const [savingMinutes, setSavingMinutes] = useState(false)
  const [minutesStatus, setMinutesStatus] = useState<MinutesStatus | null>(null)

  // Meeting actions
  const [confirm, setConfirm] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/admin/login'); return }
      setCurrentUserId(user.id)

      const m = await getMeeting(id) as Meeting
      if (!m) throw new Error('Meeting not found')
      setMeeting(m)
      setAgendaItems((m.agenda_items ?? []).sort((a, b) => a.order_index - b.order_index))
      setAttendees(m.attendees ?? [])
      setActions(m.actions ?? [])

      const mins = m.minutes?.[0] ?? null
      setMinutes(mins)
      setMinutesContent(mins?.content ?? '')
      setMinutesStatus(mins?.status ?? null)

      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('school_id', (m as unknown as { school_id: string }).school_id)
        .order('full_name')
      setProfiles(profs ?? [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load meeting')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  const initRef = useRef(false)
  if (!initRef.current) { initRef.current = true; load() }

  const profileName = (pid?: string) =>
    profiles.find(p => p.id === pid)?.full_name ?? '—'

  const updateMeetingStatus = async (
    status: MeetingStatus,
    extra?: { started_at?: string; ended_at?: string }
  ) => {
    setActionLoading(true)
    try {
      const { error: e } = await supabase
        .from('meetings')
        .update({ status, ...extra })
        .eq('id', id)
      if (e) throw e
      setMeeting(prev => prev ? { ...prev, status, ...extra } : prev)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setActionLoading(false)
      setConfirm(null)
    }
  }

  const cycleAgendaStatus = async (item: AgendaItem) => {
    const idx = AGENDA_STATUS_CYCLE.indexOf(item.status)
    const next = AGENDA_STATUS_CYCLE[(idx + 1) % AGENDA_STATUS_CYCLE.length]
    const updated = { ...item, status: next }
    setAgendaItems(prev => prev.map(a => a.id === item.id ? updated : a))
    await upsertAgendaItem({ ...updated, meeting_id: id })
  }

  const addAgendaItem = async () => {
    if (!newAgendaTitle.trim()) return
    setSavingAgenda(true)
    try {
      const item = await upsertAgendaItem({
        meeting_id: id,
        title: newAgendaTitle.trim(),
        duration_mins: newAgendaDuration ? parseInt(newAgendaDuration) : undefined,
        presenter_id: newAgendaPresenter || undefined,
        order_index: agendaItems.length,
        status: 'pending',
      })
      if (item) setAgendaItems(prev => [...prev, item as AgendaItem])
      setNewAgendaTitle(''); setNewAgendaDuration(''); setNewAgendaPresenter('')
      setShowAddAgenda(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add agenda item')
    } finally {
      setSavingAgenda(false)
    }
  }

  const toggleAttendance = async (att: Attendee) => {
    if (!meeting || !['live', 'completed'].includes(meeting.status)) return
    const updated = { ...att, attended: !att.attended }
    setAttendees(prev => prev.map(a => a.id === att.id ? updated : a))
    await upsertAttendee({ ...updated, meeting_id: id })
  }

  const addAction = async () => {
    if (!newActionTitle.trim()) return
    setSavingAction(true)
    try {
      const action = await upsertAction({
        meeting_id: id,
        title: newActionTitle.trim(),
        owner_id: newActionOwner || undefined,
        due_date: newActionDue || undefined,
        priority: newActionPriority,
        status: 'pending',
      })
      if (action) setActions(prev => [...prev, action as Action])
      setNewActionTitle(''); setNewActionOwner(''); setNewActionDue('')
      setNewActionPriority('medium'); setShowAddAction(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add action')
    } finally {
      setSavingAction(false)
    }
  }

  const cycleActionStatus = async (action: Action) => {
    const cycle: ActionStatus[] = ['pending', 'in_progress', 'done', 'overdue']
    const idx = cycle.indexOf(action.status)
    const next = cycle[(idx + 1) % cycle.length]
    const updated = { ...action, status: next }
    setActions(prev => prev.map(a => a.id === action.id ? updated : a))
    await upsertAction({ ...updated, meeting_id: id })
  }

  const startMinutes = async () => {
    setSavingMinutes(true)
    try {
      const m = await upsertMinutes({
        meeting_id: id,
        content: '',
        status: 'draft',
        drafted_by: currentUserId,
      })
      if (m) { setMinutes(m as Minutes); setMinutesStatus('draft') }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start minutes')
    } finally {
      setSavingMinutes(false)
    }
  }

  const saveMinutesContent = async () => {
    if (!minutes) return
    setSavingMinutes(true)
    try {
      await upsertMinutes({ ...minutes, content: minutesContent, meeting_id: id })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save minutes')
    } finally {
      setSavingMinutes(false)
    }
  }

  const advanceMinutesStatus = async () => {
    if (!minutes) return
    const next: Record<MinutesStatus, MinutesStatus> = {
      draft: 'review', review: 'approved', approved: 'distributed', distributed: 'distributed',
    }
    const nextStatus = next[minutesStatus ?? 'draft']
    setSavingMinutes(true)
    try {
      if (nextStatus === 'approved') {
        await approveMinutes(minutes.id, currentUserId)
      } else {
        await upsertMinutes({ ...minutes, content: minutesContent, status: nextStatus, meeting_id: id })
      }
      setMinutesStatus(nextStatus)
      setMinutes(prev => prev ? { ...prev, status: nextStatus } : prev)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update minutes status')
    } finally {
      setSavingMinutes(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: `3px solid ${C.border}`, borderTopColor: C.hero, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    )
  }

  if (!meeting) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 32 }}>😕</div>
        <div style={{ color: C.muted, fontSize: 15 }}>Meeting not found</div>
        <button onClick={() => router.back()} style={{ padding: '10px 20px', background: C.hero, color: C.white, border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 14 }}>Go Back</button>
      </div>
    )
  }

  const typeMeta = TYPE_BADGE[meeting.meeting_type] ?? { color: C.muted, bg: C.bg }
  const statusMeta = STATUS_BADGE[meeting.status] ?? { color: C.muted, bg: C.bg, label: meeting.status }

  const attending = attendees.filter(a => a.rsvp === 'attending').length
  const declined = attendees.filter(a => a.rsvp === 'declined').length
  const noResponse = attendees.filter(a => a.rsvp === 'pending').length

  const TABS: { id: TabId; label: string }[] = [
    { id: 'agenda',    label: 'Agenda' },
    { id: 'attendees', label: 'Attendees' },
    { id: 'actions',   label: 'Actions' },
    { id: 'minutes',   label: 'Minutes' },
  ]

  const minutesNextLabel: Record<MinutesStatus, string> = {
    draft: 'Submit for Review',
    review: 'Approve',
    approved: 'Distribute',
    distributed: 'Distributed ✓',
  }

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: C.hero, display: 'flex', alignItems: 'center',
        gap: 12, padding: '14px 16px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
      }}>
        <button onClick={() => router.back()} style={{
          background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10,
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: C.white, fontSize: 18, flexShrink: 0,
        }}>←</button>
        <span style={{ color: C.white, fontWeight: 700, fontSize: 17, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {meeting.title}
        </span>
        <button onClick={() => router.push(`/admin/meetings/${id}/edit`)} style={{
          background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10,
          padding: '8px 12px', color: C.white, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>Edit</button>
      </div>

      <div style={{ background: C.bg, minHeight: '100vh', paddingBottom: 80 }}>

        {/* Error */}
        {error && (
          <div style={{ margin: '12px 16px', background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 12, padding: '12px 14px', color: '#dc2626', fontSize: 14, fontWeight: 500 }}>
            {error}
          </div>
        )}

        {/* Hero card */}
        <div style={{ margin: '16px 16px 0', background: C.surface, borderRadius: 16, padding: '20px 16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            <Badge label={meeting.meeting_type.charAt(0).toUpperCase() + meeting.meeting_type.slice(1)} color={typeMeta.color} bg={typeMeta.bg} />
            <Badge label={statusMeta.label} color={statusMeta.color} bg={statusMeta.bg} />
            <Badge label={meeting.confidentiality.replace('_', ' ')} color={C.muted} bg={C.bg} />
          </div>

          <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 12 }}>{meeting.title}</div>
          {meeting.description && <div style={{ fontSize: 14, color: C.textSm, marginBottom: 12, lineHeight: 1.5 }}>{meeting.description}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, color: C.textSm }}>
            <div>📅 {formatDate(meeting.scheduled_at)} · {formatTime(meeting.scheduled_at)}{meeting.duration_mins ? ` · ${meeting.duration_mins} min` : ''}</div>
            {meeting.venue && <div>📍 {meeting.venue}</div>}
            {meeting.meeting_link && (
              <div>🔗 <a href={meeting.meeting_link} target="_blank" rel="noreferrer" style={{ color: C.navy3, textDecoration: 'none', fontWeight: 600 }}>Join Meeting</a></div>
            )}
            <div>🪑 Chair: <strong style={{ color: C.text }}>{profileName(meeting.chair_id)}</strong></div>
            <div>📝 Secretary: <strong style={{ color: C.text }}>{profileName(meeting.secretary_id)}</strong></div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            {meeting.status === 'scheduled' && (
              <button onClick={() => updateMeetingStatus('live', { started_at: new Date().toISOString() })} disabled={actionLoading} style={{
                flex: 1, padding: '11px', background: C.emerald, color: C.white, border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}>
                {actionLoading ? <Spinner /> : '▶ Start Meeting'}
              </button>
            )}
            {meeting.status === 'live' && (
              <button onClick={() => updateMeetingStatus('completed', { ended_at: new Date().toISOString() })} disabled={actionLoading} style={{
                flex: 1, padding: '11px', background: C.hero, color: C.white, border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}>
                {actionLoading ? <Spinner /> : '⏹ End Meeting'}
              </button>
            )}
            {['scheduled', 'live'].includes(meeting.status) && (
              confirm === 'cancel' ? (
                <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                  <button onClick={() => updateMeetingStatus('cancelled')} style={{ flex: 1, padding: '11px', background: C.red, color: C.white, border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Confirm Cancel</button>
                  <button onClick={() => setConfirm(null)} style={{ flex: 1, padding: '11px', background: C.bg, color: C.text, border: `1.5px solid ${C.border}`, borderRadius: 12, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Keep</button>
                </div>
              ) : (
                <button onClick={() => setConfirm('cancel')} style={{
                  padding: '11px 16px', background: '#fef2f2', color: C.red, border: `1.5px solid #fca5a5`, borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}>Cancel</button>
              )
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex', background: C.surface, margin: '12px 16px 0',
          borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
        }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              flex: 1, padding: '13px 4px', border: 'none', background: 'transparent',
              fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? C.emerald : C.muted,
              borderBottom: activeTab === tab.id ? `2.5px solid ${C.emerald}` : '2.5px solid transparent',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ margin: '12px 16px 0' }}>

          {/* AGENDA TAB */}
          {activeTab === 'agenda' && (
            <div>
              {agendaItems.length === 0 && !showAddAgenda && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted, fontSize: 14 }}>No agenda items yet</div>
              )}
              {agendaItems.map((item, i) => {
                const sm = AGENDA_STATUS_META[item.status]
                return (
                  <div key={item.id} style={{ background: C.surface, borderRadius: 12, padding: '14px', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, minWidth: 20 }}>{i + 1}.</span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{item.title}</span>
                        </div>
                        {item.duration_mins && <div style={{ fontSize: 12, color: C.muted, marginLeft: 28 }}>⏱ {item.duration_mins} min</div>}
                        {item.presenter_id && <div style={{ fontSize: 12, color: C.muted, marginLeft: 28 }}>👤 {profileName(item.presenter_id)}</div>}
                      </div>
                      <button onClick={() => cycleAgendaStatus(item)} style={{
                        padding: '4px 10px', borderRadius: 99, border: 'none',
                        background: sm.bg, color: sm.color, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                      }}>
                        {sm.label}
                      </button>
                    </div>
                  </div>
                )
              })}

              {showAddAgenda ? (
                <div style={{ background: C.surface, borderRadius: 12, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>New Agenda Item</div>
                  <input placeholder="Title *" value={newAgendaTitle} onChange={e => setNewAgendaTitle(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, background: C.bg, marginBottom: 8, fontFamily: 'inherit', color: C.text, outline: 'none' }} />
                  <input placeholder="Duration (mins)" type="number" value={newAgendaDuration} onChange={e => setNewAgendaDuration(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, background: C.bg, marginBottom: 8, fontFamily: 'inherit', color: C.text, outline: 'none' }} />
                  <select value={newAgendaPresenter} onChange={e => setNewAgendaPresenter(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, background: C.bg, marginBottom: 12, fontFamily: 'inherit', color: newAgendaPresenter ? C.text : C.muted, outline: 'none' }}>
                    <option value="">Select presenter…</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={addAgendaItem} disabled={savingAgenda} style={{ flex: 1, padding: '11px', background: C.hero, color: C.white, border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                      {savingAgenda ? <Spinner /> : 'Add Item'}
                    </button>
                    <button onClick={() => setShowAddAgenda(false)} style={{ padding: '11px 16px', background: C.bg, color: C.text, border: `1.5px solid ${C.border}`, borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddAgenda(true)} style={{ width: '100%', padding: '13px', background: C.surface, color: C.hero, border: `1.5px dashed ${C.border}`, borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', marginTop: 4 }}>
                  + Add Agenda Item
                </button>
              )}
            </div>
          )}

          {/* ATTENDEES TAB */}
          {activeTab === 'attendees' && (
            <div>
              <div style={{ background: C.surface, borderRadius: 12, padding: '12px 14px', marginBottom: 12, display: 'flex', gap: 16, fontSize: 13 }}>
                <span style={{ color: C.emerald, fontWeight: 700 }}>{attending} attending</span>
                <span style={{ color: C.red, fontWeight: 700 }}>{declined} declined</span>
                <span style={{ color: C.muted, fontWeight: 600 }}>{noResponse} no response</span>
              </div>
              {attendees.map(att => {
                const rsvpM = RSVP_META[att.rsvp]
                const canToggle = meeting && ['live', 'completed'].includes(meeting.status)
                return (
                  <div key={att.id} style={{ background: C.surface, borderRadius: 12, padding: '14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.hero, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.white, fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                      {(att.profiles?.full_name ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.profiles?.full_name ?? att.profile_id}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: C.bg, color: C.muted, fontWeight: 600 }}>{att.role}</span>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: rsvpM.bg, color: rsvpM.color, fontWeight: 700 }}>{rsvpM.label}</span>
                      </div>
                    </div>
                    <div
                      onClick={() => canToggle && toggleAttendance(att)}
                      style={{
                        width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                        background: att.attended ? C.emerald : 'transparent',
                        border: `2px solid ${att.attended ? C.emerald : C.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: canToggle ? 'pointer' : 'default',
                        opacity: canToggle ? 1 : 0.4,
                      }}
                    >
                      {att.attended && <span style={{ color: C.white, fontSize: 13 }}>✓</span>}
                    </div>
                  </div>
                )
              })}
              {attendees.length === 0 && <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted, fontSize: 14 }}>No attendees added</div>}
            </div>
          )}

          {/* ACTIONS TAB */}
          {activeTab === 'actions' && (
            <div>
              {actions.map(action => {
                const pm = PRIORITY_META[action.priority]
                const sm = ACTION_STATUS_META[action.status]
                return (
                  <div key={action.id} style={{ background: C.surface, borderRadius: 12, padding: '14px', marginBottom: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>{action.title}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: pm.bg, color: pm.color, fontWeight: 700 }}>{pm.label}</span>
                          <button onClick={() => cycleActionStatus(action)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: sm.bg, color: sm.color, fontWeight: 700, border: 'none', cursor: 'pointer' }}>{sm.label}</button>
                        </div>
                        {action.owner_id && <div style={{ fontSize: 12, color: C.muted }}>👤 {profileName(action.owner_id)}</div>}
                        {action.due_date && <div style={{ fontSize: 12, color: C.muted }}>📅 Due {action.due_date}</div>}
                      </div>
                    </div>
                  </div>
                )
              })}
              {actions.length === 0 && !showAddAction && <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted, fontSize: 14 }}>No actions yet</div>}

              {showAddAction ? (
                <div style={{ background: C.surface, borderRadius: 12, padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>New Action</div>
                  <input placeholder="Title *" value={newActionTitle} onChange={e => setNewActionTitle(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, background: C.bg, marginBottom: 8, fontFamily: 'inherit', color: C.text, outline: 'none' }} />
                  <select value={newActionOwner} onChange={e => setNewActionOwner(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, background: C.bg, marginBottom: 8, fontFamily: 'inherit', color: newActionOwner ? C.text : C.muted, outline: 'none' }}>
                    <option value="">Assign owner…</option>
                    {attendees.map(a => <option key={a.profile_id} value={a.profile_id}>{a.profiles?.full_name ?? a.profile_id}</option>)}
                  </select>
                  <input type="date" value={newActionDue} onChange={e => setNewActionDue(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, background: C.bg, marginBottom: 8, fontFamily: 'inherit', color: C.text, outline: 'none' }} />
                  <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                    {(['low', 'medium', 'high'] as ActionPriority[]).map(p => (
                      <button key={p} onClick={() => setNewActionPriority(p)} style={{
                        flex: 1, padding: '8px', borderRadius: 10, border: `1.5px solid ${newActionPriority === p ? PRIORITY_META[p].color : C.border}`,
                        background: newActionPriority === p ? PRIORITY_META[p].bg : C.white, color: newActionPriority === p ? PRIORITY_META[p].color : C.muted,
                        fontWeight: 700, fontSize: 12, cursor: 'pointer',
                      }}>{PRIORITY_META[p].label}</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={addAction} disabled={savingAction} style={{ flex: 1, padding: '11px', background: C.hero, color: C.white, border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                      {savingAction ? <Spinner /> : 'Add Action'}
                    </button>
                    <button onClick={() => setShowAddAction(false)} style={{ padding: '11px 16px', background: C.bg, color: C.text, border: `1.5px solid ${C.border}`, borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddAction(true)} style={{ width: '100%', padding: '13px', background: C.surface, color: C.hero, border: `1.5px dashed ${C.border}`, borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', marginTop: 4 }}>
                  + Add Action
                </button>
              )}
            </div>
          )}

          {/* MINUTES TAB */}
          {activeTab === 'minutes' && (
            <div>
              {!minutes ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                  <div style={{ color: C.muted, fontSize: 14, marginBottom: 20 }}>No minutes started yet</div>
                  <button onClick={startMinutes} disabled={savingMinutes} style={{ padding: '12px 28px', background: C.hero, color: C.white, border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                    {savingMinutes ? <Spinner /> : 'Start Minutes'}
                  </button>
                </div>
              ) : minutesStatus === 'approved' || minutesStatus === 'distributed' ? (
                <div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    <Badge label={minutesStatus === 'distributed' ? 'Distributed ✓' : 'Approved ✓'} color="#10b981" bg="#ecfdf5" />
                  </div>
                  <div style={{ background: C.surface, borderRadius: 12, padding: '16px', whiteSpace: 'pre-wrap', fontSize: 14, color: C.text, lineHeight: 1.7, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    {minutesContent || 'No content'}
                  </div>
                  {minutes.approved_by && (
                    <div style={{ marginTop: 12, fontSize: 12, color: C.muted }}>
                      Approved by {profileName(minutes.approved_by)}{minutes.approved_at ? ` · ${formatDate(minutes.approved_at)}` : ''}
                    </div>
                  )}
                  {minutesStatus === 'approved' && (
                    <button onClick={advanceMinutesStatus} disabled={savingMinutes} style={{ width: '100%', marginTop: 16, padding: '13px', background: C.emerald, color: C.white, border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                      {savingMinutes ? <Spinner /> : 'Distribute'}
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <Badge
                      label={minutesStatus === 'draft' ? 'Draft' : 'Under Review'}
                      color={minutesStatus === 'draft' ? C.muted : '#f59e0b'}
                      bg={minutesStatus === 'draft' ? C.bg : '#fffbeb'}
                    />
                  </div>
                  <textarea
                    value={minutesContent}
                    onChange={e => setMinutesContent(e.target.value)}
                    onBlur={saveMinutesContent}
                    placeholder="Type meeting minutes here… (auto-saves on blur)"
                    rows={12}
                    style={{
                      width: '100%', boxSizing: 'border-box', padding: '14px',
                      borderRadius: 12, border: `1.5px solid ${C.border}`,
                      fontSize: 14, background: C.surface, color: C.text,
                      lineHeight: 1.7, resize: 'vertical', outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                  {savingMinutes && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Saving…</div>}
                  <button onClick={advanceMinutesStatus} disabled={savingMinutes} style={{ width: '100%', marginTop: 12, padding: '13px', background: C.hero, color: C.white, border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                    {savingMinutes ? <Spinner /> : minutesNextLabel[minutesStatus ?? 'draft']}
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  )
}
