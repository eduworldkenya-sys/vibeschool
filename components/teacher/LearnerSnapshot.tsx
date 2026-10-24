"use client";

type Score = { assessment_id: string; subject_id: string | null; percentage: number | null; assessment_title: string; released_at: string | null };

type Props = {
  scores: Score[];
  subjects: { id: string; name: string }[];
  attendance: { present: number; records: number };
  work: { submitted: number; assigned: number };
  followUps: number;
  overdue: number;
  assessmentRecords: number;
  releasedScores: number;
  onProgress: () => void;
  onAttendance: () => void;
  onWork: () => void;
  onSupport: () => void;
};

export default function LearnerSnapshot({
  scores, subjects, attendance, work, followUps, overdue,
  assessmentRecords, releasedScores, onProgress, onAttendance, onWork, onSupport,
}: Props) {
  const latest = scores
    .filter(row => row.released_at && row.percentage != null)
    .sort((a, b) => (b.released_at ?? "").localeCompare(a.released_at ?? ""))[0];
  const latestSubject = latest ? subjects.find(subject => subject.id === latest.subject_id)?.name : null;
  return (
    <section className="studio-learner-summary" aria-label="Learner record summary">
      <div className="studio-learner-summary-grid">
        <button type="button" onClick={onAttendance}>
          <span>Attendance</span>
          <strong>{attendance.records ? `${attendance.present} / ${attendance.records}` : "—"}</strong>
          <small>{attendance.records ? "Sessions present" : "No sessions recorded"}</small>
        </button>
        <button type="button" onClick={onWork}>
          <span>Work</span>
          <strong>{work.submitted} / {work.assigned}</strong>
          <small>{overdue ? `${overdue} overdue` : "No overdue work recorded"}</small>
        </button>
        <button type="button" onClick={onProgress}>
          <span>Results</span>
          <strong>{releasedScores} released</strong>
          <small>{assessmentRecords} assessment record{assessmentRecords === 1 ? "" : "s"}</small>
        </button>
        <button type="button" onClick={onSupport}>
          <span>Follow-ups</span>
          <strong>{followUps}</strong>
          <small>{followUps ? "Recorded follow-ups" : "No follow-up recorded"}</small>
        </button>
      </div>
      <p className="studio-learner-summary-context">
        {assessmentRecords} assessment record{assessmentRecords === 1 ? "" : "s"} · {releasedScores
          ? `${releasedScores} released subject score${releasedScores === 1 ? "" : "s"}`
          : "No released subject scores"}
        {latest && latestSubject ? ` · Latest: ${latestSubject} ${Math.round(latest.percentage!)}%` : ""}
        {overdue ? ` · ${overdue} overdue task${overdue === 1 ? "" : "s"}` : ""}
        {!followUps ? " · No follow-up recorded" : ""}
      </p>
    </section>
  );
}
