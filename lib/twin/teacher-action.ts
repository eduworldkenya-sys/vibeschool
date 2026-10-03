import { supabase } from "@/lib/supabase";
import { loadWorkbook, saveExamMarks } from "@/lib/class-workbook/data";

export interface TeacherTwinExamMarkAction {
  kind: "exam_mark";
  schoolId: string;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  subjectId: string;
  subjectName: string;
  examId: string;
  examName: string;
  mark: number;
}

export interface TeacherTwinActionProposal {
  action: TeacherTwinExamMarkAction;
  summary: string;
  confirmationLabel: string;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function clean(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function words(value: string): string[] {
  return clean(value).split(" ").filter(Boolean);
}

function scoreName(candidate: string, query: string): number {
  const c = clean(candidate);
  const q = clean(query);
  if (!q || !c) return 0;
  if (c === q) return 100;
  if (c.startsWith(q)) return 85;
  if (c.includes(q)) return 75;
  const qWords = words(q);
  const matched = qWords.filter(word => c.split(" ").some(part => part === word || part.startsWith(word))).length;
  return qWords.length ? Math.round((matched / qWords.length) * 60) : 0;
}

function parseExamMarkCommand(input: string): { mark: number; learner: string; subject: string; exam: string } | null {
  const normalized = input.replace(/\s+/g, " ").trim();
  const patterns = [
    /^(?:add|enter|record|set|give)\s+(\d{1,3})(?:\s*\/\s*100)?\s*(?:marks?|points?)?\s+(?:to|for)\s+(.+?)\s+(?:in|for|on)\s+(.+?)\s+(cat|exam|test|quiz|assessment)(?:\s+(\d+))?$/i,
    /^(?:add|enter|record|set|give)\s+(\d{1,3})(?:\s*\/\s*100)?\s*(?:marks?|points?)?\s+(?:to|for)\s+(.+?)\s+(?:in|for|on)\s+(.+?)\s+(midterm|mid term|endterm|end term|mock)$/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const mark = Number(match[1]);
    if (!Number.isFinite(mark) || mark < 0 || mark > 100) return null;
    const learner = match[2].trim();
    if (pattern === patterns[0]) {
      const subject = match[3].trim();
      const exam = [match[4], match[5]].filter(Boolean).join(" ").trim();
      return { mark, learner, subject, exam };
    }
    return { mark, learner, subject: match[3].trim(), exam: match[4].trim() };
  }
  return null;
}

export async function proposeTeacherTwinAction(input: string): Promise<TeacherTwinActionProposal | null> {
  const command = parseExamMarkCommand(input);
  if (!command) return null;

  const auth = await supabase.auth.getUser();
  if (auth.error || !auth.data.user) throw new Error("Sign in before asking Twin to change school records.");
  const teacherId = auth.data.user.id;

  const contextResult = await supabase.rpc("teacher_get_operating_context");
  if (contextResult.error) throw new Error(contextResult.error.message);
  const context = record(contextResult.data);
  const schoolId = typeof context.school_id === "string" ? context.school_id : "";
  if (!schoolId || context.teacher_id !== teacherId) {
    throw new Error("Twin could not confirm your active teacher school. Open Me → School.");
  }

  const assignments = (Array.isArray(context.classes) ? context.classes : [])
    .map(record)
    .filter(row =>
      typeof row.class_id === "string" &&
      typeof row.subject_id === "string" &&
      typeof row.subject_name === "string"
    );

  const subjectMatches = assignments
    .map(row => ({
      classId: String(row.class_id),
      className: `${row.class_name ?? "Class"} ${row.stream ?? ""}`.trim(),
      subjectId: String(row.subject_id),
      subjectName: String(row.subject_name),
      score: scoreName(String(row.subject_name), command.subject),
    }))
    .filter(row => row.score >= 60)
    .sort((a, b) => b.score - a.score);

  if (!subjectMatches.length) {
    throw new Error(`I could not match “${command.subject}” to one of your assigned subjects.`);
  }

  const bestSubjectScore = subjectMatches[0].score;
  const candidateAssignments = subjectMatches.filter(row => row.score === bestSubjectScore);
  const classIds = Array.from(new Set(candidateAssignments.map(row => row.classId)));

  const enrollment = await supabase
    .from("student_classes")
    .select("student_id,class_id")
    .eq("school_id", schoolId)
    .eq("is_current", true)
    .in("class_id", classIds);
  if (enrollment.error) throw new Error(enrollment.error.message);

  const studentIds = Array.from(new Set((enrollment.data ?? []).map(row => row.student_id).filter(Boolean)));
  if (!studentIds.length) throw new Error("None of the matching classes currently has an enrolled learner.");

  const students = await supabase
    .from("students")
    .select("id,name")
    .in("id", studentIds)
    .is("deleted_at", null);
  if (students.error) throw new Error(students.error.message);

  const learnerMatches = (students.data ?? [])
    .map(student => ({ ...student, score: scoreName(student.name ?? "", command.learner) }))
    .filter(student => student.score >= 60)
    .sort((a, b) => b.score - a.score);

  if (!learnerMatches.length) {
    throw new Error(`I could not find an enrolled learner matching “${command.learner}” in your matching classes.`);
  }
  const bestLearnerScore = learnerMatches[0].score;
  const bestLearners = learnerMatches.filter(student => student.score === bestLearnerScore);
  if (bestLearners.length !== 1) {
    throw new Error(`“${command.learner}” matches more than one learner. Use the learner’s fuller name before Twin changes marks.`);
  }
  const learner = bestLearners[0];

  const learnerEnrollment = (enrollment.data ?? []).filter(row => row.student_id === learner.id);
  const assignment = candidateAssignments.find(row => learnerEnrollment.some(en => en.class_id === row.classId));
  if (!assignment) throw new Error("The learner is not currently enrolled in a class where you teach that subject.");

  const exams = await supabase
    .from("exams")
    .select("id,name,exam_type,is_locked")
    .eq("school_id", schoolId)
    .eq("is_locked", false);
  if (exams.error) throw new Error(exams.error.message);

  const examMatches = (exams.data ?? [])
    .map(exam => ({
      ...exam,
      score: Math.max(scoreName(exam.name ?? "", command.exam), scoreName(exam.exam_type ?? "", command.exam)),
    }))
    .filter(exam => exam.score >= 60)
    .sort((a, b) => b.score - a.score);

  if (!examMatches.length) {
    throw new Error(`I could not find an unlocked exam matching “${command.exam}”. Open Exam Centre to choose the exact exam.`);
  }
  const bestExamScore = examMatches[0].score;
  const bestExams = examMatches.filter(exam => exam.score === bestExamScore);
  if (bestExams.length !== 1) {
    throw new Error(`“${command.exam}” matches more than one unlocked exam. Use the exact exam name.`);
  }
  const exam = bestExams[0];

  const action: TeacherTwinExamMarkAction = {
    kind: "exam_mark",
    schoolId,
    classId: assignment.classId,
    className: assignment.className,
    studentId: learner.id,
    studentName: learner.name ?? command.learner,
    subjectId: assignment.subjectId,
    subjectName: assignment.subjectName,
    examId: exam.id,
    examName: exam.name ?? exam.exam_type ?? command.exam,
    mark: command.mark,
  };

  return {
    action,
    summary: `Set ${action.studentName}’s ${action.subjectName} mark to ${action.mark}/100 for ${action.examName} in ${action.className}. I will re-check your authority, enrolment, subject assignment and exam lock before saving.`,
    confirmationLabel: `Save ${action.mark}/100`,
  };
}

export async function executeTeacherTwinAction(action: TeacherTwinExamMarkAction): Promise<string> {
  const workbook = await loadWorkbook(action.classId);
  if (workbook.data.schoolId !== action.schoolId) throw new Error("Your active school changed. Ask Twin again before saving.");
  const learner = workbook.data.learners.find(row => row.id === action.studentId);
  if (!learner) throw new Error("This learner is no longer currently enrolled in the selected class.");
  if (!workbook.data.subjects.some(subject => subject.id === action.subjectId)) {
    throw new Error("You are no longer assigned to this subject in the selected class.");
  }
  await saveExamMarks(workbook.data, action.examId, action.subjectId, [
    { studentId: action.studentId, value: action.mark },
  ]);
  return `Saved and confirmed: ${learner.name} — ${action.subjectName} — ${action.examName}: ${action.mark}/100.`;
}
