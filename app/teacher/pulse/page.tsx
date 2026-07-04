"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchPulseData } from "@/lib/pulse/fetcher";
import type { PulseSnapshot, ActivityLog, PriorityTask, ActivityItem } from "@/lib/types";
import { runRules } from "@/lib/pulse/rules";
import {
  fingerprint,
  readGuideCache,
  readSnapCache,
  writeGuideCache,
  writeSnapCache,
} from "@/lib/pulse/cache";
import LessonFlowCard from "@/components/teacher/LessonFlowCard";
import NextTeachingAction from "@/components/teacher/NextTeachingAction";
import RecentActivity from "@/components/teacher/RecentActivity";
import TodayGlance from "@/components/teacher/TodayGlance";
import TwinShortcut from "@/components/teacher/TwinShortcut";
import QuickActions from "@/components/teacher/QuickActions";
import WeekOverview from "@/components/teacher/WeekOverview";
import { subscribePulse } from "@/lib/pulse/refresh";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;

  return `${Math.floor(hrs / 24)}d ago`;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 20,
      padding: 16,
      marginBottom: 12,
      boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
    }}>
      {children}
    </div>
  );
}

function Label({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 900,
      color: "#9ca3af",
      letterSpacing: 1.2,
      textTransform: "uppercase",
      marginBottom: 10,
    }}>
      {text}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: "critical" | "urgent" | "calm" }) {
  const config =
    severity === "critical"
      ? { label: "High", color: "#ef4444", bg: "#fef2f2" }
      : severity === "urgent"
      ? { label: "Today", color: "#f59e0b", bg: "#fffbeb" }
      : { label: "Medium", color: "#3b82f6", bg: "#eff6ff" };

  return (
    <span style={{
      fontSize: 10,
      fontWeight: 900,
      color: config.color,
      background: config.bg,
      borderRadius: 999,
      padding: "3px 9px",
      whiteSpace: "nowrap",
    }}>
      {config.label}
    </span>
  );
}

function Pressable({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <div onClick={onClick} style={{ cursor: "pointer" }}>
      {children}
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ padding: "20px 16px" }}>
      <div style={{ height: 38, borderRadius: 10, background: "#f3f4f6", marginBottom: 16 }} />
      <div style={{ height: 120, borderRadius: 20, background: "#f3f4f6", marginBottom: 16 }} />
      <div style={{ height: 240, borderRadius: 20, background: "#f3f4f6" }} />
    </div>
  );
}

const smallIconProps = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function IconBook() {
  return <svg {...smallIconProps}><path d="M4 4h9a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z" /><path d="M20 4v13a3 3 0 0 1-3 3h-1" /></svg>;
}

function IconAlert() {
  return <svg {...smallIconProps}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9L2.7 18a1.5 1.5 0 0 0 1.3 2.3h16a1.5 1.5 0 0 0 1.3-2.3L13.7 3.9a1.5 1.5 0 0 0-2.6 0z" /></svg>;
}

function IconClock() {
  return <svg {...smallIconProps}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>;
}

function GuideCard({
  headline,
  message,
  priority,
  active,
}: {
  headline: string | null;
  message: string;
  priority: string;
  active: boolean;
}) {
  const color = priority === "critical" ? "#ef4444" : priority === "urgent" ? "#f59e0b" : "#10b981";

  return (
    <div style={{
      background: "linear-gradient(135deg,#0f172a,#1e1b4b,#064e3b)",
      borderRadius: 20,
      padding: 16,
      marginBottom: 12,
      border: `1px solid ${color}33`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 900, color, textTransform: "uppercase", marginBottom: 6 }}>
        Teaching Guide {active ? "· preparing..." : ""}
      </div>
      {headline && (
        <div style={{ fontSize: 18, fontWeight: 950, color: "#fff", lineHeight: 1.2, marginBottom: 6 }}>
          {headline}
        </div>
      )}
      <div style={{ fontSize: 14, fontWeight: 700, color: "#e0e7ff", lineHeight: 1.5 }}>
        {message || "Preparing today’s teaching flow..."}
      </div>
    </div>
  );
}

export default function PulsePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState("");
  const [snap, setSnap] = useState<PulseSnapshot | null>(null);
  const [usingCachedSnap, setUsingCachedSnap] = useState(false);
  const [guideMsg, setGuideMsg] = useState("");
  const [guidePriority, setGuidePriority] = useState("calm");
  const [guideActive, setGuideActive] = useState(false);
  const [guideHeadline, setGuideHeadline] = useState<string | null>(null);
  const [tasks, setTasks] = useState<PriorityTask[]>([]);

  const touchStartY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);

  const resolveGuide = useCallback(async (snapshot: PulseSnapshot, signal?: AbortSignal) => {
    const result = runRules(snapshot);

    if (signal?.aborted) return;

    setGuideMsg(result.message);
    setGuidePriority(result.priority);
    setGuideHeadline(result.upcomingWarning);
    setTasks(result.tasks);

    if (result.confidence >= 70) return;

    const fp = fingerprint(snapshot);
    const cached = readGuideCache();

    if (cached?.fp === fp) {
      setGuideMsg(cached.message);
      return;
    }

    setGuideActive(true);

    try {
      const res = await fetch("/api/guide/pulse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshot, signals: result.signals }),
        signal,
      });

      const data = (await res.json()) as { message?: string };

      if (!signal?.aborted && data.message) {
        setGuideMsg(data.message);
        writeGuideCache(fp, data.message);
      }
    } catch {
      // Guide support must never block the teaching flow.
    } finally {
      if (!signal?.aborted) setGuideActive(false);
    }
  }, []);

  const boot = useCallback(async (isRefresh = false, signal?: AbortSignal) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    if (isRefresh) setRefreshing(true);

    if (!isRefresh) {
      const cached = readSnapCache();
      if (cached) {
        setSnap(cached);
        setUsingCachedSnap(true);
        setLoading(false);
        const result = runRules(cached);
        setGuideMsg(result.message);
        setGuidePriority(result.priority);
        setGuideHeadline(result.upcomingWarning);
        setTasks(result.tasks);
      }
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || signal?.aborted) return;

      const [memberRes, profileRes] = await Promise.all([
        supabase.from("school_members").select("school_id").eq("profile_id", user.id).maybeSingle(),
        supabase.from("profiles").select("full_name,school_id").eq("id", user.id).single(),
      ]);

      if (signal?.aborted) return;

      const schoolId = memberRes.data?.school_id ?? profileRes.data?.school_id ?? null;
      setName((profileRes.data?.full_name ?? "").split(" ")[0] ?? "");

      if (!schoolId) return;

      const fresh = await fetchPulseData(user.id, schoolId, null);

      if (signal?.aborted) return;

      setSnap(fresh);
      setUsingCachedSnap(false);
      writeSnapCache(fresh);
      await resolveGuide(fresh, signal);
    } catch {
      // Offline cache already keeps the page usable.
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
      fetchingRef.current = false;
    }
  }, [resolveGuide]);

  useEffect(() => {
    const controller = new AbortController();
    boot(false, controller.signal);

    return () => controller.abort();
  }, [boot]);

  useEffect(() => {
    return subscribePulse(() => {
      const controller = new AbortController();
      boot(true, controller.signal);
    });
  }, [boot]);

  const onTouchStart = (event: React.TouchEvent) => {
    touchStartY.current = event.touches[0].clientY;
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const delta = event.changedTouches[0].clientY - touchStartY.current;

    if (delta > 65 && (scrollRef.current?.scrollTop ?? 0) === 0 && !refreshing) {
      const controller = new AbortController();
      boot(true, controller.signal);
    }
  };

  if (loading && !snap) return <Skeleton />;

  if (!snap) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#6b7280" }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
        <div style={{ fontSize: 14, fontWeight: 800 }}>No teaching data available for today.</div>
        <Pressable onClick={() => boot(true)}>
          <div style={{ marginTop: 12, fontSize: 13, fontWeight: 800, color: "#10b981" }}>
            Try again
          </div>
        </Pressable>
      </div>
    );
  }

  const todayName = DAYS[new Date().getDay()];
  const dateStr = new Date().toLocaleDateString("en-KE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      ref={scrollRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ paddingTop: 4, paddingBottom: 24 }}
    >
      {refreshing && (
        <div style={{ textAlign: "center", fontSize: 12, color: "#10b981", padding: "6px 0 10px", fontWeight: 800 }}>
          Updating today’s flow...
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#1e1b4b", letterSpacing: -0.4 }}>
          {greeting()}{name ? `, ${name}` : ""}.
        </div>

        <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 2 }}>
          {todayName} · {dateStr}
          {snap.termNumber != null && snap.weekNumber != null
            ? ` · Term ${snap.termNumber}, Week ${snap.weekNumber}`
            : ""}
          {usingCachedSnap ? " · Offline copy" : ""}
        </div>
      </div>

      <TodayGlance snap={snap} onNavigate={(href) => router.push(href)} />

      <QuickActions onNavigate={(href) => router.push(href)} />

      <GuideCard
        headline={guideHeadline}
        message={guideMsg}
        priority={guidePriority}
        active={guideActive}
      />

      <TwinShortcut onOpen={() => router.push("/teacher/pulse?twin=1")} />

      <NextTeachingAction
        task={tasks[0] ?? null}
        hasLessons={snap.todaySlots.length > 0}
        headline={guideHeadline}
        snap={snap}
        onNavigate={(href) => router.push(href)}
      />

      {tasks.length > 1 && (
        <Card>
          <Label text="Your Tasks" />
          {tasks.slice(1).map((task, index, remaining) => (
            <Pressable key={task.id} onClick={() => router.push(task.href)}>
              <div style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 10,
                padding: "11px 0",
                borderBottom: index < remaining.length - 1 ? "1px solid #f3f4f6" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{
                    marginTop: 2,
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    border: "2px solid #d1d5db",
                    flexShrink: 0,
                  }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#1e1b4b" }}>
                      {task.label}
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                      {task.detail}
                    </div>
                  </div>
                </div>
                <SeverityBadge severity={task.severity} />
              </div>
            </Pressable>
          ))}
        </Card>
      )}

      <Label text="Today’s Teaching Flow" />
      <LessonFlowCard
        slots={snap.todaySlots}
        snap={snap}
        teacherId={snap.userId}
        onNavigate={(href) => router.push(href)}
        onSaved={() => {
          const controller = new AbortController();
          boot(true, controller.signal);
        }}
      />

      {snap.currStats.length > 0 && (
        <Card>
          <Label text="Curriculum Progress" />
          {snap.currStats.map((stat) => {
            const pct = stat.total > 0 ? Math.round((stat.covered / stat.total) * 100) : 0;

            return (
              <div key={`${stat.classId}-${stat.subjectId}`} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 800 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#1e1b4b" }}>
                    <span style={{ color: "#10b981" }}><IconBook /></span>
                    {stat.subject}
                  </span>
                  <span>{pct}%</span>
                </div>
                <div style={{ height: 7, background: "#f3f4f6", borderRadius: 999, marginTop: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: "#10b981" }} />
                </div>
              </div>
            );
          })}
          <Pressable onClick={() => router.push("/teacher/scheme")}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#10b981" }}>
              View scheme →
            </div>
          </Pressable>
        </Card>
      )}

      {(snap.atRisk.length > 0 || snap.consecutiveAbsences.length > 0) && (
        <Card>
          <Label text="Class Support Needed" />
          {[...snap.consecutiveAbsences.slice(0, 3), ...snap.atRisk.slice(0, 3).map((student) => ({
            studentId: student.id,
            name: student.name,
            days: 0,
          }))].slice(0, 4).map((student) => (
            <Pressable key={student.studentId} onClick={() => router.push("/teacher/students")}>
              <div style={{ padding: "9px 0", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ marginTop: 2, color: "#ef4444", flexShrink: 0 }}><IconAlert /></span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#1e1b4b" }}>
                    {student.name}
                  </div>
                  <div style={{ fontSize: 11, color: "#ef4444", marginTop: 2 }}>
                    Needs teacher follow-up
                  </div>
                </div>
              </div>
            </Pressable>
          ))}
        </Card>
      )}

      {snap.tomorrowSlots.length > 0 && (
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "#8b5cf6", flexShrink: 0 }}><IconClock /></span>
              <div>
                <div style={{ fontSize: 10, fontWeight: 900, color: "#9ca3af", letterSpacing: 1.2, textTransform: "uppercase" }}>
                  Tomorrow
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#1e1b4b", marginTop: 2 }}>
                  {snap.tomorrowSlots[0].subject} · {snap.tomorrowSlots[0].class_name}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>
                  {snap.tomorrowSlots[0].start_time}
                  {snap.tomorrowSlots.length > 1 ? ` · +${snap.tomorrowSlots.length - 1} more` : ""}
                </div>
              </div>
            </div>
            <Pressable onClick={() => router.push(`/teacher/lessonplan?subjectId=${snap.tomorrowSlots[0].subject_id}&classId=${snap.tomorrowSlots[0].class_id}`)}>
              <div style={{
                background: "#10b981",
                color: "#fff",
                fontSize: 12,
                fontWeight: 800,
                borderRadius: 999,
                padding: "8px 16px",
                whiteSpace: "nowrap",
              }}>
                Prepare
              </div>
            </Pressable>
          </div>
        </Card>
      )}

      <WeekOverview overview={snap.weekOverview} />

      {snap.recentActivity.length > 0 && (
        <RecentActivity
          items={snap.recentActivity.map((activity: ActivityLog): ActivityItem => ({
            id: activity.id,
            type: activity.type === "homework" ? "gradebook" : activity.type,
            title: activity.title,
            subtitle: activity.subtitle,
            timestamp: relativeTime(activity.timestamp),
          }))}
        />
      )}
    </div>
  );
}
