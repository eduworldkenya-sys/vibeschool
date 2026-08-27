import Link from "next/link";

export const metadata = {
  title: "For Teachers | VibeSchool",
  description: "Prepare your teaching, strengthen revision, and grow the value of what you know — built for Kenyan teachers.",
};

const paths = [
  {
    eyebrow: "SAVE · TEACH",
    title: "Prepare my teaching",
    body: "Start with the work already waiting for you: schemes of work, lesson plans, teaching resources, homework and assessment.",
    points: ["Work from your phone", "Keep and reuse your work", "Move from scheme to lesson without starting again"],
    href: "/auth?role=teacher&next=/teacher/scheme",
    cta: "Prepare my teaching",
  },
  {
    eyebrow: "IMPROVE",
    title: "Prepare my learners",
    body: "Turn revision into a focused cycle: practise, find difficult areas, respond with targeted support, and keep moving.",
    points: ["Build revision around real topics", "Create practice and assessment", "Keep candidate preparation connected to teaching"],
    href: "/exam",
    cta: "Start revision",
  },
  {
    eyebrow: "EARN",
    title: "Earn from what I know",
    body: "Your best explanations, questions and teaching methods have value beyond one classroom. Help shape VibeSchool's teacher creator programme.",
    points: ["Bring your subject expertise", "Build reusable professional resources", "Join early without fake earning promises"],
    href: "/contact?topic=founding-teacher-creator",
    cta: "Join founding creators",
    coming: true,
  },
];

export default function TeacherGateway() {
  return (
    <main style={{ minHeight: "100vh", background: "#f7f8f5", color: "#17211b" }}>
      <header style={{ maxWidth: 1180, margin: "0 auto", padding: "22px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <Link href="/" style={{ color: "inherit", textDecoration: "none", display: "flex", alignItems: "center", gap: 10, fontWeight: 900, letterSpacing: -0.4 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: "#16865b", color: "white", display: "grid", placeItems: "center" }}>V</span>
          VibeSchool
        </Link>
        <Link href="/auth?role=teacher&next=/teacher/pulse" style={{ color: "#17211b", fontSize: 14, fontWeight: 800, textDecoration: "none" }}>Already a teacher? Continue →</Link>
      </header>

      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "64px 20px 34px" }}>
        <div style={{ maxWidth: 820 }}>
          <p style={{ margin: "0 0 16px", color: "#16865b", fontSize: 13, fontWeight: 900, letterSpacing: 1.4 }}>BUILT FOR KENYAN TEACHERS · MOBILE FIRST</p>
          <h1 style={{ margin: 0, fontSize: "clamp(42px, 7vw, 78px)", lineHeight: 0.98, letterSpacing: "-0.055em", fontWeight: 950 }}>What do you need to do today, Teacher?</h1>
          <p style={{ maxWidth: 690, margin: "26px 0 0", fontSize: "clamp(18px, 2.5vw, 23px)", lineHeight: 1.55, color: "#536159" }}>
            Don&apos;t start with software. Start with the job in front of you. Prepare your work, help your learners improve, and grow the value of what you already know.
          </p>
        </div>
      </section>

      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 20px 76px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
        {paths.map((path) => (
          <article key={path.title} style={{ background: "#fff", border: "1px solid #e2e7e2", borderRadius: 24, padding: 28, display: "flex", flexDirection: "column", minHeight: 430, boxShadow: "0 14px 40px rgba(28, 52, 38, 0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ color: "#16865b", fontSize: 12, fontWeight: 900, letterSpacing: 1.1 }}>{path.eyebrow}</span>
              {path.coming && <span style={{ background: "#edf8f2", color: "#14714e", padding: "6px 9px", borderRadius: 999, fontSize: 11, fontWeight: 800 }}>Founding programme</span>}
            </div>
            <h2 style={{ margin: "24px 0 12px", fontSize: 30, lineHeight: 1.08, letterSpacing: -1.1 }}>{path.title}</h2>
            <p style={{ margin: 0, color: "#5f6c64", lineHeight: 1.65, fontSize: 16 }}>{path.body}</p>
            <ul style={{ margin: "24px 0 28px", paddingLeft: 20, color: "#334139", lineHeight: 1.8, fontSize: 14 }}>
              {path.points.map((point) => <li key={point}>{point}</li>)}
            </ul>
            <Link href={path.href} style={{ marginTop: "auto", minHeight: 50, borderRadius: 14, background: "#17211b", color: "white", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 18px", textDecoration: "none", fontWeight: 900 }}>{path.cta} →</Link>
          </article>
        ))}
      </section>

      <section style={{ background: "#17211b", color: "white" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "68px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 42, alignItems: "center" }}>
          <div>
            <p style={{ margin: "0 0 10px", color: "#77d5ad", fontWeight: 900, fontSize: 12, letterSpacing: 1.2 }}>SAVE → TEACH → IMPROVE → EARN</p>
            <h2 style={{ margin: 0, fontSize: "clamp(30px, 5vw, 50px)", lineHeight: 1.05, letterSpacing: -1.8 }}>Your work should not disappear when the lesson ends.</h2>
          </div>
          <div style={{ color: "#cbd5ce", fontSize: 17, lineHeight: 1.7 }}>
            <p style={{ marginTop: 0 }}>Prepare it once. Keep it. Improve it. Reuse it. Let the next lesson remember where the last one stopped.</p>
            <p style={{ marginBottom: 0 }}>Need a hard copy? Prepare the thinking on VibeSchool, export when available, and print wherever works for you.</p>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 900, margin: "0 auto", padding: "78px 20px", textAlign: "center" }}>
        <p style={{ margin: "0 0 12px", color: "#16865b", fontWeight: 900, fontSize: 12, letterSpacing: 1.2 }}>START WITH TODAY</p>
        <h2 style={{ margin: "0 auto", maxWidth: 720, fontSize: "clamp(32px, 5vw, 52px)", lineHeight: 1.08, letterSpacing: -1.8 }}>Do the work you already came to do.</h2>
        <p style={{ margin: "18px auto 28px", maxWidth: 650, color: "#5f6c64", fontSize: 17, lineHeight: 1.7 }}>VibeSchool grows with your teaching instead of making you configure everything again tomorrow.</p>
        <Link href="/auth?role=teacher&next=/teacher/scheme" style={{ display: "inline-flex", minHeight: 54, alignItems: "center", justifyContent: "center", borderRadius: 15, padding: "0 24px", background: "#16865b", color: "white", textDecoration: "none", fontWeight: 900 }}>Prepare my teaching →</Link>
      </section>
    </main>
  );
}
