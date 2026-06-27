"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { C } from "@/components/teacher/ui";
import { useCredits } from "@/app/teacher/layout";
import { fetchPulseData, PulseSnapshot } from "@/lib/pulse/fetcher";
import { runRules } from "@/lib/pulse/rules";
import { fingerprint, readCache, writeCache } from "@/lib/pulse/cache";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function timeStr(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`;
}
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
function Skel({ h = 60, r = 14 }: { h?: number; r?: number }) {
  return <div style={{ height: h, borderRadius: r, background: "linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />;
}
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "#fff", borderRadius: 18, padding: "16px 16px", marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", ...style }}>{children}</div>;
}
function SectionLabel({ label }: { label: string }) {
  return <div style={{ fontSize: 10, fontWeight: 800, color: "#6b7280", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>{label}</div>;
}

export default function PulsePage() {
  const router = useRouter();
  const { creditBalance } = useCredits();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState("");
  const [snapshot, setSnapshot] = useState<PulseSnapshot | null>(null);
  const [twinMsg, setTwinMsg] = useState("Thinking…");
  const [twinAiActive, setTwinAiActive] = useState(false);
  const touchStartY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const resolveTwin = useCallback(async (snap: PulseSnapshot) => {
    // Step 1 — rules engine instantly
    const { message, confidence, signals } = runRules(snap);
    setTwinMsg(message);

    // Step 2 — if confidence high, done
    if (confidence >= 70) return;

    // Step 3 — check cache
    const fp = fingerprint(snap);
    const cached = readCache();
    if (cached && cached.fp === fp) {
      setTwinMsg(cached.message);
      return;
    }

    // Step 4 — call AI only if needed
    setTwinAiActive(true);
    try {
      const res = await fetch("/api/twin/pulse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshot: snap, signals }),
      });
      const { message: aiMsg } = await res.json();
      if (aiMsg) {
        setTwinMsg(aiMsg);
        writeCache(fp, aiMsg);
      }
    } catch {}
    setTwinAiActive(false);
  }, []);

  const boot = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [memberRes, profileRes] = await Promise.all([
      supabase.from("school_members").select("school_id").eq("profile_id", user.id).maybeSingle(),
      supabase.from("profiles").select("full_name,school_id").eq("id", user.id).single(),
    ]);

    const sid = memberRes.data?.school_id ?? profileRes.data?.school_id ?? null;
    setName((profileRes.data?.full_name ?? "").split(" ")[0] ?? "");
    if (!sid) { setLoading(false); setRefreshing(false); return; }

    const snap = await fetchPulseData(user.id, sid, creditBalance);
    setSnapshot(snap);
    setLoading(false);
    setRefreshing(false);
    await resolveTwin(snap);
  }, [creditBalance, resolveTwin]);

  useEffect(() => { boot(); }, [boot]);

  // Pull to refresh
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    const atTop = (scrollRef.current?.scrollTop ?? 0) === 0;
    if (delta > 60 && atTop && !refreshing) boot(true);
  };

  const todayName = DAYS[new Date().getDay()];
  const dateStr = new Date().toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });
  const snap = snapshot;

  return (
    <div
      ref={scrollRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ paddingTop: 4 }}
    >
      <style>{`
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
      `}</style>

      {refreshing && (
        <div style={{ textAlign: "center", padding: "8px 0", fontSize: 11, color: "#10b981", fontWeight: 700 }}>
          Refreshing…
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 16, animation: "fadeUp 0.25s ease" }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#1e1b4b", letterSpacing: -0.5 }}>
          {greeting()}{name ? `, ${name}` : ""}.
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{todayName} · {dateStr}</div>
      </div>

      {/* Twin card */}
      <div
        onClick={() => router.push("/teacher/twin")}
        style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e1b4b 60%,#064e3b 100%)", borderRadius: 18, padding: "14px 16px", marginBottom: 12, cursor: "pointer", animation: "fadeUp 0.3s ease", boxShadow: "0 4px 20px rgba(16,185,129,0.2)" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%,rgba(16,185,129,0.4),rgba(16,185,129,0.1))", border: "1.5px solid rgba(16,185,129,0.6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#10b981", flexShrink: 0, animation: twinAiActive ? "pulse 1.2s infinite" : "none" }}>✦</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(16,185,129,0.8)", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 3 }}>
              Your Twin {twinAiActive ? "· thinking" : ""}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#e0e7ff", lineHeight: 1.4 }}>{twinMsg}</div>
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[
          { label: "Credits", value: creditBalance !== null ? String(creditBalance) : "…", sub: "available", color: (creditBalance ?? 99) <= 3 ? "#ef4444" : "#10b981", onClick: () => router.push("/teacher/credits") },
          { label: "At Risk", value: loading ? "…" : String(snap?.atRisk.length ?? 0), sub: "students", color: (snap?.atRisk.length ?? 0) > 0 ? "#f59e0b" : "#10b981", onClick: () => router.push("/teacher/students") },
          { label: "TPAD", value: snap?.tpadDays !== null && snap?.tpadDays !== undefined ? `${snap.tpadDays}d` : "—", sub: "to deadline", color: (snap?.tpadDays ?? 999) <= 7 ? "#ef4444" : (snap?.tpadDays ?? 999) <= 14 ? "#f59e0b" : "#10b981", onClick: () => router.push("/teacher/tpad") },
        ].map(s => (
          <div key={s.label} onClick={s.onClick} style={{ background: "#fff", borderRadius: 14, padding: "12px 10px", textAlign: "center", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Attendance pending */}
      {!loading && (snap?.attPending.length ?? 0) > 0 && (
        <Card style={{ borderLeft: "3px solid #ef4444", animation: "fadeUp 0.3s ease" }}>
          <SectionLabel label="Attendance Pending" />
          {snap!.attPending.map(c => (
            <div key={c.class_id} onClick={() => router.push(`/teacher/attendance?classId=${c.class_id}`)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e1b4b" }}>{c.class_name}</div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#ef4444", background: "#fef2f2", borderRadius: 8, padding: "3px 8px" }}>Mark Now →</div>
            </div>
          ))}
        </Card>
      )}

      {/* Today's timetable */}
      <Card style={{ animation: "fadeUp 0.35s ease" }}>
        <SectionLabel label={`Today — ${todayName}`} />
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><Skel h={52} /><Skel h={52} /></div>
        ) : (snap?.todaySlots.length ?? 0) === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: "#6b7280", fontSize: 13 }}>No lessons scheduled today</div>
        ) : snap!.todaySlots.map((slot: any) => {
          const [h, m] = slot.start_time.split(":").map(Number);
          const slotMins = h * 60 + m;
          const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
          const [eh, em] = slot.end_time.split(":").map(Number);
          const endMins = eh * 60 + em;
          const isNow = slotMins <= nowMins && nowMins < endMins;
          const isPast = endMins <= nowMins;
          return (
            <div key={slot.id} onClick={() => router.push(`/teacher/classhub/${slot.class_id}`)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f3f4f6", cursor: "pointer", opacity: isPast ? 0.5 : 1 }}>
              <div style={{ width: 4, height: 44, borderRadius: 4, flexShrink: 0, background: isNow ? "#10b981" : isPast ? "#e5e7eb" : "#6366f1" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1e1b4b" }}>{slot.subject} — {slot.class_name}</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{timeStr(slot.start_time)} – {timeStr(slot.end_time)}</div>
              </div>
              {isNow && <div style={{ fontSize: 9, fontWeight: 900, color: "#10b981", background: "#f0fdf4", borderRadius: 8, padding: "3px 8px", letterSpacing: 0.5, textTransform: "uppercase" }}>Now</div>}
            </div>
          );
        })}
      </Card>

      {/* Curriculum coverage */}
      {!loading && (snap?.currStats.length ?? 0) > 0 && (
        <Card style={{ animation: "fadeUp 0.4s ease" }}>
          <SectionLabel label="Curriculum Coverage" />
          {snap!.currStats.map(s => {
            const pct = Math.round((s.covered / s.total) * 100);
            return (
              <div key={s.subject} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1e1b4b" }}>{s.subject}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444" }}>{pct}%</div>
                </div>
                <div style={{ height: 6, background: "#f3f4f6", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444", borderRadius: 4, transition: "width 0.6s ease" }} />
                </div>
              </div>
            );
          })}
          <div onClick={() => router.push("/teacher/scheme")} style={{ fontSize: 12, fontWeight: 700, color: "#10b981", marginTop: 4, cursor: "pointer" }}>View full curriculum →</div>
        </Card>
      )}

      {/* At-risk students */}
      {!loading && (snap?.atRisk.length ?? 0) > 0 && (
        <Card style={{ animation: "fadeUp 0.45s ease" }}>
          <SectionLabel label="Students Needing Attention" />
          {snap!.atRisk.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1e1b4b" }}>{s.name}</div>
                <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 1 }}>{s.reason}</div>
              </div>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />
            </div>
          ))}
          <div onClick={() => router.push("/teacher/students")} style={{ fontSize: 12, fontWeight: 700, color: "#10b981", marginTop: 8, cursor: "pointer" }}>View all students →</div>
        </Card>
      )}

      {/* Quick actions */}
      <Card style={{ animation: "fadeUp 0.5s ease" }}>
        <SectionLabel label="Quick Actions" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { label: "Generate Lesson Plan", emoji: "✨", href: "/teacher/lessonplan" },
            { label: "Take Attendance",      emoji: "📋", href: "/teacher/attendance" },
            { label: "Record Assessment",    emoji: "📊", href: "/teacher/assessment" },
            { label: "Scheme of Work",       emoji: "📚", href: "/teacher/scheme" },
          ].map(a => (
            <button key={a.href} onClick={() => router.push(a.href)} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, padding: "13px 12px", border: "none", borderRadius: 14, background: "#f8f9fa", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
              <span style={{ fontSize: 20 }}>{a.emoji}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#1e1b4b", lineHeight: 1.3 }}>{a.label}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
