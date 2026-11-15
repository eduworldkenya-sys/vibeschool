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
  { label: "My Exams", href: "/student/vibelearn/exams", Icon: ClipboardCheck, group: "Practice & exams" },
  { label: "My Mistakes", href: "/student/vibelearn/mistakes", Icon: Eraser, group: "Practice & exams" },
  { label: "Revision", href: "/student/vibelearn/revision", Icon: BrainCircuit, group: "Practice & exams" },
  { label: "My Tutors", href: "/student/tutoring", Icon: UsersRound, group: "Planning & tuition" },
  { label: "Practice Sets", href: "/student/vibelearn/practice", Icon: BookOpenCheck, group: "Practice & exams" },
  { label: "Books & Stories", href: "/learn/stories", Icon: LibraryBig, group: "Reading & study" },
  { label: "Offline Books", href: "/offline/books", Icon: BookOpenCheck, group: "Reading & study" },
  { label: "My Workspace", href: "/student/workspace", Icon: NotebookPen, group: "Reading & study" },
  { label: "My Day", href: "/student/timetable", Icon: CalendarDays, group: "Planning & tuition" },
  { label: "Profile", href: "/student/profile", Icon: UserRound, group: "My account" },
  { label: "Settings", href: "/student/settings", Icon: Settings, group: "My account" },
] as const;

// One list owns every destination; groups organise More without creating routes.
const MORE_GROUPS = [
  { label: "Practice & exams", items: MORE.filter(item => item.group === "Practice & exams") },
  { label: "Reading & study", items: MORE.filter(item => item.group === "Reading & study") },
  { label: "Planning & tuition", items: MORE.filter(item => item.group === "Planning & tuition") },
  { label: "My account", items: MORE.filter(item => item.group === "My account") },
] as const;

const COLLEGE_DESTINATIONS = {
  Home: "/student/college",
  Learn: "/learn/kasneb-cpa",
  Practice: "/learn/kasneb-cpa?view=practice",
  Tasks: "/student/college/tasks",
  Progress: "/learn/kasneb-cpa?view=progress",
} as const;
const COLLEGE_PRIMARY = PRIMARY.map(tab => ({ ...tab, href: COLLEGE_DESTINATIONS[tab.label] }));

const COLLEGE_MORE = [{ label: "College", items: [
  { label: "CPA paper selection", href: "/student/college", Icon: GraduationCap },
  { label: "Profile", href: "/student/college/profile", Icon: UserRound },
] }] as const;

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

export default function BottomNav({ collegeView }: { collegeView?: "Learn" | "Practice" | "Progress" } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const college = Boolean(collegeView) || pathname === "/student/college" || pathname.startsWith("/student/college/");
  const current = college ? collegeView ?? (pathname === "/student/college" ? "Home" : pathname === "/student/college/tasks" ? "Tasks" : "") : activeSection(pathname);
  const groupList = college ? COLLEGE_MORE : MORE_GROUPS;
  const activeMore = (college ? COLLEGE_MORE[0].items.filter(item => item.href !== "/student/college") : MORE).some(({ href }) => isToolActive(pathname, href));

  const navigate = (href: string) => {
    setMoreOpen(false);
    if (href === "/offline/books") { window.location.assign(href); return; }
    router.push(href);
  };

  // Route changes, Escape, scroll lock and keyboard focus are shared across mobile routes.
  useEffect(() => { setMoreOpen(false); }, [pathname]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width:1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setMoreOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  useEffect(() => {
    if (!moreOpen) return;
    const trigger = moreButton.current;
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
      else trigger?.focus();
    };
  }, [moreOpen]);

  return <>
    <nav className={styles.nav} aria-label="Student primary navigation">
      <div className={styles.heading}>MY LEARNING</div>
      {(college ? COLLEGE_PRIMARY : PRIMARY).map(({label,href,Icon}) => <button key={href} type="button" className={styles.tab + (current===label ? " "+styles.tabActive:"")} aria-current={current===label?"page":undefined} onClick={()=>navigate(href)}>
        <Icon size={21} aria-hidden="true"/><span className={styles.label}>{label}</span>
      </button>)}
      <div className={styles.secondary}>
        <div className={styles.heading}>EXPLORE TOOLS</div>
        {groupList.map(group => <div className={styles.desktopGroup} key={group.label}>
          <div className={styles.groupHeading}>{group.label}</div>
          {group.items.map(({label,href,Icon}) => <button type="button" key={href} className={(href===pathname || (href!=="/student/college" && isToolActive(pathname,href)))?styles.quickActive:""} aria-current={(href===pathname || (href!=="/student/college" && isToolActive(pathname,href)))?"page":undefined} onClick={()=>navigate(href)}>
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
        {groupList.map(group => <div className={styles.sheetGroup} key={group.label}>
          <h2 className={styles.sheetGroupTitle}>{group.label}</h2>
          <div className={styles.sheetGrid}>{group.items.map(({label,href,Icon})=><button key={href} type="button" aria-current={(href===pathname || (href!=="/student/college" && isToolActive(pathname,href)))?"page":undefined} className={(href===pathname || (href!=="/student/college" && isToolActive(pathname,href)))?styles.sheetActive:""} onClick={()=>navigate(href)}>
            <Icon size={21} aria-hidden="true"/><span>{label}</span><ChevronRight size={14} aria-hidden="true"/>
          </button>)}</div>
        </div>)}
      </section>
    </div>}
  </>;
}
