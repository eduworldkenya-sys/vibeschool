import { evidencePercentage, normalizeProgressBand, reconcileProgressEvidence, type ProgressEvidence } from './progress-record'
import { progressDate } from './progress-period'
import { safeExport } from '@/lib/class-workbook/model'

export function progressDataChecks(rows: ProgressEvidence[], now = new Date()) {
  const reconciled = reconcileProgressEvidence(rows), today = progressDate(now)
  return {
    captured: rows.length, observations: reconciled.length, repeatedSourceRows: rows.length - reconciled.length,
    unknownSubject: reconciled.filter(row=>!row.subjectId).length,
    unlinked: reconciled.filter(row => !row.outcomeId).length,
    unknownMaximum: reconciled.filter(row => row.score !== null && row.maxScore === null).length,
    invalidScale: reconciled.filter(row => row.score !== null && row.maxScore !== null && evidencePercentage(row) === null).length,
    noRecordedLevel: reconciled.filter(row => normalizeProgressBand(row.proficiency, null) === 'NE').length,
    captureDates: reconciled.filter(row=>row.timestampKind==='recorded').length,
    futureDated: reconciled.filter(row => {const date=progressDate(row.observedAt);return Boolean(date && today && date>today)}).length,
    sources: Array.from(new Set(reconciled.map(row=>row.source))).sort(),
  }
}

/** Teacher working copy. Names are roster-scoped; private notes are excluded. */
export function progressCsv(rows: ProgressEvidence[], learners: {id:string;name:string;admission_number:string|null}[], subjects: {id:string;name:string}[], context: {className:string;period:string;asOf:string}) {
  const names = new Map(learners.map(learner=>[learner.id,learner])), subjectNames = new Map(subjects.map(subject=>[subject.id,subject.name]))
  const header = ['Document','Class','Period','As of','Learner ID','Learner','Admission','Subject','Outcome ID','Outcome','Source','Source ID','Observation or record date','Date meaning','Score','Maximum','Percentage','Recorded level']
  const values: (string|number|null)[][] = [header]
  for (const row of reconcileProgressEvidence(rows)) {
    const learner = names.get(row.studentId)
    if (!learner) continue
    values.push(['Teacher working copy — not a released report',context.className,context.period,context.asOf,row.studentId,learner.name,learner.admission_number,row.subjectId?subjectNames.get(row.subjectId)??'Unresolved subject':'Unresolved subject',row.outcomeId,row.outcomeText,row.source,row.sourceId,row.observedAt,row.timestampKind??'observed',row.score,row.maxScore,evidencePercentage(row),normalizeProgressBand(row.proficiency,null)])
  }
  for (const learner of learners) if (!rows.some(row=>row.studentId===learner.id)) values.push(['Teacher working copy — not a released report',context.className,context.period,context.asOf,learner.id,learner.name,learner.admission_number,null,null,'No evidence in exported view',null,null,null,null,null,null,null,'NE'])
  return '\uFEFF'+values.map(row=>row.map(value=>'"'+String(safeExport(value)??'').replace(/"/g,'""')+'"').join(',')).join('\r\n')
}

export function downloadProgressCsv(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}))
  const anchor = document.createElement('a'); anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}
