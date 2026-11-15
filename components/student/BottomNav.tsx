"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BookOpen, BookOpenCheck, BrainCircuit, CalendarDays, ChartNoAxesColumn, ChevronRight, ClipboardCheck, Eraser, GraduationCap, Home, LibraryBig, Menu, NotebookPen, PencilLine, Settings, ShieldCheck, UserRound, UsersRound, X, ListTodo } from "lucide-react";
import styles from "./BottomNav.module.css";

const PRIMARY = [
  { label: "Home", href: "/student", Icon: Home },
  { label: "Learn", href: "/student/study", Icon: BookOpen },
  { label: "Practice", href: "/student/vibelearn/topic-practice", Icon: PencilLine },
  { label: "Tasks", href: "/student/tasks", Icon: ListTodo },
  { label: "Progress", href: "/student/marks", Icon: ChartNoAxesColumn },
] as const;

const MORE = [
  { label: "My Exams", href: "/student/vibelearn/exams", Icon: ClipboardCheck },
  { label: "My Mistakes", href: "/student/vibelearn/mistakes", Icon: Eraser },
  { label: "Revision", href: "/student/vibelearn/revision", Icon: BrainCircuit },
  { label: "My Tutors", href: "/student/tutoring", Icon: UsersRound },
  { label: "Practice Sets", href: "/student/vibelearn/practice", Icon: BookOpenCheck },
  { label: "Books & Stories", href: "/learn/stories", Icon: LibraryBig },
  { label: "My Workspace", href: "/student/workspace", Icon: NotebookPen },
  { label: "My Day", href: "/student/timetable", Icon: CalendarDays },
  { label: "Profile", href: "/student/profile", Icon: UserRound },
  { label: "Settings", href: "/student/settings", Icon: Settings },
] as const;

// One list owns every destination; groups organise More without creating routes.
const MORE_GROUPS = [
  { label: "Practice & exams", items: [MORE[0], MORE[1], MORE[2], MORE[4]] },
  { label: "Reading & study", items: [MORE[5], MORE[6]] },
  { label: "Planning & tuition", items: [MORE[7], MORE[3]] },
  { label: "My account", items: [MORE[8], MORE[9]] },
] as const;

function isToolActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

function activeSection(path: string): string {
  if (path === "/student" || path === "/student/") return "Home";
  if (path.startsWith("/student/study") || path.startsWith("/student/lesson") || path.startsWith("/student/resources") || path.startsWith("/student/twin") || path.startsWith("/learn")) return "Learn";
  if (path.startsWith("/student/vibelearn/topic-practice") || path.startsWith("/student/vibelearn/practice") || path.startsWith("/student/vibelearn/recovery") || path.startsWith("/student/vibelearn/mistakes") || path.startsWith("/student/vibelearn/revision") || path.startsWith("/student/vibelearn/topic")) return "Practice";
  if (path.startsWith("/student/tasks") || path.startsWith("/student/homework") || path.startsWith("/student/exercises") || path.startsWith("/student/projects") || path.startsWith("/student/timetable")) return "Tasks";
  if (path.startsWith("/student/marks") || path.startsWith("/student/results")) return "Progress";
  // Formal exams keep their own owner and cannot appear as Topic Practice.
  if (path.startsWith("/student/vibelearn/exams")) return "";
  if (path.startsWith("/student/assessment/")) return "";
  return "";
}

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const current = activeSection(pathname);
  const activeMore = MORE.some(({ href }) => isToolActive(pathname, href));

  const navigate = (href: string) => {
    setMoreOpen(false);
    router.push(href);
  };

  // Route changes, Escape, scroll lock and keyboard focus are shared across mobile routes.
  useEffect(() => { setMoreOpen(false); }, [pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMoreOpen(false);
      }
      if (event.key !== "Tab" || !sheet.current) return;
      const buttons = Array.from(sheet.current.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
      if (!buttons.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
      else moreButton.current?.focus();
    };
  }, [moreOpen]);

  return <>
    <nav className={styles.nav} aria-label="Student primary navigation">
      <div className={styles.heading}>MY LEARNING</div>
      {PRIMARY.map(({label,href,Icon}) => <button key={href} type="button" className={styles.tab + (current===label ? " "+styles.tabActive:"")} aria-current={current===label?"page":undefined} onClick={()=>navigate(href)}>
        <Icon size={21} aria-hidden="true"/><span className={styles.label}>{label}</span>
      </button>)}
      <div className={styles.secondary}>
        <div className={styles.heading}>EXPLORE TOOLS</div>
        {MORE_GROUPS.map(group => <div className={styles.desktopGroup} key={group.label}>
          <div className={styles.groupHeading}>{group.label}</div>
          {group.items.map(({label,href,Icon}) => <button type="button" key={href} className={isToolActive(pathname,href)?styles.quickActive:""} aria-current={isToolActive(pathname,href)?"page":undefined} onClick={()=>navigate(href)}>
            <Icon size={19} aria-hidden="true"/><span>{label}</span>
          </button>)}
        </div>)}
      </div>
      <button ref={moreButton} type="button" className={styles.mobileMore + (activeMore ? " "+styles.tabActive : "")} aria-expanded={moreOpen} aria-controls="learner-tools-menu" aria-haspopup="dialog" onClick={()=>setMoreOpen(value=>!value)} aria-label={moreOpen?"Close learner tools":"Open all learner tools"}>
        {moreOpen?<X size={20}/>:<Menu size={20}/>}<span>More</span>
      </button>
    </nav>
    {moreOpen && <div className={styles.mobileOverlay} id="learner-tools-menu">
      <button type="button" className={styles.scrim} aria-label="Close learner tools" tabIndex={-1} onClick={()=>setMoreOpen(false)}/>
      <section ref={sheet} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="learner-tools-title">
        <div className={styles.sheetHead}><strong id="learner-tools-title">Explore VibeSchool</strong><button ref={closeButton} type="button" aria-label="Close menu" onClick={()=>setMoreOpen(false)}><X size={22}/></button></div>
        {MORE_GROUPS.map(group => <div className={styles.sheetGroup} key={group.label}>
          <h2 className={styles.sheetGroupTitle}>{group.label}</h2>
          <div className={styles.sheetGrid}>{group.items.map(({label,href,Icon})=><button key={href} type="button" aria-current={isToolActive(pathname,href)?"page":undefined} className={isToolActive(pathname,href)?styles.sheetActive:""} onClick={()=>navigate(href)}>
            <Icon size={21} aria-hidden="true"/><span>{label}</span><ChevronRight size={14} aria-hidden="true"/>
          </button>)}</div>
        </div>)}
      </section>
    </div>}
  </>;
}
