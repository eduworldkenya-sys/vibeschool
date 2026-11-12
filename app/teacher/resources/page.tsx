'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { nairobiDateStr } from '@/lib/time'
import { C, Modal } from '@/components/teacher/ui'
import TeachingLibraryStructure from '@/components/teacher/TeachingLibraryStructure'
import type { CanonicalTeachingLibraryItem } from '@/components/teacher/TeachingLibraryStructure'

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
  subject: string | null
  academic_term_id: string | null
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
  resource_version_id: string | null
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
  material_variant: string | null
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
  resources: Array<LinkedResourceRow & { resource: LearningResource | null; certifiedVersionId: string | null }>
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

function typeMeta(type: string) { return TYPES.find(item => item.value === type) ?? TYPES[TYPES.length - 1] }
function unique<T>(values: T[]) { return Array.from(new Set(values)) }
function orderScheme(a: SchemeLesson, b: SchemeLesson) {
  return (a.sequence_number ?? 999999) - (b.sequence_number ?? 999999)
    || (a.lesson_number ?? 999999) - (b.lesson_number ?? 999999)
    || a.id.localeCompare(b.id)
}
function readerHref(row: LinkedResourceRow & { resource: LearningResource | null; certifiedVersionId: string | null }) {
  if (!row.resource || !row.certifiedVersionId) return null
  const publicationId = row.publication_id || row.resource.publication_id
  const chapterId = row.chapter_id || row.resource.chapter_id
  if (publicationId && chapterId) return `/read/textbook/${publicationId}/${chapterId}`
  return `/teacher/resources/read/${row.resource.id}?versionId=${row.certifiedVersionId}`
}
function publishedDescription(description: string | null): string | null {
  // Historical editorial copy is not certification evidence. Do not repeat
  // a now-false "review-stage manuscript" label on a certified resource.
  return description && !/review[- ]stage manuscript|candidate manuscript|draft manuscript/i.test(description)
    ? description : null
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
  const searchParams = useSearchParams()
  const requestedClassId = searchParams.get('classId') ?? ''
  const requestedSubjectId = searchParams.get('subjectId') ?? ''
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [linkWarning, setLinkWarning] = useState('')
  const [teacherId, setTeacherId] = useState<string | null>(null)
  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [week, setWeek] = useState<number | null>(null)
  const [termId, setTermId] = useState<string | null>(null)
  const [classFilter, setClassFilter] = useState(requestedClassId)
  const [subjectFilter, setSubjectFilter] = useState(requestedSubjectId)
  const [topicFilter, setTopicFilter] = useState('')
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
  useEffect(() => { setClassFilter(requestedClassId); setSubjectFilter(requestedSubjectId) }, [requestedClassId, requestedSubjectId])
  const scopedSubjectName = useMemo(
    () => subjects.find(row => row.id === subjectFilter)?.name ?? '',
    [subjectFilter, subjects],
  )
  const subjectOptions = useMemo(() => {
    if (!classFilter) return subjects
    const allowed = new Set(assignments.filter(row => row.class_id === classFilter).map(row => row.subject_id))
    return subjects.filter(row => allowed.has(row.id))
  }, [assignments, classFilter, subjects])
  const catalogueLibrary = useMemo(() => library.filter(row =>
    (!classFilter || row.class_id === classFilter) &&
    (!scopedSubjectName || row.subject === scopedSubjectName),
  ), [library, classFilter, scopedSubjectName])
  const visibleLibrary = useMemo(() =>
    filter === 'all' ? catalogueLibrary : catalogueLibrary.filter(row => row.type === filter),
    [catalogueLibrary, filter],
  )
  // The library is independent of the current week or a timetable. "Ready
  // this week" remains a separate, correctly date-scoped view of the same
  // Scheme-linked inventory.
  const cataloguePacks = useMemo(
    () => packs.filter(pack =>
      (!classFilter || pack.scheme.class_id === classFilter) &&
      (!subjectFilter || pack.scheme.subject_id === subjectFilter) &&
      (!topicFilter.trim() || [pack.scheme.topic, pack.scheme.sub_strand, pack.scheme.strand]
        .some(value => (value ?? '').toLocaleLowerCase().includes(topicFilter.trim().toLocaleLowerCase()))),
    ),
    [packs, classFilter, subjectFilter, topicFilter],
  )
  const visiblePacks = useMemo(
    () => cataloguePacks.filter(pack =>
      week !== null && termId !== null &&
      pack.scheme.week === week &&
      pack.scheme.academic_term_id === termId,
    ),
    [cataloguePacks, week, termId],
  )
  const canonicalLibraryItems = useMemo<CanonicalTeachingLibraryItem[]>(() =>
    cataloguePacks.flatMap(pack => pack.resources.flatMap(item => {
      if (!item.resource || !item.certifiedVersionId) return []
      const resource = item.resource
      const schemeHref = `/teacher/scheme?classId=${encodeURIComponent(pack.scheme.class_id)}&subjectId=${encodeURIComponent(pack.scheme.subject_id)}`
      return [{
        id: resource.id,
        title: resource.title,
        description: publishedDescription(resource.description),
        assetKind: resource.asset_kind,
        materialVariant: resource.material_variant,
        purpose: resource.purpose,
        resourceRole: item.resource_role,
        href: readerHref(item),
        schemeHref,
        classLabel: pack.classLabel,
        subjectLabel: pack.subjectLabel,
        topicLabel: pack.scheme.topic || pack.scheme.sub_strand || pack.scheme.strand || 'Scheme lesson',
      }]
    })),
    [cataloguePacks],
  )
  const certifiedCount = useMemo(
    () => visiblePacks.reduce((sum, pack) => sum + pack.resources.filter(item => item.certifiedVersionId).length, 0),
    [visiblePacks],
  )

  const openAdd = useCallback((requestedType: ResourceType = 'notes') => {
    const selectedClassIsAssigned = classes.some(row => row.id === classFilter)
    const classId = selectedClassIsAssigned ? classFilter : (classes[0]?.id ?? '')
    const subjectIds = assignments.filter(row => row.class_id === classId).map(row => row.subject_id)
    const selectedSubjectIsAssigned = subjectIds.includes(subjectFilter)
    const subjectId = selectedSubjectIsAssigned ? subjectFilter : (subjectIds[0] ?? '')
    setForm({ type: requestedType, title: '', class_id: classId, subject_id: subjectId, description: '', external_url: '', content: '' })
    setFormError('')
    setShowAdd(true)
  }, [assignments, classes, classFilter, subjectFilter])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setLinkWarning('')
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
        supabase.rpc('resolve_instructional_week_for_date', { p_school_id: resolvedSchoolId, p_date: nairobiDateStr() }),
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
      setTermId(termId)
      // A teacher can browse linked resources even during holidays or before
      // the school calendar assigns an instructional week.
      if (!classIds.length) { setPacks([]); return }

      const schemeResult = await supabase
        .from('scheme_of_work')
        .select('id,class_id,subject_id,subject,academic_term_id,topic,sub_strand,strand,week,lesson_number,sequence_number')
        .eq('teacher_id', user.id)
        .eq('school_id', resolvedSchoolId)
        .in('class_id', classIds)
        .order('week', { ascending: true })
        .limit(300)
      if (schemeResult.error) throw schemeResult.error
      const schemes = ((schemeResult.data ?? []) as SchemeLesson[]).sort(orderScheme)
      if (!schemes.length) { setPacks([]); return }

      const schemeIds = schemes.map(row => row.id)
      const [linkResult, canonicalLinkResult] = await Promise.all([
        supabase.rpc('list_scheme_lesson_resources_batch', { p_scheme_ids: schemeIds }),
        supabase.from('teaching_resource_links')
          .select('id,scheme_lesson_id,resource_id,resource_version_id,usage_role,sequence,page_start,page_end')
          .eq('target_type', 'scheme_lesson').in('scheme_lesson_id', schemeIds),
      ])
      if (linkResult.error) throw linkResult.error
      // The canonical generic resource bridge is additive. If older tenants
      // cannot read it, keep their legacy Scheme content usable and show a
      // non-blocking warning instead of losing the entire library.
      if (canonicalLinkResult.error) {
        setLinkWarning('Some additional Scheme links could not be loaded; available resources are still shown.')
      }
      const legacyLinks = (linkResult.data ?? []) as LinkedResourceRow[]
      const canonicalLinks: LinkedResourceRow[] = ((canonicalLinkResult.data ?? []) as Array<{
        id: string
        scheme_lesson_id: string
        resource_id: string
        resource_version_id: string | null
        usage_role: string
        sequence: number
        page_start: number | null
        page_end: number | null
      }>).map(row => ({
        id: row.id,
        scheme_lesson_id: row.scheme_lesson_id,
        resource_id: row.resource_id,
        resource_version_id: row.resource_version_id,
        publication_id: '',
        chapter_id: '',
        resource_role: row.usage_role,
        sequence: row.sequence,
        page_start: row.page_start,
        page_end: row.page_end,
      }))
      const seenLinks = new Set<string>()
      // Prefer generic links because they can pin an immutable version.
      const links = [...canonicalLinks, ...legacyLinks.map(row => ({ ...row, resource_version_id: null }))].filter(row => {
        const key = row.scheme_lesson_id + ':' + row.resource_id
        if (seenLinks.has(key)) return false
        seenLinks.add(key)
        return true
      })
      const resourceIds = unique(links.map(row => row.resource_id).filter(Boolean))
      const learningResult = resourceIds.length
        ? await supabase.from('learning_resources').select('id,title,description,subject,grade,asset_kind,material_variant,purpose,status,visibility,publication_id,chapter_id').in('id', resourceIds).eq('status', 'active').eq('visibility', 'public')
        : { data: [], error: null }
      if (learningResult.error) throw learningResult.error
      const learningMap = new Map(((learningResult.data ?? []) as LearningResource[]).map(row => [row.id, row]))
      const versionResult = resourceIds.length
        ? await supabase.from('learning_resource_versions')
          .select('id,resource_id,version,lifecycle_status,certified_at')
          .in('resource_id', resourceIds).eq('lifecycle_status', 'certified')
          .not('certified_at', 'is', null).order('version', { ascending: false })
        : { data: [], error: null }
      // A link to an active root alone is not proof of publication. Fail
      // closed if certified versions cannot be verified under the user's RLS.
      if (versionResult.error) setLinkWarning('Certification could not be verified. Unverified materials are not available to open.')
      const certifiedVersions = (versionResult.data ?? []) as Array<{ id: string; resource_id: string; version: number }>
      const byVersionId = new Map(certifiedVersions.map(row => [row.id, row]))
      const latestByResource = new Map<string, string>()
      for (const version of certifiedVersions) {
        if (!latestByResource.has(version.resource_id)) latestByResource.set(version.resource_id, version.id)
      }
      const verifiedVersion = (link: LinkedResourceRow) =>
        link.resource_version_id
          ? (byVersionId.get(link.resource_version_id)?.resource_id === link.resource_id ? link.resource_version_id : null)
          : latestByResource.get(link.resource_id) ?? null
      const linkMap = new Map<string, LinkedResourceRow[]>()
      for (const row of links) linkMap.set(row.scheme_lesson_id, [...(linkMap.get(row.scheme_lesson_id) ?? []), row])
      for (const rows of linkMap.values()) rows.sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id))

      const classMap = new Map(classRows.map(row => [row.id, row.label]))
      const subjectMap = new Map(subjectRows.map(row => [row.id, row.name]))
      setPacks(schemes.map(scheme => ({
        scheme,
        classLabel: classMap.get(scheme.class_id) ?? 'Class',
        subjectLabel: subjectMap.get(scheme.subject_id) ?? scheme.subject ?? 'Subject not recorded',
        resources: (linkMap.get(scheme.id) ?? [])
          .map(link => ({
            ...link,
            resource: learningMap.get(link.resource_id) ?? null,
            certifiedVersionId: verifiedVersion(link),
          }))
          .filter(item => item.resource !== null),
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
    <section className="vs-teacher-workspace teacher-resources">
      <header className="teacher-homework__summary">
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 750, letterSpacing: '.08em', textTransform: 'uppercase', opacity: .72 }}>Teaching materials</div>
              <h1 style={{ fontSize: 23, margin: '5px 0 4px', fontWeight: 750 }}>Teaching Library</h1>
              <p style={{ margin: 0, fontSize: 13, maxWidth: 680, opacity: .82 }}>Find teaching resource types, Scheme-linked lesson materials and your saved resources.</p>
            </div>
            <button type="button" onClick={() => openAdd()} style={{ border: 0, borderRadius: 11, padding: '10px 13px', background: '#fff', color: 'var(--teacher-green)', minHeight: 44, fontWeight: 650, whiteSpace: 'nowrap' }}>+ Add resource</button>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 11, fontSize: 12, opacity: .9 }}>
            <span>Week {week ?? '—'}</span>
            <span>{certifiedCount} certified {certifiedCount === 1 ? 'material' : 'materials'} this week</span>
            <span>{library.length} saved by me</span>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 980, margin: '0 auto', padding: 16 }}>
        <section aria-label="Find lessons" style={{ background: '#fff', border: '1px solid #dce7de', borderRadius: 12, padding: 12, marginBottom: 14 }}>
          <strong style={{ display: 'block', fontSize: 13, marginBottom: 9 }}>Find resources for</strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,190px),1fr))', gap: 9 }}>
            <label style={{ fontSize: 12, color: '#5f7168' }}>Class
              <select aria-label="Filter by class" value={classFilter} onChange={event => { setClassFilter(event.target.value); setSubjectFilter(''); setTopicFilter('') }}
                style={{ ...inputStyle, marginTop: 5, minHeight: 42 }}>
                <option value="">All my classes</option>
                {classes.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, color: '#5f7168' }}>Subject
              <select aria-label="Filter by subject" value={subjectFilter} onChange={event => setSubjectFilter(event.target.value)}
                style={{ ...inputStyle, marginTop: 5, minHeight: 42 }}>
                <option value="">All subjects</option>
                {subjectOptions.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, color: '#5f7168' }}>Topic
              <input aria-label="Filter by Scheme topic" type="search" value={topicFilter} onChange={event => setTopicFilter(event.target.value)}
                placeholder="e.g. Jumping" style={{ ...inputStyle, marginTop: 5, minHeight: 42 }} />
            </label>
          </div>
        </section>
        <TeachingLibraryStructure savedResources={catalogueLibrary} linkedResources={canonicalLibraryItems} onAddPersonalResource={openAdd} />
        <details style={{ marginBottom: 19, border: '1px solid #e0e7e1', borderRadius: 12, padding: '11px 14px', background: '#fff' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 650, fontSize: 13 }}>Published subject readers</summary>
          <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
          <Link href="/learn/grade-4/mathematics/time" style={{ display: 'block', marginBottom: 16, padding: '14px 16px', border: '1px solid #a8cbb6', borderRadius: 12, background: '#f0faf4', color: '#175b43', textDecoration: 'none' }}>
            <strong style={{ fontSize: 14 }}>Grade 4 Mathematics · Time · Shared learning library</strong>
            <span style={{ display: 'block', fontSize: 12, marginTop: 4 }}>Open released Time lessons in the canonical learner reader. Candidate manuscripts stay private.</span>
          </Link>
          <Link href="/learn/grade-1/creative-activities" style={{ display: 'block', marginBottom: 16, padding: '14px 16px', border: '1px solid #a8cbb6', borderRadius: 12, background: '#f0faf4', color: '#175b43', textDecoration: 'none' }}>
            <strong style={{ fontSize: 14 }}>Grade 1 Creative Activities · Learning library</strong>
            <span style={{ display: 'block', fontSize: 12, marginTop: 4 }}>Read the shared curriculum activities and approved materials. Draft lesson manuscripts remain private.</span>
          </Link>
          </div>
        </details>
        {error && <div role="alert" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 12, padding: 12, marginBottom: 14 }}>{error}</div>}
        {linkWarning && <p role="status" style={{ color: '#8a6300', fontSize: 12 }}>{linkWarning}</p>}

        <details id="scheme-linked-resources" style={{ marginBottom: 24, border: '1px solid #e1e9e2', borderRadius: 13, padding: '12px 14px', background: '#fff' }}>
          <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#22392c' }}>
            Ready this week · Scheme materials
            <span style={{ fontSize: 12, fontWeight: 400, color: '#61756a', marginLeft: 8 }}>{visiblePacks.length} topics · {certifiedCount} certified resource links</span>
          </summary>
          <p style={{ color: '#63746a', fontSize: 12, lineHeight: 1.6 }}>
            Scheme-linked resources for the selected week. Optional materials never block lesson preparation.
          </p>
          {visiblePacks.length === 0 ? (
            <p style={{ fontSize: 13, color: '#62756a' }}>No Scheme materials are linked for this instructional week. You can still prepare and teach your lesson.</p>
          ) : visiblePacks.map(pack => {
            const certified = pack.resources.filter(item => item.certifiedVersionId).length
            return (
              <details key={pack.scheme.id} style={{ marginBottom: 8, border: '1px solid #e0e7e2', borderRadius: 11, padding: '11px 12px' }}>
                <summary style={{ cursor: 'pointer', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <span>
                    <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#1e6150' }}>
                      {pack.classLabel} · {pack.subjectLabel}
                      {pack.scheme.lesson_number !== null ? ` · Lesson ${pack.scheme.lesson_number}` : ''}
                    </span>
                    <strong style={{ display: 'block', marginTop: 3, fontSize: 13 }}>{pack.scheme.topic || pack.scheme.sub_strand || pack.scheme.strand || 'Scheme topic'}</strong>
                  </span>
                  <span style={{ fontSize: 12, color: certified ? '#176448' : '#65766a' }}>
                    {certified ? `${certified} certified ${certified === 1 ? 'resource' : 'resources'}` : 'No certified materials linked'}
                  </span>
                </summary>
                <div style={{ marginTop: 10, display: 'grid', gap: 7 }}>
                  {pack.resources.length === 0 && <p style={{ fontSize: 12, color: '#63746a' }}>No resources linked to this Scheme topic. This is optional.</p>}
                  {pack.resources.map(item => {
                    const href = readerHref(item)
                    return (
                      <div key={item.id} style={{ padding: '9px 11px', borderRadius: 9, background: '#f8faf9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <div>
                          <strong style={{ display: 'block', fontSize: 12 }}>{item.resource?.title ?? 'Learning resource'}</strong>
                          <span style={{ display: 'block', fontSize: 11, color: '#66786e' }}>{item.resource?.asset_kind || item.resource_role || 'Material'} · {href ? 'Certified version' : 'Not released'}</span>
                        </div>
                        {href
                          ? <Link href={href} style={{ color: '#146a49', fontSize: 12, fontWeight: 750, whiteSpace: 'nowrap' }}>Open resource</Link>
                          : <span style={{ fontSize: 11, color: '#66786e' }}>Unavailable</span>}
                      </div>
                    )
                  })}
                </div>
              </details>
            )
          })}
        </details>

        <section id="saved-teaching-resources">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'end', marginBottom: 10 }}>
            <div><h2 style={{ fontSize: 18, margin: 0 }}>My saved materials</h2><p style={{ margin: '3px 0 0', fontSize: 12, color: C.textMuted }}>My teaching library. Teacher-added resources stay class-scoped.</p></div>
          </div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 10 }}>
            {(['all', ...TYPES.map(t => t.value)] as Array<'all' | ResourceType>).map(value => <button type="button" key={value} onClick={() => setFilter(value)} style={{ border: '1px solid #dbe3ea', background: filter === value ? '#e0f2fe' : '#fff', color: filter === value ? '#075985' : C.textMuted, borderRadius: 999, padding: '7px 10px', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>{value === 'all' ? 'All' : typeMeta(value).label}</button>)}
          </div>

          {visibleLibrary.length === 0 ? <div style={{ background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 14, padding: 18, color: C.textMuted }}>You have no saved {filter === 'all' ? '' : typeMeta(filter).label.toLowerCase() + ' '}resources yet. VibeSchool lesson resources above remain available independently.</div> : visibleLibrary.map(resource => {
            const meta = typeMeta(resource.type)
            const classLabel = resource.class_id ? classById.get(resource.class_id)?.label ?? 'Class' : 'Legacy school-wide'
            const isExpanded = expanded === resource.id
            return <article id={'saved-resource-' + resource.id} key={resource.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, marginBottom: 8, overflow: 'hidden' }}>
              <button type="button" onClick={() => setExpanded(isExpanded ? null : resource.id)} aria-expanded={isExpanded} style={{ border: 0, width: '100%', background: '#fff', textAlign: 'left', padding: 13, display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 19 }}>{meta.icon}</span><span style={{ flex: 1 }}><strong style={{ display: 'block', color: C.textPrimary }}>{resource.title}</strong><span style={{ fontSize: 11, color: C.textMuted }}>{resource.subject} · {classLabel} · {timeAgo(resource.created_at)}</span></span><span>{isExpanded ? '⌃' : '⌄'}</span>
              </button>
              {isExpanded && <div style={{ padding: '0 13px 13px' }}>{resource.description && <p style={{ lineHeight: 1.6 }}>{resource.description}</p>}{resource.content && <div style={{ whiteSpace: 'pre-wrap', background: "var(--teacher-canvas, #f5f6f2)", borderRadius: 10, padding: 11, lineHeight: 1.65 }}>{resource.content}</div>}{resource.external_url && <a href={resource.external_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 9 }}>Open external resource ↗</a>}<button type="button" disabled={deleting === resource.id} onClick={() => void deleteResource(resource)} style={{ display: 'block', marginTop: 10, border: '1px solid #fecaca', background: '#fff', color: '#991b1b', borderRadius: 9, padding: '7px 9px', fontWeight: 800 }}>{deleting === resource.id ? 'Deleting…' : 'Delete'}</button></div>}
            </article>
          })}
        </section>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add my resource">
        <div style={{ display: 'grid', gap: 13, marginTop: 16 }}>
          <div><label style={labelStyle}>Type</label><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{TYPES.map(item => <button type="button" key={item.value} onClick={() => setForm(current => ({ ...current, type: item.value }))} aria-pressed={form.type === item.value} style={{ border: form.type === item.value ? '1px solid #0f4c75' : '1px solid #dbe3ea', background: form.type === item.value ? '#e0f2fe' : '#fff', minHeight: 44, borderRadius: 999, padding: '7px 9px', fontWeight: 800 }}>{item.icon} {item.label}</button>)}</div></div>
          <div><label htmlFor="resource-class" style={labelStyle}>Class</label><select id="resource-class" style={inputStyle} value={form.class_id} onChange={event => setForm(current => ({ ...current, class_id: event.target.value }))}><option value="">Choose class</option>{classes.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}</select></div>
          <div><label htmlFor="resource-subject" style={labelStyle}>Subject</label><select id="resource-subject" style={inputStyle} value={form.subject_id} onChange={event => setForm(current => ({ ...current, subject_id: event.target.value }))}><option value="">Choose subject</option>{allowedSubjects.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div>
          <div><label htmlFor="resource-title" style={labelStyle}>Title</label><input id="resource-title" style={inputStyle} value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="Short useful title" /></div>
          <div><label htmlFor="resource-description" style={labelStyle}>Description</label><textarea id="resource-description" style={{ ...inputStyle, minHeight: 64 }} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} /></div>
          <div><label htmlFor="resource-link" style={labelStyle}>Paste link</label><input id="resource-link" style={inputStyle} value={form.external_url} onChange={event => setForm(current => ({ ...current, external_url: event.target.value }))} placeholder="https://…" /></div>
          <div><label htmlFor="resource-content" style={labelStyle}>Or add content</label><textarea id="resource-content" style={{ ...inputStyle, minHeight: 110 }} value={form.content} onChange={event => setForm(current => ({ ...current, content: event.target.value }))} placeholder="Notes, questions, instructions…" /></div>
        </div>
        {formError && <div role="alert" style={{ marginTop: 10, color: '#991b1b', fontSize: 12 }}>{formError}</div>}
        <button type="button" onClick={() => void saveResource()} disabled={saving} style={{ width: '100%', marginTop: 14, border: 0, borderRadius: 11, padding: 12, background: '#0f4c75', color: '#fff', fontWeight: 750 }}>{saving ? 'Saving…' : 'Save to my class library'}</button>
      </Modal>
    </section>
  )
}
