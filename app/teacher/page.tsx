import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { TrackedLink } from "@/components/public/TrackedLink";
import styles from "@/components/public/PublicLanding.module.css";

export const metadata = {
  title: "For Teachers | VibeSchool",
  description: "Schemes, lesson planning, candidate revision and a path to grow the value of what you know — built for Kenyan teachers.",
};

const jobs = [
  { title: "I need a scheme of work", body: "Start from the curriculum, organise the term, then keep the work ready for the lesson that follows.", href: "/login?redirect=/teacher/scheme", cta: "Prepare my scheme", event: "public_teacher_scheme" as const },
  { title: "My lesson is not ready", body: "Move from your teaching plan into lesson preparation without rebuilding the same context every day.", href: "/login?redirect=/teacher/lessonplan", cta: "Prepare my lesson", event: "public_teacher_lesson" as const },
  { title: "My candidates need revision", body: "Prepare practice and assessment around the topics your learners need to strengthen.", href: "/login?redirect=/teacher/assessment", cta: "Prepare revision", event: "public_teacher_revision" as const },
  { title: "I want to earn from what I know", body: "Join the founding creator programme as we build a governed path for excellent teacher knowledge to reach more learners.", href: "/teacher/creators", cta: "Explore creator programme", event: "public_teacher_creator" as const },
];

const stages = [
  ["SAVE", "Stop rebuilding the same work", "Prepare schemes, lessons and assessments from your phone. Keep the work so tomorrow starts where today ended."],
  ["TEACH", "Connect the teaching week", "A scheme should lead naturally to the lesson, the lesson to homework and assessment, and the next lesson should retain that context."],
  ["IMPROVE", "Turn learner evidence into revision", "Use assessment and learner work to focus revision on what needs attention instead of simply giving more questions."],
  ["EARN", "Grow the value of teacher expertise", "Great explanations, questions and teaching methods should be reusable. The founding creator programme begins that journey without promising income before the marketplace is ready."],
];

const proof = [
  ["Scheme of work", "Existing Teacher OS route", "/login?redirect=/teacher/scheme", "public_teacher_scheme"],
  ["Lesson planning", "Existing Teacher OS route", "/login?redirect=/teacher/lessonplan", "public_teacher_lesson"],
  ["Assessment & revision", "Existing Teacher OS route", "/login?redirect=/teacher/assessment", "public_teacher_revision"],
  ["Teacher wallet", "Existing M-Pesa credit flow", "/login?redirect=/teacher/credits", "public_teacher_payment"],
] as const;

const whatsapp = "https://wa.me/254728232157?text=" + encodeURIComponent("Hello VibeSchool. I am a teacher interested in VibeSchool teacher access. Please help me get started.");

export default function TeacherGateway() {
  return <div className={styles.page}>
    <PublicHeader product="Teachers" />
    <main id="main-content">
      <section className={styles.hero}><div className={styles.wrap}>
        <p className={styles.eyebrow}>FOR KENYAN TEACHERS · BUILT FOR THE PHONE IN YOUR HAND</p>
        <h1>What do you need to get done today?</h1>
        <p className={styles.lead}>A scheme. Tomorrow&apos;s lesson. Candidate revision. A better way to use what you already know. Start with the job — not the software.</p>
        <div className={styles.actions}><TrackedLink className={styles.primary} event="public_teacher_scheme" href="/login?redirect=/teacher/scheme">Prepare my scheme</TrackedLink><TrackedLink className={styles.secondary} event="public_teacher_revision" href="/login?redirect=/teacher/assessment">Prepare revision</TrackedLink></div>
        <div className={styles.signals}><span>Kenyan curriculum context</span><span>Mobile-first</span><span>Connected Teacher OS</span><span>Human-led teaching</span></div>
      </div></section>

      <section className={styles.section}><div className={styles.wrap}>
        <p className={styles.eyebrow}>START WITH THE JOB</p><h2>Choose the work already waiting for you.</h2>
        <div className={styles.grid}>{jobs.map(job => <article key={job.title}><h3>{job.title}</h3><p>{job.body}</p><TrackedLink event={job.event} href={job.href}>{job.cta} →</TrackedLink></article>)}</div>
      </div></section>

      <section className={styles.sectionAlt}><div className={styles.wrap}>
        <p className={styles.eyebrow}>REAL PRODUCT PATHS</p><h2>See where each promise leads.</h2>
        <div className={styles.proofGrid}>{proof.map(([title,status,href,event]) => <div className={styles.proofCard} key={title}><small>{status}</small><h3>{title}</h3><TrackedLink className={styles.inlineLink} href={href} event={event}>Open workflow →</TrackedLink></div>)}</div>
      </div></section>

      <section className={styles.section}><div className={styles.wrap}>
        <p className={styles.eyebrow}>ONE WORKFLOW, NOT FOUR DISCONNECTED TOOLS</p><h2>Prepare it once. Let the next job remember.</h2>
        <div className={styles.steps}>{stages.map(([name,title,body],i) => <div className={styles.step} key={name}><span>{String(i+1).padStart(2,"0")} · {name}</span><strong>{title}</strong><p className={styles.muted}>{body}</p></div>)}</div>
      </div></section>

      <section className={styles.ctaBand}><div className={styles.ctaInner}><div><p className={styles.eyebrow}>READY TO USE MORE?</p><h2>Teacher payments already use the Vibe wallet.</h2><p className={styles.copy}>Sign in, choose an active teacher credit package and complete payment through the existing M-Pesa STK flow. We do not invent a special price here that the live wallet does not support.</p></div><div className={styles.actions}><TrackedLink className={styles.primary} event="public_teacher_payment" href="/login?redirect=/teacher/credits">View teacher packages & pay</TrackedLink><TrackedLink className={styles.secondary} event="public_teacher_whatsapp" href={whatsapp} external target="_blank" rel="noopener noreferrer">Ask on WhatsApp</TrackedLink></div></div></section>

      <section className={styles.section}><div className={`${styles.wrap} ${styles.two}`}><div><p className={styles.eyebrow}>THE CYBER CAN STILL PRINT IT</p><h2>Keep the thinking with you.</h2></div><div><p className={styles.copy}>You may still need a hard copy. The difference is that preparation, editing and reuse can live with you instead of beginning again each time you need a document.</p><p><strong>Prepare → save → reuse → export when available → print where convenient.</strong></p></div></div></section>

      <section className={styles.dark}><div className={`${styles.wrap} ${styles.center}`}><p className={styles.eyebrowLight}>SAVE → TEACH → IMPROVE → EARN</p><h2>Start with the work already waiting for you.</h2><p className={styles.lead}>No need to learn an education platform first. Choose the job, get to work, and let VibeSchool connect the rest over time.</p><div className={styles.actions}><TrackedLink className={styles.gold} event="public_teacher_scheme" href="/login?redirect=/teacher/scheme">Prepare my scheme</TrackedLink></div></div></section>
    </main>
    <PublicFooter />
  </div>;
}
