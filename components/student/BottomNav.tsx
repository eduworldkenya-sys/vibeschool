"use client"

import { useRouter, usePathname } from "next/navigation"

const TABS = [
  { id: "home",    label: "Home",     href: "/student"           },
  { id: "learn",   label: "Learn",    href: "/student/vibelearn" },
  { id: "twin",    label: "Twin",     href: "/student/twin"      },
  { id: "tasks",   label: "Tasks",    href: "/student/tasks"     },
  { id: "results", label: "Progress", href: "/student/marks"     },
] as const

type TabId = typeof TABS[number]["id"]

function activeTab(path: string): TabId {
  if (path === "/student" || path === "/student/") return "home"
  if (path.startsWith("/student/twin")) return "twin"
  if (path.startsWith("/student/vibelearn") || path.startsWith("/student/lesson") || path.startsWith("/student/resources")) return "learn"
  if (path.startsWith("/student/tasks") || path.startsWith("/student/learn") || path.startsWith("/student/homework") || path.startsWith("/student/exercises") || path.startsWith("/student/projects") || path.startsWith("/student/assessment")) return "tasks"
  if (path.startsWith("/student/marks") || path.startsWith("/student/results")) return "results"
  return "home"
}

function IconHome({ active }: { active: boolean }) { return <svg width={active ? 22 : 20} height={active ? 22 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> }
function IconLearn({ active }: { active: boolean }) { return <svg width={active ? 22 : 20} height={active ? 22 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> }
function IconTwin({ active }: { active: boolean }) { return <svg width={active ? 23 : 21} height={active ? 23 : 21} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z"/><path d="M5 14l.7 1.6L7.3 16.3l-1.6.7L5 18.6 4.3 17l-1.6-.7 1.6-.7L5 14z"/></svg> }
function IconTasks({ active }: { active: boolean }) { return <svg width={active ? 22 : 20} height={active ? 22 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/><path d="M7 14h.01"/><path d="M11 14h6"/><path d="M7 18h.01"/><path d="M11 18h6"/></svg> }
function IconResults({ active }: { active: boolean }) { return <svg width={active ? 22 : 20} height={active ? 22 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg> }

const ICONS: Record<TabId, ({ active }: { active: boolean }) => React.ReactNode> = { home: IconHome, learn: IconLearn, twin: IconTwin, tasks: IconTasks, results: IconResults }

export default function BottomNav() {
  const router = useRouter(); const pathname = usePathname(); const current = activeTab(pathname)
  return <nav aria-label="Student primary navigation" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50, display: "flex", height: 66, borderTop: "1px solid var(--vs-nav-border)", background: "var(--vs-nav-bg)", paddingBottom: "env(safe-area-inset-bottom)" }}>
    {TABS.map(tab => { const isActive = tab.id === current; const Icon = ICONS[tab.id]; return <button key={tab.id} aria-current={isActive ? "page" : undefined} onClick={() => router.push(tab.href)} style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, border: "none", background: "transparent", cursor: "pointer", color: isActive ? "var(--vs-accent)" : "var(--vs-muted)", transition: "color .15s, transform .15s", minWidth: 44, minHeight: 44, transform: tab.id === 'twin' && isActive ? 'translateY(-1px)' : undefined }}>
      {isActive && <span style={{ position: "absolute", top: 0, width: tab.id === 'twin' ? 30 : 24, height: 2, borderRadius: "0 0 4px 4px", background: "var(--vs-accent)" }} />}
      <Icon active={isActive} /><span style={{ fontSize: 9.5, lineHeight: 1, fontWeight: isActive ? 800 : 500, fontFamily: "inherit" }}>{tab.label}</span>
    </button> })}
  </nav>
}