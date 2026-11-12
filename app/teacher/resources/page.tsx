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
import TeacherResourceEditor from '@/components/teacher/TeacherResourceEditor'
import type { PersonalResourceRow } from '@/components/teacher/TeacherResourceEditor'
import { componentForPersonalResource, mayShareResource } from '@/lib/teaching/personalResourceTypes'
import { TEACHING_LIBRARY_SLOTS } from '@/lib/teaching/libraryStructure'

type TeacherResource = PersonalResourceRow

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
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 12px', borderRadius: 10, border: '1px solid #dbe3ea',
  fontSize: 14, color: C.textPrimary, background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit',
}
const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: 5, fontSize: 11, fontWeight: 800, color: C.textMuted,
  textTransform: 'uppercase', letterSpacing: '.05em',
}

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
  const [editorComponent, setEditorComponent] = useState('lesson-notes')
  const [editingResource, setEditingResource] = useState<TeacherResource | null>(null)
  const [filter, setFilter] = useState<'all' | 'draft' | 'shared'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [sharing, setSharing] = useState<string | null>(null)
  const [savedQuery, setSavedQuery] = useState('')
  const [notice, setNotice] = useState('')
  const classById = useMemo(() => new Map(classes.map(row => [row.id, row])), [classes])
  const subjectById = useMemo(() => new Map(subjects.map(row => [row.id, row])), [subjects])
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
    catalogueLibrary.filter(row => (filter === 'all' || row.publication_status === filter) &&
      (!savedQuery.trim() || [row.title, row.description ?? '', row.subject ?? '']
        .some(value => value.toLocaleLowerCase().includes(savedQuery.trim().toLocaleLowerCase())))),
    [catalogueLibrary, filter, savedQuery],
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

  const openAdd = useCallback((component: string = 'lesson-notes') => {
    setEditingResource(null)
    setEditorComponent(component)
    setNotice('')
    setShowAdd(true)
  }, [])

  const editSaved = (resource: TeacherResource) => {
    setEditingResource(resource)
    setEditorComponent(componentForPersonalResource(resource) ?? 'lesson-notes')
    setShowAdd(true)
  }

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
      setLibrary((resourceResult.data ?? []) as TeacherResource[])

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

  const onSavedResource = (resource: TeacherResource) => {
    setLibrary(current => [resource, ...current.filter(item => item.id !== resource.id)])
    setShowAdd(false)
    setEditingResource(null)
    setExpanded(resource.id)
    setFilter('all')
    setNotice('Saved privately. Learners cannot read this material until you explicitly share it.')
  }

  async function setSharingStatus(resource: TeacherResource, next: 'draft' | 'shared') {
    if (!teacherId || sharing) return
    setError('')
    setNotice('')
    if (next === 'shared') {
      if (!mayShareResource(resource)) {
        setError('Add content or a valid external link before sharing.')
        return
      }
      if (!window.confirm(`Share “${resource.title}” with learners in this class? Learners will be able to read it.`)) return
    }
    setSharing(resource.id)
    const result = await supabase.from('resources')
      .update({ publication_status: next })
      .eq('id', resource.id).eq('teacher_id', teacherId).select('*').single()
    setSharing(null)
    if (result.error || !result.data) {
      setError(result.error?.message ?? 'Resource visibility could not be changed.')
      return
    }
    setLibrary(current => current.map(item => item.id === resource.id ? result.data as TeacherResource : item))
    setNotice(next === 'shared' ? 'Shared with the class.' : 'Unshared. Learner access has been withdrawn.')
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
            <button type="button" onClick={() => openAdd()} style={{ border: 0, borderRadius: 11, padding: '10px 13px', background: '#fff', color: 'var(--teacher-green)', minHeight: 44, fontWeight: 650, whiteSpace: 'nowrap' }}>+ Create resource</button>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 11, fontSize: 12, opacity: .9 }}>
            <span>Week {week ?? '—'}</span>
            <span>{certifiedCount} certified {certifiedCount === 1 ? 'material' : 'materials'} this week</span>
            <span>{library.filter(row => row.publication_status === 'draft').length} private drafts · {library.filter(row => row.publication_status === 'shared').length} shared</span>
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
        {notice && <div role="status" style={{ background: '#f0faf3', color: '#176346', padding: 12, marginBottom: 12, borderRadius: 10 }}>{notice}</div>}
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

        <section id="saved-teaching-resources" aria-label="My saved teaching materials">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'end', marginBottom: 12 }}>
            <div>
              <h2 style={{ fontSize: 18, margin: 0 }}>My teaching materials</h2>
              <p style={{ fontSize: 12, color: C.textMuted, margin: '4px 0' }}>Save privately first. Only Share with class makes content visible to learners.</p>
            </div>
            <button type="button" onClick={() => openAdd()} style={{ background: '#fff', color: '#126747', padding: 10, border: '1px solid #bfd4c6', borderRadius: 9 }}>+ Create</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center', marginBottom: 12 }}>
            {(['all','draft','shared'] as const).map(value =>
              <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}
                style={{ border: '1px solid #cddbd3', borderRadius: 999, padding: '8px 12px', fontSize: 12, background: filter === value ? '#e9f6ed' : '#fff' }}>
                {value === 'all' ? 'All saved' : value === 'draft' ? 'Private drafts' : 'Shared with class'}
              </button>)}
            <input aria-label="Search my materials" type="search" value={savedQuery} onChange={e => setSavedQuery(e.target.value)}
              placeholder="Search my materials…" style={{ ...inputStyle, flex: '1 1 170px', width: 'auto', minHeight: 38, padding: 8 }} />
          </div>
          {visibleLibrary.length === 0 && <div role="status" style={{ background: '#fff', border: '1px dashed #cad7cf', borderRadius: 12, padding: 16, color: C.textMuted }}>
            No matching materials. You can create a private draft and add its content later.
          </div>}
          {visibleLibrary.map(resource => {
            const opened = expanded === resource.id
            const shared = resource.publication_status === 'shared'
            const componentLabel = TEACHING_LIBRARY_SLOTS.find(slot => slot.id === componentForPersonalResource(resource))?.label ?? 'Teaching material'
            const classLabel = resource.class_id ? classById.get(resource.class_id)?.label ?? 'Class' : 'Legacy item'
            const schemeLabel = resource.scheme_lesson_id ? packs.find(p => p.scheme.id === resource.scheme_lesson_id)?.scheme.topic : null
            return <article id={'saved-resource-' + resource.id} key={resource.id} style={{ border: '1px solid #dce7dd', background: '#fff', borderRadius: 12, marginBottom: 8, overflow: 'hidden' }}>
              <button type="button" aria-expanded={opened} onClick={() => setExpanded(opened ? null : resource.id)}
                style={{ display: 'flex', width: '100%', border: 0, background: '#fff', textAlign: 'left', padding: 13, gap: 9, alignItems: 'center', cursor: 'pointer' }}>
                <span style={{ flex: 1 }}>
                  <strong style={{ display: 'block', fontSize: 14, color: C.textPrimary }}>{resource.title}</strong>
                  <span style={{ display: 'block', fontSize: 11, color: C.textMuted }}>{componentLabel} · {classLabel} · {resource.subject || 'Subject'} {schemeLabel ? '· ' + schemeLabel : ''}</span>
                </span>
                <span style={{ color: shared ? '#136747' : '#735f38', fontWeight: 750, fontSize: 11, whiteSpace: 'nowrap' }}>{shared ? 'Shared' : 'Private draft'}</span>
                <span aria-hidden="true">{opened ? '⌃' : '⌄'}</span>
              </button>
              {opened && <div style={{ padding: '0 13px 13px', borderTop: '1px solid #edf1ed' }}>
                {resource.description && <p style={{ fontSize: 13, color: '#566e61' }}>{resource.description}</p>}
                {resource.content && <div style={{ background: '#f7faf8', padding: 12, borderRadius: 9, whiteSpace: 'pre-wrap', lineHeight: 1.6, marginTop: 10, fontSize: 13 }}>{resource.content}</div>}
                {resource.external_url && <a href={resource.external_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 10, color: '#136747' }}>Open external resource</a>}
                {!resource.content && !resource.external_url && <p style={{ fontSize: 12, color: '#687c6e' }}>Content has not been added. This draft can be edited.</p>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                  <button type="button" onClick={() => editSaved(resource)} style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #b5cfc0', background: '#fff', color: '#146c4b' }}>Edit</button>
                  <button type="button" disabled={sharing === resource.id} onClick={() => void setSharingStatus(resource, shared ? 'draft' : 'shared')}
                    style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #b5cfc0', background: shared ? '#fff' : '#176949', color: shared ? '#146744' : '#fff', fontWeight: 700 }}>
                    {sharing === resource.id ? 'Updating…' : shared ? 'Unshare' : 'Share with class'}
                  </button>
                  <button type="button" disabled={deleting === resource.id} onClick={() => void deleteResource(resource)}
                    style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #f0c8c8', background: '#fff', color: '#9a2929' }}>
                    {deleting === resource.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>}
            </article>
          })}
        </section>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={editingResource ? 'Edit teaching material' : 'Create teaching material'}>
        {teacherId && schoolId && <TeacherResourceEditor
          key={editingResource?.id ?? editorComponent} teacherId={teacherId} schoolId={schoolId}
          classes={classes} subjects={subjects} assignments={assignments} schemes={packs.map(p => p.scheme)}
          initialClassId={classFilter && classById.has(classFilter) ? classFilter : classes[0]?.id ?? ''}
          initialSubjectId={subjectFilter && subjectById.has(subjectFilter) ? subjectFilter
            : assignments.find(a => a.class_id === (classFilter || classes[0]?.id))?.subject_id ?? ''}
          initialComponent={editorComponent} editing={editingResource}
          onClose={() => setShowAdd(false)} onSaved={onSavedResource}
        />}
      </Modal>
    </section>
  )
}
