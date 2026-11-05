"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, Check, ClipboardCheck, GraduationCap, House, LayoutGrid, Menu, School, Users, X } from "lucide-react";
import styles from "./TeacherExperiencePreview.module.css";

type View = "today" | "classes" | "plan" | "assess";
const views: { id: View; label: string; Icon: typeof House }[] = [
  { id: "today", label: "Today", Icon: House },
  { id: "classes", label: "Classes", Icon: Users },
  { id: "plan", label: "Plan", Icon: BookOpen },
  { id: "assess", label: "Assess", Icon: ClipboardCheck },
];

export default function TeacherExperiencePreview() {
  const [view, setView] = useState<View>("today");
  const [answer, setAnswer] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  return <div className={styles.device}>
    <div className={styles.topbar}>
      <div className={styles.logo}><GraduationCap size={20} aria-hidden="true" /></div>
      <span className={styles.brand}>VibeSchool <small>Teacher OS</small></span>
      <span className={styles.previewLabel}>INTERACTIVE PREVIEW</span>
    </div>
    <div className={styles.content} aria-live="polite">
      {view === "today" && <>
        <p className={styles.kicker}>YOUR TEACHING SPACE</p>
        <h3>Good morning, Teacher.</h3>
        <p className={styles.muted}>Your work, all in one place.</p>
        <div className={styles.lesson}>
          <div className={styles.lessonHeader}><span>EXAMPLE LESSON</span><CalendarDays size={16} aria-hidden="true"/></div>
          <strong>Grade 6 · Social Studies</strong>
          <small>Environmental Conservation</small>
          <button type="button" onClick={() => setView("plan")}>Prepare this lesson <ArrowRight size={16} aria-hidden="true"/></button>
        </div>
        <p className={styles.groupLabel}>Choose your next task</p>
        <div className={styles.quick}>
          <button type="button" onClick={() => setView("plan")}><BookOpen size={19} aria-hidden="true"/><span>Plan lesson</span></button>
          <button type="button" onClick={() => setView("assess")}><ClipboardCheck size={19} aria-hidden="true"/><span>Try a quiz</span></button>
          <button type="button" onClick={() => setView("classes")}><Users size={19} aria-hidden="true"/><span>My classes</span></button>
        </div>
      </>}
      {view === "classes" && <>
        <p className={styles.kicker}>SAMPLE CLASS</p><h3>My Classes</h3>
        <p className={styles.muted}>A simple view of the classes you teach.</p>
        <div className={styles.detailCard}><div className={styles.cardHeading}><School size={21} aria-hidden="true"/> Grade 6 Yellow</div><p>Social Studies</p><small>Example class — no learner records shown</small><button type="button" onClick={() => setView("plan")}>Plan a lesson <ArrowRight size={16} aria-hidden="true"/></button></div>
      </>}
      {view === "plan" && <>
        <p className={styles.kicker}>SAMPLE LESSON</p><h3>Plan a lesson</h3>
        <p className={styles.muted}>Grade 6 · Social Studies</p>
        <div className={styles.detailCard}><strong>Environmental Conservation</strong><p>Learning outcome: Describe ways of caring for the environment.</p>
          <ul><li>Discuss conservation in your community</li><li>Identify practical ways to help</li><li>Share ideas in small groups</li></ul>
          <button type="button" onClick={() => setReady(v => !v)}>{ready ? <Check size={16} aria-hidden="true"/> : <BookOpen size={16} aria-hidden="true"/>}{ready ? "Ready in this preview" : "Mark sample lesson ready"}</button>
        </div>
      </>}
      {view === "assess" && <>
        <p className={styles.kicker}>INSTANT MARKING DEMO</p><h3>Try a quick question</h3>
        <p className={styles.muted}>Grade 6 · Mathematics</p>
        <div className={styles.detailCard}><strong>What is ¾ of 20?</strong>
          <div className={styles.options}>
            {([["A","10"],["B","15"],["C","16"],["D","18"]] as const).map(([key,label])=><button key={key} type="button" aria-pressed={answer===key} className={answer===key?(key==="B"?styles.correct:styles.incorrect):""} onClick={()=>setAnswer(key)}><span>{key}</span>{label}{answer===key&&(key==="B"?<Check size={17} aria-hidden="true"/>:<X size={17} aria-hidden="true"/>)}</button>)}
          </div>
          {answer&&<p className={styles.feedback} role="status">{answer==="B"?"Correct — ¾ × 20 = 15.":"Try again. ¾ × 20 = 15."}</p>}
        </div>
      </>}
    </div>
    <nav className={styles.bottom} aria-label="Preview navigation">
      {views.map(({id,label,Icon})=><button key={id} type="button" aria-current={view===id?"page":undefined} className={view===id?styles.active:""} onClick={()=>setView(id)}><Icon size={20} aria-hidden="true"/><span>{label}</span></button>)}
      <Link href="/login?redirect=/teacher/pulse" aria-label="Open the real Teacher OS"><Menu size={20} aria-hidden="true"/><span>More</span></Link>
    </nav>
    <div className={styles.disclaimer}><LayoutGrid size={13} aria-hidden="true"/> Example data only · Changes stay in this preview</div>
  </div>;
}
