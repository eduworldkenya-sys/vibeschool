"use client";
export const dynamic = "force-dynamic";
import { C } from '@/components/teacher/ui'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

const LEARNING_PRESETS = [
  { name: 'Exceeding Expectation',   color: '#065f46', bg: '#d1fae5', emoji: '🟢' },
  { name: 'Meeting Expectation',     color: '#92400e', bg: '#fef3c7', emoji: '🟡' },
  { name: 'Approaching Expectation', color: '#991b1b', bg: '#fee2e2', emoji: '🔴' },
]

const READING_PRESETS = [
  { name: 'Fluent Readers',     color: '#1d4ed8', bg: '#dbeafe', emoji: '📖' },
  { name: 'Developing Readers', color: '#92400e', bg: '#fef3c7', emoji: '📘' },
  { name: 'Emerging Readers',   color: '#991b1b', bg: '#fee2e2', emoji: '📕' },
]

const GROUP_COLORS = ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16']

interface Student   { id: string; name: string; admission_number: string | null }
interface Group     { id: string; name: string; color: string; type: string }
interface GroupMember { group_id: string; student_id: string }

function GroupsInner() {
  const router   = useRouter()
  const params   = useParams()
  const classId  = params.id as string

  const [students,        setStudents]        = useState<Student[]>([])
  const [groups,          setGroups]          = useState<Group[]>([])
  const [members,         setMembers]         = useState<GroupMember[]>([])
  const [className,       setClassName]       = useState('')
  const [loading,         setLoading]         = useState(true)
  const [authError,       setAuthError]       = useState('')
  const [saving,          setSaving]          = useState(false)
  const [msg,             setMsg]             = useState('')
  const [editingId,       setEditingId]       = useState<string | null>(null)
  const [editName,        setEditName]        = useState('')
  const [groupCount,      setGroupCount]      = useState(3)
  const [showCountPicker, setShowCountPicker] = useState(false)

  async function load() {
    setLoading(true)
    setAuthError('')

    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) { router.push('/'); return }

    // Verify teacher owns or teaches this class
    const { data: ownership } = await supabase
      .from('classes')
      .select('id, name')
      .eq('id', classId)
      .eq('teacher_id', user.id)
      .maybeSingle()

    // Also allow subject teachers via teacher_classes
    let className = ownership?.name ?? null
    if (!ownership) {
      const { data: tc } = await supabase
        .from('teacher_classes')
        .select('class_id')
        .eq('class_id', classId)
        .eq('teacher_id', user.id)
        .maybeSingle()
      if (!tc) {
        setAuthError('You do not have access to this class.')
        setLoading(false)
        return
      }
      const { data: cls } = await supabase
        .from('classes')
        .select('name')
        .eq('id', classId)
        .single()
      className = cls?.name ?? ''
    }

    const [studsRes, groupsRes, membersRes] = await Promise.all([
      supabase.from('student_classes').select('student_id, students(id, name, admission_number)').eq('class_id', classId).eq('is_current', true),
      supabase.from('class_groups').select('*').eq('class_id', classId),
      supabase.from('class_group_members').select('group_id, student_id'),
    ])

    setClassName(className ?? '')
    setStudents((studsRes.data ?? []).map((sc: any) => sc.students).filter(Boolean))
    setGroups(groupsRes.data ?? [])
    setMembers(membersRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [classId])

  async function createGroups(type: string, presets: typeof LEARNING_PRESETS) {
    setSaving(true)
    await Promise.all(
      presets.map(p => supabase.from('class_groups').insert({ class_id: classId, name: p.name, color: p.color, type }))
    )
    await load()
    setSaving(false)
    setMsg('Groups created!')
    setTimeout(() => setMsg(''), 2500)
  }

  async function createRandomGroups() {
    setSaving(true)
    const n       = groupCount
    const colors  = GROUP_COLORS.slice(0, n)
    const shuffled = [...students].sort(() => Math.random() - 0.5)

    const { data: newGroups } = await supabase
      .from('class_groups')
      .insert(colors.map((c, i) => ({ class_id: classId, name: `Group ${i + 1}`, color: c, type: 'custom' })))
      .select('id')

    if (newGroups) {
      const assignments = shuffled.map((s, i) => ({
        group_id:   newGroups[i % n].id,
        student_id: s.id,
      }))
      await supabase.from('class_group_members').delete().eq('student_id', shuffled[0]?.id ?? '')
      const sameTypeGroupIds = (groups.filter(g => g.type === 'custom')).map(g => g.id)
      if (sameTypeGroupIds.length > 0) {
        await supabase.from('class_group_members').delete().in('group_id', sameTypeGroupIds)
        await supabase.from('class_groups').delete().in('id', sameTypeGroupIds)
      }
      await supabase.from('class_group_members').insert(assignments)
    }
    await load()
    setSaving(false)
    setMsg('Random groups created!')
    setTimeout(() => setMsg(''), 2500)
  }

  async function assignStudent(studentId: string, groupId: string, type: string) {
    const sameTypeGroupIds = groups.filter(g => g.type === type).map(g => g.id)
    await supabase.from('class_group_members').delete().eq('student_id', studentId).in('group_id', sameTypeGroupIds)
    await supabase.from('class_group_members').insert({ group_id: groupId, student_id: studentId })
    await load()
  }

  async function removeStudent(studentId: string, type: string) {
    const sameTypeGroupIds = groups.filter(g => g.type === type).map(g => g.id)
    await supabase.from('class_group_members').delete().eq('student_id', studentId).in('group_id', sameTypeGroupIds)
    await load()
  }

  async function renameGroup(id: string, name: string) {
    await supabase.from('class_groups').update({ name: name.trim() }).eq('id', id)
    setEditingId(null)
    await load()
  }

  async function deleteGroup(id: string) {
    await supabase.from('class_groups').delete().eq('id', id)
    await load()
  }

  const groupsByType = (type: string) => groups.filter(g => g.type === type)
  const memberOf = (studentId: string, type: string) => {
    const typeGroupIds = new Set(groupsByType(type).map(g => g.id))
    return members.find(m => m.student_id === studentId && typeGroupIds.has(m.group_id))?.group_id ?? null
  }

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTop: '3px solid #10b981', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (authError) return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>{authError}</div>
      <button onClick={() => router.push('/teacher')} style={{ padding: '10px 20px', background: C.accent, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
        Go Home
      </button>
    </div>
  )

  const TABS = [
    { type: 'learning', label: 'Performance',  presets: LEARNING_PRESETS },
    { type: 'reading',  label: 'Reading',      presets: READING_PRESETS  },
    { type: 'custom',   label: 'Custom',       presets: []               },
  ]

  return (
    <div style={{ paddingBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => router.back()} style={{ background: C.dark, border: 'none', borderRadius: 10, width: 36, height: 36, color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.dark }}>Class Groups</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>{className}</div>
        </div>
      </div>

      {msg && (
        <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#065f46', marginBottom: 16 }}>
          {msg}
        </div>
      )}

      {TABS.map(tab => (
        <div key={tab.type} style={{ background: '#fff', borderRadius: 16, border: '1px solid #f0ece6', padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.dark, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {tab.label} Groups
          </div>

          {groupsByType(tab.type).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>No {tab.label.toLowerCase()} groups yet</div>
              {tab.presets.length > 0 && (
                <button onClick={() => createGroups(tab.type, tab.presets)} disabled={saving} style={{ padding: '8px 16px', background: C.accent, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  Create Default Groups
                </button>
              )}
              {tab.type === 'custom' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: C.textMuted }}>Groups:</span>
                    <button onClick={() => setGroupCount(c => Math.max(2, c - 1))} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontWeight: 700 }}>-</button>
                    <span style={{ fontWeight: 800, fontSize: 14 }}>{groupCount}</span>
                    <button onClick={() => setGroupCount(c => Math.min(8, c + 1))} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontWeight: 700 }}>+</button>
                  </div>
                  <button onClick={createRandomGroups} disabled={saving || students.length === 0} style={{ padding: '8px 16px', background: C.accent, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    Randomise into {groupCount} Groups
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {groupsByType(tab.type).map(g => (
                <div key={g.id} style={{ border: '1px solid #f0ece6', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ background: g.color + '18', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {editingId === g.id ? (
                      <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                        <input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'inherit' }}
                          autoFocus
                        />
                        <button onClick={() => renameGroup(g.id, editName)} style={{ padding: '4px 10px', background: C.accent, color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Save</button>
                        <button onClick={() => setEditingId(null)} style={{ padding: '4px 10px', background: '#f3f4f6', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                      </div>
                    ) : (
                      <>
                        <span style={{ fontWeight: 700, fontSize: 13, color: g.color }}>{g.name}</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => { setEditingId(g.id); setEditName(g.name) }} style={{ fontSize: 11, padding: '3px 8px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>Rename</button>
                          <button onClick={() => deleteGroup(g.id)} style={{ fontSize: 11, padding: '3px 8px', border: '1px solid #fecaca', borderRadius: 6, background: '#fff', color: '#ef4444', cursor: 'pointer' }}>Delete</button>
                        </div>
                      </>
                    )}
                  </div>
                  <div style={{ padding: '8px 14px 12px' }}>
                    {students.map(s => {
                      const assigned = memberOf(s.id, tab.type)
                      const inThis   = assigned === g.id
                      return (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f9fafb' }}>
                          <span style={{ fontSize: 13, color: C.dark }}>{s.name}</span>
                          {inThis ? (
                            <button onClick={() => removeStudent(s.id, tab.type)} style={{ fontSize: 11, padding: '3px 10px', background: g.color + '20', color: g.color, border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>✓ Remove</button>
                          ) : (
                            <button onClick={() => assignStudent(s.id, g.id, tab.type)} disabled={!!assigned} style={{ fontSize: 11, padding: '3px 10px', background: assigned ? '#f3f4f6' : '#f0fdf4', color: assigned ? '#9ca3af' : C.accent, border: 'none', borderRadius: 6, fontWeight: 600, cursor: assigned ? 'not-allowed' : 'pointer' }}>
                              {assigned ? 'Assigned' : 'Add'}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function GroupsPage() {
  return <Suspense><GroupsInner /></Suspense>
}
