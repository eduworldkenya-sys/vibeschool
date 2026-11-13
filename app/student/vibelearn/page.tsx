import { redirect } from 'next/navigation'

/** Legacy VibeLearn home returns to the protected learner workspace. Deep readers, exams and practice keep their own routes. */
export default function StudentVibeLearnPage() { redirect('/student/study') }
