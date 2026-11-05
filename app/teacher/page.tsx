import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { TrackedLink } from "@/components/public/TrackedLink";
import { BookOpen, CalendarDays, ClipboardCheck, ArrowRight, CheckCircle2, GraduationCap, MessageCircle, BriefcaseBusiness } from "lucide-react";
import styles from "./TeacherGateway.module.css";
import TeachingJobs from "./TeachingJobs";


export const metadata = {
  title: "For Teachers | VibeSchool",
  description: "Plan lessons, prepare schemes, assess learners and continue your work in VibeSchool Teacher OS.",
};

const tasks = [
  { title: "Lesson plan", href: "/login?redirect=/teacher/lessonplan", Icon: BookOpen },
  { title: "Scheme of work", href: "/login?redirect=/teacher/scheme", Icon: CalendarDays },
  { title: "Quiz", href: "/sandbox", Icon: ClipboardCheck },
  { title: "Revision", href: "/login?redirect=/teacher/assessment", Icon: GraduationCap },
];

const journey = ["Plan", "Teach", "Assess", "Improve"];

const whatsapp = "https://wa.me/254728232157?text=" + encodeURIComponent("Hello VibeSchool. I am a teacher interested in VibeSchool teacher access. Please help me get started.");

export default function TeacherGateway() {
  return <div className={styles.page}>
    <PublicHeader product="Teachers" />
    <main id="main-content">
      <section className={styles.hero} aria-labelledby="teacher-hero-title">
        <div className={styles.wrap}>
          <p className={styles.eyebrow}>BUILT FOR KENYAN TEACHERS</p>
          <h1 id="teacher-hero-title">Your teaching work, made easier.</h1>
          <p className={styles.intro}>Plan lessons, prepare schemes, assess learners and find teaching resources in one place.</p>
          <div className={styles.heroActions}>
            <a className={styles.primary} href="#teaching-tools">Get started <ArrowRight size={18} aria-hidden="true" /></a>
          </div>
        </div>
      </section>
      <section className={styles.section} id="teaching-tools" aria-labelledby="teaching-tools-title">
        <div className={styles.wrap}>
          <p className={styles.eyebrow}>TRY VIBESCHOOL</p>
          <h2 id="teaching-tools-title">What would you like to prepare?</h2>
          <div className={styles.taskGrid}>
            {tasks.map(({title,href,Icon}) => <a className={styles.task} href={href} key={title}>
              <span className={styles.taskIcon}><Icon size={24} aria-hidden="true"/></span>
              <strong>{title}</strong><ArrowRight size={17} aria-hidden="true"/>
            </a>)}
          </div>
          <p className={styles.demoNote}>Explore a public example or sign in to prepare and save your work.</p>
        </div>
      </section>
      <section className={styles.jobs} aria-labelledby="teacher-jobs-title">
        <div className={styles.wrap}>
          <div className={styles.jobsHeading}><h2 id="teacher-jobs-title">Teaching jobs</h2><BriefcaseBusiness size={19} aria-hidden="true"/></div>
          <TeachingJobs />
          <p className={styles.demoNote}>Only approved, current vacancies appear here.</p>
        </div>
      </section>
      <section className={styles.journey} aria-labelledby="journey-title">
        <div className={styles.wrap}>
          <h2 id="journey-title">See how your work connects</h2>
          <ol className={styles.journeyGrid}>
            {journey.map((step,index)=><li key={step}><span className={styles.number}>{index+1}</span><h3>{step}</h3></li>)}
          </ol>
          <p className={styles.journeyLead}>From curriculum planning to learner progress, your teaching work stays connected.</p>
        </div>
      </section>
      <section className={styles.workspace} aria-labelledby="workspace-title">
        <div className={styles.wrap}>
          <div className={styles.workspacePanel}>
            <div className={styles.workspaceIcon}><GraduationCap size={28} aria-hidden="true"/></div>
            <div>
              <h2 id="workspace-title">Already using VibeSchool?</h2>
              <p>Your saved lessons, classes and assessments are waiting.</p>
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
