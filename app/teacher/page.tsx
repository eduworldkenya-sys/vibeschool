import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { TrackedLink } from "@/components/public/TrackedLink";
import { BookOpen, CalendarDays, ClipboardCheck, Users, ArrowRight, CheckCircle2, GraduationCap, MessageCircle } from "lucide-react";
import styles from "./TeacherGateway.module.css";

export const metadata = {
  title: "For Teachers | VibeSchool",
  description: "Plan lessons, prepare schemes, assess learners and continue your work in VibeSchool Teacher OS.",
};

const tasks = [
  { title: "Prepare a scheme", detail: "Organise curriculum work across the term.", href: "/login?redirect=/teacher/scheme", cta: "Open scheme", event: "public_teacher_scheme" as const, Icon: CalendarDays },
  { title: "Plan a lesson", detail: "Turn your plan into tomorrow’s classroom activities.", href: "/login?redirect=/teacher/lessonplan", cta: "Plan a lesson", event: "public_teacher_lesson" as const, Icon: BookOpen },
  { title: "Assess learners", detail: "Prepare practice and review understanding.", href: "/login?redirect=/teacher/assessment", cta: "Open assessment", event: "public_teacher_revision" as const, Icon: ClipboardCheck },
  { title: "Manage classes", detail: "Return to your learners and class records.", href: "/login?redirect=/teacher/classhub", cta: "View classes", event: "public_teacher_lesson" as const, Icon: Users },
];

const journey = [
  { title: "Plan", detail: "Start with curriculum and the scheme of work." },
  { title: "Teach", detail: "Prepare and deliver the next lesson." },
  { title: "Assess", detail: "Collect evidence of what learners understand." },
  { title: "Support", detail: "Use that evidence to decide what comes next." },
];

const whatsapp = "https://wa.me/254728232157?text=" + encodeURIComponent("Hello VibeSchool. I am a teacher interested in VibeSchool teacher access. Please help me get started.");

export default function TeacherGateway() {
  return <div className={styles.page}>
    <PublicHeader product="Teachers" />
    <main id="main-content">
      <section className={styles.hero} aria-labelledby="teacher-hero-title">
        <div className={styles.wrap}>
          <p className={styles.eyebrow}>VIBESCHOOL FOR KENYAN TEACHERS</p>
          <h1 id="teacher-hero-title">Your teaching day, <span>made simpler.</span></h1>
          <p className={styles.intro}>Prepare your lessons, organise your classes and understand what learners need next — in one connected workspace.</p>
          <div className={styles.heroActions}>
            <TrackedLink className={styles.primary} event="public_teacher_lesson" href="/login?redirect=/teacher/pulse">Open Teacher OS <ArrowRight aria-hidden="true" size={18}/></TrackedLink>
            <a className={styles.secondary} href="#teaching-tools">Explore teaching tools</a>
          </div>
          <p className={styles.note}><CheckCircle2 size={16} aria-hidden="true"/> Built around the Kenyan curriculum and real classroom work</p>
        </div>
      </section>

      <section className={styles.section} id="teaching-tools" aria-labelledby="teaching-tools-title">
        <div className={styles.wrap}>
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>YOUR NEXT ACTION</p><h2 id="teaching-tools-title">What would you like to do?</h2></div>
            <p>Choose the work in front of you. Sign in to continue in your Teacher OS workspace.</p>
          </div>
          <div className={styles.taskGrid}>
            {tasks.map(({title,detail,href,cta,event,Icon}) => <article className={styles.task} key={title}>
              <div className={styles.taskIcon}><Icon size={23} strokeWidth={1.8} aria-hidden="true"/></div>
              <h3>{title}</h3><p>{detail}</p>
              <TrackedLink event={event} href={href} aria-label={cta}>{cta} <ArrowRight size={16} aria-hidden="true"/></TrackedLink>
            </article>)}
          </div>
        </div>
      </section>

      <section className={styles.journey} id="how-it-works" aria-labelledby="journey-title">
        <div className={styles.wrap}>
          <p className={styles.eyebrow}>ONE CONNECTED TEACHING JOURNEY</p>
          <h2 id="journey-title">From preparation to progress.</h2>
          <p className={styles.journeyLead}>The tools belong to the same teaching journey, so your next action starts with the work you already did.</p>
          <ol className={styles.journeyGrid}>
            {journey.map((step,index) => <li key={step.title}>
              <span className={styles.number}>{String(index+1).padStart(2,"0")}</span>
              <h3>{step.title}</h3><p>{step.detail}</p>
            </li>)}
          </ol>
        </div>
      </section>

      <section className={styles.workspace} aria-labelledby="workspace-title">
        <div className={styles.wrap}>
          <div className={styles.workspacePanel}>
            <div className={styles.workspaceIcon}><GraduationCap size={28} aria-hidden="true"/></div>
            <div>
              <p className={styles.eyebrow}>READY TO TEACH?</p>
              <h2 id="workspace-title">Pick up where you left off.</h2>
              <p>Teacher OS is where your classes, lessons and assessments come together. Your workspace uses its own navigation after you sign in.</p>
              <div className={styles.heroActions}>
                <TrackedLink className={styles.primary} event="public_teacher_lesson" href="/login?redirect=/teacher/pulse">Continue to Teacher OS <ArrowRight size={18} aria-hidden="true"/></TrackedLink>
                <TrackedLink className={styles.support} event="public_teacher_whatsapp" href={whatsapp} external target="_blank" rel="noopener noreferrer"><MessageCircle size={18} aria-hidden="true"/> Ask for help</TrackedLink>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
    <PublicFooter />
  </div>;
}
