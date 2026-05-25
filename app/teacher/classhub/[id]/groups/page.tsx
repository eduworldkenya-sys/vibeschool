'use client'
import { C } from '@/components/teacher/ui'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

const CBC_PRESETS = [
  { name: 'Exceeding Expectation',   color: '#065f46', bg: '#d1fae5', emoji: '🟢' },
  { name: 'Meeting Expectation',     color: '#92400e', bg: '#fef3c7', emoji: '🟡' },
  { name: 'Approaching Expectation', color: '#991b1b', bg: '#fee2e2', emoji: '🔴' },
]

interface Group {
  id:      string
  name:    string
  color:   string
  members: string[]
}

interface Student {
  id:               string
  name:             string
  admission_number: string
}

function GroupsInner() {
  const router  = useRouter()
  const params  = useParams()
  const classId = params.id as string

  const [students, setStudents] = useState<Student[]>([])
  const [groups,   setGroups]   = useState<Group[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState('')

  async function load() {
    const [studsRes, groupsRes, membersRes] = await Promise.all([
      supabase.from('students').select('id, name, admission_number').eq('class_id', classId).is('deleted_at', null).order('name', { ascending: true }),
      supabase.from('class_groups').select('*').eq('class_id', classId),
      supabase.from('class_group_members').select('group_id, student_id'),
    ])

    const fetchedGroups: Group[] = (groupsRes.data ?? []).map(g => ({
      id:      g.id,
      name:    g.name,
      color:   g.color,
      members: (membersRes.data ?? []).filter(m => m.group_id === g.id).map(m => m.student_id),
    }))

    setStudents(studsRes.data ?? [])
    setGroups(fetchedGroups)
    setLoading(false)
  }

  useEffect(() => { load() }, [classId])

  async function createPresets() {
    setSaving(true)
    for (const p of CBC_PRESETS) {
      await supabase.from('class_groups').insert({ class_id: classId, name: p.name, color: p.color })
    }
    setSaving(false)
    load()
  }

  async function assignStudent(studentId: string, groupId: string) {
    const memberGroupIds = groups.map(g => g.id)
    if (memberGroupIds.length > 0) {
      await supabase.from('class_group_members').delete().eq('student_id', studentId).in('group_id', memberGroupIds)
    }
    await supabase.from('class_group_members').insert({ group_id: groupId, student_id: studentId })
    setMsg('Saved')
    setTimeout(() => setMsg(''), 1500)
    load()
  }

  async function removeFromGroup(studentId: string) {
    const memberGroupIds = groups.map(g => g.id)
    if (memberGroupIds.length > 0) {
      await supabase.from('class_group_members').delete().eq('student_id', studentId).in('group_id', memberGroupIds)
    }
    load()
  }

  const assignedIds = groups.flatMap(g => g.members)
  const unassigned  = students.filter(s => !assignedIds.includes(s.id))

  const presetColors: Record<string, { bg: string; text: string }> = {
    '#065f46': { bg: '#d1fae5', text: '#065f46' },
    '#92400e': { bg: '#fef3c7', text: '#92400e' },
    '#991b1b': { bg: '#fee2e2', text: '#991b1b' },
    '#6d28d9': { bg: '#ede9fe', text: '#6d28d9' },
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: C.textMuted, paddingBottom: 80, background: C.surface, minHeight: '100%' }}>
      <style>{`@keyframes slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }`}</style>

      <div style={{ background: 'linear-gradient(135deg, #b45309 0%, #d97706 100%)', padding: '20px 16px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, width: 36, height: 36, color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 }}>Learning Groups</h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: '2px 0 0' }}>CBC differentiated instruction</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {CBC_PRESETS.map(p => (
            <div key={p.name} style={{ flex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '6px 4px', textAlign: 'center' }}>
              <div style={{ fontSize: 14 }}>{p.emoji}</div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', fontWeight: 700, lineHeight: 1.3, marginTop: 2 }}>{p.name.split(' ')[0]}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {msg && (
          <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: C.accent, color: '#fff', padding: '8px 20px', borderRadius: 20, fontWeight: 700, fontSize: 13, zIndex: 999 }}>{msg}</div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: C.textMuted }}>Loading…</div>
        ) : groups.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 20, padding: '32px 20px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🫂</div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, margin: '0 0 8px' }}>No groups yet</h2>
            <p style={{ fontSize: 13, color: C.textMuted, margin: '0 0 20px', lineHeight: 1.5 }}>Set up CBC learning groups to assign students by performance level and target homework or activities to specific groups.</p>
            <button onClick={createPresets} disabled={saving} style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: '#b45309', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Creating…' : '✨ Create CBC Groups'}
            </button>
          </div>
        ) : (
          <>
            {unassigned.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 20, padding: '16px', marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 12px' }}>Unassigned ({unassigned.length})</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {unassigned.map(s => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: C.surface, borderRadius: 12, border: '1px solid #e5e7eb' }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, margin: 0 }}>{s.name}</p>
                        {s.admission_number && <p style={{ fontSize: 11, color: C.textMuted, margin: '2px 0 0' }}>{s.admission_number}</p>}
                      </div>
                      <select onChange={e => { if (e.target.value) assignStudent(s.id, e.target.value) }} defaultValue="" style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, fontFamily: 'inherit', color: C.textPrimary, background: '#fff', cursor: 'pointer' }}>
                        <option value="" disabled>Assign →</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {groups.map(g => {
              const palette = presetColors[g.color] ?? { bg: '#f3f4f6', text: '#374151' }
              const members = students.filter(s => g.members.includes(s.id))
              return (
                <div key={g.id} style={{ background: '#fff', borderRadius: 20, padding: '16px', marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: `4px solid ${g.color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ padding: '4px 10px', borderRadius: 20, background: palette.bg }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: palette.text }}>{g.name}</span>
                    </div>
                    <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{members.length} student{members.length !== 1 ? 's' : ''}</span>
                  </div>
                  {members.length === 0 ? (
                    <p style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', padding: '12px 0', margin: 0 }}>No students assigned yet</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {members.map(s => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: palette.bg, borderRadius: 10 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, margin: 0 }}>{s.name}</p>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <select onChange={e => { if (e.target.value) assignStudent(s.id, e.target.value) }} value={g.id} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 11, fontFamily: 'inherit', background: '#fff', cursor: 'pointer' }}>
                              {groups.map(og => <option key={og.id} value={og.id}>{og.name}</option>)}
                            </select>
                            <button onClick={() => removeFromGroup(s.id)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #fca5a5', background: 'transparent', color: C.error, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {unassigned.length === 0 && (
              <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: C.textMuted }}>✅ All students assigned to groups</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function GroupsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20, color: '#6b7280' }}>Loading…</div>}>
      <GroupsInner />
    </Suspense>
  )
}
