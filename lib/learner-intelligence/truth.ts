export type LearnerAttendanceEvidence = {
  date: string;
  status: string;
  is_late?: boolean | null;
};

export type LearnerHomeworkEvidence = {
  id: string;
  due_date: string;
};

export type LearnerSubmissionEvidence = {
  homework_id: string;
  status: string;
};

export type LearnerAssessmentEvidence = {
  assessment_id: string;
  subject_id: string;
  percentage: number;
  assessment_type: string;
  released_at: string | null;
};

export type LearnerCbcEvidence = {
  subject_id: string;
  sub_strand: string | null;
  performance: string;
  created_at: string;
};

export type LearnerTruthInput = {
  attendance: LearnerAttendanceEvidence[];
  homework: LearnerHomeworkEvidence[];
  submissions: LearnerSubmissionEvidence[];
  assessments: LearnerAssessmentEvidence[];
  cbc: LearnerCbcEvidence[];
  examCount: number;
  now?: Date;
};

export type LearnerSignal = {
  id: "missing_work" | "repeated_low_assessment" | "repeated_cbc_support";
  reason: string;
  evidenceCount: number;
  confidence: "medium" | "high";
};

export type LearnerTrend = {
  delta: number;
  subjectId: string;
  assessmentType: string;
  evidenceCount: number;
} | null;

export type LearnerTruthSummary = {
  attendance: {
    records: number;
    present: number;
    absent: number;
    late: number;
    rate: number | null;
  };
  work: {
    assigned: number;
    submitted: number;
    missing: number;
  };
  assessment: {
    released: number;
    cbc: number;
    exams: number;
    averageReleasedScore: number | null;
  };
  evidenceState: "none" | "sparse" | "sufficient";
  evidenceMessage: string;
  trend: LearnerTrend;
  signals: LearnerSignal[];
};

const CBC_SUPPORT_LEVELS = new Set(["BE", "AE"]);

function finitePercent(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function comparableTrend(assessments: LearnerAssessmentEvidence[]): LearnerTrend {
  const groups = new Map<string, LearnerAssessmentEvidence[]>();
  for (const row of assessments) {
    if (!finitePercent(Number(row.percentage)) || !row.released_at) continue;
    const key = `${row.subject_id}::${row.assessment_type}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const candidates = [...groups.entries()]
    .map(([key, rows]) => ({
      key,
      rows: [...rows].sort((a, b) => new Date(b.released_at ?? 0).getTime() - new Date(a.released_at ?? 0).getTime()),
    }))
    .filter(({ rows }) => rows.length >= 4)
    .sort((a, b) => b.rows.length - a.rows.length);

  const selected = candidates[0];
  if (!selected) return null;

  const recent = selected.rows.slice(0, 2);
  const prior = selected.rows.slice(2, 4);
  const recentAverage = recent.reduce((sum, row) => sum + Number(row.percentage), 0) / recent.length;
  const priorAverage = prior.reduce((sum, row) => sum + Number(row.percentage), 0) / prior.length;
  const [subjectId, assessmentType] = selected.key.split("::");

  return {
    delta: Math.round(recentAverage - priorAverage),
    subjectId,
    assessmentType,
    evidenceCount: selected.rows.length,
  };
}

export function buildLearnerTruthSummary(input: LearnerTruthInput): LearnerTruthSummary {
  const now = input.now ?? new Date();
  const present = input.attendance.filter((row) => row.status === "present").length;
  const absent = input.attendance.filter((row) => row.status === "absent").length;
  const late = input.attendance.filter((row) => Boolean(row.is_late)).length;
  const attendanceRecords = input.attendance.length;
  const attendanceRate = attendanceRecords ? Math.round((present / attendanceRecords) * 100) : null;

  const submissionIds = new Set(input.submissions.map((row) => row.homework_id));
  const submitted = input.homework.filter((row) => submissionIds.has(row.id)).length;
  const missingRows = input.homework.filter((row) => !submissionIds.has(row.id) && new Date(row.due_date).getTime() < now.getTime());

  const releasedAssessments = input.assessments.filter((row) => row.released_at && finitePercent(Number(row.percentage)));
  const averageReleasedScore = releasedAssessments.length
    ? Math.round(releasedAssessments.reduce((sum, row) => sum + Number(row.percentage), 0) / releasedAssessments.length)
    : null;

  const learningEvidenceCount = releasedAssessments.length + input.cbc.length + input.examCount;
  const totalEvidenceCount = attendanceRecords + input.submissions.length + learningEvidenceCount;
  const evidenceState: LearnerTruthSummary["evidenceState"] = totalEvidenceCount === 0
    ? "none"
    : learningEvidenceCount < 2
      ? "sparse"
      : "sufficient";

  const signals: LearnerSignal[] = [];
  if (missingRows.length > 0) {
    signals.push({
      id: "missing_work",
      reason: `${missingRows.length} assigned item${missingRows.length === 1 ? " is" : "s are"} overdue without a submission record.`,
      evidenceCount: missingRows.length,
      confidence: "high",
    });
  }

  const lowAssessmentGroups = new Map<string, LearnerAssessmentEvidence[]>();
  for (const row of releasedAssessments.filter((item) => Number(item.percentage) < 50)) {
    const key = `${row.subject_id}::${row.assessment_type}`;
    const group = lowAssessmentGroups.get(key) ?? [];
    group.push(row);
    lowAssessmentGroups.set(key, group);
  }
  const repeatedLow = [...lowAssessmentGroups.values()].sort((a, b) => b.length - a.length)[0];
  if (repeatedLow && repeatedLow.length >= 2) {
    signals.push({
      id: "repeated_low_assessment",
      reason: `${repeatedLow.length} comparable released assessment scores are below 50%. Inspect the underlying assessment evidence before choosing an intervention.`,
      evidenceCount: repeatedLow.length,
      confidence: repeatedLow.length >= 3 ? "high" : "medium",
    });
  }

  const cbcSupportGroups = new Map<string, LearnerCbcEvidence[]>();
  for (const row of input.cbc.filter((item) => CBC_SUPPORT_LEVELS.has(item.performance))) {
    const key = `${row.subject_id}::${row.sub_strand ?? "unspecified"}`;
    const group = cbcSupportGroups.get(key) ?? [];
    group.push(row);
    cbcSupportGroups.set(key, group);
  }
  const repeatedCbc = [...cbcSupportGroups.values()].sort((a, b) => b.length - a.length)[0];
  if (repeatedCbc && repeatedCbc.length >= 2) {
    signals.push({
      id: "repeated_cbc_support",
      reason: `${repeatedCbc.length} CBC observations on the same curriculum area are at BE/AE. Review teacher evidence before acting.`,
      evidenceCount: repeatedCbc.length,
      confidence: repeatedCbc.length >= 3 ? "high" : "medium",
    });
  }

  return {
    attendance: { records: attendanceRecords, present, absent, late, rate: attendanceRate },
    work: { assigned: input.homework.length, submitted, missing: missingRows.length },
    assessment: {
      released: releasedAssessments.length,
      cbc: input.cbc.length,
      exams: input.examCount,
      averageReleasedScore,
    },
    evidenceState,
    evidenceMessage: evidenceState === "sufficient"
      ? "Enough recorded learning evidence exists to inspect patterns."
      : "Not enough evidence yet. Record learning evidence before drawing mastery or trend conclusions.",
    trend: comparableTrend(releasedAssessments),
    signals,
  };
}
