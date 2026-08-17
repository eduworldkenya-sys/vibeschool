"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Attendance = { recorded: number; present: number; percentage: number | null };
type Mastery = { subject_id: string; subject: string; mastered: number; assessed: number; total: number };
type ChildPayload = {
  child: { id: string; name: string; class_name: string; school_name: string };
  today_attendance: { id: string; status: string; date: string }[];
  attendance: Attendance;
  mastery: Mastery[];
};

const dark = "#1e1b4b";
const accent = "#10b981";
const bg = "#f0f2f5";

export default function ParentChildPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = typeof params.id === "string" ? params.id : "";
  const [data, setData] = useState<ChildPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    if (!studentId) return;
    setLoading(true); setError("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }
    const { data: payload, error: rpcError } = await supabase.rpc("get_parent_child_dashboard", { p_student_id: studentId });
    if (rpcError) {
      setError(rpcError.message.includes("not authorized") ? "You don't have access to this child." : "We couldn't load this child's dashboard.");
      setLoading(false); return;
    }
    setData(payload as ChildPayload);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [studentId]);

  if (loading) return <div style={{ padding: 20 }}><div style={skeleton} /><div style={{ ...skeleton, height: 140, marginTop: 12 }} /><div style={{ ...skeleton, height: 110, marginTop: 12 }} /></div>;
  if (error || !data) return <div style={{ ...card, textAlign: "center", marginTop: 20 }}><div style={{ fontSize: 32 }}>⚠️</div><h2 style={{ fontSize: 17, margin: "8px 0" }}>{error || "Child not found"}</h2><button onClick={() => router.push("/parent")} style={primary}>Back to Home</button></div>;

  const child = data.child;
  const today = data.today_attendance;
  const attendance = data.attendance;
  const todayStatus = today[0]?.status;
  const statusText = todayStatus === "present" ? `${child.name.split(" ")[0]} is at school today` : todayStatus === "absent" ? "Marked absent today" : todayStatus === "late" ? "Arrived late today" : "No attendance recorded yet today";
  const statusColor = todayStatus === "absent" ? "#991b1b" : todayStatus === "late" ? "#92400e" : todayStatus === "present" ? "#065f46" : "#4b5563";
  const statusBg = todayStatus === "absent" ? "#fee2e2" : todayStatus === "late" ? "#fef3c7" : todayStatus === "present" ? "#d1fae5" : "#f3f4f6";

  return (
    <div style={{ background: bg, minHeight: "100%", paddingBottom: 30 }}>
      <section style={{ ...card, background: `linear-gradient(135deg,${dark},#312e81)`, color: "#fff", border: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={avatar}>{child.name?.[0]?.toUpperCase() ?? "C"}</div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 20, fontWeight: 850 }}>{child.name}</div><div style={{ fontSize: 11, color: "rgba(255,255,255,.65)", marginTop: 3 }}>{child.class_name} · {child.school_name}</div></div>
        </div>
        <div style={{ marginTop: 14, background: "rgba(255,255,255,.1)", borderRadius: 12, padding: 11, color: "#fff" }}><div style={{ fontSize: 13, fontWeight: 800 }}>{statusText}</div><div style={{ fontSize: 10, color: "rgba(255,255,255,.62)", marginTop: 3 }}>Based on today's recorded attendance.</div></div>
      </section>

      <Section title="Attendance" subtitle="Recent recorded evidence, not an assumption." />
      <section style={card}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
          <Metric label="Last 30 days" value={attendance.percentage === null ? "Not enough data" : `${attendance.percentage}%`} />
          <Metric label="Records" value={String(attendance.recorded)} />
        </div>
        <div style={{ marginTop: 10, borderRadius: 11, padding: 10, background: statusBg, color: statusColor, fontSize: 12, fontWeight: 800 }}>{statusText}</div>
      </section>

      <Section title="Learning growth" subtitle="Only recorded learner-outcome evidence is shown here." />
      <section style={card}>
        {data.mastery.length === 0 ? <p style={muted}>No learner-outcome evidence is available yet.</p> : <div style={{ display: "grid", gap: 9 }}>{data.mastery.map(item => <div key={item.subject_id} style={row}><div><div style={{ fontSize: 13, fontWeight: 800 }}>{item.subject}</div><div style={muted}>{item.assessed} assessed · {item.total} outcomes recorded</div></div><strong style={{ color: item.assessed > 0 && item.mastered / item.assessed < 0.5 ? "#991b1b" : "#065f46" }}>{item.assessed > 0 ? `${Math.round(item.mastered / item.assessed * 100)}% mastered` : "No assessment yet"}</strong></div>)}</div>}
      </section>

      <Section title="What you can do" subtitle="Stay connected without digging through menus." />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
        <button onClick={() => router.push(`/parent/messages?studentId=${studentId}`)} style={action}>💬<span>Message school</span></button>
        <button onClick={() => router.push(`/parent/assessments?studentId=${studentId}`)} style={action}>📊<span>Learning progress</span></button>
        <button onClick={() => router.push(`/parent/report-cards?studentId=${studentId}`)} style={action}>📝<span>Report cards</span></button>
        <button onClick={() => router.push("/parent")} style={action}>←<span>Back to family</span></button>
      </div>
    </div>
  );
}

function Section({ title, subtitle }: { title: string; subtitle: string }) { return <div style={{ margin: "17px 2px 9px" }}><div style={{ fontSize: 15, fontWeight: 850 }}>{title}</div><div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{subtitle}</div></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div style={{ background: "#f8fafc", borderRadius: 11, padding: "10px" }}><div style={{ fontSize: 15, fontWeight: 850 }}>{value}</div><div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{label}</div></div>; }
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 15, marginBottom: 12, boxShadow: "0 1px 3px rgba(0,0,0,.04)" };
const avatar: React.CSSProperties = { width: 48, height: 48, borderRadius: "50%", background: "#ede9fe", color: dark, display: "grid", placeItems: "center", fontSize: 18, fontWeight: 850, flexShrink: 0 };
const primary: React.CSSProperties = { border: "none", borderRadius: 11, padding: "11px 15px", background: dark, color: "#fff", fontWeight: 800, cursor: "pointer" };
const action: React.CSSProperties = { ...card, margin: 0, textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 9, fontSize: 18 };
const row: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 12, padding: 11, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" };
const muted: React.CSSProperties = { fontSize: 11, color: "#6b7280", margin: "3px 0 0" };
const skeleton: React.CSSProperties = { height: 90, borderRadius: 16, background: "linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)", backgroundSize: "200% 100%" };
