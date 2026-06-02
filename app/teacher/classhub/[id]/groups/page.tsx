"use client";
'use client'
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
  { name: 'Developing Readers', color: '#6d28d9', bg: '#ede9fe', emoji: '📝' },
  { name: 'Emerging Readers',   color: '#9d174d', bg: '#fce7f3', emoji: '🌱' },
]

const ACTIVITY_COLORS = [
  { color: '#1d4ed8', bg: '#dbeafe' },
  { color: '#065f46', bg: '#d1fae5' },
  { color: '#6d28d9', bg: '#ede9fe' },
  { color: '#92400e', bg: '#fef3c7' },
  { color: '#0f766e', bg: '#ccfbf1' },
  { color: '#9d174d', bg: '#fce7f3' },
]

type TabType = 'learning' | 'activity' | 'reading'

interface Group {
  id:      string
  name:    string
  color:   string
  type:    string
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

  const [tab,             setTab]             = useState<TabType>('learning')
  const [students,        setStudents]        = useState<Student[]>([])
  const [groups,          setGroups]          = useState<Group[]>([])
  const [grade,           setGrade]           = useState<number>(0)
  const [loading,         setLoading]         = useState(true)
  const [saving,          setSaving]          = useState(false)
  const [msg,             setMsg]             = useState('')
  const [editingId,       setEditingId]       = useState<string | null>(null)
  const [editName,        setEditName]        = useState('')
  const [groupCount,      setGroupCount]      = useState(3)
  const [showCountPicker, setShowCountPicker] = useState(false)

  async function load() {
    const [studsRes, classRes, groupsRes, membersRes] = await Promise.all([
      supabase.from('students').select('id, name, admission_number').eq('class_id', classId).is('deleted_at', null).order('name', { ascending: true }),
      supabase.from('classes').select('name').eq('id', classId).single(),
      supabase.from('class_groups').select('*').eq('class_id', classId),
      supabase.from('class_group_members').select('group_id, student_id'),
    ])

    const className = classRes.data?.name ?? ''
    const parsedGrade = parseInt(className.match(/\d+/)?.[0] ?? '0')
    setGrade(parsedGrade)

    const fetchedGroups: Group[] = (groupsRes.data ?? []).map(g => ({
      id:      g.id,
      name:    g.name,
      color:   g.color,
      type:    g.type ?? 'learning',
      members: (membersRes.data ?? []).filter(m => m.group_id === g.id).map(m => m.student_id),
    }))

    setStudents(studsRes.data ?? [])
    setGroups(fetchedGroups)
    setLoading(false)
  }

  useEffect(() => { load() }, [classId])

  function showMsg(text: string) {
    setMsg(text)
    setTimeout(() => setMsg(''), 1800)
  }

  async function createPresets(presets: { name: string; color: string }[], type: string) {
    setSaving(true)
    for (const p of presets) {
      await supabase.from('class_groups').insert({ class_id: classId, name: p.name, color: p.color, type })
    }
    setSaving(false)
    load()
  }

  async function createActivityGroups(count: number) {
    setSaving(true)
    const letters     = ['A', 'B', 'C', 'D', 'E', 'F']
    const allStudents = students
    const chunkSize   = Math.ceil(allStudents.length / count)

    for (let i = 0; i < count; i++) {
      const palette = ACTIVITY_COLORS[i % ACTIVITY_COLORS.length]
      const { data: grp } = await supabase
        .from('class_groups')
        .insert({ class_id: classId, name: 'Group ' + letters[i], color: palette.color, type: 'activity' })
        .select('id')
        .single()

      if (grp) {
        const chunk = allStudents.slice(i * chunkSize, (i + 1) * chunkSize)
        if (chunk.length > 0) {
          await supabase.from('class_group_members').insert(
            chunk.map(s => ({ group_id: grp.id, student_id: s.id }))
          )
        }
      }
    }

    setSaving(false)
    setShowCountPicker(false)
    load()
  }

  async function assignStudent(studentId: string, groupId: string, type: string) {
    const sameTypeGroupIds = groups.filter(g => g.type === type).map(g => g.id)
    if (sameTypeGroupIds.length > 0) {
      await supabase.from('class_group_members').delete().eq('student_id', studentId).in('group_id', sameTypeGroupIds)
    }
    await supabase.from('class_group_members').insert({ group_id: groupId, student_id: studentId })
    showMsg('Saved')
    load()
  }

  async function removeFromGroup(studentId: string, type: string) {
    const sameTypeGroupIds = groups.filter(g => g.type === type).map(g => g.id)
    if (sameTypeGroupIds.length > 0) {
      await supabase.from('class_group_members').delete().eq('student_id', studentId).in('group_id', sameTypeGroupIds)
    }
    load()
  }

  async function renameGroup(id: string, name: string) {
    if (!name.trim()) return
    await supabase.from('class_groups').update({ name: name.trim() }).eq('id', id)
    setEditingId(null)
    showMsg('Renamed')
    load()
  }

  async function deleteGroup(id: string) {
    await supabase.from('class_groups').delete().eq('id', id)
    showMsg('Group deleted')
    load()
  }

  const showReading = grade >= 1 && grade <= 3

  const TABS: { id: TabType; label: string }[] = [
    { id: 'learning', label: '🎯 Learning' },
    { id: 'activity', label: '⚡ Activity' },
    ...(showReading ? [{ id: 'reading' as TabType, label: '📖 Reading' }] : []),
  ]

  const TAB_CONFIG: Record<TabType, {
    label: string; sub: string; gradient: string
    emptyIcon: string; emptyText: string; emptyBtn: string
    emptyAction: () => void
  }> = {
    learning: {
      label:       'Learning Groups',
      sub:         'CBC differentiated instruction',
      gradient:    'linear-gradient(135deg, #b45309 0%, #d97706 100%)',
      emptyIcon:   '🫂',
      emptyText:   'Set up CBC learning groups to differentiate instruction by performance level.',
      emptyBtn:    '✨ Create CBC Groups',
      emptyAction: () => createPresets(LEARNING_PRESETS, 'learning'),
    },
    activity: {
      label:       'Activity Groups',
      sub:         'Daily classwork teams',
      gradient:    'linear-gradient(135deg, #1e1b4b 0%, #4f46e5 100%)',
      emptyIcon:   '🏃',
      emptyText:   'Create activity groups for daily classwork. Students are split evenly and you can rename each group.',
      emptyBtn:    '⚡ Create Activity Groups',
      emptyAction: () => setShowCountPicker(true),
    },
    reading: {
      label:       'Reading Groups',
      sub:         'Literacy & fluency tracking',
      gradient:    'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
      emptyIcon:   '📖',
      emptyText:   'Group students by reading fluency level to target literacy support effectively.',
      emptyBtn:    '📖 Create Reading Groups',
      emptyAction: () => createPresets(READING_PRESETS, 'reading'),
    },
  }

  const cfg         = TAB_CONFIG[tab]
  const tabGroups   = groups.filter(g => g.type === tab)
  const assignedIds = tabGroups.flatMap(g => g.members)
  const unassigned  = students.filter(s => !assignedIds.includes(s.id))

  const paletteFor = (color: string) => {
    const allColors = [
      ...ACTIVITY_COLORS,
      ...READING_PRESETS.map(p => ({ color: p.color, bg: p.bg })),
    ]
    const found = allColors.find(c => c.color === color)
    if (found) return { bg: found.bg, text: color }
    const map: Record<string, string> = { '#065f46': '#d1fae5', '#92400e': '#fef3c7', '#991b1b': '#fee2e2' }
    return { bg: map[color] ?? '#f3f4f6', text: color }
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: C.textMuted, paddingBottom: 80, background: C.surface, minHeight: '100%' }}>
      <style>{`@keyframes slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} } @keyframes fadeIn { from{opacity:0} to{opacity:1} }`}</style>

      {/* HERO */}
      <div style={{ background: cfg.gradient, padding: '20px 16px 24px', transition: 'background 0.3s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, width: 36, height: 36, color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 }}>{cfg.label}</h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: '2px 0 0' }}>{cfg.sub}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setShowCountPicker(false) }} style={{ flex: 1, padding: '10px 8px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 11, background: tab === t.id ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.15)', color: tab === t.id ? '#1e1b4b' : 'rgba(255,255,255,0.85)', transition: 'all 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* TOAST */}
      {msg && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: C.accent, color: '#fff', padding: '8px 20px', borderRadius: 20, fontWeight: 700, fontSize: 13, zIndex: 999, animation: 'fadeIn 0.2s ease' }}>{msg}</div>
      )}

      <div style={{ padding: '16px', animation: 'slideDown 0.2s ease' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: C.textMuted }}>Loading…</div>

        ) : showCountPicker ? (
          <div style={{ background: '#fff', borderRadius: 20, padding: '24px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚡</div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1e1b4b', margin: '0 0 6px' }}>How many groups?</h2>
            <p style={{ fontSize: 13, color: C.textMuted, margin: '0 0 20px' }}>Students will be split evenly. You can rename groups after.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
              {[2, 3, 4, 5, 6].map(n => (
                <button key={n} onClick={() => setGroupCount(n)} style={{ width: 44, height: 44, borderRadius: 12, border: groupCount === n ? '2.5px solid #4f46e5' : '1.5px solid #e5e7eb', background: groupCount === n ? '#ede9fe' : '#fff', color: groupCount === n ? '#4f46e5' : C.textPrimary, fontWeight: 800, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}>{n}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowCountPicker(false)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fff', color: C.textMuted, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={() => createActivityGroups(groupCount)} disabled={saving} style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: saving ? '#a5b4fc' : '#4f46e5', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Creating…' : `Create ${groupCount} Groups`}
              </button>
            </div>
          </div>

        ) : tabGroups.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 20, padding: '32px 20px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>{cfg.emptyIcon}</div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1e1b4b', margin: '0 0 8px' }}>No {tab} groups yet</h2>
            <p style={{ fontSize: 13, color: C.textMuted, margin: '0 0 20px', lineHeight: 1.5 }}>{cfg.emptyText}</p>
            <button onClick={cfg.emptyAction} disabled={saving} style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: tab === 'learning' ? '#b45309' : tab === 'reading' ? '#0f766e' : '#4f46e5', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Creating…' : cfg.emptyBtn}
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
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#1e1b4b', margin: 0 }}>{s.name}</p>
                        {s.admission_number && <p style={{ fontSize: 11, color: C.textMuted, margin: '2px 0 0' }}>{s.admission_number}</p>}
                      </div>
                      <select onChange={e => { if (e.target.value) assignStudent(s.id, e.target.value, tab) }} defaultValue="" style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, fontFamily: 'inherit', color: '#1e1b4b', background: '#fff', cursor: 'pointer' }}>
                        <option value="" disabled>Assign →</option>
                        {tabGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tabGroups.map(g => {
              const palette   = paletteFor(g.color)
              const members   = students.filter(s => g.members.includes(s.id))
              const isEditing = editingId === g.id
              return (
                <div key={g.id} style={{ background: '#fff', borderRadius: 20, padding: '16px', marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: `4px solid ${g.color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: 6, flex: 1, marginRight: 8 }}>
                        <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') renameGroup(g.id, editName) }} autoFocus style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1.5px solid ' + g.color, fontSize: 13, fontFamily: 'inherit', fontWeight: 700, color: '#1e1b4b', outline: 'none' }} />
                        <button onClick={() => renameGroup(g.id, editName)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: g.color, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>✓</button>
                        <button onClick={() => setEditingId(null)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: C.textMuted, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingId(g.id); setEditName(g.name) }} style={{ padding: '4px 10px', borderRadius: 20, background: palette.bg, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: palette.text }}>{g.name} ✏️</span>
                      </button>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{members.length} student{members.length !== 1 ? 's' : ''}</span>
                      <button onClick={() => deleteGroup(g.id)} style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid #fca5a5', background: 'transparent', color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>🗑</button>
                    </div>
                  </div>
                  {members.length === 0 ? (
                    <p style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', padding: '12px 0', margin: 0 }}>No students assigned yet</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {members.map(s => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: palette.bg, borderRadius: 10 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#1e1b4b', margin: 0 }}>{s.name}</p>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <select onChange={e => { if (e.target.value) assignStudent(s.id, e.target.value, tab) }} value={g.id} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 11, fontFamily: 'inherit', background: '#fff', cursor: 'pointer' }}>
                              {tabGroups.map(og => <option key={og.id} value={og.id}>{og.name}</option>)}
                            </select>
                            <button onClick={() => removeFromGroup(s.id, tab)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #fca5a5', background: 'transparent', color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
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
