"use client";

import { useEffect, useMemo, useState } from 'react'
import { saveCanonicalExamResult } from '@/lib/teacher/examResultAuthority'
import {
  correctClassExamResult, loadClassExamSheet,
  type ClassExamLearner, type ClassExamResult, type ClassExamSubject, type ClassExamSheet as Sheet,
} from '@/lib/teacher/classExamSheet'
import styles from './ClassExamSheet.module.css'

type Selected = {
  learner: ClassExamLearner
  subject: ClassExamSubject
  entry: ClassExamResult | null
}

const statuses: Record<string,string> = {
  entered: 'Recorded', absent: 'Absent', exempt: 'Exempt',
  pending: 'Pending', not_assessed: 'Not assessed',
  incomplete: 'Incomplete', late: 'Late',
  transferred: 'Transferred', awaiting_marking: 'Awaiting marking',
}
function display(entry: ClassExamResult | undefined): string {
  if (!entry) return '—'
  return entry.result_state === 'entered' && entry.marks !== null
    ? String(entry.marks) : (statuses[entry.result_state] ?? 'Check')
}
function message(cause: unknown): string {
  const e = cause instanceof Error ? cause.message : 'Could not save the result.'
  if (e.includes('result_changed_review_again')) return 'This mark changed. Close this editor and reload the register before correcting it.'
  if (e.includes('exam_locked')) return 'This examination is locked. No changes were saved.'
  if (e.includes('class_teacher_not_authorized') || e.includes('teacher_subject_not_authorized')) return 'Your teacher assignment does not permit this change.'
  if (e.includes('result_not_entered_by_subject_teacher')) return 'The assigned subject teacher must enter the original mark first.'
  if (e.includes('marks_outside_exam_maximum')) return 'The mark exceeds the examination maximum.'
  return e
}
export default function ClassExamSheet({ examId, schoolId, classId, className }: {
  examId: string
  schoolId: string
  classId: string
  className: string
}) {
  const [sheet, setSheet] = useState<Sheet|null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Selected|null>(null)
  const [mark, setMark] = useState('')
  const [resultState, setResultState] = useState('entered')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setSheet(null)
    void loadClassExamSheet({ examId,schoolId,classId })
      .then(data => {if(active)setSheet(data)})
      .catch(cause=>{if(active)setError(message(cause))})
      .finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false}
  }, [examId,schoolId,classId,version])

  const saved = useMemo(
    () => new Map(sheet?.results.map(r => [r.student_id+':'+r.subject_id,r] as const) ?? []),
    [sheet],
  )
  const visible = useMemo(() => (
    (sheet?.learners ?? []).filter(l => (
      !query.trim() || (l.name+' '+(l.admission_number ?? '')).toLowerCase().includes(query.trim().toLowerCase())
    ))
  ),[sheet,query])
  const completion = useMemo(()=>{
    const total=(sheet?.learners.length??0)*(sheet?.subjects.length??0)
    const recorded=sheet?.results.filter(r => ['entered','absent','exempt','not_assessed','transferred'].includes(r.result_state)).length??0
    return {total,recorded,unresolved:Math.max(0,total-recorded)}
  },[sheet])
  function open(learner:ClassExamLearner,subject:ClassExamSubject,entry:ClassExamResult|null){
    if (!sheet || sheet.is_locked || (!subject.can_enter && (!sheet.is_class_teacher || !entry))) return
    setSelected({learner,subject,entry})
    setMark(entry?.marks == null ? '' : String(entry.marks))
    setResultState(entry?.result_state === 'absent' ? 'absent' : 'entered')
    setReason('')
    setSaveError('')
  }
  async function save(){
    if(!sheet||!selected||saving)return
    const {learner,subject,entry}=selected
    const requiresCorrection = !subject.can_enter || (!!entry && !entry.recorder_is_me)
    if(requiresCorrection && !entry){setSaveError('Only the assigned subject teacher may enter the original result.');return}
    const max=entry?.max_marks ?? subject.max_marks
    const numeric = resultState === 'entered' ? Number(mark) : null
    if(resultState === 'entered' && (!mark.trim() || numeric===null || !Number.isFinite(numeric) || numeric<0 || numeric>max)){
      setSaveError('Enter a mark between 0 and '+max+'.')
      return
    }
    if(requiresCorrection && (reason.trim().length<10 || reason.trim().length>500)){
      setSaveError('Enter a correction reason of 10–500 characters.')
      return
    }
    setSaving(true);setSaveError('')
    try{
      if(requiresCorrection){
        await correctClassExamResult({
          examId,schoolId,classId,subjectId:subject.id,studentId:learner.id,
          marks:numeric,resultState,expectedUpdatedAt:entry!.updated_at,reason:reason.trim(),
        })
      }else{
        await saveCanonicalExamResult({
          examId,schoolId,classId,subjectId:subject.id,studentId:learner.id,
          marks:resultState==='absent'?0:numeric!,isAbsent:resultState==='absent',
          expectedUpdatedAt:entry?.updated_at??null,
        })
      }
      // Authoritative readback: never claim success based on an optimistic cell.
      const fresh=await loadClassExamSheet({examId,schoolId,classId})
      setSheet(fresh)
      setSelected(null)
    }catch(cause){setSaveError(message(cause))}
    finally{setSaving(false)}
  }

  if (loading) return <div className={styles.loading} role="status">Loading class examination register…</div>
  if (error) return <section className={styles.error} role="alert">{error}<button type="button" onClick={()=>setVersion(v=>v+1)}>Retry</button></section>
  if(!sheet)return null
  return <section className={styles.root} aria-label="Consolidated class exam register">
    <header className={styles.heading}>
      <div>
        <h2>{className} <span>· All learning areas</span></h2>
        <p>{sheet.is_class_teacher ? 'Class teacher · Review and correct recorded results' : 'Subject teacher · View all, edit assigned learning areas'}</p>
      </div>
      <div className={styles.count}><strong>{completion.recorded}/{completion.total}</strong><span>Resolved results</span></div>
    </header>
    <div className={styles.toolbar}>
      <label className={styles.searchLabel}>
        <span className={styles.srOnly}>Find learner</span>
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find learner or admission number" type="search"/>
      </label>
      <span className={styles.info}>{completion.unresolved} unresolved · {sheet.is_locked?'Locked':'Open'}</span>
      <button type="button" onClick={()=>setVersion(v=>v+1)} className={styles.quiet}>Refresh</button>
    </div>
    {sheet.subjects.length===0?<div className={styles.empty}>No learning areas are assigned to this class yet. Confirm assignments in School Hub.</div>
    : sheet.learners.length===0?<div className={styles.empty}>No currently enrolled learners were found. Check the class register.</div>
    : <div className={styles.scroller} role="region" aria-label="Class examination results" tabIndex={0}>
      <table className={styles.table}>
        <thead><tr>
          <th className={styles.nameCell} scope="col">Learner</th>
          {sheet.subjects.map(s=><th scope="col" key={s.id} title={s.name}>{s.name}<small>/{s.max_marks}{s.can_enter?' · Edit':''}</small></th>)}
        </tr></thead>
        <tbody>{visible.map(learner=><tr key={learner.id}>
          <th className={styles.nameCell} scope="row">{learner.name}
            {learner.admission_number&&<small>{learner.admission_number}</small>}</th>
          {sheet.subjects.map(subject=>{
            const entry=saved.get(learner.id+':'+subject.id)
            const allowed=!sheet.is_locked&&(subject.can_enter || (sheet.is_class_teacher && !!entry))
            const value=display(entry)
            return <td key={subject.id}>
              {allowed?<button className={styles.cellAction} type="button"
                aria-label={`Edit ${subject.name} result for ${learner.name}: ${value}`}
                onClick={()=>open(learner,subject,entry??null)}>
                <span className={entry?.result_state==='entered'?styles.score:styles.status}>{value}</span>
                {entry?.result_state==='entered'&&entry.max_marks!==subject.max_marks&&<small>/{entry.max_marks}</small>}
              </button>:<span className={styles.readonly} title={entry?'Read-only result':'Awaiting subject teacher'}>
                {value}</span>}
            </td>
          })}
        </tr>)}</tbody>
      </table>
      {visible.length===0&&<p className={styles.empty}>No learner matches that search.</p>}
    </div>}
    <p className={styles.note}>Scores remain out of their original maximums. No automatic CBC level or class rank is inferred. Missing is never zero.</p>
    {selected&&<div className={styles.overlay} onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)setSelected(null)}}>
      <form className={styles.dialog} role="dialog" aria-modal="true"
        aria-label={`Result for ${selected.learner.name}`} onSubmit={e=>{e.preventDefault();void save()}}>
        <div className={styles.dialogHead}><div><strong>{selected.learner.name}</strong>
          <p>{selected.subject.name} · Maximum {selected.entry?.max_marks??selected.subject.max_marks}</p></div>
          <button type="button" className={styles.close} onClick={()=>setSelected(null)} disabled={saving} aria-label="Close editor">×</button>
        </div>
        <label>Result status
          <select value={resultState} onChange={e=>setResultState(e.target.value)} disabled={saving}>
            <option value="entered">Mark recorded</option>
            <option value="absent">Absent</option>
            {!selected.subject.can_enter&&<>
              <option value="exempt">Exempt</option>
              <option value="not_assessed">Not assessed</option>
              <option value="pending">Pending</option>
            </>}
          </select>
        </label>
        {resultState==='entered'&&<label>Marks obtained
          <input autoFocus type="number" inputMode="decimal" min={0}
            max={selected.entry?.max_marks??selected.subject.max_marks} step="any"
            value={mark} onChange={e=>setMark(e.target.value)} disabled={saving}/>
        </label>}
        {(!selected.subject.can_enter || (selected.entry && !selected.entry.recorder_is_me))&&<label>Reason for correction
          <textarea minLength={10} maxLength={500} rows={3} value={reason}
            onChange={e=>setReason(e.target.value)} disabled={saving}
            placeholder="Describe what was checked and why the result is changing"/>
        </label>}
        {saveError&&<p role="alert" className={styles.saveError}>{saveError}</p>}
        <div className={styles.actions}>
          <button type="button" className={styles.quiet} disabled={saving} onClick={()=>setSelected(null)}>Cancel</button>
          <button type="submit" className={styles.primary} disabled={saving}>{saving?'Saving…':'Save result'}</button>
        </div>
      </form>
    </div>}
  </section>
}
