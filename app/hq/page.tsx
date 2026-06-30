"use client";
export const dynamic = "force-dynamic";

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import HQTwinDrawer from "@/components/hq/TwinDrawer"

const deepspace = "#0a1628"
const panel     = "#0f1d33"
const accent    = "#10b981"
const violet    = "#8b5cf6"
const amber     = "#f59e0b"
const danger    = "#ef4444"
const blue      = "#3b82f6"

type Screen = "home" | "courses" | "modules" | "topic" | "exam" | "exam-subject" | "curriculum" | "curriculum-week" | "global-mod" | "funhub" | "domains"

export default function HQPage() {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>("home")
  const [navActive, setNavActive] = useState<string>("home")
  const [twinOpen, setTwinOpen] = useState(false)

  function go(s: Screen, nav?: string) {
    setScreen(s)
    if (nav) setNavActive(nav)
    window.scrollTo(0, 0)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace("/hq/login")
  }

  const card: React.CSSProperties = {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "16px", padding: "14px",
  }
  const row: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 2px", borderBottom: "1px solid rgba(255,255,255,0.08)", cursor: "pointer",
  }
  const sec: React.CSSProperties = {
    fontSize: "10.5px", fontWeight: 700, color: "rgba(255,255,255,0.28)",
    textTransform: "uppercase", letterSpacing: "0.06em", margin: "20px 0 9px",
  }
  const pill = (color: string, bg: string): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", fontSize: "10px", fontWeight: 700,
    padding: "3px 8px", borderRadius: "999px", background: bg, color, whiteSpace: "nowrap",
  })
  const addBlock: React.CSSProperties = {
    textAlign: "center", padding: "11px", border: "1.5px dashed rgba(255,255,255,0.08)",
    borderRadius: "10px", fontSize: "11.5px", fontWeight: 700,
    color: "rgba(255,255,255,0.28)", cursor: "pointer", marginBottom: "8px",
  }
  const block: React.CSSProperties = {
    background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)",
    borderLeft: `3px solid ${accent}`, borderRadius: "10px", padding: "11px", marginBottom: "8px",
  }
  const dinput: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px", padding: "10px 12px", color: "#fff", fontSize: "13px",
    fontWeight: 600, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  }

  const Topbar = ({ title, sub, back, backLabel }: { title: string; sub?: string; back?: Screen; backLabel?: string }) => (
    <div style={{ background: "rgba(10,22,40,0.92)", backdropFilter: "blur(10px)", padding: "16px 18px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)", position: "sticky", top: 0, zIndex: 50 }}>
      {back && (
        <div onClick={() => go(back)} style={{ fontSize: "11px", color: "rgba(255,255,255,0.28)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", cursor: "pointer" }}>
          ← <span style={{ color: "rgba(255,255,255,0.45)" }}>{backLabel}</span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: "19px", fontWeight: 800, letterSpacing: "-0.2px", margin: 0 }}>{title}</h1>
          {sub && <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "12px", margin: "3px 0 0" }}>{sub}</p>}
        </div>
        {!back && (
          <button onClick={handleSignOut} style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", padding: "6px 12px", color: danger, fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
            Sign out
          </button>
        )}
      </div>
    </div>
  )

  const BottomNav = () => (
    <div style={{ position: "sticky", bottom: 0, background: "rgba(10,22,40,0.97)", backdropFilter: "blur(14px)", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", padding: "8px 4px calc(8px + env(safe-area-inset-bottom))", zIndex: 60 }}>
      {[
        { id: "home", label: "Home", icon: "🏠", s: "home" as Screen },
        { id: "courses", label: "Academy", icon: "📚", s: "courses" as Screen },
        { id: "exam", label: "Exam", icon: "🎓", s: "exam" as Screen },
        { id: "global", label: "Global", icon: "🌍", s: "global-mod" as Screen },
        { id: "domains", label: "More", icon: "🗂️", s: "domains" as Screen },
      ].map(n => (
        <div key={n.id} onClick={() => go(n.s, n.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", padding: "5px 0", cursor: "pointer", color: navActive === n.id ? accent : "rgba(255,255,255,0.28)" }}>
          <div style={{ fontSize: "18px" }}>{n.icon}</div>
          <div style={{ fontSize: "9px", fontWeight: 700 }}>{n.label}</div>
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ minHeight: "100dvh", background: deepspace, fontFamily: "'Inter', sans-serif", color: "#fff", maxWidth: "480px", margin: "0 auto", position: "relative" }}>
      <style>{`* { box-sizing: border-box; } input { font-family: inherit; } input::placeholder { color: rgba(255,255,255,0.2); }`}</style>

      {/* ── HOME ── */}
      {screen === "home" && <>
        <Topbar title="VibeSchool HQ" sub="Platform content studio" />
        <div style={{ padding: "16px 18px 100px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
            {[
              { n: "6", l: "Academy courses", color: accent },
              { n: "12", l: "Items in draft", color: amber },
              { n: "7", l: "KCSE subjects", color: violet },
              { n: "41%", l: "CBC coverage", color: blue },
            ].map((s, i) => (
              <div key={i} style={{ ...card, padding: "13px" }}>
                <div style={{ fontSize: "22px", fontWeight: 800, color: s.color }}>{s.n}</div>
                <div style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.45)", marginTop: "2px" }}>{s.l}</div>
              </div>
            ))}
          </div>

          <div style={sec as React.CSSProperties}>Studio modules</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
            {[
              { icon: "📚", title: "Academy", sub: "Courses & vocational", badge: "3 draft", badgeColor: amber, s: "courses" as Screen },
              { icon: "🎓", title: "Exam", sub: "KCSE syllabus & Qs", badge: "7 subjects", badgeColor: accent, s: "exam" as Screen },
              { icon: "📖", title: "CBC Curriculum", sub: "Teacher scheme content", badge: "41% cov.", badgeColor: amber, s: "curriculum" as Screen },
              { icon: "🌍", title: "Global", sub: "Press · Voice · Chronicles", badge: "2 flagged", badgeColor: danger, s: "global-mod" as Screen },
              { icon: "🎮", title: "FunHub", sub: "XP, vouchers, leaderboard", badge: "1,240 XP", badgeColor: violet, s: "funhub" as Screen },
              { icon: "🗂️", title: "Domains", sub: "Academy taxonomy", badge: "", badgeColor: accent, s: "domains" as Screen },
            ].map((m, i) => (
              <div key={i} onClick={() => go(m.s, m.s.split("-")[0])} style={{ ...card, cursor: "pointer", position: "relative", overflow: "hidden" }}>
                {m.badge && <div style={{ position: "absolute", top: "12px", right: "12px", fontSize: "9px", fontWeight: 800, padding: "3px 7px", borderRadius: "999px", background: `${m.badgeColor}22`, color: m.badgeColor }}>{m.badge}</div>}
                <div style={{ fontSize: "22px", marginBottom: "14px", display: "block" }}>{m.icon}</div>
                <div style={{ fontSize: "13px", fontWeight: 800 }}>{m.title}</div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", marginTop: "3px" }}>{m.sub}</div>
              </div>
            ))}
          </div>

          <div style={sec as React.CSSProperties}>Needs attention</div>
          <div style={{ ...card, cursor: "pointer", marginBottom: "8px" }} onClick={() => go("topic", "courses")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700 }}>Speed Limits &amp; Right of Way</div>
                <div style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.45)", marginTop: "3px" }}>AA Driving Course · draft 4 days</div>
              </div>
              <span style={pill(amber, `${amber}22`)}>DRAFT</span>
            </div>
          </div>
          <div style={{ ...card, cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700 }}>VibePress · 4 pending reviews</div>
                <div style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.45)", marginTop: "3px" }}>2 flagged for harassment</div>
              </div>
              <span style={pill(danger, `${danger}22`)}>2 FLAGGED</span>
            </div>
          </div>
        </div>
        <BottomNav />
      </>}

      {/* ── COURSES ── */}
      {screen === "courses" && <>
        <Topbar title="Academy" sub="6 courses across 5 domains" back="home" backLabel="HQ" />
        <div style={{ padding: "16px 18px 100px" }}>
          <div style={{ ...card, padding: "6px 12px" }}>
            {[
              { title: "Community Health Nursing", sub: "KMTC · Certificate · 32 weeks", domain: "health", status: "LIVE", sc: accent },
              { title: "AA Driving Course", sub: "NTSA theory + Model Town Board", domain: "transportation", status: "DRAFT", sc: amber },
              { title: "Pharmacy Technician", sub: "KMTC · Certificate · 2 years", domain: "health", status: "COMING SOON", sc: "rgba(255,255,255,0.45)" },
              { title: "Electrical Installations", sub: "NITA · Certificate · 18 months", domain: "trade", status: "COMING SOON", sc: "rgba(255,255,255,0.45)" },
            ].map((c, i) => (
              <div key={i} style={{ ...row, borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.08)" : "none" }} onClick={() => go("modules", "courses")}>
                <div>
                  <div style={{ fontSize: "13.5px", fontWeight: 700 }}>{c.title}</div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", marginTop: "2px" }}>{c.sub}</div>
                  <div style={{ marginTop: "5px", display: "flex", gap: "6px" }}>
                    <span style={pill("rgba(255,255,255,0.7)", "rgba(255,255,255,0.06)")}>{c.domain}</span>
                    <span style={pill(c.sc, `${c.sc}22`)}>{c.status}</span>
                  </div>
                </div>
                <span style={{ color: "rgba(255,255,255,0.28)", fontSize: "15px" }}>›</span>
              </div>
            ))}
          </div>
          <div style={{ ...addBlock, marginTop: "10px" }}>+ New course</div>
        </div>
        <BottomNav />
      </>}

      {/* ── MODULES ── */}
      {screen === "modules" && <>
        <Topbar title="AA Driving Course" sub="5 modules · domain: transportation" back="courses" backLabel="Academy" />
        <div style={{ padding: "16px 18px 100px" }}>
          <div style={{ ...card, padding: "6px 12px" }}>
            {[
              { t: "1 · Getting Licensed", s: "3 topics · 2 published" },
              { t: "2 · The Highway Code", s: "9 topics · 1 published" },
              { t: "3 · Model Town Board", s: "0 topics" },
              { t: "4 · Practical Skills Prep", s: "0 topics" },
              { t: "5 · Mock Theory Test", s: "0 questions" },
            ].map((m, i) => (
              <div key={i} style={{ ...row, borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.08)" : "none" }} onClick={() => go("topic", "courses")}>
                <div><div style={{ fontSize: "13.5px", fontWeight: 700 }}>{m.t}</div><div style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", marginTop: "2px" }}>{m.s}</div></div>
                <span style={{ color: "rgba(255,255,255,0.28)", fontSize: "15px" }}>›</span>
              </div>
            ))}
          </div>
          <div style={{ ...addBlock, marginTop: "10px" }}>+ Add module</div>
        </div>
        <BottomNav />
      </>}

      {/* ── TOPIC EDITOR ── */}
      {screen === "topic" && <>
        <Topbar title="Edit topic" back="modules" backLabel="The Highway Code" />
        <div style={{ padding: "16px 18px 100px" }}>
          <span style={{ fontSize: "10.5px", fontWeight: 700, color: "rgba(255,255,255,0.45)", display: "block", marginBottom: "5px" }}>TITLE</span>
          <input style={dinput} defaultValue="Speed Limits, Traffic Lights & Right of Way" />
          <span style={{ fontSize: "10.5px", fontWeight: 700, color: "rgba(255,255,255,0.45)", display: "block", margin: "12px 0 5px" }}>STATUS</span>
          <div style={{ display: "flex", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "4px", marginBottom: "14px" }}>
            {["Draft", "In review", "Published"].map((s, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center", padding: "8px 4px", borderRadius: "9px", fontSize: "10.5px", fontWeight: 700, cursor: "pointer", background: i === 0 ? `${amber}22` : "transparent", color: i === 0 ? amber : "rgba(255,255,255,0.28)" }}>{s}</div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "6px", overflowX: "auto", marginBottom: "12px", paddingBottom: "2px" }}>
            {["💡 Concept", "🇰🇪 Kenya Context", "📝 Practice", "⚠️ Errors"].map((t, i) => (
              <div key={i} style={{ flexShrink: 0, fontSize: "11.5px", fontWeight: 700, padding: "7px 13px", borderRadius: "999px", background: i === 0 ? accent : "rgba(255,255,255,0.03)", color: i === 0 ? "#06281c" : "rgba(255,255,255,0.45)", border: `1px solid ${i === 0 ? accent : "rgba(255,255,255,0.08)"}`, cursor: "pointer" }}>{t}</div>
            ))}
          </div>
          <div style={block}><div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>Town speed limit</div><div style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>50 km/h in towns and cities. Default unless a sign states otherwise.</div></div>
          <div style={block}><div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>Highway limits by vehicle</div><div style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>Cars 110 km/h · Pick-ups/Lorries 80 km/h · Trailers 65 km/h.</div></div>
          <div style={addBlock}>+ Add content block</div>
          <div style={{ ...sec as React.CSSProperties, color: accent }}>Practice questions (2)</div>
          <div style={block}>
            <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "8px" }}>What is the maximum town speed limit in Kenya?</div>
            {["A · 40 km/h", "B · 50 km/h ✓", "C · 60 km/h"].map((o, i) => (
              <div key={i} style={{ padding: "7px 10px", borderRadius: "8px", background: i === 1 ? `${accent}22` : "rgba(255,255,255,0.03)", border: `1px solid ${i === 1 ? accent : "rgba(255,255,255,0.08)"}`, fontSize: "12px", color: i === 1 ? accent : "rgba(255,255,255,0.45)", marginBottom: "4px" }}>{o}</div>
            ))}
          </div>
          <div style={addBlock}>+ Add question</div>
          <div style={{ display: "flex", gap: "8px", marginTop: "18px" }}>
            <div style={{ flex: 1, textAlign: "center", padding: "13px", borderRadius: "12px", fontSize: "13px", fontWeight: 700, cursor: "pointer", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>Preview</div>
            <div style={{ flex: 1, textAlign: "center", padding: "13px", borderRadius: "12px", fontSize: "13px", fontWeight: 700, cursor: "pointer", background: accent, color: "#06281c" }}>Publish</div>
          </div>
        </div>
        <BottomNav />
      </>}

      {/* ── EXAM ── */}
      {screen === "exam" && <>
        <Topbar title="Exam" sub="KCSE syllabus · 7 subjects" back="home" backLabel="HQ" />
        <div style={{ padding: "16px 18px 100px" }}>
          <div style={{ ...card, padding: "6px 12px" }}>
            {[
              { icon: "📐", title: "Mathematics", sub: "Form 1–4 · 48 topics" },
              { icon: "🧪", title: "Chemistry", sub: "Form 1–4 · 32 topics" },
              { icon: "🧬", title: "Biology", sub: "Form 1–4 · 32 topics" },
              { icon: "✏️", title: "English", sub: "Form 1–4 · 32 topics" },
              { icon: "🌍", title: "Geography", sub: "Form 1–4 · 28 topics" },
            ].map((s, i, arr) => (
              <div key={i} style={{ ...row, borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none" }} onClick={() => go("exam-subject", "exam")}>
                <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: `${blue}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>{s.icon}</div>
                  <div><div style={{ fontSize: "13.5px", fontWeight: 700 }}>{s.title}</div><div style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", marginTop: "2px" }}>{s.sub}</div></div>
                </div>
                <span style={{ color: "rgba(255,255,255,0.28)", fontSize: "15px" }}>›</span>
              </div>
            ))}
          </div>
          <div style={{ ...addBlock, marginTop: "10px" }}>+ Add subject</div>
        </div>
        <BottomNav />
      </>}

      {/* ── EXAM SUBJECT ── */}
      {screen === "exam-subject" && <>
        <Topbar title="Mathematics" sub="Syllabus topics by form" back="exam" backLabel="Exam" />
        <div style={{ padding: "16px 18px 100px" }}>
          <div style={{ display: "flex", gap: "6px", overflowX: "auto", marginBottom: "12px" }}>
            {["Form 1", "Form 2", "Form 3", "Form 4"].map((f, i) => (
              <div key={i} style={{ flexShrink: 0, fontSize: "11.5px", fontWeight: 700, padding: "7px 13px", borderRadius: "999px", background: i === 0 ? accent : "rgba(255,255,255,0.03)", color: i === 0 ? "#06281c" : "rgba(255,255,255,0.45)", border: `1px solid ${i === 0 ? accent : "rgba(255,255,255,0.08)"}`, cursor: "pointer" }}>{f}</div>
            ))}
          </div>
          <div style={card}>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "6px", marginBottom: "4px" }}>
              {["Numbers", "Fractions", "Decimals", "Squares & Roots", "Algebraic Expressions", "Linear Equations", "Commercial Arithmetic", "Coordinates", "Angles & Triangles"].map((t, i) => (
                <span key={i} style={{ fontSize: "10.5px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", padding: "5px 9px", borderRadius: "8px", color: "rgba(255,255,255,0.45)" }}>{t}</span>
              ))}
            </div>
            <div style={{ ...addBlock, marginTop: "6px" }}>+ Add topic</div>
          </div>
          <div style={sec as React.CSSProperties}>Question bank</div>
          <div style={{ ...card, textAlign: "center", padding: "22px" }}>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)" }}>No questions yet for Form 1 Mathematics</div>
            <div style={{ ...addBlock, marginTop: "10px" }}>+ Add question</div>
          </div>
        </div>
        <BottomNav />
      </>}

      {/* ── CURRICULUM ── */}
      {screen === "curriculum" && <>
        <Topbar title="CBC Curriculum" sub="Feeds teacher scheme-of-work content" back="home" backLabel="HQ" />
        <div style={{ padding: "16px 18px 100px" }}>
          <div style={{ display: "flex", gap: "6px", overflowX: "auto", marginBottom: "12px" }}>
            {["Grade 6", "Grade 7", "Grade 8"].map((g, i) => (
              <div key={i} style={{ flexShrink: 0, fontSize: "11.5px", fontWeight: 700, padding: "7px 13px", borderRadius: "999px", background: i === 0 ? accent : "rgba(255,255,255,0.03)", color: i === 0 ? "#06281c" : "rgba(255,255,255,0.45)", border: `1px solid ${i === 0 ? accent : "rgba(255,255,255,0.08)"}`, cursor: "pointer" }}>{g}</div>
            ))}
          </div>
          <div style={{ ...card, padding: "6px 12px" }}>
            {[
              { t: "Mathematics", s: "13 weeks tracked", pct: "62%", c: accent },
              { t: "English", s: "13 weeks tracked", pct: "28%", c: amber },
              { t: "Science & Technology", s: "13 weeks tracked", pct: "41%", c: violet },
              { t: "Kiswahili", s: "13 weeks tracked", pct: "19%", c: amber },
              { t: "Creative Arts", s: "8 weeks tracked", pct: "12%", c: amber },
            ].map((c, i, arr) => (
              <div key={i} style={{ ...row, borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none" }} onClick={() => go("curriculum-week", "domains")}>
                <div><div style={{ fontSize: "13.5px", fontWeight: 700 }}>{c.t}</div><div style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", marginTop: "2px" }}>{c.s}</div></div>
                <span style={pill(c.c, `${c.c}22`)}>{c.pct}</span>
              </div>
            ))}
          </div>
        </div>
        <BottomNav />
      </>}

      {/* ── CURRICULUM WEEK ── */}
      {screen === "curriculum-week" && <>
        <Topbar title="Term 1 · Week 3" sub="Substrand editor" back="curriculum" backLabel="Science & Technology" />
        <div style={{ padding: "16px 18px 100px" }}>
          <span style={{ fontSize: "10.5px", fontWeight: 700, color: "rgba(255,255,255,0.45)", display: "block", marginBottom: "5px" }}>SUBSTRAND NAME</span>
          <input style={dinput} defaultValue="Simple Machines — Levers and Pulleys" />
          <span style={{ fontSize: "10.5px", fontWeight: 700, color: "rgba(255,255,255,0.45)", display: "block", margin: "12px 0 5px" }}>STATUS</span>
          <div style={{ display: "flex", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "4px", marginBottom: "14px" }}>
            {["Pending", "Review needed", "Complete"].map((s, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center", padding: "8px 4px", borderRadius: "9px", fontSize: "10.5px", fontWeight: 700, cursor: "pointer", background: i === 0 ? `${amber}22` : "transparent", color: i === 0 ? amber : "rgba(255,255,255,0.28)" }}>{s}</div>
            ))}
          </div>
          <div style={{ ...sec as React.CSSProperties, color: accent }}>🎯 Learning outcomes</div>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "6px", marginBottom: "4px" }}>
            {["Identify classes of levers", "Explain mechanical advantage", "Relate pulleys to daily tools"].map((t, i) => (
              <span key={i} style={{ fontSize: "10.5px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", padding: "5px 9px", borderRadius: "8px", color: "rgba(255,255,255,0.45)" }}>{t}</span>
            ))}
          </div>
          <div style={sec as React.CSSProperties}>💡 Teaching tips</div>
          <div style={block}><div style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>Use a jembe handle or wheelbarrow as a live lever example — concrete, locally available.</div></div>
          <div style={sec as React.CSSProperties}>⚠️ Common mistakes</div>
          <div style={block}><div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>Confusing effort and load arms</div><div style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>Learners often swap which side is effort vs load on a class 1 lever diagram.</div></div>
          <div style={{ display: "flex", gap: "8px", marginTop: "18px" }}>
            <div style={{ flex: 1, textAlign: "center", padding: "13px", borderRadius: "12px", fontSize: "13px", fontWeight: 700, cursor: "pointer", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>Preview</div>
            <div style={{ flex: 1, textAlign: "center", padding: "13px", borderRadius: "12px", fontSize: "13px", fontWeight: 700, cursor: "pointer", background: accent, color: "#06281c" }}>Mark complete</div>
          </div>
        </div>
        <BottomNav />
      </>}

      {/* ── GLOBAL MOD ── */}
      {screen === "global-mod" && <>
        <Topbar title="Global" sub="Press · Voice · Chronicles · Vibes" back="home" backLabel="HQ" />
        <div style={{ padding: "16px 18px 100px" }}>
          <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
            {["Pending (4)", "Flagged (2)", "All"].map((t, i) => (
              <div key={i} style={{ flexShrink: 0, fontSize: "11.5px", fontWeight: 700, padding: "7px 13px", borderRadius: "999px", background: i === 0 ? accent : "rgba(255,255,255,0.03)", color: i === 0 ? "#06281c" : "rgba(255,255,255,0.45)", border: `1px solid ${i === 0 ? accent : "rgba(255,255,255,0.08)"}`, cursor: "pointer" }}>{t}</div>
            ))}
          </div>
          <div style={{ ...card, padding: "6px 10px" }}>
            {[
              { app: "VibePress", author: "by Wanjiru K.", text: '"Growing Up in Kibera: A Memoir" — long-form chapter 3, submitted for publish review.', ic: "📰", bg: `${blue}22` },
              { app: "VibeVoice", author: "by Otieno M.", text: 'Dholuo narration submitted for "The Tortoise and the Eagle" — community queue.', ic: "🎙️", bg: `${violet}22` },
              { app: "VibeChronicles", author: "by Achieng W.", text: '"A Nairobi Night Market" — short story, Grade 8, first submission.', ic: "📖", bg: `${amber}22` },
              { app: "Vibes", author: "by anonymous", text: "Reported 3× for harassment in comments — needs review.", ic: "⚡", bg: `${danger}22` },
            ].map((f, i, arr) => (
              <div key={i} style={{ padding: "12px 2px", borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "7px" }}>
                  <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: f.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", flexShrink: 0 }}>{f.ic}</div>
                  <div><div style={{ fontSize: "10px", fontWeight: 800, color: "rgba(255,255,255,0.45)", textTransform: "uppercase" as const }}>{f.app}</div><div style={{ fontSize: "11px", color: "rgba(255,255,255,0.28)" }}>{f.author}</div></div>
                </div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", lineHeight: 1.5, marginBottom: "9px" }}>{f.text}</div>
                <div style={{ display: "flex", gap: "7px" }}>
                  <div style={{ flex: 1, textAlign: "center", fontSize: "11px", fontWeight: 700, padding: "8px", borderRadius: "9px", cursor: "pointer", background: `${accent}22`, color: accent }}>Approve</div>
                  <div style={{ flex: 1, textAlign: "center", fontSize: "11px", fontWeight: 700, padding: "8px", borderRadius: "9px", cursor: "pointer", background: `${danger}22`, color: danger }}>{i === 3 ? "Remove" : "Flag"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <BottomNav />
      </>}

      {/* ── FUNHUB ── */}
      {screen === "funhub" && <>
        <Topbar title="FunHub" sub="XP rules, vouchers, leaderboard" back="home" backLabel="HQ" />
        <div style={{ padding: "16px 18px 100px" }}>
          <div style={sec as React.CSSProperties}>XP rules</div>
          <div style={{ ...card, padding: "6px 12px" }}>
            {[
              ["Complete a lesson", "+20 XP"],
              ["Pass a quiz (80%+)", "+15 XP"],
              ["7-day streak", "+50 XP"],
              ["Daily login", "+5 XP"],
              ["Math Sprint · perfect", "+30 XP"],
              ["FunHub game · complete", "+10 XP"],
            ].map(([l, v], i, arr) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 2px", borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none", fontSize: "12px" }}>
                <span>{l}</span><span style={{ fontWeight: 800, color: accent }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={sec as React.CSSProperties}>Sponsor vouchers</div>
          <div style={{ ...card, padding: "6px 12px" }}>
            {[
              { ic: "📓", name: "Exercise book bundle", meta: "42 in stock · Naivas", cost: "800 XP" },
              { ic: "🖊️", name: "Pen set", meta: "120 in stock · Indomie", cost: "300 XP" },
              { ic: "🎒", name: "School bag", meta: "6 in stock · Safaricom", cost: "5,000 XP" },
              { ic: "📱", name: "Safaricom 100 airtime", meta: "200 in stock", cost: "1,000 XP" },
            ].map((v, i, arr) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "11px 2px", borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: `${violet}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>{v.ic}</div>
                <div><div style={{ fontSize: "12.5px", fontWeight: 700 }}>{v.name}</div><div style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.45)", marginTop: "1px" }}>{v.meta}</div></div>
                <div style={{ fontSize: "12px", fontWeight: 800, color: accent, marginLeft: "auto" }}>{v.cost}</div>
              </div>
            ))}
          </div>
          <div style={{ ...addBlock, marginTop: "10px" }}>+ Add voucher</div>
        </div>
        <BottomNav />
      </>}

      {/* ── DOMAINS ── */}
      {screen === "domains" && <>
        <Topbar title="Domains" sub="Powers Academy tags, tip labels & icons" back="home" backLabel="HQ" />
        <div style={{ padding: "16px 18px 100px" }}>
          <div style={{ ...card, padding: "6px 12px" }}>
            {[
              { ic: "🏥", name: "Health", slug: "health", bg: `${accent}22` },
              { ic: "🔧", name: "Trade", slug: "trade", bg: `${amber}22` },
              { ic: "🎓", name: "Education", slug: "education", bg: `${violet}22` },
              { ic: "🚦", name: "Transportation", slug: "transportation", bg: "rgba(255,255,255,0.08)" },
              { ic: "💻", name: "Technology", slug: "technology", bg: `${blue}22` },
            ].map((d, i, arr) => (
              <div key={i} style={{ ...row, borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: d.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", marginRight: "9px", flexShrink: 0 }}>{d.ic}</div>
                  <div><div style={{ fontSize: "13px", fontWeight: 700 }}>{d.name}</div><div style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.28)", fontFamily: "monospace" }}>{d.slug}</div></div>
                </div>
                <span style={{ color: "rgba(255,255,255,0.28)", fontSize: "15px" }}>›</span>
              </div>
            ))}
          </div>
          <div style={{ ...addBlock, marginTop: "10px" }}>+ Add domain</div>
        </div>
        <BottomNav />
      </>}

      {/* ── TWIN FAB ── */}
      <button
        onClick={() => setTwinOpen(true)}
        style={{
          position: "fixed", right: "16px", bottom: "84px", zIndex: 770,
          width: "52px", height: "52px", borderRadius: "50%",
          background: "linear-gradient(135deg,#10b981,#059669)",
          border: "1.5px solid rgba(16,185,129,0.5)",
          boxShadow: "0 4px 20px rgba(16,185,129,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "22px", cursor: "pointer", color: "#fff",
        }}
        title="Open HQ Twin"
      >✦</button>

      <HQTwinDrawer open={twinOpen} onClose={() => setTwinOpen(false)} />
    </div>
  )
}
