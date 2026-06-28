"use client"

import { useRouter, usePathname } from "next/navigation"

const TABS = [
  { id: "home",      label: "Home",      href: "/student"           },
  { id: "work",      label: "My Work",   href: "/student/learn"     },
  { id: "vibelearn", label: "VibeLearn", href: "/student/vibelearn" },
  { id: "play",      label: "Play",      href: "/student/funhub"    },
  { id: "me",        label: "Me",        href: "/student/profile"   },
] as const

type TabId = typeof TABS[number]["id"]

function activeTab(path: string): TabId {
  if (path === "/student" || path === "/student/") return "home"
  if (path.startsWith("/student/learn") || path.startsWith("/student/homework") || path.startsWith("/student/lesson")) return "work"
  if (path.startsWith("/student/vibelearn")) return "vibelearn"
  if (path.startsWith("/student/funhub"))    return "play"
  if (
    path.startsWith("/student/profile")       ||
    path.startsWith("/student/marks")         ||
    path.startsWith("/student/timetable")     ||
    path.startsWith("/student/fees")          ||
    path.startsWith("/student/health")        ||
    path.startsWith("/student/notifications")
  ) return "me"
  return "home"
}

function IconHome({ active }: { active: boolean }) {
  return (
    <svg width={active ? 23 : 21} height={active ? 23 : 21} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

function IconWork({ active }: { active: boolean }) {
  return (
    <svg width={active ? 23 : 21} height={active ? 23 : 21} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="13" x2="15" y2="13"/>
      <line x1="9" y1="17" x2="15" y2="17"/>
    </svg>
  )
}

function IconVibeLearn({ active }: { active: boolean }) {
  return (
    <svg width={active ? 23 : 21} height={active ? 23 : 21} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="10 8 16 12 10 16 10 8"/>
    </svg>
  )
}

function IconPlay({ active }: { active: boolean }) {
  return (
    <svg width={active ? 23 : 21} height={active ? 23 : 21} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  )
}

function IconMe({ active }: { active: boolean }) {
  return (
    <svg width={active ? 23 : 21} height={active ? 23 : 21} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

const ICONS: Record<TabId, ({ active }: { active: boolean }) => React.ReactNode> = {
  home:      IconHome,
  work:      IconWork,
  vibelearn: IconVibeLearn,
  play:      IconPlay,
  me:        IconMe,
}

export default function BottomNav() {
  const router   = useRouter()
  const pathname = usePathname()
  const current  = activeTab(pathname)

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex h-16 border-t
                 bg-white border-gray-200
                 dark:bg-[#0F0F1A] dark:border-[#2D2D4E]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map(tab => {
        const isActive = tab.id === current
        const Icon     = ICONS[tab.id]
        return (
          <button
            key={tab.id}
            onClick={() => router.push(tab.href)}
            className={`relative flex flex-1 flex-col items-center justify-center gap-1 border-none bg-transparent cursor-pointer transition-colors duration-150
              ${isActive
                ? "text-[#5B4EE8] dark:text-[#7C6EF8]"
                : "text-gray-400 dark:text-[#9090B0]"
              }`}
          >
            {isActive && (
              <span className="absolute top-0 w-7 h-0.5 rounded-b bg-[#5B4EE8] dark:bg-[#7C6EF8]" />
            )}
            <Icon active={isActive} />
            <span className={`text-[10px] leading-none ${isActive ? "font-bold" : "font-medium"}`}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
