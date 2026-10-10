'use client'

import { useMemo } from 'react'

type Score = { assessment_id: string; subject_id: string | null; percentage: number | null; assessment_title: string; released_at: string | null }
export default function LearnerSnapshot({ scores, subjects, attendance, work, followUps, onProgress, onAttendance, onWork, onSupport }: {
  scores: Score[]; subjects: { id: string; name: string }[]; attendance: { present: number; records: number }; work: { submitted: number; assigned: number }; followUps: number
  onProgress: () => void; onAttendance: () => void; onWork: () => void; onSupport: () => void
}) {
  const groups = useMemo(() => subjects.map(subject => ({ ...subject, scores: scores.filter(row => row.subject_id === subject.id && row.percentage !== null && row.released_at).sort((a,b) => a.released_at!.localeCompare(b.released_at!)).slice(-5) })).filter(group => group.scores.length), [subjects, scores])
  return <div className="studio-profile-focus">
    <button className="studio-profile-learning" onClick={onProgress}><div className="studio-matrix-heading"><h2>Learning snapshot</h2><span aria-hidden="true">↗</span></div>{groups.length ? <div className="studio-score-groups">{groups.slice(0,3).map(group => <div key={group.id}><small>{group.name}</small><div className="studio-score-bars">{group.scores.map(row => <span key={row.assessment_id} style={{ height: `${Math.max(3, Math.min(100, row.percentage!))}%` }} title={`${row.assessment_title}: ${row.percentage}% · ${row.released_at}`}><span className="sr-only">{row.assessment_title}: {row.percentage}%</span></span>)}</div><strong>{group.scores.at(-1)?.percentage}% latest</strong></div>)}</div> : <div className="studio-snapshot-empty"><span aria-hidden="true">—</span><p>No released subject scores yet</p></div>}<small>Recorded scores · open evidence and progress</small></button>
    <div className="studio-profile-stats"><button onClick={onAttendance}><strong>{attendance.records ? `${attendance.present} / ${attendance.records}` : '—'}</strong><span>Recorded sessions present</span></button><button onClick={onWork}><strong>{work.submitted} / {work.assigned}</strong><span>Work submitted</span></button><button onClick={onSupport}><strong>{followUps}</strong><span>Active follow-ups</span></button></div>
  </div>
}
