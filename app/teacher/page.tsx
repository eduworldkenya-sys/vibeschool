import Link from "next/link";
import { TrackedLink } from "@/components/public/TrackedLink";

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
  return (
    <main style={{ minHeight: "100vh", background: "#f7f8f5", color: "#17211b" }}>
      <header style={{ maxWidth: 1180, margin: "0 auto", padding: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <Link href="/" style={{ color: "inherit", textDecoration: "none", display: "flex", alignItems: "center", gap: 10, fontWeight: 900 }}><span style={{ width: 36, height: 36, borderRadius: 11, background: "#16865b", color: "white", display: "grid", placeItems: "center" }}>V</span>VibeSchool</Link>
        <Link href="/login?redirect=/teacher/pulse" style={{ color: "#17211b", fontSize: 14, fontWeight: 800, textDecoration: "none" }}>Continue to Teacher →</Link>
      </header>

      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "66px 20px 34px" }}>
        <div style={{ maxWidth: 900 }}>
          <p style={{ margin: "0 0 16px", color: "#16865b", fontSize: 13, fontWeight: 900, letterSpacing: 1.4 }}>FOR KENYAN TEACHERS · BUILT FOR THE PHONE IN YOUR HAND</p>
          <h1 style={{ margin: 0, fontSize: "clamp(42px, 7vw, 80px)", lineHeight: .98, letterSpacing: "-.055em", fontWeight: 950 }}>What do you need to get done today?</h1>
          <p style={{ maxWidth: 720, margin: "26px 0 0", fontSize: "clamp(18px, 2.5vw, 23px)", lineHeight: 1.55, color: "#536159" }}>A scheme. Tomorrow&apos;s lesson. Candidate revision. A better way to use what you already know. Start with the job — not the software.</p>
        </div>
      </section>

      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 20px 76px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(245px,1fr))", gap: 16 }}>
        {jobs.map((job, i) => <article key={job.title} style={{ background: i === 0 ? "#17211b" : "#fff", color: i === 0 ? "#fff" : "#17211b", border: "1px solid #e1e6e1", borderRadius: 24, padding: 26, minHeight: 310, display: "flex", flexDirection: "column", boxShadow: "0 14px 38px rgba(28,52,38,.06)" }}>
          <span style={{ width: 34, height: 34, borderRadius: 999, display: "grid", placeItems: "center", background: i === 0 ? "#16865b" : "#edf8f2", color: i === 0 ? "#fff" : "#16865b", fontWeight: 900 }}>{i + 1}</span>
          <h2 style={{ margin: "22px 0 12px", fontSize: 27, lineHeight: 1.08, letterSpacing: -.8 }}>{job.title}</h2>
          <p style={{ margin: 0, lineHeight: 1.65, color: i === 0 ? "#d5ddd8" : "#5f6c64" }}>{job.body}</p>
          <TrackedLink event={job.event} href={job.href} style={{ marginTop: "auto", paddingTop: 24, color: i === 0 ? "#7ce0b5" : "#16865b", textDecoration: "none", fontWeight: 900 }}>{job.cta} →</TrackedLink>
        </article>)}
      </section>

      <section style={{ background: "#fff", borderTop: "1px solid #e4e8e4", borderBottom: "1px solid #e4e8e4" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 20px" }}>
          <p style={{ color: "#16865b", fontWeight: 900, letterSpacing: 1.3, fontSize: 12 }}>REAL PRODUCT PATHS</p>
          <h2 style={{ maxWidth: 760, margin: "10px 0 30px", fontSize: "clamp(32px,5vw,54px)", lineHeight: 1.05, letterSpacing: -1.8 }}>See where each promise leads.</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14 }}>
            {proof.map(([title,status,href,event]) => <div key={title} style={{ border: "1px solid #e1e6e1", borderRadius: 18, padding: 20 }}><div style={{ color: "#16865b", fontSize: 11, fontWeight: 900 }}>{status}</div><h3 style={{ margin: "10px 0 16px", fontSize: 21 }}>{title}</h3><TrackedLink href={href} event={event} style={{ color: "#17211b", fontWeight: 900, textDecoration: "none" }}>Open workflow →</TrackedLink></div>)}
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 20px" }}>
        <p style={{ color: "#16865b", fontWeight: 900, letterSpacing: 1.3, fontSize: 12 }}>ONE WORKFLOW, NOT FOUR DISCONNECTED TOOLS</p>
        <h2 style={{ maxWidth: 760, margin: "10px 0 38px", fontSize: "clamp(32px,5vw,54px)", lineHeight: 1.05, letterSpacing: -1.8 }}>Prepare it once. Let the next job remember.</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 18 }}>
          {stages.map(([name,title,body], i) => <div key={name} style={{ padding: "24px 0", borderTop: "3px solid #16865b" }}><div style={{ color: "#16865b", fontSize: 12, fontWeight: 950 }}>{String(i+1).padStart(2,"0")} · {name}</div><h3 style={{ fontSize: 22, margin: "14px 0 10px" }}>{title}</h3><p style={{ color: "#5f6c64", lineHeight: 1.65, margin: 0 }}>{body}</p></div>)}
        </div>
      </section>

      <section style={{ background: "#edf8f2", borderTop: "1px solid #d7eadf", borderBottom: "1px solid #d7eadf" }}><div style={{ maxWidth: 980, margin: "0 auto", padding: "70px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 28, alignItems: "center" }}><div><p style={{ color: "#16865b", fontSize: 12, fontWeight: 900, letterSpacing: 1.2 }}>READY TO USE MORE?</p><h2 style={{ margin: "10px 0", fontSize: "clamp(32px,4.5vw,50px)", letterSpacing: -1.6, lineHeight: 1.05 }}>Teacher payments already use the Vibe wallet.</h2><p style={{ color: "#536159", lineHeight: 1.7 }}>Sign in, choose an active teacher credit package and complete payment through the existing M-Pesa STK flow. We do not invent a special price here that the live wallet does not support.</p></div><div style={{ display: "grid", gap: 12 }}><TrackedLink event="public_teacher_payment" href="/login?redirect=/teacher/credits" style={{ minHeight: 54, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 15, background: "#16865b", color: "#fff", textDecoration: "none", fontWeight: 900, padding: "0 20px" }}>View teacher packages & pay →</TrackedLink><TrackedLink event="public_teacher_whatsapp" href={whatsapp} external target="_blank" rel="noopener noreferrer" style={{ minHeight: 52, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 15, border: "1px solid #16865b", color: "#16865b", textDecoration: "none", fontWeight: 900, padding: "0 20px", background: "#fff" }}>Ask on WhatsApp →</TrackedLink></div></div></section>

      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 30 }}>
        <div><p style={{ color: "#16865b", fontSize: 12, fontWeight: 900, letterSpacing: 1.2 }}>THE CYBER CAN STILL PRINT IT</p><h2 style={{ margin: "10px 0", fontSize: "clamp(30px,4vw,46px)", letterSpacing: -1.5 }}>Keep the thinking with you.</h2></div>
        <div style={{ color: "#536159", fontSize: 17, lineHeight: 1.75 }}><p style={{ marginTop: 0 }}>You may still need a hard copy. The difference is that preparation, editing and reuse can live with you instead of beginning again each time you need a document.</p><p style={{ marginBottom: 0 }}><strong style={{ color: "#17211b" }}>Prepare → save → reuse → export when available → print where convenient.</strong></p></div>
      </section>

      <section style={{ background: "#17211b", color: "white" }}><div style={{ maxWidth: 900, margin: "0 auto", padding: "76px 20px", textAlign: "center" }}><p style={{ color: "#77d5ad", fontSize: 12, fontWeight: 900, letterSpacing: 1.2 }}>SAVE → TEACH → IMPROVE → EARN</p><h2 style={{ fontSize: "clamp(34px,5vw,56px)", lineHeight: 1.05, letterSpacing: -2, margin: "12px 0 18px" }}>Start with the work already waiting for you.</h2><p style={{ color: "#cbd5ce", fontSize: 18, lineHeight: 1.7, maxWidth: 650, margin: "0 auto 28px" }}>No need to learn an education platform first. Choose the job, get to work, and let VibeSchool connect the rest over time.</p><TrackedLink event="public_teacher_scheme" href="/login?redirect=/teacher/scheme" style={{ display: "inline-flex", minHeight: 54, alignItems: "center", justifyContent: "center", padding: "0 25px", borderRadius: 15, background: "#16865b", color: "white", textDecoration: "none", fontWeight: 900 }}>Prepare my scheme →</TrackedLink></div></section>
    </main>
  );
}
