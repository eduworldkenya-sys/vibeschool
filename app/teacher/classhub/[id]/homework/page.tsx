'use client'
import { C } from '@/components/teacher/ui'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'

interface Homework {
  id:           string
  title:        string
  subject:      string
  instructions: string
  due_date:     string
  type:         string
  created_at:   string
  target_group_id: string | null
}

interface Group {
  id:   string
  name: string
}

function HomeworkInner() {
  const router  = useRouter()
  const params  = useParams()
  const classId = params.id as string

  const [list,      setList]      = useState<Homework[]>([])
  const [groups,    setGroups]    = useState<Group[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [classInfo, setClassInfo] = useState<{ name: string; stream: string; subject: string } | null>(null)
  const [subjects,  setSubjects]  = useState<{ id: string; name: string }[]>([])
  const [schoolId,  setSchoolId]  = useState<string | null>(null)

  const [form, setForm] = useState({
    title:        '',
    subject:      '',
    instructions: '',
    due_date:     '',
    type:         'general',
    target_group_id: '',
  })

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [hwRes, clsRes, grpRes, subjRes] = await Promise.all([
      supabase.from('homework').select('*').eq('class_id', classId).order('created_at', { ascending: false }),
      supabase.from('classes').select('name, stream, subject, school_id').eq('id', classId).single(),
      supabase.from('class_groups').select('id, name').eq('class_id', classId),
      supabase.from('subjects').select('id, name').order('name'),
    ])

    setList(hwRes.data ?? [])
    setClassInfo(clsRes.data)
    setSchoolId((clsRes.data as { school_id?: string | null } | null)?.school_id ?? null)
    setGroups(grpRes.data ?? [])
    setSubjects(subjRes.data ?? [])
    if (clsRes.data?.subject) setForm(f => ({ ...f, subject: clsRes.data!.subject }))
    setLoading(false)
  }

  useEffect(() => { load() }, [classId])

  async function handleSubmit() {
    setError('')
    if (!form.title.trim()) { setError('Title is required'); return }
    if (!form.due_date)     { setError('Due date is required'); return }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: err } = await supabase.from('homework').insert({
      class_id:     classId,
      teacher_id:   user.id,
      school_id:    schoolId,
      title:        form.title.trim(),
      subject:      form.subject.trim(),
      instructions: form.instructions.trim(),
      due_date:     form.due_date,
      type:         form.type,
      target_group_id: form.target_group_id || null,
    })

    setSaving(false)
    if (err) { setError(err.message); return }
    setForm(f => ({ ...f, title: '', instructions: '', due_date: '' }))
    setShowForm(false)
    load()
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  function isOverdue(due: string) {
    return new Date(due) < new Date()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: '1px solid #e5e7eb', fontSize: 14, color: C.textPrimary,
    outline: 'none', fontFamily: 'inherit', background: '#f9fafb',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: C.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 6, display: 'block',
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: C.textMuted, paddingBottom: 80, background: C.surface, minHeight: '100%' }}>

      <div style={{ background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)', padding: '20px 16px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 10, width: 36, height: 36, color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 }}>Homework</h1>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: '2px 0 0' }}>
                {classInfo ? `${classInfo.name}${classInfo.stream ? ' · ' + classInfo.stream : ''}` : ''}
              </p>
            </div>
          </div>
          <button onClick={() => setShowForm(v => !v)} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: showForm ? 'rgba(255,255,255,0.2)' : '#fff', color: showForm ? '#fff' : '#0f766e', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            {showForm ? 'Cancel' : '+ New'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: 'Total',   value: list.length },
            { label: 'Active',  value: list.filter(h => !isOverdue(h.due_date)).length },
            { label: 'Overdue', value: list.filter(h => isOverdue(h.due_date)).length },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{s.value}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        {showForm && (
          <div style={{ background: '#fff', borderRadius: 20, padding: '20px', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', animation: 'slideDown 0.2s ease' }}>
            <style>{`@keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }`}</style>
            <p style={{ fontSize: 12, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 16px' }}>New Assignment</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Title *</label>
                <input style={inputStyle} placeholder="e.g. Read pages 12–15 and summarise" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Subject</label>
                <select style={inputStyle} value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
                  <option value="">-- Select subject --</option>
                  {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Instructions</label>
                <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder="What should students do?" value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Due Date *</label>
                <input style={inputStyle} type="datetime-local" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Type</label>
                <select style={inputStyle} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="general">General</option>
                  <option value="reading">Reading</option>
                  <option value="writing">Writing</option>
                  <option value="project">Project</option>
                  <option value="revision">Revision</option>
                </select>
              </div>
            </div>
            <div>
                <label style={labelStyle}>Assign To</label>
                <select style={inputStyle} value={form.target_group_id} onChange={e => setForm(f => ({ ...f, target_group_id: e.target.value }))}>
                  <option value=''>Whole Class</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
{error && <p style={{ color: C.error, fontSize: 12, marginTop: 10 }}>{error}</p>}
            <button onClick={handleSubmit} disabled={saving} style={{ marginTop: 16, width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: saving ? '#99f6e4' : '#0f766e', color: '#fff', fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Saving…' : 'Post Homework'}
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: C.textMuted }}>Loading…</div>
        ) : list.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 20, padding: '32px 20px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, margin: '0 0 8px' }}>No homework posted yet</h2>
            <p style={{ fontSize: 13, color: C.textMuted, margin: '0 0 20px', lineHeight: 1.5 }}>Post your first assignment — parents and students will see it instantly in their portal.</p>
            <button onClick={() => setShowForm(true)} style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>+ Post First Assignment</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {list.map(h => {
              const overdue = isOverdue(h.due_date)
              return (
                <div key={h.id} style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: `4px solid ${overdue ? '#ef4444' : '#0f766e'}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 800, color: C.textPrimary, margin: 0 }}>{h.title}</p>
                      {h.subject && <p style={{ fontSize: 11, color: C.textMuted, margin: '3px 0 0' }}>{h.subject}</p>}
                      {h.instructions && <p style={{ fontSize: 12, color: C.textMuted, margin: '6px 0 0', lineHeight: 1.4 }}>{h.instructions}</p>}
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 20, background: overdue ? '#fee2e2' : '#d1fae5', color: overdue ? '#991b1b' : '#065f46' }}>
                        {overdue ? 'Overdue' : 'Active'}
                      </span>
                      <p style={{ fontSize: 11, color: C.textMuted, margin: '4px 0 0', fontWeight: 600 }}>Due {formatDate(h.due_date)}</p>
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#f3f4f6', color: C.textMuted, textTransform: 'capitalize' }}>{h.type}</span>
                      {h.target_group_id && groups.find(g => g.id === h.target_group_id) && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#ede9fe', color: '#6d28d9', marginLeft: 6 }}>
                          Group: {groups.find(g => g.id === h.target_group_id).name}
                        </span>
                      )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function HomeworkPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20, color: '#6b7280' }}>Loading…</div>}>
      <HomeworkInner />
    </Suspense>
  )
}
