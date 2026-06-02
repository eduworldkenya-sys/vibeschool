"use client";
'use client'

import { useEffect, useState, useCallback } from 'react'
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

type QueueItem = {
  transaction_id: string
  school_id: string
  project_id: string
  project_title: string
  project_type: string
  description: string
  amount: number
  vendor: string | null
  receipt_ref: string | null
  task_ref: string | null
  status: 'pending' | 'confirmed' | 'returned'
  return_reason: string | null
  logged_at: string
  logged_by: string
  logged_by_name: string | null
  confirmed_by: string | null
  confirmed_by_name: string | null
  confirmed_at: string | null
  days_pending: number
}

function fmt(n: number) {
  return 'KES ' + Number(n ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })
}

export default function ApprovalsPage() {
  const [loading, setLoading]       = useState(true)
  const [queue, setQueue]           = useState<QueueItem[]>([])
  const [hasBursar, setHasBursar]   = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [schoolId, setSchoolId]     = useState<string | null>(null)
  const [toast, setToast]           = useState<string | null>(null)

  const [confirmModal, setConfirmModal]   = useState<QueueItem | null>(null)
  const [returnModal, setReturnModal]     = useState<QueueItem | null>(null)
  const [returnReason, setReturnReason]   = useState('')
  const [saving, setSaving]               = useState(false)

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
      { data: items },
      { data: bursarRow },
    ] = await Promise.all([
      supabase.from('v_approvals_queue').select('*').eq('school_id', sid),
      supabase.from('finance_roles').select('profile_id').eq('school_id', sid).eq('is_bursar', true).is('revoked_at', null).maybeSingle(),
    ])

    setQueue(items ?? [])
    setHasBursar(!!bursarRow)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleConfirm() {
    if (!confirmModal) return
    setSaving(true)
    await supabase
      .from('project_transactions')
      .update({ status: 'confirmed', confirmed_by: currentUserId, confirmed_at: new Date().toISOString() })
      .eq('id', confirmModal.transaction_id)
    setSaving(false)
    setConfirmModal(null)
    showToast('Transaction confirmed')
    load()
  }

  async function handleReturn() {
    if (!returnModal || !returnReason.trim()) return
    setSaving(true)
    await supabase
      .from('project_transactions')
      .update({ status: 'returned', return_reason: returnReason.trim() })
      .eq('id', returnModal.transaction_id)
    setSaving(false)
    setReturnModal(null)
    setReturnReason('')
    showToast('Transaction returned')
    load()
  }

  const pending  = queue.filter(q => q.status === 'pending')
  const returned = queue.filter(q => q.status === 'returned')

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

      {/* Page header */}
      <div style={{ background: C.hero, borderRadius: 16, padding: '18px 20px', marginBottom: 16, color: '#fff' }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Approvals</div>
        {!loading && (
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>
            {pending.length} pending confirmation{pending.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* No bursar banner */}
      {!loading && !hasBursar && (
        <div style={{
          background: C.warningLt, border: `1px solid ${C.warning}`, borderRadius: 12,
          padding: '12px 14px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>No bursar appointed</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              You are the sole approver. Appoint a bursar in Finance Settings to enable two-person approval.
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => <Skeleton key={i} h={120} />)}
        </div>
      ) : (
        <>
          {/* Pending */}
          <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Pending
          </div>

          {pending.length === 0 ? (
            <div style={{
              background: C.surface, borderRadius: 14, padding: '32px 16px', textAlign: 'center',
              color: C.muted, fontSize: 14, marginBottom: 20, border: `1px solid ${C.border}`,
            }}>
              ✅ All clear — no pending approvals
            </div>
          ) : pending.map(item => (
            <QueueCard
              key={item.transaction_id}
              item={item}
              currentUserId={currentUserId}
              onConfirm={() => setConfirmModal(item)}
              onReturn={() => { setReturnModal(item); setReturnReason('') }}
            />
          ))}

          {/* Returned */}
          {returned.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, marginTop: 24 }}>
                Returned
              </div>
              {returned.map(item => (
                <QueueCard
                  key={item.transaction_id}
                  item={item}
                  currentUserId={currentUserId}
                  onConfirm={() => {}}
                  onReturn={() => {}}
                  readonly
                />
              ))}
            </>
          )}
        </>
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <div style={overlay}>
          <div style={modalBox}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>Confirm Transaction?</div>
            <div style={{ fontSize: 14, color: C.muted, marginBottom: 4 }}>{confirmModal.description}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 16 }}>{fmt(confirmModal.amount)}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirmModal(null)} style={{ ...primaryBtn, background: C.bg, color: C.text, flex: 1 }}>Cancel</button>
              <button onClick={handleConfirm} disabled={saving} style={{ ...primaryBtn, background: C.emerald, flex: 1, opacity: saving ? 0.5 : 1 }}>
                {saving ? 'Confirming…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {returnModal && (
        <div style={overlay}>
          <div style={modalBox}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 12 }}>Return Transaction</div>
            <label style={labelStyle}>Reason for returning *</label>
            <textarea
              value={returnReason}
              onChange={e => setReturnReason(e.target.value)}
              placeholder="Explain why this is being returned…"
              rows={3}
              style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, color: C.text, background: C.bg, boxSizing: 'border-box', resize: 'vertical', outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => setReturnModal(null)} style={{ ...primaryBtn, background: C.bg, color: C.text, flex: 1 }}>Cancel</button>
              <button
                onClick={handleReturn}
                disabled={saving || !returnReason.trim()}
                style={{ ...primaryBtn, background: C.error, flex: 1, opacity: saving || !returnReason.trim() ? 0.5 : 1 }}
              >{saving ? 'Returning…' : 'Return'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function QueueCard({ item, currentUserId, onConfirm, onReturn, readonly = false }: {
  item: QueueItem
  currentUserId: string | null
  onConfirm: () => void
  onReturn: () => void
  readonly?: boolean
}) {
  const isOwnTransaction = currentUserId === item.logged_by
  const daysOverdue = (item.days_pending ?? 0) > 3

  return (
    <div style={{
      background: C.surface, borderRadius: 14, padding: '14px 16px', marginBottom: 10,
      border: `1px solid ${C.border}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>{item.project_title}</div>
        {item.status === 'pending' && (
          <span style={{
            background: daysOverdue ? C.errorLt : C.warningLt,
            color: daysOverdue ? C.error : C.warning,
            borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
          }}>{item.days_pending}d</span>
        )}
        {item.status === 'returned' && (
          <span style={{ background: C.errorLt, color: C.error, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>returned</span>
        )}
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>{item.description}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 6 }}>{fmt(item.amount)}</div>

      <div style={{ fontSize: 12, color: C.muted, marginBottom: item.status === 'pending' && !readonly ? 10 : 0 }}>
        {item.vendor && <span>Vendor: {item.vendor} &nbsp;·&nbsp; </span>}
        {item.receipt_ref && <span>Ref: {item.receipt_ref} &nbsp;·&nbsp; </span>}
        Logged by {item.logged_by_name ?? '—'}
      </div>

      {item.return_reason && (
        <div style={{ fontSize: 12, color: C.error, marginBottom: 8 }}>Returned: {item.return_reason}</div>
      )}

      {item.status === 'pending' && !readonly && (
        isOwnTransaction ? (
          <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic' }}>
            You logged this — another approver must confirm
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onConfirm} style={{ flex: 1, padding: '9px 0', background: C.emeraldLt, color: C.emerald, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Confirm
            </button>
            <button onClick={onReturn} style={{ flex: 1, padding: '9px 0', background: C.errorLt, color: C.error, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Return
            </button>
          </div>
        )
      )}
    </div>
  )
}

const overlay: React.CSSProperties   = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }
const modalBox: React.CSSProperties  = { background: C.surface, borderRadius: 16, padding: 20, width: '100%', maxWidth: 420 }
const primaryBtn: React.CSSProperties = { padding: '12px 0', background: C.hero, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }
