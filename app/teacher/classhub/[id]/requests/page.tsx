"use client";
export const dynamic = "force-dynamic";
import { C } from '@/components/teacher/ui'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const dark   = C.dark
const accent = C.accent

interface JoinRequest {
  id:          string
  student_id:  string
  parent_id:   string
  studentName: string
  parentName:  string
  className:   string
}

function Skeleton({ h = 80 }: { h?: number }) {
  return (
    <div style={{ height: h, borderRadius: 14, background: 'linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
  )
}

export default function JoinRequestsPage() {
  const router  = useRouter()
  const params  = useParams()
  const classId = params.id as string

  const [requests,  setRequests]  = useState<JoinRequest[]>([])
  const [loading,   setLoading]   = useState(true)
  const [acting,    setActing]    = useState<string | null>(null)
  const [actingErr, setActingErr] = useState<string | null>(null)
  const [className, setClassName] = useState('')

  async function loadRequests() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/admin/login'); return }

    const { data: cls } = await supabase
      .from('classes')
      .select('name, stream')
      .eq('id', classId)
      .single()

    if (!cls) { router.push('/teacher/classhub'); return }
    setClassName(cls.name + (cls.stream ? ' ' + cls.stream : ''))

    const { data: raw } = await supabase
      .from('class_join_requests')
      .select('id, student_id, parent_id, status')
      .eq('class_id', classId)
      .eq('status', 'pending')

    if (!raw || raw.length === 0) {
      setRequests([])
      setLoading(false)
      return
    }

    const studentIds = raw.map(r => r.student_id)
    const parentIds  = raw.map(r => r.parent_id)

    const [studsRes, parentsRes] = await Promise.all([
      supabase.from('students').select('id, name').in('id', studentIds),
      supabase.from('profiles').select('id, full_name').in('id', parentIds),
    ])

    const studMap   = Object.fromEntries((studsRes.data   ?? []).map(s => [s.id, s.name]))
    const parentMap = Object.fromEntries((parentsRes.data ?? []).map(p => [p.id, p.full_name]))

    setRequests(raw.map(r => ({
      id:          r.id,
      student_id:  r.student_id,
      parent_id:   r.parent_id,
      studentName: studMap[r.student_id]   ?? 'Unknown Student',
      parentName:  parentMap[r.parent_id]  ?? 'Unknown Parent',
      className:   cls.name + (cls.stream ? ' ' + cls.stream : ''),
    })))

    setLoading(false)
  }

  useEffect(() => { loadRequests() }, [classId])

  async function handleApprove(req: JoinRequest) {
    setActing(req.id)
    setActingErr(null)

    // 1. Get school_id from class
    const { data: cls, error: clsErr } = await supabase
      .from('classes')
      .select('school_id')
      .eq('id', classId)
      .single()

    if (clsErr || !cls) {
      console.error('Failed to fetch class:', clsErr)
      setActingErr('Failed to fetch class info.')
      setActing(null)
      return
    }

    const schoolId = cls.school_id ?? null

    // 2. Update students.class_id — the missing piece
    const { error: stuErr } = await supabase
      .from('students')
      .update({ class_id: classId })
      .eq('id', req.student_id)

    if (stuErr) {
      console.error('Failed to update student class_id:', stuErr)
      setActingErr('Failed to assign student to class.')
      setActing(null)
      return
    }

    // 3. Upsert student_classes (safe — won't duplicate)
    const { error: scErr } = await supabase
      .from('student_classes')
      .upsert({
        school_id:  schoolId,
        student_id: req.student_id,
        class_id:   classId,
        joined_at:  new Date().toISOString(),
        is_current: true,
      }, { onConflict: 'student_id,class_id' })

    if (scErr) {
      console.error('Failed to upsert student_classes:', scErr)
      setActingErr('Failed to enrol student in class.')
      setActing(null)
      return
    }

    // 4. Update existing parent_student_links with real school_id
    //    or insert if somehow missing
    const { data: existing } = await supabase
      .from('parent_student_links')
      .select('id')
      .eq('parent_id', req.parent_id)
      .eq('student_id', req.student_id)
      .single()

    if (existing) {
      const { error: linkErr } = await supabase
        .from('parent_student_links')
        .update({ school_id: schoolId })
        .eq('id', existing.id)

      if (linkErr) {
        console.error('Failed to update parent link school_id:', linkErr)
        setActingErr('Failed to update parent link.')
        setActing(null)
        return
      }
    } else {
      const { error: linkErr } = await supabase
        .from('parent_student_links')
        .insert({
          parent_id:       req.parent_id,
          student_id:      req.student_id,
          school_id:       schoolId,
          relationship:    'parent',
          is_primary:      true,
          can_pickup:      true,
          receives_alerts: true,
        })

      if (linkErr) {
        console.error('Failed to insert parent link:', linkErr)
        setActingErr('Failed to link parent.')
        setActing(null)
        return
      }
    }

    // 5. Mark request approved — only after all writes succeed
    const { error: reqErr } = await supabase
      .from('class_join_requests')
      .update({ status: 'approved' })
      .eq('id', req.id)

    if (reqErr) {
      console.error('Failed to mark request approved:', reqErr)
      setActingErr('Student enrolled but request status failed to update.')
      setActing(null)
      return
    }

    // Auto-generate student + parent claim codes
    const studentCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    const parentCode  = Math.random().toString(36).substring(2, 8).toUpperCase()
    const expiry = new Date()
    expiry.setDate(expiry.getDate() + 30)
    const expiresAt = expiry.toISOString()

    await supabase
      .from('student_claim_codes')
      .delete()
      .eq('student_id', req.student_id)
      .eq('claimed', false)

    await Promise.all([
      supabase.from('student_claim_codes').insert({
        student_id: req.student_id,
        code:       studentCode,
        claimed:    false,
        role:       'student',
        expires_at: expiresAt,
      }),
      supabase.from('student_claim_codes').insert({
        student_id: req.student_id,
        code:       parentCode,
        claimed:    false,
        role:       'parent',
        expires_at: expiresAt,
      }),
    ])

    setActing(null)
    setRequests(prev => prev.filter(r => r.id !== req.id))
  }

  async function handleReject(reqId: string) {
    setActing(reqId)
    setActingErr(null)

    const { error } = await supabase
      .from('class_join_requests')
      .update({ status: 'rejected' })
      .eq('id', reqId)

    if (error) {
      console.error('Failed to reject request:', error)
      setActingErr('Failed to reject request.')
    } else {
      setRequests(prev => prev.filter(r => r.id !== reqId))
    }

    setActing(null)
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: C.surface }}>
      <style>{`
        @keyframes shimmer  { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes slideIn  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${dark} 0%, #312e81 100%)`, padding: '20px 16px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => router.push('/teacher/classhub/' + classId)}
            style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 18 }}
          >←</button>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: 0.8 }}>
              {className}
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>Join Requests</div>
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>🔔</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>
              {loading ? '—' : requests.length} pending {requests.length === 1 ? 'request' : 'requests'}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
              Approve to link parent and enrol student
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, animation: 'slideIn 0.22s ease' }}>

        {actingErr && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: '12px 16px', fontSize: 13, fontWeight: 600, color: C.error }}>
            ⚠️ {actingErr}
          </div>
        )}

        {loading ? (
          <>
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </>
        ) : requests.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, textAlign: 'center', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.textPrimary, marginBottom: 6 }}>All caught up</div>
            <div style={{ fontSize: 13, color: C.textMuted }}>No pending join requests for this class.</div>
          </div>
        ) : (
          requests.map(req => (
            <div key={req.id} style={{ background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>

              {/* Student */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, color: dark, flexShrink: 0 }}>
                  {req.studentName[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.textPrimary }}>{req.studentName}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>Student</div>
                </div>
                <div style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 20, background: '#fef3c7', fontSize: 10, fontWeight: 800, color: '#92400e' }}>
                  PENDING
                </div>
              </div>

              {/* Parent */}
              <div style={{ background: C.surface, borderRadius: 10, padding: '10px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>👤</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.textPrimary }}>{req.parentName}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>Parent requesting access</div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => handleApprove(req)}
                  disabled={acting === req.id}
                  style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: acting === req.id ? C.accentLight : accent, color: '#fff', fontWeight: 700, fontSize: 13, cursor: acting === req.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                >
                  {acting === req.id ? 'Approving…' : '✓ Approve'}
                </button>
                <button
                  onClick={() => handleReject(req.id)}
                  disabled={acting === req.id}
                  style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #fca5a5', background: 'transparent', color: C.error, fontWeight: 700, fontSize: 13, cursor: acting === req.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                >
                  {acting === req.id ? '…' : '✕ Reject'}
                </button>
              </div>

            </div>
          ))
        )}
      </div>
    </div>
  )
}
