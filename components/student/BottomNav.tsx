"use client"

import { useRouter, usePathname } from "next/navigation"
import { BookOpenCheck, CalendarDays, GraduationCap, Settings, UserRound } from "lucide-react"
import styles from "./BottomNav.module.css"

const TABS = [
  { id: "home",    label: "Home",     href: "/student"           },
  { id: "learn",   label: "Learn",    href: "/student/study" },
  { id: "practise",label: "Practise", href: "/student/vibelearn/topic-practice" },
  { id: "tasks",   label: "Tasks",    href: "/student/tasks"     },
  { id: "results", label: "Progress", href: "/student/marks"     },
] as const

type TabId = typeof TABS[number]["id"]

function activeTab(path: string): TabId | null {
  if (path === "/student" || path === "/student/") return "home"
  if (path.startsWith("/student/vibelearn/topic-practice")) return "practise"
  if (path.startsWith("/student/vibelearn/practice") || path.startsWith("/student/vibelearn/revision") || path.startsWith("/student/vibelearn/mistakes") || path.startsWith("/student/vibelearn/recovery") || path.startsWith("/student/vibelearn/topic")) return "practise"
  // Formal exams have their own owner and do not impersonate Learn or Practice.
  if (path.startsWith("/student/vibelearn/exams") || path.startsWith("/student/vibelearn/kcse")) return null
  if (path.startsWith("/student/exercises") || path.startsWith("/student/projects")) return "tasks"
  if (path.startsWith("/student/twin")) return "learn"
  if (path.startsWith("/learn") || path.startsWith("/student/study") || path.startsWith("/student/vibelearn") || path.startsWith("/student/learn") || path.startsWith("/student/lesson") || path.startsWith("/student/resources")) return "learn"
  if (path.startsWith("/student/assessment")) return null // Shared exam/practice assessment is not a Tasks destination.
  if (path.startsWith("/student/tasks") || path.startsWith("/student/homework")) return "tasks"
  if (path.startsWith("/student/marks") || path.startsWith("/student/results")) return "results"
  return "home"
}

function IconHome({ active }: { active: boolean }) { return <svg width={active ? 22 : 20} height={active ? 22 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> }
function IconLearn({ active }: { active: boolean }) { return <svg width={active ? 22 : 20} height={active ? 22 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> }
function IconPractise({ active }: { active: boolean }) { return <svg width={active ? 22 : 20} height={active ? 22 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="m16.5 3.5 4 4L9 19H5v-4L16.5 3.5z"/><path d="m14.5 5.5 4 4"/></svg> }
function IconTasks({ active }: { active: boolean }) { return <svg width={active ? 22 : 20} height={active ? 22 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="M7 14h.01"/><path d="M11 14h6"/><path d="M7 18h.01"/><path d="M11 18h6"/></svg> }
function IconResults({ active }: { active: boolean }) { return <svg width={active ? 22 : 20} height={active ? 22 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg> }

const ICONS: Record<TabId, ({ active }: { active: boolean }) => React.ReactNode> = { home: IconHome, learn: IconLearn, practise: IconPractise, tasks: IconTasks, results: IconResults }

const QUICK_LINKS = [
  { href: "/student/vibelearn/exams", label: "Exams", Icon: GraduationCap },
  { href: "/student/workspace", label: "Workspace", Icon: BookOpenCheck },
  { href: "/learn/stories", label: "Stories", Icon: BookOpenCheck },
  { href: "/student/timetable", label: "My Day", Icon: CalendarDays },
] as const

export default function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()
  const current = activeTab(pathname)
  const tabs = TABS
  return (
    <nav className={styles.nav} aria-label="Student primary navigation">
      <div className={styles.heading}>My learning</div>
      {tabs.map(tab => {
        const isActive = tab.id === current
        const Icon = ICONS[tab.id]
        return <button type="button" key={tab.id}
          className={styles.tab + (isActive ? " " + styles.tabActive : "")}
          aria-current={isActive ? "page" : undefined}
          onClick={() => router.push(tab.href)}>
          <Icon active={isActive} />
          <span className={styles.label}>{tab.label}</span>
        </button>
      })}
      <div className={styles.secondary}>
        <div className={styles.heading}>Quick access</div>
        {QUICK_LINKS.map(({href,label,Icon})=>
          <button type="button" key={href} className={pathname.startsWith(href)?styles.quickActive:""} onClick={()=>router.push(href)}>
            <Icon aria-hidden="true" size={19}/><span>{label}</span>
          </button>
        )}
      </div>
      <div className={styles.footer}>
        <button type="button" onClick={()=>router.push("/student/profile")}><UserRound size={19} aria-hidden="true"/>Profile</button>
        <button type="button" onClick={()=>router.push("/student/settings")}><Settings size={19} aria-hidden="true"/>Settings</button>
      </div>
    </nav>
  )
}
