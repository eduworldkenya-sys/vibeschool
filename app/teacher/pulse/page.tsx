"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useCredits } from "@/app/teacher/layout";
import { fetchPulseData, PulseSnapshot } from "@/lib/pulse/fetcher";
import { runRules, PriorityTask } from "@/lib/pulse/rules";
import RecentActivity, { ActivityItem } from "@/components/teacher/RecentActivity";
import LessonFlowCard from "@/components/teacher/LessonFlowCard";
import {
  fingerprint, readTwinCache, writeTwinCache,
  readSnapCache, writeSnapCache
} from "@/lib/pulse/cache";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function timeStr(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2,"0")} ${h >= 12 ? "PM" : "AM"}`;
}
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function nextStepFor(s: { lessonCount: number; covered: number; total: number }): {
  label: string; icon: string;
} {
  if (s.lessonCount === 0) return { label: "Plan your next lesson", icon: "📖" };
  if (s.total > 0 && s.covered / s.total < 0.3) return { label: "Catch up on curriculum", icon: "📋" };
  return { label: "Keep going", icon: "✓" };
}

function Skel({ h = 52, r = 12 }: { h?: number; r?: number }) {
  return (
    <div style={{
      height: h, borderRadius: r,
      background: "linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
    }} />
  );
}

function Card({ children, style = {}, onClick }: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        background: "#fff",
        borderRadius: 20,
        padding: "16px",
        marginBottom: 12,
        boxShadow: pressed
          ? "0 1px 4px rgba(0,0,0,0.08)"
          : "0 2px 16px rgba(0,0,0,0.06)",
        transform: pressed ? "scale(0.985)" : "scale(1)",
        transition: "all 0.15s ease",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Label({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 800, color: "#9ca3af",
      letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 10,
    }}>{text}</div>
  );
}

function Pressable({ children, onClick, style = {} }: {
  children: React.ReactNode;
  onClick: () => void;
  style?: React.CSSProperties;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        cursor: "pointer",
        transform: pressed ? "scale(0.96)" : "scale(1)",
        transition: "transform 0.12s ease",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function StreakBadge({ streak }: { streak: number }) {
  if (streak < 3) return null;
  const fire = streak >= 14 ? "🔥🔥" : streak >= 7 ? "🔥" : "✦";
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: streak >= 7 ? "linear-gradient(135deg,#ff6b35,#f59e0b)" : "linear-gradient(135deg,#10b981,#059669)",
      borderRadius: 20, padding: "4px 10px",
    }}>
      <span style={{ fontSize: 11 }}>{fire}</span>
      <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>{streak} day streak</span>
    </div>
  );
}

function TwinCard({
  message, aiActive, priority, upcomingWarning, onClick,
}: {
  message: string;
  aiActive: boolean;
  priority: string;
  upcomingWarning: string | null;
  onClick: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const glowColor = priority === "critical" ? "rgba(239,68,68,0.3)"
    : priority === "urgent" ? "rgba(245,158,11,0.25)"
    : "rgba(16,185,129,0.2)";
  const accentColor = priority === "critical" ? "#ef4444"
    : priority === "urgent" ? "#f59e0b"
    : "#10b981";

  return (
    <div style={{ marginBottom: 12 }}>
      <div
        onClick={onClick}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        style={{
          background: "linear-gradient(135deg,#0f172a 0%,#1e1b4b 55%,#064e3b 100%)",
          borderRadius: 20,
          padding: "16px",
          cursor: "pointer",
          boxShadow: `0 4px 24px ${glowColor}`,
          transform: pressed ? "scale(0.985)" : "scale(1)",
          transition: "all 0.15s ease",
          border: `1px solid ${accentColor}22`,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
            background: `radial-gradient(circle at 35% 35%,${accentColor}44,${accentColor}11)`,
            border: `1.5px solid ${accentColor}99`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, color: accentColor,
            animation: aiActive ? "orbPulse 1.4s ease-in-out infinite" : "none",
          }}>✦</div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 9, fontWeight: 800, color: `${accentColor}cc`,
              letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 4,
            }}>
              Your Twin {aiActive ? "· reading your day" : ""}
            </div>
            <div style={{
              fontSize: 14, fontWeight: 600, color: "#e0e7ff", lineHeight: 1.5,
              minHeight: 20,
            }}>
              {message || "Reading your day…"}
            </div>
          </div>
        </div>
      </div>
      {upcomingWarning && (
        <div style={{
          marginTop: 6, background: "#fffbeb",
          border: "1px solid #fcd34d", borderRadius: 12,
          padding: "10px 14px", fontSize: 12, fontWeight: 600,
          color: "#92400e", animation: "fadeUp 0.3s ease",
        }}>
          ⏱ {upcomingWarning}
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, sub, color, onClick }: {
  label: string; value: string; sub: string;
  color: string; onClick: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onClick={onClick}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        background: "#fff", borderRadius: 16, padding: "13px 10px",
        textAlign: "center", cursor: "pointer",
        boxShadow: pressed ? "0 1px 4px rgba(0,0,0,0.06)" : "0 2px 10px rgba(0,0,0,0.06)",
        transform: pressed ? "scale(0.95)" : "scale(1)",
        transition: "all 0.12s ease",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>{sub}</div>
    </div>
  );
}

function AttSheet({ classes, onClose, onGo }: {
  classes: { class_id: string; class_name: string }[];
  onClose: () => void;
  onGo: (id: string) => void;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999,
      display: "flex", flexDirection: "column", justifyContent: "flex-end",
    }}>
      <div onClick={onClose} style={{ flex: 1, background: "rgba(0,0,0,0.4)" }} />
      <div style={{
        background: "#fff", borderRadius: "20px 20px 0 0",
        padding: "20px 16px 32px", animation: "slideUp 0.25s ease",
      }}>
        <div style={{ width: 36, height: 4, background: "#e5e7eb", borderRadius: 2, margin: "0 auto 16px" }} />
        <div style={{ fontSize: 15, fontWeight: 800, color: "#1e1b4b", marginBottom: 14 }}>Mark Attendance</div>
        {classes.map(c => (
          <Pressable key={c.class_id} onClick={() => onGo(c.class_id)} style={{ marginBottom: 8 }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: 14, padding: "13px 14px",
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1e1b4b" }}>{c.class_name}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#ef4444" }}>Mark Now →</div>
            </div>
          </Pressable>
        ))}
      </div>
    </div>
  );
}

export default function PulsePage() {
  const router = useRouter();
  const { creditBalance } = useCredits();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState("");
  const [snap, setSnap] = useState<PulseSnapshot | null>(null);
  const [twinMsg, setTwinMsg] = useState("");
  const [twinPriority, setTwinPriority] = useState<string>("calm");
  const [twinAiActive, setTwinAiActive] = useState(false);
  const [upcomingWarning, setUpcomingWarning] = useState<string | null>(null);
  const [tasks, setTasks] = useState<PriorityTask[]>([]);
  const [attSheetOpen, setAttSheetOpen] = useState(false);

  const touchStartY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const resolveTwin = useCallback(async (data: PulseSnapshot) => {
    const result = runRules(data);
    setTwinMsg(result.message);
    setTwinPriority(result.priority);
    setUpcomingWarning(result.upcomingWarning);
    setTasks(result.tasks);
    if (result.confidence >= 70) return;

    const fp = fingerprint(data);
    const cached = readTwinCache();
    if (cached && cached.fp === fp) { setTwinMsg(cached.message); return; }

    setTwinAiActive(true);
    try {
      const res = await fetch("/api/twin/pulse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshot: data, signals: result.signals }),
      });
      const { message: aiMsg } = await res.json();
      if (aiMsg) { setTwinMsg(aiMsg); writeTwinCache(fp, aiMsg); }
    } catch {}
    setTwinAiActive(false);
  }, []);

  const boot = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else {
      const cachedSnap = readSnapCache();
      if (cachedSnap) {
        setSnap(cachedSnap);
        setLoading(false);
        const result = runRules(cachedSnap);
        setTwinMsg(result.message);
        setTwinPriority(result.priority);
        setUpcomingWarning(result.upcomingWarning);
        setTasks(result.tasks);
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [memberRes, profileRes] = await Promise.all([
      supabase.from("school_members").select("school_id").eq("profile_id", user.id).maybeSingle(),
      supabase.from("profiles").select("full_name,school_id").eq("id", user.id).single(),
    ]);

    const sid = memberRes.data?.school_id ?? profileRes.data?.school_id ?? null;
    setName((profileRes.data?.full_name ?? "").split(" ")[0] ?? "");
    if (!sid) { setLoading(false); setRefreshing(false); return; }

    const freshSnap = await fetchPulseData(user.id, sid, creditBalance);
    setSnap(freshSnap);
    writeSnapCache(freshSnap);
    setLoading(false);
    setRefreshing(false);
    await resolveTwin(freshSnap);
  }, [creditBalance, resolveTwin]);

  useEffect(() => { boot(); }, [boot]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (snap) resolveTwin(snap);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [snap, resolveTwin]);

  const onTouchStart = (e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    if (delta > 65 && (scrollRef.current?.scrollTop ?? 0) === 0 && !refreshing) boot(true);
  };

  const todayName = DAYS[new Date().getDay()];
  const dateStr = new Date().toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div
      ref={scrollRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ paddingTop: 4, paddingBottom: 24 }}
    >
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes orbPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.92)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      {refreshing && (
        <div style={{ textAlign: "center", padding: "6px 0 10px", animation: "fadeUp 0.2s ease" }}>
          <div style={{ display: "inline-block", width: 16, height: 16, border: "2px solid #10b981", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 16, animation: "fadeUp 0.2s ease" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#1e1b4b", letterSpacing: -0.5 }}>
              {greeting()}{name ? `, ${name}` : ""}.
            </div>
            <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>
              {todayName} · {dateStr}
              {snap?.termNumber != null && snap?.weekNumber != null
                ? ` · Term ${snap.termNumber}, Week ${snap.weekNumber}`
                : ""}
            </div>
            {(() => {
              if (!snap || snap.todaySlots.length === 0) return null;
              const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
              const next = snap.todaySlots.find((s: any) => {
                const [h, m] = s.start_time.split(":").map(Number);
                return h * 60 + m > nowMins;
              });
              if (!next) return null;
              const [h, m] = next.start_time.split(":").map(Number);
              const mins = h * 60 + m - nowMins;
              return (
                <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981", marginTop: 4 }}>
                  Next: {next.subject} ({next.class_name}) in {mins < 60 ? `${mins}m` : timeStr(next.start_time)}
                </div>
              );
            })()}
          </div>
          {(snap?.streak ?? 0) >= 3 && <StreakBadge streak={snap!.streak} />}
        </div>
      </div>

      {/* Twin */}
      <div style={{ animation: "fadeUp 0.25s ease" }}>
        <TwinCard
          message={twinMsg}
          aiActive={twinAiActive}
          priority={twinPriority}
          upcomingWarning={upcomingWarning}
          onClick={() => router.push("/teacher/twin")}
        />
      </div>

      {/* Priority Tasks */}
      {tasks.length > 0 && (
        <div style={{ animation: "fadeUp 0.28s ease" }}>
          <Card>
            <Label text="Priority Tasks" />
            {tasks.map((t, i) => {
              const color = t.severity === "critical" ? "#ef4444" : t.severity === "urgent" ? "#f59e0b" : "#6b7280";
              const bg = t.severity === "critical" ? "#fef2f2" : t.severity === "urgent" ? "#fffbeb" : "#f9fafb";
              return (
                <Pressable key={t.id} onClick={() => router.push(t.href)}>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "11px 0", borderBottom: i < tasks.length - 1 ? "1px solid #f3f4f6" : "none",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1e1b4b" }}>{t.label}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{t.detail}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 800, color, background: bg, borderRadius: 8, padding: "3px 8px", textTransform: "uppercase", letterSpacing: 0.5, flexShrink: 0 }}>
                      {t.severity}
                    </div>
                  </div>
                </Pressable>
              );
            })}
          </Card>
        </div>
      )}

      {/* Stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 12, animation: "fadeUp 0.3s ease" }}>
        <StatTile
          label="Credits" sub="available"
          value={creditBalance !== null ? String(creditBalance) : "…"}
          color={(creditBalance ?? 99) <= 3 ? "#ef4444" : "#10b981"}
          onClick={() => router.push("/teacher/credits")}
        />
        <StatTile
          label="At Risk" sub="students"
          value={loading && !snap ? "…" : String(snap?.atRisk.length ?? 0)}
          color={(snap?.atRisk.length ?? 0) > 0 ? "#f59e0b" : "#10b981"}
          onClick={() => router.push("/teacher/students")}
        />
        <StatTile
          label="TPAD" sub="to deadline"
          value={snap?.tpadDays != null ? `${snap.tpadDays}d` : "—"}
          color={(snap?.tpadDays ?? 999) <= 7 ? "#ef4444" : (snap?.tpadDays ?? 999) <= 14 ? "#f59e0b" : "#10b981"}
          onClick={() => router.push("/teacher/tpad")}
        />
        <StatTile
          label="Messages" sub="unread"
          value={loading && !snap ? "…" : String(snap?.unreadMessages ?? 0)}
          color={(snap?.unreadMessages ?? 0) > 0 ? "#f59e0b" : "#10b981"}
          onClick={() => router.push("/teacher/vibeconnect")}
        />
      </div>

      {/* Today's lesson flow */}
      <div style={{ animation: "fadeUp 0.32s ease" }}>
        <Label text={`Today's Flow — ${todayName}`} />
        {loading && !snap ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Skel h={72} /><Skel h={72} />
          </div>
        ) : (
          <LessonFlowCard
            slots={snap?.todaySlots ?? []}
            snap={snap!}
            onNavigate={(href) => router.push(href)}
          />
        )}
        {(snap?.attPending.length ?? 0) > 1 && (
          <Pressable onClick={() => setAttSheetOpen(true)} style={{ marginBottom: 12 }}>
            <div style={{ background: "#f0fdf9", border: "1px solid #10b981", borderRadius: 12, padding: "11px", textAlign: "center", fontSize: 13, fontWeight: 700, color: "#0d7a5f" }}>
              Mark all classes
            </div>
          </Pressable>
        )}
      </div>

      {/* Tomorrow preview */}
      {(snap?.tomorrowSlots.length ?? 0) > 0 && (
        <div style={{ animation: "fadeUp 0.36s ease" }}>
          <Card style={{ background: "#f8f7ff", border: "1px solid #e9e6ff" }}>
            <Label text="Tomorrow" />
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
              {snap!.tomorrowSlots.length} lesson{snap!.tomorrowSlots.length !== 1 ? "s" : ""}
              {(snap?.homeworkDueTomorrow.length ?? 0) > 0
                ? ` · ${snap!.homeworkDueTomorrow.length} homework due`
                : ""}
            </div>
            {snap!.tomorrowSlots.slice(0, 4).map((slot: any) => (
              <Pressable key={slot.id} onClick={() => router.push(`/teacher/classhub/${slot.class_id}`)}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #ece9ff" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1e1b4b" }}>{slot.subject}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>{slot.class_name}</div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#6d5dfc" }}>{timeStr(slot.start_time)}</div>
                </div>
              </Pressable>
            ))}
            {(snap?.homeworkDueTomorrow.length ?? 0) > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #ece9ff" }}>
                {snap!.homeworkDueTomorrow.map((h, i) => (
                  <div key={`${h.class_id}-${i}`} style={{ fontSize: 11, color: "#7c3aed", padding: "3px 0" }}>
                    📚 {h.title} ({h.subject}) due
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Curriculum coverage */}
      {(snap?.currStats.length ?? 0) > 0 && (
        <div style={{ animation: "fadeUp 0.4s ease" }}>
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <Label text="Curriculum Coverage" />
              <div style={{ fontSize: 10, color: "#9ca3af" }}>Term {Math.round(snap?.termProgressPct ?? 0)}% done</div>
            </div>
            {snap!.currStats.map(s => {
              const pct = Math.round((s.covered / s.total) * 100);
              const termPct = snap?.termProgressPct ?? 50;
              const isBehind = pct < termPct - 15;
              const barColor = pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444";
              const next = nextStepFor(s);
              return (
                <div key={s.subject} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1e1b4b" }}>
                      {s.subject}
                      {isBehind && <span style={{ fontSize: 9, fontWeight: 800, color: "#ef4444", background: "#fef2f2", borderRadius: 6, padding: "2px 6px", marginLeft: 6 }}>Behind</span>}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: barColor }}>{pct}%</div>
                  </div>
                  <div style={{ height: 7, background: "#f3f4f6", borderRadius: 4, overflow: "hidden", position: "relative" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 4, transition: "width 0.7s ease" }} />
                    <div style={{ position: "absolute", top: 0, left: `${Math.min(termPct, 99)}%`, width: 2, height: "100%", background: "#6366f1", opacity: 0.5 }} />
                  </div>
                  <Pressable onClick={() => router.push(`/teacher/lessonplan?subjectId=${s.subjectId}&classId=${s.classId}`)} style={{ marginTop: 6 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#6366f1" }}>
                      <span>{next.icon}</span><span>{next.label}</span>
                    </div>
                  </Pressable>
                </div>
              );
            })}
            <Pressable onClick={() => router.push("/teacher/scheme")}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981", marginTop: 2 }}>View full curriculum →</div>
            </Pressable>
          </Card>
        </div>
      )}

      {/* At-risk students */}
      {((snap?.atRisk.length ?? 0) > 0 || (snap?.consecutiveAbsences.length ?? 0) > 0) && (
        <div style={{ animation: "fadeUp 0.45s ease" }}>
          <Card>
            <Label text="Needs Attention" />
            {(snap?.consecutiveAbsences.length ?? 0) > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#ef4444", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>
                  Consecutive Absences
                </div>
                {snap!.consecutiveAbsences.slice(0, 3).map((s) => (
                  <Pressable key={s.studentId} onClick={() => router.push("/teacher/students")}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #f3f4f6" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1e1b4b" }}>{s.name}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#ef4444" }}>{s.days} days in a row</div>
                    </div>
                  </Pressable>
                ))}
              </div>
            )}
            {(snap?.atRisk.length ?? 0) > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#f59e0b", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>
                  Frequently Absent
                </div>
                {snap!.atRisk.map((s, i) => {
                  const count = parseInt(s.reason.match(/\d+/)?.[0] ?? "3");
                  const severity = count >= 7 ? "#ef4444" : count >= 5 ? "#f59e0b" : "#6b7280";
                  return (
                    <Pressable key={s.id} onClick={() => router.push("/teacher/students")}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: i < snap!.atRisk.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e1b4b" }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: severity, marginTop: 2, fontWeight: 600 }}>{s.reason}</div>
                        </div>
                        <div style={{ width: 9, height: 9, borderRadius: "50%", background: severity, flexShrink: 0 }} />
                      </div>
                    </Pressable>
                  );
                })}
              </div>
            )}
            <Pressable onClick={() => router.push("/teacher/students")} style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#10b981" }}>View all students →</div>
            </Pressable>
          </Card>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ animation: "fadeUp 0.5s ease" }}>
        <Card>
          <Label text="Quick Actions" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: "Lesson Plan",   icon: "✨", href: "/teacher/lessonplan",  bg: "#f0fdf4", ic: "#10b981" },
              { label: "Attendance",    icon: "📋", href: "/teacher/attendance",  bg: "#fef2f2", ic: "#ef4444" },
              { label: "Assessment",    icon: "📊", href: "/teacher/assessment",  bg: "#eff6ff", ic: "#3b82f6" },
              { label: "Scheme",        icon: "📚", href: "/teacher/scheme",      bg: "#f5f3ff", ic: "#8b5cf6" },
            ].map(a => (
              <Pressable key={a.href} onClick={() => router.push(a.href)}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, padding: "14px 12px", borderRadius: 16, background: a.bg }}>
                  <div style={{ fontSize: 22 }}>{a.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#1e1b4b", lineHeight: 1.3 }}>{a.label}</div>
                </div>
              </Pressable>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      {(snap?.recentActivity.length ?? 0) > 0 && (
        <div style={{ animation: "fadeUp 0.55s ease" }}>
          <RecentActivity
            items={(snap!.recentActivity as any[]).map((a, i): ActivityItem => ({
              id: `${a.type}-${i}-${a.timestamp}`,
              type: a.type,
              title: a.title,
              subtitle: a.subtitle,
              timestamp: relativeTime(a.timestamp),
            }))}
          />
        </div>
      )}

      {/* Attendance bottom sheet */}
      {attSheetOpen && snap && (
        <AttSheet
          classes={snap.attPending}
          onClose={() => setAttSheetOpen(false)}
          onGo={(id) => { setAttSheetOpen(false); router.push(`/teacher/attendance?classId=${id}`); }}
        />
      )}
    </div>
  );
}
