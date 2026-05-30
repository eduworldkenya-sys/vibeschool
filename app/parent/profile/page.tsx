'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LinkedChild } from '@/lib/types'

// ─── Colour tokens ────────────────────────────────────────────────────────────
const C = {
  dark:       '#1e1b4b',
  accent:     '#10b981',
  accentLight:'#d1fae5',
  bg:         '#f0f2f5',
  surface:    '#ffffff',
  border:     '#e5e7eb',
  textPrimary:'#111827',
  textMuted:  '#6b7280',
  red:        '#ef4444',
}

// ─── Shimmer skeleton ─────────────────────────────────────────────────────────
function Skeleton({ h = 48, w = '100%', circle = false }: { h?: number; w?: string | number; circle?: boolean }) {
  return (
    <div style={{
      height: h,
      width: w,
      borderRadius: circle ? '50%' : 12,
      background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      flexShrink: 0,
    }} />
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <div
      onClick={onChange}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        background: on ? C.accent : C.border,
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute',
        top: 3,
        left: on ? 23 : 3,
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  )
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 700,
      color: C.textMuted,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      marginBottom: 8,
      paddingLeft: 4,
    }}>
      {children}
    </div>
  )
}

// ─── Input field ──────────────────────────────────────────────────────────────
function Field({ label, value, onChange, editing }: {
  label: string
  value: string
  onChange: (v: string) => void
  editing: boolean
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 4 }}>
        {label}
      </div>
      {editing ? (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            border: `1.5px solid ${C.accent}`,
            fontSize: 14,
            color: C.textPrimary,
            background: '#fff',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      ) : (
        <div style={{
          padding: '10px 12px',
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          fontSize: 14,
          color: value ? C.textPrimary : C.textMuted,
          background: C.surface,
        }}>
          {value || '—'}
        </div>
      )}
    </div>
  )
}

// ─── Initials helper ──────────────────────────────────────────────────────────
function initials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ParentProfilePage() {
  const router = useRouter()

  const [loading,  setLoading]  = useState(true)
  const [editing,  setEditing]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [toast,    setToast]    = useState<string | null>(null)
  const [children, setChildren] = useState<LinkedChild[]>([])

  const [profile, setProfile] = useState<{
    id: string
    full_name: string
    country_code: string
  } | null>(null)

  const [parentProfile, setParentProfile] = useState<{
    occupation:   string
    relationship: string
  } | null>(null)

  const [editForm, setEditForm] = useState({
    full_name:    '',
    occupation:   '',
    relationship: '',
    country_code: '',
  })

  const [notifs, setNotifs] = useState({
    fees:          true,
    attendance:    true,
    homework:      true,
    announcements: true,
  })

  // ─── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/academy/signin?role=parent'); return }

    const [profileRes, parentRes, linksRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, country_code')
        .eq('id', user.id)
        .single(),
      supabase
        .from('parent_profiles')
        .select('occupation, relationship')
        .eq('profile_id', user.id)
        .single(),
      supabase
        .from('parent_student_links')
        .select('student_id, students(id, name, admission_number, class_id)')
        .eq('parent_id', user.id),
    ])

    if (profileRes.data) {
      setProfile(profileRes.data)
      setEditForm(f => ({
        ...f,
        full_name:    profileRes.data.full_name    ?? '',
        country_code: profileRes.data.country_code ?? '',
      }))
    }

    if (parentRes.data) {
      setParentProfile(parentRes.data)
      setEditForm(f => ({
        ...f,
        occupation:   parentRes.data.occupation   ?? '',
        relationship: parentRes.data.relationship ?? '',
      }))
    }

    if (linksRes.data) {
      const mapped: LinkedChild[] = linksRes.data
        .filter((l: any) => l.students)
        .map((l: any) => ({
          student_id:     l.students.id            ?? l.student_id,
          name:           l.students.name          ?? '',
          class_name:     l.students.class_id      ?? '',
          attendance_pct: 0,
          school_name:    '',
          pending_approval: l.pending_approval ?? false,
        }))
      setChildren(mapped)
    }

    setLoading(false)
  }, [router])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ─── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!profile) return
    setSaving(true)

    const [pRes, ppRes] = await Promise.all([
      supabase
        .from('profiles')
        .update({
          full_name:    editForm.full_name,
          country_code: editForm.country_code,
        })
        .eq('id', profile.id),
      supabase
        .from('parent_profiles')
        .upsert({
          profile_id:   profile.id,
          occupation:   editForm.occupation,
          relationship: editForm.relationship,
        }, { onConflict: 'profile_id' }),
    ])

    setSaving(false)

    if (pRes.error || ppRes.error) {
      setToast('Failed to save. Try again.')
    } else {
      setProfile(p => p ? { ...p, full_name: editForm.full_name, country_code: editForm.country_code } : p)
      setParentProfile({ occupation: editForm.occupation, relationship: editForm.relationship })
      setEditing(false)
      setToast('Profile updated')
    }

    setTimeout(() => setToast(null), 3000)
  }, [profile, editForm])

  // ─── Sign out ──────────────────────────────────────────────────────────────
  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/academy/signin?role=parent')
  }, [router])

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: C.bg }}>

      <style>{`
        @keyframes shimmer {
          0%   { background-position:  200% 0 }
          100% { background-position: -200% 0 }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px) }
          to   { opacity: 1; transform: translateY(0) }
        }
        * { box-sizing: border-box; }
        input:focus { outline: none; }
      `}</style>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          background: C.dark,
          color: '#fff',
          padding: '10px 20px',
          borderRadius: 20,
          fontSize: 13,
          fontWeight: 600,
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease',
          whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}


        {/* ── HERO ── */}
        <div style={{
          background: C.surface,
          borderRadius: 20,
          padding: '32px 20px 24px',
          marginBottom: 16,
          textAlign: 'center',
          position: 'relative',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>

          {/* Edit button */}
          {!loading && (
            <button
              onClick={() => editing ? setEditing(false) : setEditing(true)}
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: editing ? C.border : C.accentLight,
                border: 'none',
                borderRadius: 10,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                color: editing ? C.textMuted : C.accent,
                cursor: 'pointer',
              }}
            >
              {editing ? 'Cancel' : '✏️ Edit'}
            </button>
          )}

          {/* Avatar */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <Skeleton h={80} w={80} circle />
            </div>
          ) : (
            <div style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: C.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: 28,
              fontWeight: 800,
              color: '#fff',
              letterSpacing: '-0.5px',
            }}>
              {initials(profile?.full_name ?? '?')}
            </div>
          )}

          {/* Name */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <Skeleton h={24} w={180} />
              <Skeleton h={20} w={80} />
            </div>
          ) : (
            <>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.textPrimary, marginBottom: 6 }}>
                {profile?.full_name ?? '—'}
              </div>
              <div style={{
                display: 'inline-block',
                background: C.accentLight,
                color: C.accent,
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 12px',
                borderRadius: 20,
                letterSpacing: '0.05em',
              }}>
                Parent
              </div>
            </>
          )}
        </div>

        {/* ── PERSONAL INFO ── */}
        <div style={{
          background: C.surface,
          borderRadius: 20,
          padding: '20px 16px',
          marginBottom: 16,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <SectionLabel>Personal Info</SectionLabel>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Skeleton h={44} />
              <Skeleton h={44} />
              <Skeleton h={44} />
            </div>
          ) : (
            <>
              <Field
                label="Full Name"
                value={editForm.full_name}
                onChange={v => setEditForm(f => ({ ...f, full_name: v }))}
                editing={editing}
              />
              <Field
                label="Occupation"
                value={editForm.occupation}
                onChange={v => setEditForm(f => ({ ...f, occupation: v }))}
                editing={editing}
              />
              <Field
                label="Relationship to Child"
                value={editForm.relationship}
                onChange={v => setEditForm(f => ({ ...f, relationship: v }))}
                editing={editing}
              />
              <Field
                label="Country"
                value={editForm.country_code}
                onChange={v => setEditForm(f => ({ ...f, country_code: v }))}
                editing={editing}
              />

              {editing && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    width: '100%',
                    padding: '13px 0',
                    borderRadius: 12,
                    background: saving ? C.border : C.accent,
                    border: 'none',
                    color: saving ? C.textMuted : '#fff',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    marginTop: 4,
                    transition: 'background 0.2s',
                  }}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              )}
            </>
          )}
        </div>

        {/* ── MY CHILDREN ── */}
        <div style={{
          background: C.surface,
          borderRadius: 20,
          padding: '20px 16px',
          marginBottom: 16,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <SectionLabel>My Children</SectionLabel>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Skeleton h={64} />
              <Skeleton h={64} />
            </div>
          ) : children.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, color: C.textMuted }}>
              No children linked yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {children.map(child => (
                <div
                  key={child.student_id}
                  onClick={() => router.push(`/parent/child/${child.student_id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 14,
                    border: `1px solid ${C.border}`,
                    background: C.bg,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: C.dark,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 15,
                    fontWeight: 800,
                    color: '#fff',
                    flexShrink: 0,
                  }}>
                    {initials(child.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, marginBottom: 2 }}>
                      {child.name}
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>
                      {child.class_name || 'Class not set'}
                    </div>
                  </div>
                  <div style={{ fontSize: 18, color: C.textMuted }}>›</div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => router.push('/parent/create-child')}
            style={{
              width: '100%',
              marginTop: 12,
              padding: '11px 0',
              borderRadius: 12,
              border: `1.5px dashed ${C.accent}`,
              background: 'transparent',
              color: C.accent,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            + Add Child
          </button>
        </div>

        {/* ── NOTIFICATIONS ── */}
        <div style={{
          background: C.surface,
          borderRadius: 20,
          padding: '20px 16px',
          marginBottom: 16,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <SectionLabel>Notifications</SectionLabel>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, background: C.bg, borderRadius: 8, padding: '2px 8px' }}>
              Coming soon
            </span>
          </div>

          {([
            { key: 'fees',          label: 'Fee Reminders' },
            { key: 'attendance',    label: 'Attendance Alerts' },
            { key: 'homework',      label: 'Homework Updates' },
            { key: 'announcements', label: 'General Announcements' },
          ] as const).map(({ key, label }) => (
            <div key={key} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 0',
              borderBottom: key !== 'announcements' ? `1px solid ${C.border}` : 'none',
            }}>
              <span style={{ fontSize: 14, color: C.textPrimary }}>{label}</span>
              <Toggle
                on={notifs[key]}
                onChange={() => setNotifs(n => ({ ...n, [key]: !n[key] }))}
              />
            </div>
          ))}
        </div>

        {/* ── SIGN OUT ── */}
        <button
          onClick={handleSignOut}
          style={{
            width: '100%',
            padding: '14px 0',
            borderRadius: 14,
            border: `2px solid ${C.red}`,
            background: 'transparent',
            color: C.red,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            marginBottom: 8,
          }}
        >
          Sign Out
        </button>

      </div>
  )
}
