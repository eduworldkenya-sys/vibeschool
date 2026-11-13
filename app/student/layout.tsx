"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import BottomNav from "@/components/student/BottomNav";
import StudentPlannerReminders from "@/components/student/StudentPlannerReminders";
import OfflineBar from "@/components/student/OfflineBar";
import TwinWorkspaceProvider from "@/components/student/VibeTwin/TwinWorkspaceProvider";
import { ToastContext, ThemeContext } from "@/components/student/StudentUiContext";
import { FeedbackSoundToggle } from "@/components/student/LearningFeedback";
import { StudentProvider, useStudent } from "@/lib/student-context";
import { readTheme, writeTheme, resolveTheme, StudentTheme } from "@/lib/student-theme";
import { DEFAULT_LEARNER_APPEARANCE, LEARNER_APPEARANCE_EVENT, readLearnerAppearance, saveLearnerAppearance, readLearnerWallpaperPhoto, learnerWallpaperBackground, resolvedLearnerDisplayMode, isSocialDestination, learnerAppearanceStyle, type LearnerStudyMode } from "@/lib/student-appearance";
import { useToast } from "@/components/student/StudentUiContext";

function TopBar({ name, className, schoolName, focused = false, studyMode, onModeToggle }: { name: string; className: string; schoolName: string; focused?: boolean; studyMode:LearnerStudyMode; onModeToggle:()=>void }) {
  const router   = useRouter();
  const pathname = usePathname();
  const isRoot   = pathname === "/student" || pathname === "/student/";
  const initials = name.trim().split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("") || "S";

  return (
    <div style={{
      background:     "var(--vs-surface)",
      color:          "var(--vs-text)",
      borderBottom:   "1px solid var(--vs-border)",
      padding:        "0 20px",
      height:         56,
      display:        "flex",
      alignItems:     "center",
      justifyContent: "space-between",
      position:       "sticky",
      top:            0,
      zIndex:         600,
      boxShadow:      "0 3px 14px rgba(22,109,73,0.05)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {!isRoot && (
          <button type="button" aria-label="Go back" onClick={() => router.back()}
            style={{ cursor: "pointer", fontSize: 22, color: "var(--vs-accent)", lineHeight: 1, minWidth: 44, minHeight: 44, border: "none", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
            ‹
          </button>
        )}
        <button type="button" aria-label="Open Student Home" onClick={() => router.push("/student")}
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left", border: "none", background: "transparent", color: "inherit", padding: 0 }}
        >
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: "var(--vs-accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 900, color: "var(--vs-on-accent)",
          }}>
            V
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.3 }}>VibeSchool</div>
            <div style={{ fontSize: 10, color: "var(--vs-muted)", marginTop: -1 }}>
              {schoolName || className || "Student"}
            </div>
          </div>
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {!focused && <button type="button" aria-label={studyMode==='normal'?'Turn on Focus Mode':'Exit study mode'}
          onClick={onModeToggle} style={{border:'1px solid var(--vs-border)',borderRadius:11,minHeight:40,
          padding:'7px 10px',fontSize:11,fontWeight:800,cursor:'pointer',
          background:studyMode==='normal'?'var(--vs-card)':'var(--vs-accent-soft)',color:'var(--vs-accent)'}}>
          {studyMode==='normal'?'Focus':studyMode==='reading'?'Reading on':'Focus on'}
        </button>}
        {studyMode==='normal' && <FeedbackSoundToggle />}
        {!focused && studyMode==='normal' && <button type="button" aria-label="Open notifications" onClick={() => router.push("/student/notifications")}
          style={{ cursor: "pointer", color: "var(--vs-accent)", border: "none", background: "transparent", display: "flex", alignItems: "center", minWidth: 44, minHeight: 44, justifyContent: "center" }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </button>}

        {!focused && <button type="button" aria-label="Open learner profile"
          onClick={() => router.push("/student/profile")}
          style={{
            width: 44, height: 44, borderRadius: "50%", border: "none",
            background: "var(--vs-accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 800, color: "var(--vs-on-accent)", cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {initials}
        </button>}
      </div>
    </div>
  );
}

function Toast({ msg }: { msg: string }) {
  return (
    <div role="status" aria-live="polite" style={{
      position:   "fixed",
      bottom:     140,
      left:       "50%",
      transform:  "translateX(-50%)",
      background: "#1C1A2E",
      color:      "#fff",
      padding:    "11px 22px",
      borderRadius: 12,
      fontSize:   13,
      fontWeight: 600,
      zIndex:     9999,
      animation:  "fadeIn 0.2s ease",
      boxShadow:  "0 8px 24px rgba(0,0,0,0.18)",
      maxWidth: "calc(100vw - 32px)",
      overflowWrap: "anywhere",
    }}>
      {msg}
    </div>
  );
}

function StudentShell({ children }: { children: React.ReactNode }) {
  const { identity, loading, error, retry } = useStudent();
  const pathname = usePathname();
  const focusedAssessment = /^\/student\/assessment\/[^/]+\/?$/.test(pathname);
  const showToast=useToast().showToast;
  const [appearance,setAppearance] = useState(DEFAULT_LEARNER_APPEARANCE);
  const [wallpaperPhoto,setWallpaperPhoto]=useState<string|null>(null);
  const [systemDark,setSystemDark]=useState(false);
  useEffect(()=>{
    const media=window.matchMedia('(prefers-color-scheme: dark)');
    const update=()=>setSystemDark(media.matches);
    update();media.addEventListener('change',update);
    return()=>media.removeEventListener('change',update);
  },[]);
  useEffect(()=>{
    const studentId=identity?.studentId;
    if (!studentId) {setAppearance(DEFAULT_LEARNER_APPEARANCE);setWallpaperPhoto(null);return;}
    const refresh=()=>{
      setAppearance(readLearnerAppearance(studentId));
      setWallpaperPhoto(readLearnerWallpaperPhoto(studentId));
    };
    refresh();
    window.addEventListener(LEARNER_APPEARANCE_EVENT,refresh);
    return ()=>window.removeEventListener(LEARNER_APPEARANCE_EVENT,refresh);
  },[identity?.studentId]);
  const studyMode=focusedAssessment?'normal':appearance.studyMode;
  const resolvedMode=resolvedLearnerDisplayMode(appearance.displayMode,systemDark);
  const showWallpaper=studyMode!=='reading' && appearance.wallpaperPlacement==='home-workspace' &&
    (pathname==='/student'||pathname==='/student/'||pathname==='/student/workspace');
  function toggleFocus(){
    if(!identity?.studentId)return;
    const next={...appearance,studyMode:appearance.studyMode==='normal'?'focus' as const:'normal' as const};
    if(!saveLearnerAppearance(identity.studentId,next)){showToast('Focus setting could not be saved on this device.');return;}
    setAppearance(next);
  }
  function guardSocialLinks(event:React.MouseEvent<HTMLDivElement>){
    if(studyMode==='normal'||!appearance.pauseSocialLinks)return;
    const target=event.target;
    const anchor=target instanceof Element?target.closest('a[href]'):null;
    if(!anchor)return;
    const href=(anchor as HTMLAnchorElement).href;
    if(isSocialDestination(href)){
      event.preventDefault();event.stopPropagation();
      showToast('Social links are paused during study mode. Turn off Focus to open them.');
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--vs-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid var(--vs-border)", borderTop: "3px solid var(--vs-accent)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--vs-bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24 }}>
        <div style={{ fontSize: 14, color: "var(--vs-error)", textAlign: "center" }}>{error}</div>
        <button
          onClick={retry}
          style={{ padding: "10px 24px", background: "var(--vs-accent)", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="student-app" onClickCapture={guardSocialLinks}
      data-study-mode={studyMode}
      data-learner-font={appearance.font}
      data-learner-italics={appearance.italicHeadings ? "true" : "false"}
      data-learner-compact={appearance.compact ? "true" : "false"}
      data-reduce-motion={appearance.reduceMotion ? "true" : "false"}
      style={{ minHeight: '100dvh', background: 'var(--vs-bg)', color: 'var(--vs-text)', ...learnerAppearanceStyle(appearance,systemDark) }}>
      <TopBar
        name={identity?.name ?? ""}
        className={identity?.className ?? ""}
        schoolName={identity?.schoolName ?? ""}
        focused={focusedAssessment}
        studyMode={studyMode}
        onModeToggle={toggleFocus}
      />
      <OfflineBar />
      {!focusedAssessment&&studyMode!=='normal'&&<div role="status" style={{display:'flex',gap:10,
        alignItems:'center',justifyContent:'space-between',padding:'10px clamp(12px,3vw,24px)',
        borderBottom:'1px solid var(--vs-border)',background:'var(--vs-accent-soft)',color:'var(--vs-text)'}}>
        <div style={{fontSize:12}}><strong>{studyMode==='reading'?'Reading Mode':'Focus Mode'} is on.</strong>{' '}
          {studyMode==='reading'?'Comfortable text and a quiet study space.':'In-app interruptions and social links are paused.'}</div>
        <button type="button" onClick={toggleFocus} style={{border:'1px solid var(--vs-border)',borderRadius:10,
          minHeight:40,padding:'7px 12px',background:'var(--vs-card)',color:'var(--vs-accent)',fontWeight:800,cursor:'pointer'}}>Exit</button>
      </div>}
      <main className={focusedAssessment ? "student-content assessment-focus" : "student-content"} style={{
        width: "100%",
        minWidth: 0,
        maxWidth:      focusedAssessment ? 960 : 1120,
        margin:        "0 auto",
        padding:       "clamp(12px, 3vw, 20px) clamp(12px, 4vw, 20px) 0",
        paddingBottom: focusedAssessment ? 24 : 160,
        minHeight:     "calc(100dvh - 120px)",
        ...(showWallpaper?learnerWallpaperBackground(appearance.wallpaper,wallpaperPhoto,resolvedMode):{}),
      }}>
        {children}
      </main>
      {!focusedAssessment && <StudentPlannerReminders quiet={studyMode!=='normal'||!appearance.remindersEnabled} />}
      {!focusedAssessment && <BottomNav />}
    </div>
  );
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<string | null>(null);
  const [theme, setThemeState] = useState<StudentTheme>("light");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const storedTheme = readTheme();
    setThemeState(storedTheme);
    setResolved(resolveTheme(storedTheme));
  }, []);

  const setTheme = useCallback((t: StudentTheme) => {
    writeTheme(t);
    setThemeState(t);
    setResolved(resolveTheme(t));
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      <ThemeContext.Provider value={{ theme, setTheme }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700;800&family=Nunito+Sans:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Plus Jakarta Sans', sans-serif; -webkit-overflow-scrolling: touch; }

          :root {
            --vs-bg:          ${resolved === "dark" ? "#101d16" : "#f5f8f6"};
            --vs-surface:     ${resolved === "dark" ? "#1b2c21" : "#ffffff"};
            --vs-border:      ${resolved === "dark" ? "#355542" : "#dce9de"};
            --vs-text:        ${resolved === "dark" ? "#ebf6ee" : "#1b4030"};
            --vs-muted:       ${resolved === "dark" ? "#b1cfba" : "#597563"};
            --vs-accent:      ${resolved === "dark" ? "#79dbaa" : "#166d49"};
            --vs-accent-soft: ${resolved === "dark" ? "#254332" : "#eef7f0"};
            --vs-success:     ${resolved === "dark" ? "#79dbaa" : "#168153"};
            --vs-warning:     ${resolved === "dark" ? "#fbbf74" : "#a45a11"};
            --vs-error:       ${resolved === "dark" ? "#ff9c9c" : "#b93434"};
            --vs-card:        ${resolved === "dark" ? "#1b2c21" : "#ffffff"};
            --vs-soft:        ${resolved === "dark" ? "#213629" : "#f9fcf9"};
            --vs-on-accent:   ${resolved === "dark" ? "#101d16" : "#ffffff"};
            --vs-nav-bg:      ${resolved === "dark" ? "#1b2c21" : "#ffffff"};
            --vs-nav-border:  ${resolved === "dark" ? "#355542" : "#dce9de"};
          }

          body { background: var(--vs-bg); color: var(--vs-text); }
          .student-app { width:100%; min-width:0; overflow-x:clip; }
          .student-content { min-width:0; }
          .student-app :where(button,a,input,select,textarea):focus-visible { outline:3px solid var(--vs-accent);outline-offset:3px; }
          .student-app :where(button,input,select,textarea) { font-family:inherit; }
          .student-content img, .student-content video, .student-content iframe { max-width:100%; height:auto; }
          .student-content :where(h1,h2,h3,p,span,strong) { overflow-wrap:break-word; }
          .student-home { min-width:0; }
          .student-home button, .student-app nav button { touch-action:manipulation; }
          .student-app[data-learner-font="editorial"] :where(h1,h2,h3) { font-family:Georgia,Cambria,serif !important; }
          .student-app[data-learner-font="rounded"] :where(h1,h2,h3) { font-family:'Nunito Sans','Trebuchet MS',sans-serif !important; }
          .student-app[data-learner-italics="true"] .student-home-hero h2 { font-style:italic; }
          .student-app[data-learner-compact="true"] .student-home-quick-grid button { min-height:68px; }
          .student-app[data-study-mode="reading"] .student-content:not(.assessment-focus) :where(p,li) { line-height:1.9; letter-spacing:.008em; }
          .student-app[data-study-mode="reading"] .student-content:not(.assessment-focus) :where(article p,section p) { max-width:74ch; }
          .student-app[data-study-mode="reading"] .student-content:not(.assessment-focus) :where(h1,h2,h3) { line-height:1.35; }
          .student-app[data-study-mode="reading"] .student-content:not(.assessment-focus) { background-image:none !important; }
          .student-app[data-study-mode="reading"] .student-content:not(.assessment-focus) :where(article,section) { scroll-margin-top:80px; }

          .student-app[data-reduce-motion="true"] *, .student-app[data-reduce-motion="true"] *::before { animation:none !important; transition:none !important; }
          @media(min-width:1024px) {
            .student-app .student-content:not(.assessment-focus) {
              margin:0 0 0 208px !important;
              width:calc(100% - 208px) !important;
              max-width:none !important;
              padding:24px clamp(20px,3.2vw,42px) 65px !important;
            }
          }

          @media(max-width:480px) {
            .student-home .student-home-hero-row { flex-wrap:wrap; }
            .student-home .student-home-goals { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
            .student-home .student-home-pulse { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
            .student-home .student-home-hero { padding:16px !important; }
            .student-home .student-home-hero h1 { font-size:clamp(19px,5.5vw,23px) !important; }
            .student-home .student-home-change { flex-wrap:wrap; }
          }
          @media(min-width:768px) {
            .student-content:not(.assessment-focus) { padding-bottom:110px !important; }
          }
          @media(prefers-reduced-motion:reduce) {
            .student-home { animation:none !important; }
          }

          @keyframes slideIn  { from{ opacity:0; transform:translateY(10px) } to{ opacity:1; transform:translateY(0) } }
          @keyframes fadeIn   { from{ opacity:0 } to{ opacity:1 } }
          @keyframes shimmer  { 0%{ background-position:200% 0 } 100%{ background-position:-200% 0 } }
          @keyframes spin     { to{ transform:rotate(360deg) } }

          ::-webkit-scrollbar { width: 5px; }
          ::-webkit-scrollbar-thumb { background: var(--vs-border); border-radius: 10px; }
        `}</style>

        <div style={{ minHeight: "100dvh", background: "var(--vs-bg)" }}>
          <StudentProvider>
            <TwinWorkspaceProvider>
              <StudentShell>
                {children}
              </StudentShell>
            </TwinWorkspaceProvider>
          </StudentProvider>
          {toast && <Toast msg={toast} />}
        </div>
      </ThemeContext.Provider>
    </ToastContext.Provider>
  );
}