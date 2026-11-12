'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TEACHING_LIBRARY_CATEGORIES, TEACHING_LIBRARY_SLOTS } from '@/lib/teaching/libraryStructure'
import {
  componentForPersonalResource,
  isResourceComponent,
  legacyTypeForComponent,
} from '@/lib/teaching/personalResourceTypes'

export type PersonalResourceRow = {
  id: string
  title: string
  description: string | null
  type: string
  component_type: string | null
  publication_status: string
  subject: string | null
  subject_id: string | null
  scheme_lesson_id: string | null
  external_url: string | null
  content: string | null
  is_school_wide: boolean | null
  class_id: string | null
  created_at: string | null
}

type Assignment = { class_id: string; subject_id: string }
type Class = { id: string; label: string }
type Subject = { id: string; name: string }
type SchemeLesson = { id: string; class_id: string; subject_id: string; topic: string | null; sub_strand: string | null; strand: string | null; week: number | null; lesson_number: number | null }

const field: React.CSSProperties = {
  width: '100%', minHeight: 42, padding: '9px 11px', borderRadius: 9,
  border: '1px solid #cddbd3', background: '#fff', color: '#243b2f', fontSize: 14,
  fontFamily: 'inherit', boxSizing: 'border-box',
}
const label: React.CSSProperties = { display: 'block', fontSize: 12, color: '#49665a', fontWeight: 700, marginBottom: 5 }

/** Reuses public.resources: this is a teacher-owned supplementary material, never a new content engine. */
export default function TeacherResourceEditor({
  teacherId, schoolId, classes, subjects, assignments, schemes,
  initialClassId, initialSubjectId, initialComponent, editing, onClose, onSaved,
}: {
  teacherId: string
  schoolId: string
  classes: Class[]
  subjects: Subject[]
  assignments: Assignment[]
  schemes: SchemeLesson[]
  initialClassId: string
  initialSubjectId: string
  initialComponent: string
  editing: PersonalResourceRow | null
  onClose: () => void
  onSaved: (row: PersonalResourceRow) => void
}) {
  const initial = isResourceComponent(initialComponent) ? initialComponent : 'lesson-notes'
  const [component, setComponent] = useState(editing ? componentForPersonalResource(editing) ?? initial : initial)
  const [classId, setClassId] = useState(editing?.class_id ?? initialClassId)
  const [subjectId, setSubjectId] = useState(editing?.subject_id ?? initialSubjectId)
  const [schemeId, setSchemeId] = useState(editing?.scheme_lesson_id ?? '')
  const [title, setTitle] = useState(editing?.title ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [externalUrl, setExternalUrl] = useState(editing?.external_url ?? '')
  const [body, setBody] = useState(editing?.content ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const availableSubjects = useMemo(() => {
    const ids = new Set(assignments.filter(item => item.class_id === classId).map(item => item.subject_id))
    return subjects.filter(item => ids.has(item.id))
  }, [assignments, classId, subjects])
  const availableScheme = useMemo(() => schemes
    .filter(item => item.class_id === classId && item.subject_id === subjectId)
    .sort((a, b) => (a.week ?? 0) - (b.week ?? 0) || (a.lesson_number ?? 0) - (b.lesson_number ?? 0)),
    [schemes, classId, subjectId])

  async function saveDraft() {
    if (saving) return
    setError('')
    if (!title.trim()) return setError('Enter a resource title.')
    if (!classId || !subjectId || !assignments.some(a => a.class_id === classId && a.subject_id === subjectId)) {
      return setError('Choose a class and subject assigned to you.')
    }
    if (schemeId && !availableScheme.some(s => s.id === schemeId)) {
      return setError('This Scheme lesson does not belong to the selected class and subject.')
    }
    if (externalUrl.trim()) {
      try { if (!['http:', 'https:'].includes(new URL(externalUrl.trim()).protocol)) throw new Error('unsupported') }
      catch { return setError('Use a valid http:// or https:// resource link.') }
    }
    const subjectName = subjects.find(s => s.id === subjectId)?.name
    if (!subjectName) return setError('Choose a valid subject.')
    const auth = await supabase.auth.getUser()
    if (auth.error || auth.data.user?.id !== teacherId) return setError('Your teacher session must be refreshed before saving.')

    const payload = {
      title: title.trim(), description: description.trim(),
      type: legacyTypeForComponent(component, component === 'demonstrations' && !!externalUrl.trim()),
      component_type: component,
      publication_status: 'draft' as const,
      class_id: classId, subject_id: subjectId, school_id: schoolId, teacher_id: teacherId,
      scheme_lesson_id: schemeId || null,
      subject: subjectName, content: body.trim() || null,
      external_url: externalUrl.trim() || null, is_school_wide: false,
    }
    setSaving(true)
    try {
      // Editing a shared resource intentionally returns it to draft; learner
      // access is revoked until the teacher explicitly shares the revision.
      const result = editing
        ? await supabase.from('resources').update(payload)
          .eq('id', editing.id).eq('teacher_id', teacherId).select('*').single()
        : await supabase.from('resources').insert(payload).select('*').single()
      if (result.error || !result.data) throw result.error ?? new Error('Resource could not be saved.')
      onSaved(result.data as PersonalResourceRow)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Resource could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 'min(72vh, 680px)', minHeight: 0 }}>
      <div style={{ overflowY: 'auto', minHeight: 0, padding: '12px 3px 16px', display: 'grid', gap: 13 }}>
        <p style={{ margin: 0, color: '#51695d', fontSize: 13 }}>
          Create a resource for your teaching. Save it privately first; sharing with learners is a separate action.
        </p>
        {editing?.publication_status === 'shared' && (
          <p role="status" style={{ margin: 0, fontSize: 12, color: '#975b16' }}>
            Saving changes will unshare this resource until you choose Share with class again.
          </p>
        )}
        <div>
          <label htmlFor="resource-component" style={label}>Teaching component</label>
          <select id="resource-component" style={field} value={component} onChange={event => setComponent(event.target.value)}>
            {TEACHING_LIBRARY_CATEGORIES.map(group => (
              <optgroup key={group.id} label={group.label}>
                {TEACHING_LIBRARY_SLOTS.filter(slot => slot.categoryId === group.id).map(slot =>
                  <option key={slot.id} value={slot.id}>{slot.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,180px),1fr))' }}>
          <div>
            <label htmlFor="resource-class" style={label}>Class</label>
            <select id="resource-class" style={field} value={classId} onChange={e => {
              const next = e.target.value
              const nextSubject = assignments.find(a => a.class_id === next)?.subject_id ?? ''
              setClassId(next); setSubjectId(nextSubject); setSchemeId('')
            }}>
              <option value="">Choose class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="resource-subject" style={label}>Subject</label>
            <select id="resource-subject" style={field} value={subjectId} onChange={e => { setSubjectId(e.target.value); setSchemeId('') }}>
              <option value="">Choose subject</option>
              {availableSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="resource-scheme" style={label}>Link to Scheme lesson <span style={{ fontWeight: 400 }}>(optional)</span></label>
          <select id="resource-scheme" style={field} value={schemeId} onChange={e => setSchemeId(e.target.value)}>
            <option value="">No Scheme lesson linked</option>
            {availableScheme.map(s => <option key={s.id} value={s.id}>
              {s.week != null ? `Week ${s.week} · ` : ''}{s.topic || s.sub_strand || s.strand || 'Lesson'}{s.lesson_number != null ? ` · Lesson ${s.lesson_number}` : ''}
            </option>)}
          </select>
          <p style={{ margin: '5px 0 0', color: '#718275', fontSize: 11 }}>A Scheme link preserves curriculum context. It is not compulsory.</p>
        </div>
        <div>
          <label htmlFor="resource-title" style={label}>Title</label>
          <input id="resource-title" style={field} maxLength={180} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Safe Jumping — Practice Notes"/>
        </div>
        <div>
          <label htmlFor="resource-description" style={label}>Description <span style={{ fontWeight: 400 }}>(optional)</span></label>
          <textarea id="resource-description" style={{ ...field, minHeight: 62 }} maxLength={1000} value={description} onChange={e => setDescription(e.target.value)} placeholder="What learners will use this for"/>
        </div>
        <div>
          <label htmlFor="resource-content" style={label}>Content <span style={{ fontWeight: 400 }}>(can be added later)</span></label>
          <textarea id="resource-content" style={{ ...field, minHeight: 130 }} value={body} onChange={e => setBody(e.target.value)}
            placeholder="Write lesson notes, guided steps, questions, instructions or teacher prompts…"/>
        </div>
        <div>
          <label htmlFor="resource-url" style={label}>External resource link <span style={{ fontWeight: 400 }}>(optional)</span></label>
          <input id="resource-url" type="url" style={field} value={externalUrl} onChange={e => setExternalUrl(e.target.value)} placeholder="https://…"/>
        </div>
        {(component === 'quizzes' || component === 'tests-exams' || component === 'assignments' || component === 'homework') && (
          <p style={{ background: '#f5f8fb', padding: 11, borderRadius: 9, fontSize: 12, color: '#52677c', margin: 0 }}>
            This saves supporting teaching material, not a runnable or marked assessment.
            <a href="/teacher/assessment/new" style={{ display: 'inline-block', marginLeft: 6, color: '#075985' }}>Open Assessment Builder</a>
          </p>
        )}
      </div>
      {error && <p role="alert" style={{ color: '#991b1b', fontSize: 12, margin: '8px 0 0' }}>{error}</p>}
      <div style={{ position: 'sticky', bottom: 0, background: '#fff', borderTop: '1px solid #e2eae3', padding: '12px 0 4px', display: 'flex', justifyContent: 'end', gap: 9 }}>
        <button type="button" onClick={onClose} disabled={saving} style={{ border: '1px solid #ccd8d0', borderRadius: 9, background: '#fff', color: '#3d5547', padding: '10px 14px' }}>Cancel</button>
        <button type="button" onClick={() => void saveDraft()} disabled={saving}
          style={{ border: 0, borderRadius: 9, background: '#136748', color: '#fff', fontWeight: 750, padding: '10px 17px' }}>
          {saving ? 'Saving…' : 'Save private draft'}
        </button>
      </div>
    </div>
  )
}
