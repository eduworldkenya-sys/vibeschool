'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { C } from '@/components/teacher/ui'

type ResourceType = 'notes' | 'assessment' | 'exercise' | 'quiz' | 'video' | 'other'

type TeacherResource = {
  id: string
  title: string
  description: string
  type: ResourceType
  subject: string
  external_url: string | null
  content: string | null
  is_school_wide: boolean
  class_id: string | null
  created_at: string
}

type Assignment = { class_id: string; subject_id: string }
type ClassOption = { id: string; name: string; stream: string; label: string }
type SubjectOption = { id: string; name: string }
type SchemeLesson = {
  id: string
  class_id: string
  subject_id: string
  topic: string | null
  sub_strand: string | null
  strand: string | null
  week: number | null
  lesson_number: number | null
  sequence_number: number | null
}
type LinkedResourceRow = {
  id: string
  scheme_lesson_id: string
  resource_id: string
  publication_id: string
  chapter_id: string
  resource_role: string
  sequence: number
  page_start: number | null
  page_end: number | null
}
type LearningResource = {
  id: string
  title: string
  description: string | null
  subject: string | null
  grade: string | null
  asset_kind: string | null
  purpose: string | null
  status: string
  visibility: string
  publication_id: string | null
  chapter_id: string | null
}
type ReadyPack = {
  scheme: SchemeLesson
  classLabel: string
  subjectLabel: string
  resources: Array<LinkedResourceRow & { resource: LearningResource | null }>
}
type FormState = {
  type: ResourceType
  title: string
  class_id: string
  subject_id: string
  description: string
  external_url: string
  content: string
}

const TYPES: Array<{ value: ResourceType; label: string; icon: string }> = [
  { value: 'notes', label: 'Notes', icon: '📄' },
  { value: 'assessment', label: 'Assessment', icon: '📝' },
  { value: 'exercise', label: 'Exercise', icon: '✍️' },
  { value: 'quiz', label: 'Quiz', icon: '🧪' },
  { value: 'video', label: 'Video', icon: '🎬' },
  { value: 'other', label: 'Other', icon: '📎' },
]

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid #dbe3ea',
  fontSize: 14, color: C.textPrimary, background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit',
}
const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: 5, fontSize: 11, fontWeight: 800, color: C.textMuted,
  textTransform: 'uppercase', letterSpacing: '.05em',
}

function todayIso() { return new Date().toISOString().slice(0, 10) }
function typeMeta(type: string) { return TYPES.find(item => item.value === type) ?? TYPES[TYPES.length - 1] }
function unique<T>(values: T[]) { return Array.from(new Set(values)) }
function orderScheme(a: SchemeLesson, b: SchemeLesson) {
  return (a.sequence_number ?? 999999) - (b.sequence_number ?? 999999)
    || (a.lesson_number ?? 999999) - (b.lesson_number ?? 999999)
    || a.id.localeCompare(b.id)
}
function readerHref(row: LinkedResourceRow & { resource: LearningResource | null }) {
  const publicationId = row.publication_id || row.resource?.publication_id
  const chapterId = row.chapter_id || row.resource?.chapter_id
  return publicationId && chapterId ? `/read/textbook/${publicationId}/${chapterId}` : null
}
function timeAgo(iso: string) {
  const value = new Date(iso).getTime()
  if (!Number.isFinite(value)) return ''
  const minutes = Math.max(0, Math.floor((Date.now() - value) / 60000))
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
  return `${Math.floor(minutes / 1440)}d ago`
}
function isSafeUrl(value: string) {
  try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false }
}

export default function TeacherResourcesPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [week, setWeek] = useState<number | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [library, setLibrary] = useState<TeacherResource[]>([])
  const [packs, setPacks] = useState<ReadyPack[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [filter, setFilter] = useState<'all' | ResourceType>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({
    type: 'notes', title: '', class_id: '', subject_id: '', description: '', external_url: '', content: '',
  })

  const classById = useMemo(() => new Map(classes.map(row => [row.id, row])), [classes])
  const subjectById = useMemo(() => new Map(subjects.map(row => [row.id, row])), [subjects])
  const allowedSubjects = useMemo(() => {
    if (!form.class_id) return subjects
    const ids = new Set(assignments.filter(row => row.class_id === form.class_id).map(row => row.subject_id))
    return subjects.filter(row => ids.has(row.id))
  }, [assignments, form.class_id, subjects])
  const visibleLibrary = useMemo(() => filter === 'all' ? library : library.filter(row => row.type === filter), [filter, library])
  const readyCount = useMemo(() => packs.reduce((sum, pack) => sum + pack.resources.length, 0), [packs])

  const openAdd = useCallback(() => {
    const classId = classes[0]?.id ?? ''
    const subjectIds = assignments.filter(row => row.class_id === classId).map(row => row.subject_id)
    setForm({ type: 'notes', title: '', class_id: classId, subject_id: subjectIds[0] ?? '', description: '', external_url: '', content: '' })
    setFormError('')
    setShowAdd(true)
  }, [assignments, classes])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const auth = await supabase.auth.getUser()
      if (auth.error) throw auth.error
      const user = auth.data.user
      if (!user) throw new Error('Not signed in.')
      setTeacherId(user.id)

      const [teacherProfile, member, profile, assignmentResult, resourceResult] = await Promise.all([
        supabase.from('teacher_profiles').select('school_id').eq('profile_id', user.id).maybeSingle(),
        supabase.from('school_members').select('school_id').eq('profile_id', user.id).maybeSingle(),
        supabase.from('profiles').select('school_id').eq('id', user.id).maybeSingle(),
        supabase.from('teacher_classes').select('class_id,subject_id').eq('teacher_id', user.id),
        supabase.from('resources').select('*').eq('teacher_id', user.id).order('created_at', { ascending: false }),
      ])
      if (assignmentResult.error) throw assignmentResult.error
      if (resourceResult.error) throw resourceResult.error
      const resolvedSchoolId = member.data?.school_id ?? teacherProfile.data?.school_id ?? profile.data?.school_id ?? null
      if (!resolvedSchoolId) throw new Error('Teacher school could not be resolved.')
      setSchoolId(resolvedSchoolId)

      const teacherAssignments = (assignmentResult.data ?? []) as Assignment[]
      setAssignments(teacherAssignments)
      const classIds = unique(teacherAssignments.map(row => row.class_id))
      const subjectIds = unique(teacherAssignments.map(row => row.subject_id))

      const [classResult, subjectResult, calendar] = await Promise.all([
        classIds.length ? supabase.from('classes').select('id,name,stream').eq('school_id', resolvedSchoolId).in('id', classIds) : Promise.resolve({ data: [], error: null }),
        subjectIds.length ? supabase.from('subjects').select('id,name').in('id', subjectIds).order('name') : Promise.resolve({ data: [], error: null }),
        supabase.rpc('resolve_instructional_week_for_date', { p_school_id: resolvedSchoolId, p_date: todayIso() }),
      ])
      if (classResult.error) throw classResult.error
      if (subjectResult.error) throw subjectResult.error

      const classRows: ClassOption[] = (classResult.data ?? []).map(row => ({ id: row.id, name: row.name, stream: row.stream ?? '', label: row.stream ? `${row.name} ${row.stream}` : row.name }))
      const subjectRows = (subjectResult.data ?? []) as SubjectOption[]
      setClasses(classRows)
      setSubjects(subjectRows)
      setLibrary((resourceResult.data ?? []).map(row => ({
        id: row.id,
        title: row.title,
        description: row.description ?? '',
        type: (TYPES.some(t => t.value === row.type) ? row.type : 'other') as ResourceType,
        subject: row.subject ?? 'General',
        external_url: row.external_url,
        content: row.content,
        is_school_wide: row.is_school_wide ?? false,
        class_id: row.class_id,
        created_at: row.created_at ?? new Date(0).toISOString(),
      })))

      const calendarRow = !calendar.error && Array.isArray(calendar.data) && calendar.data.length === 1 ? calendar.data[0] : null
      const resolvedWeek = calendarRow?.week_number ?? null
      const termId = calendarRow?.term_id ?? null
      setWeek(resolvedWeek)
      if (!resolvedWeek || !termId || !classIds.length) { setPacks([]); return }

      const schemeResult = await supabase
        .from('scheme_of_work')
        .select('id,class_id,subject_id,topic,sub_strand,strand,week,lesson_number,sequence_number')
        .eq('teacher_id', user.id)
        .eq('school_id', resolvedSchoolId)
        .eq('academic_term_id', termId)
        .eq('week', resolvedWeek)
        .in('class_id', classIds)
      if (schemeResult.error) throw schemeResult.error
      const schemes = ((schemeResult.data ?? []) as SchemeLesson[]).sort(orderScheme)
      if (!schemes.length) { setPacks([]); return }

      const linkResult = await supabase.rpc('list_scheme_lesson_resources_batch', { p_scheme_ids: schemes.map(row => row.id) })
      if (linkResult.error) throw linkResult.error
      const links = (linkResult.data ?? []) as LinkedResourceRow[]
      const resourceIds = unique(links.map(row => row.resource_id).filter(Boolean))
      const learningResult = resourceIds.length
        ? await supabase.from('learning_resources').select('id,title,description,subject,grade,asset_kind,purpose,status,visibility,publication_id,chapter_id').in('id', resourceIds).eq('status', 'active').eq('visibility', 'public')
        : { data: [], error: null }
      if (learningResult.error) throw learningResult.error
      const learningMap = new Map(((learningResult.data ?? []) as LearningResource[]).map(row => [row.id, row]))
      const linkMap = new Map<string, LinkedResourceRow[]>()
      for (const row of links) linkMap.set(row.scheme_lesson_id, [...(linkMap.get(row.scheme_lesson_id) ?? []), row])
      for (const rows of linkMap.values()) rows.sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id))

      const classMap = new Map(classRows.map(row => [row.id, row.label]))
      const subjectMap = new Map(subjectRows.map(row => [row.id, row.name]))
      setPacks(schemes.map(scheme => ({
        scheme,
        classLabel: classMap.get(scheme.class_id) ?? 'Class',
        subjectLabel: subjectMap.get(scheme.subject_id) ?? 'Subject',
        resources: (linkMap.get(scheme.id) ?? []).map(link => ({ ...link, resource: learningMap.get(link.resource_id) ?? null })).filter(item => item.resource !== null),
      })))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Resources could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!form.class_id) return
    const ids = assignments.filter(row => row.class_id === form.class_id).map(row => row.subject_id)
    if (!ids.includes(form.subject_id)) setForm(current => ({ ...current, subject_id: ids[0] ?? '' }))
  }, [assignments, form.class_id, form.subject_id])

  async function saveResource() {
    setFormError('')
    if (!teacherId || !schoolId) return setFormError('Teacher identity is not ready.')
    if (!form.title.trim()) return setFormError('Add a short title.')
    if (!form.class_id) return setFormError('Choose a class.')
    if (!form.subject_id) return setFormError('Choose a subject.')
    if (!form.external_url.trim() && !form.content.trim()) return setFormError('Paste a link or add the resource content.')
    if (form.external_url.trim() && !isSafeUrl(form.external_url.trim())) return setFormError('Link must start with http:// or https://.')
    if (!assignments.some(row => row.class_id === form.class_id && row.subject_id === form.subject_id)) return setFormError('That class and subject are not assigned to this teacher.')
    const subjectName = subjectById.get(form.subject_id)?.name
    if (!subjectName) return setFormError('Subject could not be resolved.')

    setSaving(true)
    const inserted = await supabase.from('resources').insert({
      teacher_id: teacherId,
      school_id: schoolId,
      class_id: form.class_id,
      is_school_wide: false,
      subject: subjectName,
      title: form.title.trim(),
      description: form.description.trim(),
      type: form.type,
      external_url: form.external_url.trim() || null,
      content: form.content.trim() || null,
    }).select('*').single()
    setSaving(false)
    if (inserted.error || !inserted.data) return setFormError(inserted.error?.message ?? 'Resource could not be saved.')
    const row = inserted.data
    setLibrary(current => [{
      id: row.id, title: row.title, description: row.description ?? '', type: row.type as ResourceType,
      subject: row.subject ?? subjectName, external_url: row.external_url, content: row.content,
      is_school_wide: row.is_school_wide ?? false, class_id: row.class_id, created_at: row.created_at ?? new Date().toISOString(),
    }, ...current])
    setShowAdd(false)
  }

  async function deleteResource(resource: TeacherResource) {
    if (!teacherId || !confirm(`Delete “${resource.title}”?`)) return
    setDeleting(resource.id)
    const result = await supabase.from('resources').delete().eq('id', resource.id).eq('teacher_id', teacherId)
    setDeleting(null)
    if (result.error) return setError('Resource could not be deleted.')
    setLibrary(current => current.filter(row => row.id !== resource.id))
  }

  if (loading) return <div style={{ padding: 24, color: C.textMuted }}>Preparing your teaching resources…</div>

  return (
    <main style={{ minHeight: '100vh', background: '#f7f9fc', color: C.textPrimary, paddingBottom: 80 }}>
      <header style={{ background: 'linear-gradient(135deg,#0f4c75,#1b6ca8)', color: '#fff', padding: '22px 16px 28px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', opacity: .72 }}>Teaching resource operating system</div>
              <h1 style={{ fontSize: 23, margin: '5px 0 4px', fontWeight: 900 }}>Resources that are already connected to the lesson</h1>
              <p style={{ margin: 0, fontSize: 13, maxWidth: 680, opacity: .82 }}>VibeSchool follows the instructional calendar and your Scheme so the right lesson materials are ready before you teach. Your own notes remain available as supplements, not another preparation burden.</p>
            </div>
            <button type="button" onClick={openAdd} style={{ border: 0, borderRadius: 11, padding: '10px 13px', background: '#fff', color: '#0f4c75', fontWeight: 900, whiteSpace: 'nowrap' }}>+ Add mine</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, marginTop: 18 }}>
            {[
              ['Current week', week ?? '—'],
              ['Ready resources', readyCount],
              ['My saved resources', library.length],
            ].map(([label, value]) => <div key={label} style={{ background: 'rgba(255,255,255,.12)', borderRadius: 12, padding: 10, textAlign: 'center' }}><div style={{ fontSize: 19, fontWeight: 900 }}>{value}</div><div style={{ fontSize: 10, opacity: .72 }}>{label}</div></div>)}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 980, margin: '0 auto', padding: 16 }}>
        {error && <div role="alert" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 12, padding: 12, marginBottom: 14 }}>{error}</div>}

        <section style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: 10 }}>
            <div><h2 style={{ fontSize: 18, margin: 0 }}>Ready this week</h2><p style={{ margin: '3px 0 0', fontSize: 12, color: C.textMuted }}>Exact Scheme-linked VibeSchool resources. These feed the lesson-preparation and Teach Now journey; nothing here is title-matched or guessed.</p></div>
          </div>
          {packs.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 15, padding: 18 }}>
              <strong>No linked lesson pack is available for this instructional week.</strong>
              <p style={{ margin: '6px 0 0', color: C.textMuted, lineHeight: 1.6 }}>This does not mean VibeSchool has no content. It means no canonical resource is currently linked to this teacher’s Scheme lessons for the resolved week, so Resources fails closed instead of guessing.</p>
            </div>
          ) : packs.map(pack => (
            <article key={pack.scheme.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 14, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                <div><div style={{ fontSize: 11, fontWeight: 900, color: '#0f4c75' }}>{pack.classLabel} · {pack.subjectLabel} · Lesson {pack.scheme.lesson_number ?? '—'}</div><h3 style={{ margin: '4px 0 3px', fontSize: 15 }}>{pack.scheme.topic || pack.scheme.sub_strand || pack.scheme.strand || 'Scheme lesson'}</h3></div>
                <span style={{ background: pack.resources.length ? '#ecfdf5' : '#fff7ed', color: pack.resources.length ? '#065f46' : '#9a3412', borderRadius: 999, padding: '5px 8px', fontSize: 10, fontWeight: 900 }}>{pack.resources.length} ready</span>
              </div>
              {pack.resources.length === 0 ? <p style={{ margin: '9px 0 0', color: C.textMuted, fontSize: 12 }}>No canonical resource link is attached to this exact Scheme lesson yet.</p> : (
                <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                  {pack.resources.map(item => {
                    const href = readerHref(item)
                    return <div key={item.id} style={{ border: '1px solid #eef2f7', background: '#fafcff', borderRadius: 12, padding: 11, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <div><div style={{ fontSize: 10, color: '#6366f1', fontWeight: 900, textTransform: 'uppercase' }}>{item.resource_role || item.resource?.purpose || item.resource?.asset_kind || 'Lesson resource'}</div><div style={{ fontSize: 13, fontWeight: 800, marginTop: 2 }}>{item.resource?.title ?? 'Canonical resource'}</div>{item.resource?.description && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{item.resource.description}</div>}</div>
                      {href ? <Link href={href} style={{ textDecoration: 'none', borderRadius: 9, background: '#0f4c75', color: '#fff', padding: '8px 10px', fontSize: 11, fontWeight: 900 }}>Open</Link> : <span style={{ fontSize: 10, color: C.textMuted }}>Linked</span>}
                    </div>
                  })}
                </div>
              )}
            </article>
          ))}
        </section>

        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'end', marginBottom: 10 }}>
            <div><h2 style={{ fontSize: 18, margin: 0 }}>My teaching library</h2><p style={{ margin: '3px 0 0', fontSize: 12, color: C.textMuted }}>Personal supplementary resources. Teacher-added resources stay class-scoped.</p></div>
          </div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 10 }}>
            {(['all', ...TYPES.map(t => t.value)] as Array<'all' | ResourceType>).map(value => <button type="button" key={value} onClick={() => setFilter(value)} style={{ border: '1px solid #dbe3ea', background: filter === value ? '#e0f2fe' : '#fff', color: filter === value ? '#075985' : C.textMuted, borderRadius: 999, padding: '7px 10px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>{value === 'all' ? 'All' : typeMeta(value).label}</button>)}
          </div>

          {visibleLibrary.length === 0 ? <div style={{ background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 14, padding: 18, color: C.textMuted }}>You have no saved {filter === 'all' ? '' : typeMeta(filter).label.toLowerCase() + ' '}resources yet. VibeSchool lesson resources above remain available independently.</div> : visibleLibrary.map(resource => {
            const meta = typeMeta(resource.type)
            const classLabel = resource.class_id ? classById.get(resource.class_id)?.label ?? 'Class' : 'Legacy school-wide'
            const isExpanded = expanded === resource.id
            return <article key={resource.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, marginBottom: 8, overflow: 'hidden' }}>
              <button type="button" onClick={() => setExpanded(isExpanded ? null : resource.id)} aria-expanded={isExpanded} style={{ border: 0, width: '100%', background: '#fff', textAlign: 'left', padding: 13, display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 19 }}>{meta.icon}</span><span style={{ flex: 1 }}><strong style={{ display: 'block', color: C.textPrimary }}>{resource.title}</strong><span style={{ fontSize: 11, color: C.textMuted }}>{resource.subject} · {classLabel} · {timeAgo(resource.created_at)}</span></span><span>{isExpanded ? '⌃' : '⌄'}</span>
              </button>
              {isExpanded && <div style={{ padding: '0 13px 13px' }}>{resource.description && <p style={{ lineHeight: 1.6 }}>{resource.description}</p>}{resource.content && <div style={{ whiteSpace: 'pre-wrap', background: '#f8fafc', borderRadius: 10, padding: 11, lineHeight: 1.65 }}>{resource.content}</div>}{resource.external_url && <a href={resource.external_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 9 }}>Open external resource ↗</a>}<button type="button" disabled={deleting === resource.id} onClick={() => void deleteResource(resource)} style={{ display: 'block', marginTop: 10, border: '1px solid #fecaca', background: '#fff', color: '#991b1b', borderRadius: 9, padding: '7px 9px', fontWeight: 800 }}>{deleting === resource.id ? 'Deleting…' : 'Delete'}</button></div>}
            </article>
          })}
        </section>
      </div>

      {showAdd && <div role="dialog" aria-modal="true" aria-label="Add teaching resource" style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}><div style={{ width: '100%', maxWidth: 620, background: '#fff', borderRadius: '20px 20px 0 0', padding: 18, maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}><div><h2 style={{ margin: 0, fontSize: 18 }}>Add my resource</h2><p style={{ margin: '4px 0 0', color: C.textMuted, fontSize: 12 }}>Class and subject are constrained to your actual teaching assignments.</p></div><button type="button" onClick={() => setShowAdd(false)} aria-label="Close" style={{ border: 0, background: '#f1f5f9', borderRadius: 999, width: 32, height: 32 }}>×</button></div>
        <div style={{ display: 'grid', gap: 13, marginTop: 16 }}>
          <div><label style={labelStyle}>Type</label><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{TYPES.map(item => <button type="button" key={item.value} onClick={() => setForm(current => ({ ...current, type: item.value }))} style={{ border: form.type === item.value ? '1px solid #0f4c75' : '1px solid #dbe3ea', background: form.type === item.value ? '#e0f2fe' : '#fff', borderRadius: 999, padding: '7px 9px', fontWeight: 800 }}>{item.icon} {item.label}</button>)}</div></div>
          <div><label style={labelStyle}>Class</label><select style={inputStyle} value={form.class_id} onChange={event => setForm(current => ({ ...current, class_id: event.target.value }))}><option value="">Choose class</option>{classes.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}</select></div>
          <div><label style={labelStyle}>Subject</label><select style={inputStyle} value={form.subject_id} onChange={event => setForm(current => ({ ...current, subject_id: event.target.value }))}><option value="">Choose subject</option>{allowedSubjects.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div>
          <div><label style={labelStyle}>Title</label><input style={inputStyle} value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="Short useful title" /></div>
          <div><label style={labelStyle}>Description</label><textarea style={{ ...inputStyle, minHeight: 64 }} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} /></div>
          <div><label style={labelStyle}>Paste link</label><input style={inputStyle} value={form.external_url} onChange={event => setForm(current => ({ ...current, external_url: event.target.value }))} placeholder="https://…" /></div>
          <div><label style={labelStyle}>Or add content</label><textarea style={{ ...inputStyle, minHeight: 110 }} value={form.content} onChange={event => setForm(current => ({ ...current, content: event.target.value }))} placeholder="Notes, questions, instructions…" /></div>
        </div>
        {formError && <div role="alert" style={{ marginTop: 10, color: '#991b1b', fontSize: 12 }}>{formError}</div>}
        <button type="button" onClick={() => void saveResource()} disabled={saving} style={{ width: '100%', marginTop: 14, border: 0, borderRadius: 11, padding: 12, background: '#0f4c75', color: '#fff', fontWeight: 900 }}>{saving ? 'Saving…' : 'Save to my class library'}</button>
      </div></div>}
    </main>
  )
}
