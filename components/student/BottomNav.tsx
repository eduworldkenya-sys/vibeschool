"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
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

function activeSection(path: string): string {
  if (path === "/student" || path === "/student/") return "Home";
  if (path.startsWith("/student/study") || path.startsWith("/student/lesson") || path.startsWith("/student/resources") || path.startsWith("/student/twin") || path.startsWith("/learn")) return "Learn";
  if (path.startsWith("/student/vibelearn/topic-practice") || path.startsWith("/student/vibelearn/practice") || path.startsWith("/student/vibelearn/recovery") || path.startsWith("/student/vibelearn/mistakes") || path.startsWith("/student/vibelearn/revision") || path.startsWith("/student/vibelearn/topic")) return "Practice";
  if (path.startsWith("/student/tasks") || path.startsWith("/student/homework") || path.startsWith("/student/exercises") || path.startsWith("/student/projects") || path.startsWith("/student/timetable")) return "Tasks";
  if (path.startsWith("/student/marks") || path.startsWith("/student/results")) return "Progress";
  // Formal examinations are not Topic Practice and must not be labelled as such.
  return "";
}

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const current = activeSection(pathname);
  const navigate = (href: string) => { setMoreOpen(false); router.push(href); };
  return <>
    <nav className={styles.nav} aria-label="Student primary navigation">
      <div className={styles.heading}>MY LEARNING</div>
      {PRIMARY.map(({label,href,Icon}) => <button key={href} type="button" className={styles.tab + (current===label ? " "+styles.tabActive:"")} aria-current={current===label?"page":undefined} onClick={()=>navigate(href)}>
        <Icon size={21} aria-hidden="true"/><span className={styles.label}>{label}</span>
      </button>)}
      <div className={styles.secondary}>
        <div className={styles.heading}>EXPLORE TOOLS</div>
        {MORE.map(({label,href,Icon}) => <button type="button" key={href} className={pathname.startsWith(href)?styles.quickActive:""} aria-current={pathname.startsWith(href)?"page":undefined} onClick={()=>navigate(href)}>
          <Icon size={19} aria-hidden="true"/><span>{label}</span>
        </button>)}
      </div>
      <button type="button" className={styles.mobileMore} aria-expanded={moreOpen} aria-controls="learner-tools-menu" onClick={()=>setMoreOpen(v=>!v)} aria-label={moreOpen?"Close learner tools":"Open all learner tools"}>
        {moreOpen?<X size={20}/>:<Menu size={20}/>}<span>More</span>
      </button>
    </nav>
    {moreOpen && <div className={styles.mobileOverlay} id="learner-tools-menu">
      <button type="button" className={styles.scrim} aria-label="Close learner tools" onClick={()=>setMoreOpen(false)}/>
      <section className={styles.sheet} aria-label="All learner tools">
        <div className={styles.sheetHead}><strong>Explore VibeSchool</strong><button type="button" aria-label="Close menu" onClick={()=>setMoreOpen(false)}><X size={22}/></button></div>
        <div className={styles.sheetGrid}>{MORE.map(({label,href,Icon})=><button key={href} type="button" onClick={()=>navigate(href)}><Icon size={21} aria-hidden="true"/><span>{label}</span><ChevronRight size={14} aria-hidden="true"/></button>)}</div>
      </section>
    </div>}
  </>;
}
