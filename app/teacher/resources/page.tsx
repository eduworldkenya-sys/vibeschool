"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { C } from '@/components/teacher/ui'

interface Resource {
  id: string
  title: string
  description: string
  type: string
  subject: string
  external_url: string | null
  content: string | null
  is_school_wide: boolean
  class_id: string | null
  created_at: string
}

interface ClassOption { id: string; name: string; stream: string }

interface FormState {
  title: string; description: string; type: string; subject: string
  external_url: string; content: string; class_id: string
}

const TYPES = [
  { value: 'notes',      label: 'Notes',      icon: '📄', color: '#1d4ed8', bg: '#dbeafe' },
  { value: 'assessment', label: 'Assessment', icon: '📝', color: '#065f46', bg: '#d1fae5' },
  { value: 'exercise',   label: 'Exercise',   icon: '🏋️', color: '#92400e', bg: '#fef3c7' },
  { value: 'quiz',       label: 'Quiz',       icon: '🧪', color: '#6d28d9', bg: '#ede9fe' },
  { value: 'video',      label: 'Video',      icon: '📺', color: '#991b1b', bg: '#fee2e2' },
  { value: 'other',      label: 'Other',      icon: '📁', color: '#374151', bg: '#f3f4f6' },
]

const EMPTY_FORM: FormState = {
  title: '', description: '', type: 'notes', subject: '',
  external_url: '', content: '', class_id: '',
}

function typeMeta(type: string) {
  return TYPES.find(t => t.value === type) ?? TYPES[5]
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function isSafeUrl(url: string): boolean {
  try { return ['http:', 'https:'].includes(new URL(url).protocol) }
  catch { return false }
}

function ResourcesInner() {
  const [resources,  setResources]  = useState<Resource[]>([])
  const [classes,    setClasses]    = useState<ClassOption[]>([])
  const [subjects,   setSubjects]   = useState<{ id: string; name: string }[]>([])
  const [loading,    setLoading]    = useState(true)
  const [pageError,  setPageError]  = useState('')
  const [showForm,   setShowForm]   = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState('')
  const [filterType, setFilterType] = useState('all')
  const [expanded,   setExpanded]   = useState<string | null>(null)
  const [userId,     setUserId]     = useState<string | null>(null)
  const [schoolId,   setSchoolId]   = useState<string | null>(null)
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const [form,       setForm]       = useState<FormState>(EMPTY_FORM)

  const load = useCallback(async () => {
    setLoading(true)
    setPageError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPageError('Not signed in.'); setLoading(false); return }
    setUserId(user.id)

const [teacherRes, memberRes, profileRes] = await Promise.all([
      supabase.from('teacher_profiles').select('school_id').eq('profile_id', user.id).maybeSingle(),
      supabase.from('school_members').select('school_id').eq('profile_id', user.id).maybeSingle(),
      supabase.from('profiles').select('school_id').eq('id', user.id).single(),
    ])
    const sid = memberRes.data?.school_id ?? teacherRes.data?.school_id ?? profileRes.data?.school_id ?? null
    setSchoolId(sid)

    const [resRes, tcRes, subjRes] = await Promise.all([
      supabase.from('resources').select('*').eq('teacher_id', user.id).order('created_at', { ascending: false }),
      supabase.from('teacher_classes').select('class_id').eq('teacher_id', user.id),
      supabase.from('subjects').select('id, name').order('name'),
    ])

    if (resRes.error)  { setPageError('Failed to load resources.'); setLoading(false); return }
    if (subjRes.error) { setPageError('Failed to load subjects.');  setLoading(false); return }

    setResources(resRes.data ?? [])
    setSubjects(subjRes.data ?? [])

    const classIds = Array.from(new Set((tcRes.data ?? []).map((r: { class_id: string }) => r.class_id)))
    if (classIds.length > 0) {
      const { data: classData, error: clsErr } = await supabase.from('classes').select('id, name, stream').in('id', classIds)
      if (clsErr) { setPageError('Failed to load classes.'); setLoading(false); return }
      setClasses(classData ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSubmit() {
    setFormError('')
    if (!form.title.trim()) { setFormError('Title is required'); return }
    if (form.external_url.trim() && !isSafeUrl(form.external_url.trim())) {
      setFormError('External link must start with http:// or https://'); return
    }
    if (!userId) { setFormError('Not signed in'); return }

    setSaving(true)
    const isSchoolWide = !form.class_id

    const { data: inserted, error: err } = await supabase.from('resources').insert({
      teacher_id:     userId,
      school_id:      schoolId,
      title:          form.title.trim(),
      description:    form.description.trim(),
      type:           form.type,
      subject:        form.subject.trim(),
      external_url:   form.external_url.trim() || null,
      content:        form.content.trim() || null,
      class_id:       form.class_id || null,
      is_school_wide: isSchoolWide,
    }).select('*').single()

    setSaving(false)
    if (err || !inserted) { setFormError(err?.message ?? 'Failed to save'); return }

    // Optimistic prepend
    setResources(prev => [inserted as Resource, ...prev])
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  async function handleDelete(e: React.MouseEvent, r: Resource) {
    e.stopPropagation()
    if (!confirm(`Delete "${r.title}"? This cannot be undone.`)) return
    setDeleting(r.id)
    const { error: err } = await supabase.from('resources').delete().eq('id', r.id)
    if (err) { setDeleting(null); return }
    setResources(prev => prev.filter(x => x.id !== r.id))
    if (expanded === r.id) setExpanded(null)
    setDeleting(null)
  }

  const filtered = filterType === 'all' ? resources : resources.filter(r => r.type === filterType)

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: '1px solid #e5e7eb', fontSize: 14, color: C.textPrimary,
    outline: 'none', fontFamily: 'inherit', background: '#f9fafb', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: C.textMuted,
    textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 6, display: 'block',
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: C.textMuted, paddingBottom: 80, background: C.surface, minHeight: '100%' }}>
      <style>{`@keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }`}</style>

      {/* HEADER */}
      <div style={{ background: 'linear-gradient(135deg, #0f4c75 0%, #1b6ca8 100%)', padding: '20px 16px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 }}>📚 Resources</h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: '2px 0 0' }}>Notes, exercises, quizzes & more</p>
          </div>
          <button
            onClick={() => { setShowForm(v => !v); setFormError('') }}
            style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: showForm ? 'rgba(255,255,255,0.15)' : '#fff', color: showForm ? '#fff' : '#0f4c75', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {showForm ? 'Cancel' : '+ New'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: 'Total',   value: resources.length },
            { label: 'Notes',   value: resources.filter(r => r.type === 'notes').length },
            { label: 'Quizzes', value: resources.filter(r => r.type === 'quiz').length },
            { label: 'Videos',  value: resources.filter(r => r.type === 'video').length },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 4px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{s.value}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px' }}>

        {/* PAGE ERROR */}
        {pageError && (
          <div style={{ padding: '12px 14px', borderRadius: 12, background: '#fef2f2', color: C.error, fontSize: 13, marginBottom: 14 }}>
            ⚠️ {pageError}
          </div>
        )}

        {/* CREATE FORM */}
        {showForm && (
          <div style={{ background: '#fff', borderRadius: 20, padding: '20px', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', animation: 'slideDown 0.2s ease' }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 16px' }}>New Resource</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              <div>
                <label style={labelStyle}>Type *</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {TYPES.map(t => (
                    <button key={t.value} onClick={() => setForm(f => ({ ...f, type: t.value }))} style={{ padding: '6px 12px', borderRadius: 20, border: '1.5px solid', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', borderColor: form.type === t.value ? t.color : '#e5e7eb', background: form.type === t.value ? t.bg : '#fafafa', color: form.type === t.value ? t.color : '#6b7280' }}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Title *</label>
                <input style={inputStyle} placeholder="e.g. Fractions — Notes Term 2" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>

              <div>
                <label style={labelStyle}>Subject</label>
                <select style={inputStyle} value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
                  <option value="">-- Select subject --</option>
                  {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Class</label>
                <select style={inputStyle} value={form.class_id} onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}>
                  <option value="">-- School-wide (all classes) --</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.stream ? ' ' + c.stream : ''}</option>)}
                </select>
                {!form.class_id && (
                  <p style={{ fontSize: 11, color: '#6366f1', margin: '4px 0 0', fontWeight: 600 }}>ℹ️ No class selected — resource will be school-wide</p>
                )}
              </div>

              <div>
                <label style={labelStyle}>Description</label>
                <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} placeholder="Brief description…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              <div>
                <label style={labelStyle}>External Link (Google Drive, YouTube, etc.)</label>
                <input style={inputStyle} placeholder="https://drive.google.com/…" value={form.external_url} onChange={e => setForm(f => ({ ...f, external_url: e.target.value }))} />
              </div>

              <div>
                <label style={labelStyle}>Or Type Notes Directly</label>
                <textarea style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }} placeholder="Type your notes, questions, or content here…" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
              </div>

            </div>

            {formError && <p style={{ color: C.error, fontSize: 12, marginTop: 10 }}>⚠️ {formError}</p>}

            <button onClick={handleSubmit} disabled={saving} style={{ marginTop: 16, width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: saving ? '#d1d5db' : '#0f4c75', color: '#fff', fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              {saving ? 'Saving…' : '📤 Publish Resource'}
            </button>
          </div>
        )}

        {/* FILTER TABS */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 14, paddingBottom: 2 }} role="tablist">
          {[{ value: 'all', label: 'All', icon: '📚' }, ...TYPES].map(t => (
            <button key={t.value} role="tab" aria-selected={filterType === t.value} onClick={() => setFilterType(t.value)} style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', background: filterType === t.value ? '#0f4c75' : '#f3f4f6', color: filterType === t.value ? '#fff' : '#6b7280' }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* LIST */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: C.textMuted }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 20, padding: '32px 20px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, margin: '0 0 8px' }}>No resources yet</h2>
            <p style={{ fontSize: 13, color: C.textMuted, margin: '0 0 20px', lineHeight: 1.5 }}>Share notes, exercises, quizzes and more with your students.</p>
            <button onClick={() => setShowForm(true)} style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: '#0f4c75', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add First Resource</button>
          </div>
        ) : (
          <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(r => {
              const meta   = typeMeta(r.type)
              const isOpen = expanded === r.id
              return (
                <div key={r.id} role="listitem" style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: `4px solid ${meta.color}`, overflow: 'hidden' }}>
                  <button
                    aria-expanded={isOpen}
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                    style={{ width: '100%', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', textAlign: 'left' }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }} aria-hidden="true">{meta.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 800, color: C.textPrimary, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</p>
                      <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                        {r.subject && <span style={{ fontSize: 10, color: meta.color, fontWeight: 700 }}>{r.subject}</span>}
                        <span style={{ fontSize: 10, color: C.textMuted }}>{timeAgo(r.created_at)}</span>
                        {r.is_school_wide && <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 700 }}>🏫 School-wide</span>}
                        {r.external_url && <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 700 }}>🔗 Link</span>}
                        {r.content && <span style={{ fontSize: 10, color: '#059669', fontWeight: 700 }}>📝 Notes</span>}
                      </div>
                    </div>
                    <span style={{ fontSize: 14, color: C.textMuted, flexShrink: 0 }} aria-hidden="true">{isOpen ? '▲' : '▼'}</span>
                  </button>

                  {isOpen && (
                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid #f3f4f6' }}>
                      {r.description && <p style={{ fontSize: 13, color: C.textMuted, margin: '12px 0 0', lineHeight: 1.6 }}>{r.description}</p>}
                      {r.content && (
                        <div style={{ marginTop: 12, padding: '12px', background: '#f8fafc', borderRadius: 10, fontSize: 13, color: C.textPrimary, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                          {r.content}
                        </div>
                      )}
                      {r.external_url && isSafeUrl(r.external_url) && (
                        <a href={r.external_url} target="_blank" rel="noreferrer noopener" style={{ display: 'inline-block', marginTop: 12, padding: '10px 16px', borderRadius: 10, background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                          🔗 Open Link →
                        </a>
                      )}
                      <button
                        onClick={e => handleDelete(e, r)}
                        disabled={deleting === r.id}
                        aria-label={`Delete ${r.title}`}
                        style={{ display: 'block', marginTop: 12, padding: '8px 14px', borderRadius: 10, border: '1px solid #fca5a5', background: 'transparent', color: '#991b1b', fontSize: 12, fontWeight: 700, cursor: deleting === r.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                      >
                        {deleting === r.id ? 'Deleting…' : '🗑 Delete'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ResourcesPage() {
  return <ResourcesInner />
}
