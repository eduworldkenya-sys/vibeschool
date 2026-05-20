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

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  zIndex: 999, display: 'flex', alignItems: 'center',
  justifyContent: 'center', padding: '0 16px',
}
const modalBox: React.CSSProperties = {
  background: '#ffffff', borderRadius: 16, padding: 20,
  width: '100%', maxWidth: 420,
}
const primaryBtn: React.CSSProperties = {
  width: '100%', padding: '12px 0', background: '#0a1628',
  color: '#fff', border: 'none', borderRadius: 12,
  fontSize: 15, fontWeight: 600, cursor: 'pointer',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600,
  color: '#0f172a', marginBottom: 6,
}
const selectStyle: React.CSSProperties = {
  width: '100%', padding: '11px 12px', border: '1px solid #e2e8f0',
  borderRadius: 10, fontSize: 14, color: '#0f172a',
  background: '#f0f4f8', boxSizing: 'border-box',
  outline: 'none', appearance: 'none',
}

function Skeleton({ h = 56, r = 12 }: { h?: number; r?: number }) {
  return (
    <div style={{
      height: h, borderRadius: r,
      background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#ffffff', borderRadius: 14, padding: 16,
      marginBottom: 16, border: '1px solid #e2e8f0',
    }}>
      <div style={{
        fontSize: 13, fontWeight: 700, color: '#64748b',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
      }}>{title}</div>
      {children}
    </div>
  )
}

type BursarRow = {
  id: string
  profile_id: string
  appointed_at: string
  profile: { full_name: string } | null
  appointed_by_profile: { full_name: string } | null
}

type StaffProfile = {
  id: string
  full_name: string
  role: string
}

export default function FinanceSettingsPage() {
  const [loading, setLoading]             = useState(true)
  const [bursar, setBursar]               = useState<BursarRow | null>(null)
  const [staff, setStaff]                 = useState<StaffProfile[]>([])
  const [requiresDual, setRequiresDual]   = useState(true)
  const [schoolId, setSchoolId]           = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [toast, setToast]                 = useState<string | null>(null)
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [appointing, setAppointing]       = useState(false)
  const [revokeConfirm, setRevokeConfirm] = useState(false)
  const [revoking, setRevoking]           = useState(false)
  const [dualToggleConfirm, setDualToggleConfirm] = useState(false)
  const [togglingDual, setTogglingDual]   = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCurrentUserId(user.id)
    const { data: profile } = await supabase
      .from('profiles').select('school_id').eq('id', user.id).single()
    const sid = profile?.school_id
    setSchoolId(sid)
    const [
      { data: bursarRow },
      { data: staffRows },
      { data: schoolRow },
    ] = await Promise.all([
      supabase
        .from('finance_roles')
        .select('*, profile:profiles!profile_id(full_name), appointed_by_profile:profiles!appointed_by(full_name)')
        .eq('school_id', sid).is('revoked_at', null).maybeSingle(),
      supabase
        .from('profiles').select('id, full_name, role')
        .eq('school_id', sid).in('role', ['admin', 'teacher']).order('full_name'),
      supabase
        .from('schools').select('requires_dual_approval').eq('id', sid).single(),
    ])
    setBursar(bursarRow ?? null)
    setStaff(staffRows ?? [])
    setRequiresDual(schoolRow?.requires_dual_approval ?? true)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function appointBursar() {
    if (!selectedProfileId) return
    setAppointing(true)
    await supabase.from('finance_roles').insert({
      school_id: schoolId, profile_id: selectedProfileId,
      is_bursar: true, appointed_by: currentUserId,
      appointed_at: new Date().toISOString(),
    })
    await supabase.from('audit_logs').insert({
      school_id: schoolId, actor_id: currentUserId,
      event_type: 'bursar_appointed', payload: { profile_id: selectedProfileId },
    })
    setSelectedProfileId('')
    setAppointing(false)
    showToast('Bursar appointed successfully')
    load()
  }

  async function revokeBursar() {
    if (!bursar) return
    setRevoking(true)
    await supabase
      .from('finance_roles')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', bursar.id)
    await supabase.from('audit_logs').insert({
      school_id: schoolId, actor_id: currentUserId,
      event_type: 'bursar_revoked', payload: { profile_id: bursar.profile_id },
    })
    setRevokeConfirm(false)
    setRevoking(false)
    showToast('Bursar role revoked')
    load()
  }

  async function toggleDualApproval() {
    setTogglingDual(true)
    await supabase
      .from('schools')
      .update({ requires_dual_approval: !requiresDual })
      .eq('id', schoolId)
    await supabase.from('audit_logs').insert({
      school_id: schoolId, actor_id: currentUserId,
      event_type: 'dual_approval_toggled', payload: { new_value: !requiresDual },
    })
    setDualToggleConfirm(false)
    setTogglingDual(false)
    showToast('Dual approval ' + (!requiresDual ? 'enabled' : 'disabled'))
    load()
  }

  const availableStaff = staff.filter(s => s.id !== bursar?.profile_id)

  return (
    <div style={{ padding: '16px 16px 80px', background: '#f0f4f8', minHeight: '100vh' }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>

      {toast && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: '#0a1628', color: '#fff', padding: '10px 20px',
          borderRadius: 10, zIndex: 9999, fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap',
        }}>{toast}</div>
      )}

      <div style={{ background: '#0a1628', borderRadius: 16, padding: '18px 20px', marginBottom: 16, color: '#fff' }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Finance Settings</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>Bursar appointment and approval settings</div>
      </div>

      <div style={{
        background: '#fef3c7', border: '1px solid #f59e0b',
        borderRadius: 12, padding: '12px 14px', marginBottom: 20,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
          Financial Integrity Notice
        </div>
        <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
          VIbeSchool is not liable for financial integrity. The two-person approval rule is a safeguard — ensure all receipts are physically filed by your school.
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Skeleton h={100} /><Skeleton h={120} /><Skeleton h={80} />
        </div>
      ) : (
        <>
          <SectionCard title="Current Bursar">
            {bursar ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                    {bursar.profile?.full_name ?? '—'}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Appointed {new Date(bursar.appointed_at).toLocaleDateString('en-KE')}
                    {bursar.appointed_by_profile && ' by ' + bursar.appointed_by_profile.full_name}
                  </div>
                </div>
                <button
                  onClick={() => setRevokeConfirm(true)}
                  style={{
                    padding: '8px 14px', background: '#fee2e2', color: '#ef4444',
                    border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}
                >Revoke</button>
              </div>
            ) : (
              <div style={{
                background: '#fef3c7', borderRadius: 10, padding: '12px 14px',
                border: '1px solid #f59e0b',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
                  No bursar appointed
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  The system works without a bursar. All transaction approvals fall to the head teacher.
                </div>
              </div>
            )}
          </SectionCard>

          {!bursar && (
            <SectionCard title="Appoint a Bursar">
              {availableStaff.length === 0 ? (
                <p style={{ fontSize: 14, color: '#64748b' }}>
                  No eligible staff members found (admin or teacher role required).
                </p>
              ) : (
                <>
                  <label style={labelStyle}>Select staff member</label>
                  <select
                    value={selectedProfileId}
                    onChange={e => setSelectedProfileId(e.target.value)}
                    style={selectStyle}
                  >
                    <option value="">— choose staff member —</option>
                    {availableStaff.map(s => (
                      <option key={s.id} value={s.id}>{s.full_name} ({s.role})</option>
                    ))}
                  </select>
                  <button
                    onClick={appointBursar}
                    disabled={appointing || !selectedProfileId}
                    style={{ ...primaryBtn, marginTop: 12, opacity: appointing || !selectedProfileId ? 0.5 : 1 }}
                  >{appointing ? 'Appointing...' : 'Appoint Bursar'}</button>
                </>
              )}
            </SectionCard>
          )}

          <SectionCard title="Two-Person Approval Rule">
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginBottom: 14 }}>
              {requiresDual
                ? 'Currently ENABLED. Every transaction must be confirmed by a different person than the one who logged it. This is the recommended setting.'
                : 'Currently DISABLED. A single person can both log and confirm transactions. This reduces financial controls.'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: requiresDual ? '#10b981' : '#ef4444' }}>
                {requiresDual ? 'Dual approval on' : 'Dual approval off'}
              </div>
              <button
                onClick={() => setDualToggleConfirm(true)}
                style={{
                  padding: '8px 14px',
                  background: requiresDual ? '#fee2e2' : '#d1fae5',
                  color: requiresDual ? '#ef4444' : '#10b981',
                  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >{requiresDual ? 'Disable' : 'Enable'}</button>
            </div>
          </SectionCard>
        </>
      )}

      {revokeConfirm && (
        <div style={overlay}>
          <div style={modalBox}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
              Revoke Bursar Role?
            </div>
            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
              {bursar?.profile?.full_name} will no longer have bursar responsibilities.
              All approvals will fall to the head teacher until a new bursar is appointed.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setRevokeConfirm(false)}
                style={{ ...primaryBtn, background: '#f0f4f8', color: '#0f172a', flex: 1 }}
              >Cancel</button>
              <button
                onClick={revokeBursar}
                disabled={revoking}
                style={{ ...primaryBtn, background: '#ef4444', flex: 1, opacity: revoking ? 0.5 : 1 }}
              >{revoking ? 'Revoking...' : 'Revoke'}</button>
            </div>
          </div>
        </div>
      )}

      {dualToggleConfirm && (
        <div style={overlay}>
          <div style={modalBox}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
              {requiresDual ? 'Disable Two-Person Approval?' : 'Enable Two-Person Approval?'}
            </div>
            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
              {requiresDual
                ? 'Disabling this means one person can log and confirm their own transactions. This significantly reduces financial safeguards. Are you sure?'
                : 'Enabling this requires all transactions to be confirmed by a different person. This is the recommended setting.'}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setDualToggleConfirm(false)}
                style={{ ...primaryBtn, background: '#f0f4f8', color: '#0f172a', flex: 1 }}
              >Cancel</button>
              <button
                onClick={toggleDualApproval}
                disabled={togglingDual}
                style={{
                  ...primaryBtn, flex: 1, opacity: togglingDual ? 0.5 : 1,
                  background: requiresDual ? '#ef4444' : '#10b981',
                }}
              >{togglingDual ? 'Saving...' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
