import { BookOpen, CalendarDays, ClipboardCheck, FileText, GraduationCap, Home, Library, LifeBuoy, MessageSquare, NotebookPen, School, Settings, SlidersHorizontal, Sparkles, TrendingUp, UserRound, Users, Wallet, Bell, ClipboardList } from 'lucide-react'

export const teacherTabs = [
  { id: 'today', label: 'Today', href: '/teacher/pulse', icon: Home },
  { id: 'teach', label: 'Teach', href: '/teacher/teach-today', icon: BookOpen },
  { id: 'classes', label: 'Classes', href: '/teacher/classhub', icon: Users },
  { id: 'assess', label: 'Assess', href: '/teacher/assessment', icon: ClipboardCheck },
  { id: 'me', label: 'Me', href: '/teacher/profile', icon: UserRound },
] as const
export type TeacherTab = typeof teacherTabs[number]['id']
export const teacherTools = {
  today: [{ label: 'Today', href: '/teacher/pulse', icon: Home }, { label: 'Twin', href: '/teacher/twin', icon: Sparkles }, { label: 'Notifications', href: '/teacher/notifications', icon: Bell }],
  teach: [
    { label: 'Teach today', href: '/teacher/teach-today', icon: BookOpen },
    { label: 'Timetable', href: '/teacher/timetable', icon: CalendarDays },
    { label: 'Subjects', href: '/teacher/subjecthub', icon: GraduationCap },
    { label: 'Scheme of work', href: '/teacher/scheme', icon: ClipboardList },
    { label: 'Lesson plans', href: '/teacher/lessonplan', icon: NotebookPen },
    { label: 'Lesson notes', href: '/teacher/lesson-notes', icon: FileText },
    { label: 'Teacher guide', href: '/teacher/teacher-guide', icon: Library },
    { label: 'This week', href: '/teacher/week', icon: CalendarDays },
    { label: 'Progress', href: '/teacher/progress', icon: TrendingUp },
    { label: 'Resources', href: '/teacher/resources', icon: Library },
    { label: 'VibeLearn', href: '/teacher/vibelearn', icon: BookOpen },
    { label: 'Content studio', href: '/teacher/studio', icon: NotebookPen },
  ],
  classes: [
    { label: 'My classes', href: '/teacher/classhub', icon: School },
    { label: 'Learners', href: '/teacher/students', icon: Users },
    { label: 'Attendance', href: '/teacher/attendance', icon: ClipboardCheck },
    { label: 'Homework', href: '/teacher/homework', icon: NotebookPen },
    { label: 'VibeConnect', href: '/teacher/vibeconnect', icon: MessageSquare },
  ],
  assess: [
    { label: 'Assessments', href: '/teacher/assessment', icon: ClipboardCheck },
    { label: 'Mark submitted work', href: '/teacher/assessment/marking', icon: NotebookPen },
    { label: 'Class results', href: '/teacher/assessment/gradebook', icon: ClipboardList },
    { label: 'Results analysis', href: '/teacher/assessment/analytics', icon: TrendingUp },
    { label: 'Curriculum', href: '/teacher/assessment/curriculum', icon: Library },
    { label: 'Interventions', href: '/teacher/assessment/interventions', icon: Users },
    { label: 'Exams', href: '/teacher/results', icon: GraduationCap },
    { label: 'Report cards', href: '/teacher/results/report-card', icon: FileText },
    { label: 'Question bank', href: '/teacher/assessment/bank', icon: Library },
  ],
  me: [
    { label: 'Profile', href: '/teacher/profile', icon: UserRound },
    { label: 'My school', href: '/teacher/schoolhub', icon: School },
    { label: 'TPAD', href: '/teacher/tpad', icon: ClipboardCheck },
    { label: 'Credits', href: '/teacher/credits', icon: Wallet },
    { label: 'Settings', href: '/teacher/settings', icon: SlidersHorizontal },
    { label: 'Help', href: '/teacher/help', icon: LifeBuoy },
    { label: 'All tools', href: '/teacher/more', icon: Settings },
  ],
} as const

export function teacherTabForPath(path: string): TeacherTab {
  // Most specific match wins (e.g. a nested assessment tool over its parent).
  const match = teacherTabs.flatMap(tab => teacherTools[tab.id].map(tool => ({ tab: tab.id, href: tool.href })))
    .filter(tool => path === tool.href || path.startsWith(tool.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]
  if (match) return match.tab
  if (/^\/teacher\/(teach|from-textbook|content-materials)(\/|$)/.test(path)) return 'teach'
  if (/^\/teacher\/(content-assessments|exams|report-cards|academics)(\/|$)/.test(path)) return 'assess'
  if (/^\/teacher\/(onboarding|pathways)(\/|$)/.test(path)) return 'me'
  return 'today'
}
