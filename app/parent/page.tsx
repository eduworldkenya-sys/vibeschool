"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Child {
  child_id: string;
  child_name: string;
  class_name: string;
  school_name: string;
  attendance_recorded: number;
  attendance_pct: number | null;
  status: "waiting" | "insufficient_data" | "needs_attention" | "attendance_on_track";
  status_label: string;
}
interface Attention { type: string; student_id: string; title: string; detail: string }
interface DashboardPayload { children: Child[]; attention: Attention[] }

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}
function statusStyle(status: Child["status"]) {
  if (status === "needs_attention") return { bg: "#fee2e2", fg: "#991b1b", icon: "⚠️" };
  if (status === "waiting") return { bg: "#fef3c7", fg: "#92400e", icon: "⏳" };
  if (status === "insufficient_data") return { bg: "#f3f4f6", fg: "#4b5563", icon: "○" };
  return { bg: "#d1fae5", fg: "#065f46", icon: "✓" };
}

export default function ParentHomePage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("Parent");
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }
    const [{ data: profile, error: profileError }, { data, error: dashboardError }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).single(),
      supabase.rpc("get_parent_dashboard"),
    ]);
    if (profileError || dashboardError) {
      setError("We couldn't load your family dashboard. Please try again.");
      setLoading(false); return;
    }
    const name = profile?.full_name?.trim() || "Parent";
    setFirstName(name.split(/\s+/)[0] || "Parent");
    setDashboard((data ?? { children: [], attention: [] }) as DashboardPayload);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);
  if (loading) return <LoadingState />;
  if (error) return <div style={emptyCard}><div style={{ fontSize: 32 }}>⚠️</div><h2 style={title}>Your dashboard couldn't load</h2><p style={muted}>{error}</p><button onClick={() => void load()} style={primaryButton}>Try again</button></div>;

  const children = dashboard?.children ?? [];
  const attention = dashboard?.attention ?? [];

  return (
    <div style={{ paddingBottom: 24 }}>
      <header style={hero}>
        <div style={eyebrow}>{new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })}</div>
        <h1 style={{ margin: "4px 0", fontSize: 20, letterSpacing: -0.4 }}>{greeting()}, {firstName} 👋</h1>
        <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,.68)" }}>{children.length ? `${children.length} ${children.length === 1 ? "child" : "children"} connected. Here's what matters today.` : "Let's connect your family."}</p>
      </header>

      {children.length === 0 ? (
        <section style={emptyCard}>
          <div style={{ fontSize: 38 }}>👨‍👩‍👧</div><h2 style={title}>Let's connect your child</h2>
          <p style={muted}>Link an existing student with a claim code, or add your child to a class.</p>
          <div style={{ display: "grid", gap: 9, marginTop: 16 }}>
            <button onClick={() => router.push("/parent/link-child")} style={primaryButton}>🔗 Link with Claim Code</button>
            <button onClick={() => router.push("/parent/create-child")} style={secondaryButton}>+ Add Child to Class</button>
          </div>
        </section>
      ) : (
        <>
          <Section title="My children" subtitle="The quickest view of what we know about each child." />
          <div style={{ display: "grid", gap: 10 }}>
            {children.map(child => {
              const s = statusStyle(child.status);
              return <article key={child.child_id} style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <div style={avatar}>{child.child_name?.[0]?.toUpperCase() ?? "C"}</div>
                  <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontWeight: 850, fontSize: 15 }}>{child.child_name}</div><div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{child.class_name} · {child.school_name}</div></div>
                  <span style={{ background: s.bg, color: s.fg, borderRadius: 999, padding: "5px 8px", fontSize: 10, fontWeight: 800, whiteSpace: "nowrap" }}>{s.icon} {child.status_label}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                  <Metric label="Attendance · last 30 days" value={child.attendance_pct === null ? "Not enough data" : `${child.attendance_pct}%`} />
                  <Metric label="Attendance records" value={String(child.attendance_recorded)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 8, marginTop: 10 }}>
                  <button onClick={() => router.push(`/parent/child/${child.child_id}`)} style={primaryButton}>View child</button>
                  <button onClick={() => router.push(`/parent/messages?studentId=${child.child_id}`)} style={secondaryButton}>Message school</button>
                </div>
              </article>;
            })}
          </div>

          <Section title="Needs your attention" subtitle="Only evidence-backed items that need a parent response." />
          <section style={card}>
            {attention.length === 0 ? <div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 36, height: 36, borderRadius: 12, background: "#d1fae5", display: "grid", placeItems: "center" }}>✓</div><div><div style={{ fontSize: 14, fontWeight: 800, color: "#065f46" }}>Nothing needs your attention right now</div><div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>No current dashboard alert was triggered. This is not a claim that everything is known.</div></div></div> : <div style={{ display: "grid", gap: 9 }}>{attention.map(item => <button key={`${item.type}-${item.student_id}`} onClick={() => router.push(`/parent/child/${item.student_id}`)} style={attentionButton}><div style={{ fontSize: 13, fontWeight: 800 }}>{item.title}</div><div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>{item.detail}</div></button>)}</div>}
          </section>

          <Section title="What you can do" subtitle="The parent actions you are most likely to need." />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            <Action icon="💬" label="Message teacher" onClick={() => router.push("/parent/messages")} />
            <Action icon="📝" label="Report cards" onClick={() => router.push("/parent/report-cards")} />
            <Action icon="📊" label="Learning progress" onClick={() => router.push("/parent/assessments")} />
            <Action icon="👨‍👩‍👧" label="Manage children" onClick={() => router.push("/parent/students")} />
          </div>

          <Section title="More for your family" subtitle="Useful tools kept one level deeper so Home stays focused." />
          <div style={{ display: "grid", gap: 8 }}>
            <QuickLink icon="📚" label="Help my child learn" detail="Learning resources and homework" onClick={() => router.push("/parent/learn")} />
            <QuickLink icon="🎓" label="VibeLearn" detail="Guided learning experiences" onClick={() => router.push("/parent/vibe-learn")} />
            <QuickLink icon="🎮" label="FunHub" detail="Family-friendly activities" onClick={() => router.push("/parent/funhub")} />
          </div>
        </>
      )}
    </div>
  );
}

function LoadingState() { return <div><div style={hero}><Skeleton w={130} h={9} /><div style={{ marginTop: 9 }}><Skeleton w={220} h={20} /></div><div style={{ marginTop: 8 }}><Skeleton w={190} h={10} /></div></div><Skeleton h={170} radius={18} /><div style={{ marginTop: 12 }}><Skeleton h={100} radius={18} /></div></div>; }
function Skeleton({ w = "100%", h = 16, radius = 8 }: { w?: string | number; h?: number; radius?: number }) { return <div style={{ width: w, height: h, borderRadius: radius, background: "linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)", backgroundSize: "200% 100%", animation: "parentShimmer 1.4s infinite" }} />; }
function Section({ title: sectionTitle, subtitle }: { title: string; subtitle: string }) { return <div style={{ margin: "17px 2px 9px" }}><div style={{ fontSize: 15, fontWeight: 850 }}>{sectionTitle}</div><div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{subtitle}</div></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div style={{ background: "#f8fafc", borderRadius: 11, padding: "9px 10px" }}><div style={{ fontSize: 14, fontWeight: 850 }}>{value}</div><div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{label}</div></div>; }
function Action({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) { return <button onClick={onClick} style={{ ...card, cursor: "pointer", textAlign: "left", padding: 13 }}><div style={{ fontSize: 20 }}>{icon}</div><div style={{ fontSize: 12, fontWeight: 800, marginTop: 6 }}>{label}</div></button>; }
function QuickLink({ icon, label, detail, onClick }: { icon: string; label: string; detail: string; onClick: () => void }) { return <button onClick={onClick} style={{ ...card, display: "flex", alignItems: "center", gap: 11, cursor: "pointer", textAlign: "left", padding: 12 }}><div style={{ width: 38, height: 38, borderRadius: 12, background: "#eef2ff", display: "grid", placeItems: "center", fontSize: 18 }}>{icon}</div><div><div style={{ fontSize: 13, fontWeight: 800 }}>{label}</div><div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{detail}</div></div><div style={{ marginLeft: "auto", color: "#9ca3af", fontSize: 20 }}>›</div></button>; }

const hero: CSSProperties = { background: "linear-gradient(135deg,#1e1b4b 0%,#312e81 100%)", color: "#fff", borderRadius: 20, padding: 17, marginBottom: 16, boxShadow: "0 6px 24px rgba(30,27,75,.14)" };
const eyebrow: CSSProperties = { fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.5)" };
const card: CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,.04)" };
const avatar: CSSProperties = { width: 44, height: 44, borderRadius: "50%", background: "#ede9fe", color: "#1e1b4b", display: "grid", placeItems: "center", fontSize: 17, fontWeight: 850, flexShrink: 0 };
const primaryButton: CSSProperties = { border: "none", borderRadius: 11, padding: "10px 11px", background: "#1e1b4b", color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer" };
const secondaryButton: CSSProperties = { border: "1px solid #d1d5db", borderRadius: 11, padding: "10px 11px", background: "#fff", color: "#1e1b4b", fontWeight: 800, fontSize: 12, cursor: "pointer" };
const attentionButton: CSSProperties = { textAlign: "left", border: "1px solid #f3f4f6", background: "#fffbeb", borderRadius: 12, padding: 11, cursor: "pointer" };
const emptyCard: CSSProperties = { ...card, textAlign: "center", marginTop: 20 };
const title: CSSProperties = { fontSize: 17, fontWeight: 850, margin: "8px 0" };
const muted: CSSProperties = { fontSize: 13, lineHeight: 1.5, color: "#6b7280", margin: 0 };
