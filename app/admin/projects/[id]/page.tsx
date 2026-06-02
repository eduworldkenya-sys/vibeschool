"use client";


import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const C = {
  hero:      '#0a1628',
  heroMid:   '#0d2347',
  emerald:   '#10b981',
  emeraldLt: '#d1fae5',
  bg:        '#f0f4f8',
  border:    '#e2e8f0',
  surface:   '#ffffff',
  text:      '#0f172a',
  muted:     '#64748b',
  warning:   '#f59e0b',
  warningLt: '#fef3c7',
  error:     '#ef4444',
  errorLt:   '#fee2e2',
  navy3:     '#0f5fa8',
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  zIndex: 999, display: 'flex', alignItems: 'flex-end',
}
const modalBox: React.CSSProperties = {
  background: C.surface, borderRadius: 16, padding: 20,
  width: '100%', maxWidth: 440, margin: 'auto',
}
const primaryBtn: React.CSSProperties = {
  width: '100%', padding: '13px 0', background: C.hero, color: '#fff',
  border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer',
}
const confirmBtn: React.CSSProperties = {
  flex: 1, padding: '8px 0', background: C.emeraldLt, color: C.emerald,
  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
}
const returnBtn: React.CSSProperties = {
  flex: 1, padding: '8px 0', background: C.errorLt, color: C.error,
  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
}
const smallBtn: React.CSSProperties = {
  padding: '6px 14px', background: C.hero, color: '#fff',
  border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 12px', border: `1px solid ${C.border}`,
  borderRadius: 10, fontSize: 14, color: C.text, background: C.bg,
  boxSizing: 'border-box', outline: 'none',
}
const selectStyle: React.CSSProperties = {
  ...inputStyle, appearance: 'none' as const,
}

function Skeleton({ h = 56, r = 12 }: { h?: number; r?: number }) {
  return (
    <div style={{
      height: h,
      borderRadius: r,
      background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8', fontSize: 14 }}>
      {msg}
    </div>
  )
}

function Field({
  label, value, onChange, placeholder = '', type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  )
}

function BottomSheet({
  title, onClose, children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div style={overlay}>
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: C.surface, borderRadius: '20px 20px 0 0',
        padding: '20px 16px 40px', maxHeight: '85vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: C.muted, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
      </div>
    </div>
  )
}

type Project = {
  project_id: string
  title: string
  project_type: string
  status: string
  start_date: string
  end_date: string
  planned: number
  spent: number
  pending_confirmation: number
  remaining: number
  milestones_total: number
  milestones_done: number
  owner_id: string
  owner_name: string
  budget_line_id: string
  at_risk_ack: boolean
}

type Milestone = {
  id: string
  title: string
  due_date: string
  completed: boolean
  completed_at: string | null
  notes: string | null
}

type Transaction = {
  id: string
  description: string
  amount: number
  vendor: string | null
  receipt_ref: string | null
  task_ref: string | null
  status: 'pending' | 'confirmed' | 'returned'
  return_reason: string | null
  logged_by: string
  logged_at: string
  confirmed_by: string | null
  confirmed_at: string | null
  milestone_id: string | null
  logged_by_profile: { full_name: string } | null
  confirmed_by_profile: { full_name: string } | null
}

type LogEntry = {
  id: string
  event_type: string
  payload: Record<string, unknown>
  note: string | null
  created_at: string
  actor: { full_name: string } | null
}

type Member = {
  id: string
  profile_id: string
  role: string
  added_at: string
  profile: { full_name: string; role: string } | null
}

type SchoolProfile = {
  id: string
  full_name: string
  role: string
}

function statusColor(s: string) {
  if (s === 'confirmed') return { bg: C.emeraldLt, color: C.emerald }
  if (s === 'returned')  return { bg: C.errorLt,   color: C.error }
  return { bg: C.warningLt, color: C.warning }
}

function projectStatusColor(s: string) {
  if (s === 'active')           return { bg: C.emeraldLt, color: C.emerald }
  if (s === 'completed')        return { bg: '#dbeafe',   color: C.navy3 }
  if (s === 'at_risk')          return { bg: C.errorLt,   color: C.error }
  if (s === 'pending_approval') return { bg: C.warningLt, color: C.warning }
  if (s === 'cancelled')        return { bg: '#f1f5f9',   color: C.muted }
  return { bg: '#f1f5f9', color: C.muted }
}

function fmt(n: number) {
  return 'KES ' + Number(n ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })
}

function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

export default function ProjectDetailPage() {
  const params = useParams()
  const id = params?.id as string

  const [loading, setLoading]             = useState(true)
  const [project, setProject]             = useState<Project | null>(null)
  const [milestones, setMilestones]       = useState<Milestone[]>([])
  const [transactions, setTransactions]   = useState<Transaction[]>([])
  const [log, setLog]                     = useState<LogEntry[]>([])
  const [members, setMembers]             = useState<Member[]>([])
  const [schoolProfiles, setSchoolProfiles] = useState<SchoolProfile[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [schoolId, setSchoolId]           = useState<string | null>(null)
  const [toast, setToast]                 = useState<string | null>(null)
  const [activeTab, setActiveTab]         = useState<'milestones' | 'transactions' | 'log' | 'team'>('milestones')

  const [showExpenseSheet, setShowExpenseSheet]   = useState(false)
  const [showMilestoneSheet, setShowMilestoneSheet] = useState(false)
  const [showMemberSheet, setShowMemberSheet]     = useState(false)
  const [returnModal, setReturnModal]             = useState<{ id: string } | null>(null)
  const [returnReason, setReturnReason]           = useState('')
  const [revokeConfirm, setRevokeConfirm]         = useState<string | null>(null)

  const [expDesc, setExpDesc]       = useState('')
  const [expAmount, setExpAmount]   = useState('')
  const [expVendor, setExpVendor]   = useState('')
  const [expReceipt, setExpReceipt] = useState('')
  const [expTaskRef, setExpTaskRef] = useState('')
  const [expSaving, setExpSaving]   = useState(false)

  const [msTitle, setMsTitle]   = useState('')
  const [msDue, setMsDue]       = useState('')
  const [msSaving, setMsSaving] = useState(false)

  const [memberProfileId, setMemberProfileId] = useState('')
  const [memberSaving, setMemberSaving]       = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', user.id)
      .single()

    const sid = profile?.school_id
    setSchoolId(sid)

    const [
      { data: proj },
      { data: ms },
      { data: tx },
      { data: lg },
      { data: mem },
      { data: sp },
    ] = await Promise.all([
      supabase.from('v_project_summary').select('*').eq('project_id', id).single(),
      supabase.from('admin_project_milestones').select('*').eq('project_id', id).order('due_date'),
      supabase
        .from('project_transactions')
        .select('*, logged_by_profile:profiles!logged_by(full_name), confirmed_by_profile:profiles!confirmed_by(full_name)')
        .eq('project_id', id)
        .order('logged_at', { ascending: false }),
      supabase
        .from('project_log')
        .select('*, actor:profiles!actor_id(full_name)')
        .eq('project_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('project_members')
        .select('*, profile:profiles!profile_id(full_name, role)')
        .eq('project_id', id)
        .is('removed_at', null),
      supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('school_id', sid)
        .in('role', ['admin', 'teacher', 'owner'])
        .order('full_name'),
    ])

    setProject(proj ?? null)
    setMilestones(ms ?? [])
    setTransactions(tx ?? [])
    setLog(lg ?? [])
    setMembers(mem ?? [])
    setSchoolProfiles(sp ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function toggleMilestone(ms: Milestone) {
    const now = new Date().toISOString()
    await supabase
      .from('admin_project_milestones')
      .update({ completed: !ms.completed, completed_at: !ms.completed ? now : null })
      .eq('id', ms.id)
    await supabase.from('project_log').insert({
      project_id: id,
      school_id: schoolId,
      actor_id: currentUserId,
      event_type: ms.completed ? 'milestone_reopened' : 'milestone_completed',
      payload: { milestone_id: ms.id, title: ms.title },
      note: null,
    })
    load()
  }

  async function addMilestone() {
    if (!msTitle.trim() || !msDue) return
    setMsSaving(true)
    await supabase.from('admin_project_milestones').insert({
      project_id: id,
      title: msTitle.trim(),
      due_date: msDue,
      completed: false,
    })
    await supabase.from('project_log').insert({
      project_id: id,
      school_id: schoolId,
      actor_id: currentUserId,
      event_type: 'milestone_added',
      payload: { title: msTitle.trim() },
      note: null,
    })
    setMsTitle('')
    setMsDue('')
    setMsSaving(false)
    setShowMilestoneSheet(false)
    showToast('Milestone added')
    load()
  }

  async function logExpense() {
    if (!expDesc.trim() || !expAmount) return
    setExpSaving(true)
    await supabase.from('project_transactions').insert({
      project_id: id,
      school_id: schoolId,
      description: expDesc.trim(),
      amount: parseFloat(expAmount),
      vendor: expVendor.trim() || null,
      receipt_ref: expReceipt.trim() || null,
      task_ref: expTaskRef.trim() || null,
      status: 'pending',
      logged_by: currentUserId,
      logged_at: new Date().toISOString(),
    })
    await supabase.from('project_log').insert({
      project_id: id,
      school_id: schoolId,
      actor_id: currentUserId,
      event_type: 'transaction_logged',
      payload: { amount: parseFloat(expAmount), description: expDesc.trim() },
      note: null,
    })
    setExpDesc('')
    setExpAmount('')
    setExpVendor('')
    setExpReceipt('')
    setExpTaskRef('')
    setExpSaving(false)
    setShowExpenseSheet(false)
    showToast('Expense logged — awaiting approval')
    load()
  }

  async function confirmTransaction(txId: string) {
    await supabase
      .from('project_transactions')
      .update({ status: 'confirmed', confirmed_by: currentUserId, confirmed_at: new Date().toISOString() })
      .eq('id', txId)
    await supabase.from('project_log').insert({
      project_id: id,
      school_id: schoolId,
      actor_id: currentUserId,
      event_type: 'transaction_confirmed',
      payload: { transaction_id: txId },
      note: null,
    })
    showToast('Transaction confirmed')
    load()
  }

  async function returnTransaction() {
    if (!returnModal || !returnReason.trim()) return
    await supabase
      .from('project_transactions')
      .update({ status: 'returned', return_reason: returnReason.trim() })
      .eq('id', returnModal.id)
    await supabase.from('project_log').insert({
      project_id: id,
      school_id: schoolId,
      actor_id: currentUserId,
      event_type: 'transaction_returned',
      payload: { transaction_id: returnModal.id, reason: returnReason.trim() },
      note: null,
    })
    setReturnModal(null)
    setReturnReason('')
    showToast('Transaction returned')
    load()
  }

  async function addMember() {
    if (!memberProfileId) return
    setMemberSaving(true)
    await supabase.from('project_members').insert({
      project_id: id,
      school_id: schoolId,
      profile_id: memberProfileId,
      role: 'member',
      added_by: currentUserId,
      added_at: new Date().toISOString(),
    })
    await supabase.from('project_log').insert({
      project_id: id,
      school_id: schoolId,
      actor_id: currentUserId,
      event_type: 'member_added',
      payload: { profile_id: memberProfileId },
      note: null,
    })
    setMemberProfileId('')
    setMemberSaving(false)
    setShowMemberSheet(false)
    showToast('Member added')
    load()
  }

  async function removeMember(memberId: string) {
    await supabase
      .from('project_members')
      .update({ removed_at: new Date().toISOString() })
      .eq('id', memberId)
    await supabase.from('project_log').insert({
      project_id: id,
      school_id: schoolId,
      actor_id: currentUserId,
      event_type: 'member_removed',
      payload: { project_member_id: memberId },
      note: null,
    })
    setRevokeConfirm(null)
    showToast('Member removed')
    load()
  }

  const planned   = project?.planned ?? 0
  const spent     = project?.spent ?? 0
  const pending   = project?.pending_confirmation ?? 0
  const remaining = project?.remaining ?? 0
  const pct = planned > 0 ? Math.min(100, Math.round(((spent + pending) / planned) * 100)) : 0

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: 'milestones',   label: 'Milestones' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'log',          label: 'Log' },
    { key: 'team',         label: 'Team' },
  ]

  const addedMemberIds      = new Set(members.map(m => m.profile_id))
  const availableProfiles   = schoolProfiles.filter(p => !addedMemberIds.has(p.id))

  return (
    <div style={{ padding: '16px 16px 80px', background: C.bg, minHeight: '100vh' }}>
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      {toast && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: C.hero, color: '#fff', padding: '10px 20px', borderRadius: 10,
          zIndex: 9999, fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap',
        }}>{toast}</div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Skeleton h={120} />
          <Skeleton h={80} />
          <Skeleton h={200} />
          <Skeleton h={200} />
        </div>
      ) : !project ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: C.muted }}>Project not found.</div>
      ) : (
        <>
          {/* Header */}
          <div style={{ background: C.hero, borderRadius: 16, padding: 20, marginBottom: 16, color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3, marginBottom: 6 }}>{project.title}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>
                    {project.project_type}
                  </span>
                  <span style={{
                    ...projectStatusColor(project.status),
                    borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600,
                  }}>
                    {project.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 14 }}>
              Owner: {project.owner_name} &nbsp;·&nbsp; {project.start_date} → {project.end_date}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              {[
                { label: 'Planned',   val: planned,   color: 'rgba(255,255,255,0.8)' },
                { label: 'Spent',     val: spent,     color: C.emerald },
                { label: 'Pending',   val: pending,   color: C.warning },
                { label: 'Remaining', val: remaining, color: remaining < 0 ? C.error : 'rgba(255,255,255,0.8)' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color }}>{fmt(val)}</div>
                </div>
              ))}
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
                <span>Budget used</span><span>{pct}%</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct > 90 ? C.error : C.emerald, borderRadius: 4, transition: 'width 0.4s' }} />
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowExpenseSheet(true)}
            style={{ width: '100%', padding: '12px 0', background: C.emerald, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}
          >+ Log Expense</button>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: C.surface, borderRadius: 12, padding: 4 }}>
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  flex: 1, padding: '8px 4px', border: 'none', borderRadius: 8,
                  background: activeTab === t.key ? C.hero : 'transparent',
                  color: activeTab === t.key ? '#fff' : C.muted,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                }}
              >{t.label}</button>
            ))}
          </div>

          {/* MILESTONES */}
          {activeTab === 'milestones' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                  Milestones <span style={{ color: C.muted, fontWeight: 400 }}>({project.milestones_done}/{project.milestones_total})</span>
                </div>
                <button onClick={() => setShowMilestoneSheet(true)} style={smallBtn}>+ Add</button>
              </div>
              {milestones.length === 0 ? (
                <EmptyState msg="No milestones yet. Add the first one." />
              ) : milestones.map(ms => (
                <div key={ms.id} style={{
                  background: C.surface, borderRadius: 12, padding: '12px 14px', marginBottom: 8,
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  border: `1px solid ${C.border}`, opacity: ms.completed ? 0.65 : 1,
                }}>
                  <button
                    onClick={() => toggleMilestone(ms)}
                    style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: 'pointer',
                      border: `2px solid ${ms.completed ? C.emerald : C.border}`,
                      background: ms.completed ? C.emerald : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
                    }}
                  >
                    {ms.completed && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
                  </button>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text, textDecoration: ms.completed ? 'line-through' : 'none' }}>
                      {ms.title}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Due: {ms.due_date}</div>
                    {ms.notes && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{ms.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TRANSACTIONS */}
          {activeTab === 'transactions' && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Transactions</div>
              {transactions.length === 0 ? (
                <EmptyState msg="No transactions logged yet." />
              ) : transactions.map(tx => {
                const canConfirm = currentUserId !== tx.logged_by
                const days = daysSince(tx.logged_at)
                return (
                  <div key={tx.id} style={{
                    background: C.surface, borderRadius: 12, padding: 14, marginBottom: 10,
                    border: `1px solid ${C.border}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, flex: 1, marginRight: 8 }}>{tx.description}</div>
                      <span style={{
                        background: statusColor(tx.status).bg,
                        color: statusColor(tx.status).color,
                        borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                      }}>{tx.status}</span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6 }}>{fmt(tx.amount)}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
                      {tx.vendor && <span>Vendor: {tx.vendor} &nbsp;·&nbsp; </span>}
                      {tx.receipt_ref && <span>Ref: {tx.receipt_ref} &nbsp;·&nbsp; </span>}
                      {tx.task_ref && <span>Task: {tx.task_ref}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: tx.status === 'pending' ? 10 : 0 }}>
                      Logged by {tx.logged_by_profile?.full_name ?? '—'} &nbsp;·&nbsp;
                      {tx.status === 'pending' && (
                        <span style={{ color: days > 3 ? C.error : C.warning, fontWeight: 600 }}>{days}d pending</span>
                      )}
                      {tx.status === 'confirmed' && tx.confirmed_by_profile && (
                        <span>Confirmed by {tx.confirmed_by_profile.full_name}</span>
                      )}
                      {tx.status === 'returned' && tx.return_reason && (
                        <span style={{ color: C.error }}>Returned: {tx.return_reason}</span>
                      )}
                    </div>
                    {tx.status === 'pending' && (
                      canConfirm ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => confirmTransaction(tx.id)} style={confirmBtn}>Confirm</button>
                          <button onClick={() => { setReturnModal({ id: tx.id }); setReturnReason('') }} style={returnBtn}>Return</button>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic' }}>
                          You logged this — another approver must confirm
                        </div>
                      )
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* LOG */}
          {activeTab === 'log' && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Project Log</div>
              {log.length === 0 ? (
                <EmptyState msg="No log entries yet." />
              ) : log.map((entry, i) => (
                <div key={entry.id} style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.emerald, flexShrink: 0, marginTop: 3 }} />
                    {i < log.length - 1 && <div style={{ width: 2, flex: 1, background: C.border, marginTop: 4 }} />}
                  </div>
                  <div style={{ flex: 1, paddingBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                      {entry.event_type.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                      {entry.actor?.full_name ?? 'System'} &nbsp;·&nbsp; {new Date(entry.created_at).toLocaleString('en-KE')}
                    </div>
                    {entry.note && <div style={{ fontSize: 12, color: C.text, marginTop: 4 }}>{entry.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TEAM */}
          {activeTab === 'team' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Team</div>
                <button onClick={() => setShowMemberSheet(true)} style={smallBtn}>+ Add</button>
              </div>
              {members.length === 0 ? (
                <EmptyState msg="No team members added yet." />
              ) : members.map(m => (
                <div key={m.id} style={{
                  background: C.surface, borderRadius: 12, padding: '12px 14px', marginBottom: 8,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  border: `1px solid ${C.border}`,
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{m.profile?.full_name ?? '—'}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{m.role} &nbsp;·&nbsp; {m.profile?.role}</div>
                  </div>
                  <button
                    onClick={() => setRevokeConfirm(m.id)}
                    style={{ background: C.errorLt, color: C.error, border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >Remove</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Log Expense Sheet */}
      {showExpenseSheet && (
        <BottomSheet title="Log Expense" onClose={() => setShowExpenseSheet(false)}>
          <Field label="Description *" value={expDesc} onChange={setExpDesc} placeholder="What was purchased?" />
          <Field label="Amount (KES) *" value={expAmount} onChange={setExpAmount} placeholder="0.00" type="number" />
          <Field label="Vendor" value={expVendor} onChange={setExpVendor} placeholder="Supplier name" />
          <Field label="Receipt Ref" value={expReceipt} onChange={setExpReceipt} placeholder="Receipt number" />
          <Field label="Task Ref" value={expTaskRef} onChange={setExpTaskRef} placeholder="Task reference" />
          <button
            onClick={logExpense}
            disabled={expSaving || !expDesc.trim() || !expAmount}
            style={{ ...primaryBtn, opacity: expSaving || !expDesc.trim() || !expAmount ? 0.5 : 1 }}
          >{expSaving ? 'Saving…' : 'Log Expense'}</button>
        </BottomSheet>
      )}

      {/* Add Milestone Sheet */}
      {showMilestoneSheet && (
        <BottomSheet title="Add Milestone" onClose={() => setShowMilestoneSheet(false)}>
          <Field label="Title *" value={msTitle} onChange={setMsTitle} placeholder="Milestone name" />
          <Field label="Due Date *" value={msDue} onChange={setMsDue} type="date" />
          <button
            onClick={addMilestone}
            disabled={msSaving || !msTitle.trim() || !msDue}
            style={{ ...primaryBtn, opacity: msSaving || !msTitle.trim() || !msDue ? 0.5 : 1 }}
          >{msSaving ? 'Saving…' : 'Add Milestone'}</button>
        </BottomSheet>
      )}

      {/* Add Member Sheet */}
      {showMemberSheet && (
        <BottomSheet title="Add Team Member" onClose={() => setShowMemberSheet(false)}>
          {availableProfiles.length === 0 ? (
            <p style={{ color: C.muted, fontSize: 14 }}>All staff are already on this project.</p>
          ) : (
            <>
              <label style={labelStyle}>Select Staff Member</label>
              <select
                value={memberProfileId}
                onChange={e => setMemberProfileId(e.target.value)}
                style={selectStyle}
              >
                <option value="">— choose —</option>
                {availableProfiles.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>
                ))}
              </select>
              <button
                onClick={addMember}
                disabled={memberSaving || !memberProfileId}
                style={{ ...primaryBtn, opacity: memberSaving || !memberProfileId ? 0.5 : 1 }}
              >{memberSaving ? 'Adding…' : 'Add Member'}</button>
            </>
          )}
        </BottomSheet>
      )}

      {/* Return Reason Modal */}
      {returnModal && (
        <div style={{ ...overlay, alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
          <div style={modalBox}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 12 }}>Return Transaction</div>
            <label style={labelStyle}>Reason for returning *</label>
            <textarea
              value={returnReason}
              onChange={e => setReturnReason(e.target.value)}
              placeholder="Explain why this is being returned…"
              rows={3}
              style={{ ...selectStyle, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => setReturnModal(null)} style={{ ...primaryBtn, background: C.bg, color: C.text, flex: 1 }}>Cancel</button>
              <button
                onClick={returnTransaction}
                disabled={!returnReason.trim()}
                style={{ ...primaryBtn, background: C.error, flex: 1, opacity: !returnReason.trim() ? 0.5 : 1 }}
              >Return</button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Confirm */}
      {revokeConfirm && (
        <div style={{ ...overlay, alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
          <div style={modalBox}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>Remove Member?</div>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 16 }}>
              This will remove them from the project team.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setRevokeConfirm(null)} style={{ ...primaryBtn, background: C.bg, color: C.text, flex: 1 }}>Cancel</button>
              <button onClick={() => removeMember(revokeConfirm)} style={{ ...primaryBtn, background: C.error, flex: 1 }}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
