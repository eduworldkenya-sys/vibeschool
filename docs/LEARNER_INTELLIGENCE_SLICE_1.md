# Learner Intelligence Slice 1

## Scope

This slice establishes deterministic, evidence-gated learner summary logic for the Teacher Class learner workspace.

## Authority rules

- Learner identity is accepted only through current `student_classes` enrollment inside `teacher_get_operating_context()` school/class scope.
- Attendance rate = present attendance records / attendance records loaded for the learner. No attendance evidence displays no rate.
- Work completion is based on real homework assignment rows and matching submission rows.
- Released numeric assessment averages use only released gradebook rows with finite 0-100 percentages.
- Trend is not calculated across arbitrary assessments. At least four released rows with the same subject and assessment type are required.
- Repeated low-assessment attention requires at least two comparable released rows below 50%; a single low score never labels the learner.
- CBC support attention requires at least two BE/AE observations for the same subject + sub-strand.
- Missing work is deterministic: due date passed and no submission record exists.
- Sparse evidence explicitly renders `Not enough evidence yet` and must not be converted into mastery, risk, diagnosis or an AI conclusion.

## Intentionally not introduced

- No new tables.
- No competing mastery engine.
- No AI/Cyborg diagnosis.
- No intervention lifecycle yet.
- No parent-facing inference.
- No RLS weakening.

## Production vertical proof

Grade 6 Yellow Social Studies currently has three enrolled learners. The observed production evidence for the three learners is attendance-only (two attendance records each) with no homework submissions, assessment attempts, competency evidence, mastery, recommendations or mistakes. The expected learner intelligence state is therefore `Not enough evidence yet`.
