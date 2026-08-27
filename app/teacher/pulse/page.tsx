"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/app/teacher/layout";
import { fetchPulseData } from "@/lib/pulse/fetcher";
import type { PulseSnapshot, PriorityTask } from "@/lib/types";
import { runRules } from "@/lib/pulse/rules";
import { fingerprint, readGuideCache, readSnapCache, writeGuideCache, writeSnapCache } from "@/lib/pulse/cache";
import PulseHeader from "@/components/teacher/PulseHeader";
import TodayHero from "@/components/teacher/TodayHero";
import NextTeachingAction from "@/components/teacher/NextTeachingAction";
import { subscribePulse } from "@/lib/pulse/refresh";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function Skeleton() {
  return <div style={{ padding: "16px 12px" }}><div style={{ height: 76, borderRadius: 18, background: "#f3f4f6", marginBottom: 12 }} /><div style={{ height: 220, borderRadius: 22, background: "#f3f4f6" }} /></div>;
}

export default function PulsePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [snap, setSnap] = useState<PulseSnapshot | null>(null);
  const [usingCachedSnap, setUsingCachedSnap] = useState(false);
  const [guideHeadline, setGuideHeadline] = useState<string | null>(null);
  const [tasks, setTasks] = useState<PriorityTask[]>([]);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(null);
  const touchStartY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);
  const activeSchoolIdRef = useRef<string | null>(null);

  const resolveGuide = useCallback(async (snapshot: PulseSnapshot, signal?: AbortSignal) => {
    const result = runRules(snapshot);
    if (signal?.aborted) return;
    setGuideHeadline(result.upcomingWarning);
    setTasks(result.tasks);
    if (result.confidence >= 70) return;
    const fp = fingerprint(snapshot);
    const cached = readGuideCache();
    if (cached?.fp === fp) return;
    try {
      const res = await fetch("/api/twin/pulse", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ snapshot, signals: result.signals }), signal });
      const data = (await res.json()) as { message?: string };
      if (!signal?.aborted && data.message) writeGuideCache(fp, data.message);
    } catch { /* Twin support must never block Today. */ }
  }, []);

  const boot = useCallback(async (isRefresh = false, signal?: AbortSignal) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (isRefresh) setRefreshing(true);
    if (!isRefresh) {
      const cached = readSnapCache();
      if (cached) {
        setSnap(cached); setUsingCachedSnap(true); setLoading(false);
        const result = runRules(cached); setGuideHeadline(result.upcomingWarning); setTasks(result.tasks);
      }
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || signal?.aborted) return;
      const [memberRes, profileRes] = await Promise.all([
        supabase.from("school_members").select("school_id").eq("profile_id", user.id),
        supabase.from("profiles").select("full_name,school_id,avatar_url").eq("id", user.id).single(),
      ]);
      if (signal?.aborted) return;
      const memberSchoolIds = Array.from(new Set((memberRes.data ?? []).map((row) => row.school_id).filter(Boolean) as string[]));
      if (memberSchoolIds.length > 1 && schools.length === 0) {
        const { data } = await supabase.from("schools").select("id,name").in("id", memberSchoolIds);
        if (data) setSchools(data as { id: string; name: string }[]);
      }
      const schoolId = activeSchoolIdRef.current ?? memberSchoolIds[0] ?? profileRes.data?.school_id ?? null;
      setName((profileRes.data?.full_name ?? "").split(" ")[0] ?? "");
      setAvatarUrl((profileRes.data as { avatar_url?: string } | null)?.avatar_url ?? "");
      if (!schoolId) return;
      const fresh = await fetchPulseData(user.id, schoolId, null);
      if (signal?.aborted) return;
      setSnap(fresh); setUsingCachedSnap(false); writeSnapCache(fresh); await resolveGuide(fresh, signal);
    } catch { /* Offline cache keeps the workspace usable. */ }
    finally { if (!signal?.aborted) { setLoading(false); setRefreshing(false); } fetchingRef.current = false; }
  }, [resolveGuide, schools.length]);

  const handleSchoolChange = useCallback((id: string) => { activeSchoolIdRef.current = id; setActiveSchoolId(id); setSelectedKey(""); boot(true); }, [boot]);
  useEffect(() => { const controller = new AbortController(); boot(false, controller.signal); return () => controller.abort(); }, [boot]);
  useEffect(() => subscribePulse(() => { const controller = new AbortController(); boot(true, controller.signal); }), [boot]);

  if (loading && !snap) return <Skeleton />;
  if (!snap) return <div style={{ padding: 32, textAlign: "center", color: "#6b7280" }}><strong>No teaching data available for today.</strong><button onClick={() => boot(true)} style={{ display: "block", margin: "14px auto", border: 0, background: "transparent", color: "#059669", fontWeight: 800 }}>Try again</button></div>;

  const safeTodaySlots = snap.todaySlots ?? [];
  const safeMyClasses = snap.myClasses ?? [];
  const keyOf = (classId: string, subjectId: string) => `${classId}::${subjectId}`;
  const defaultKey = safeTodaySlots[0] ? keyOf(safeTodaySlots[0].class_id, safeTodaySlots[0].subject_id) : safeMyClasses[0] ? keyOf(safeMyClasses[0].class_id, safeMyClasses[0].subject_id) : "";
  const effectiveKey = selectedKey || defaultKey;
  const [focusClassId, focusSubjectId] = effectiveKey.split("::");
  const focusSlot = safeTodaySlots.find((slot) => slot.class_id === focusClassId && slot.subject_id === focusSubjectId);
  const focusRoster = safeMyClasses.find((c) => c.class_id === focusClassId && c.subject_id === focusSubjectId);
  const dateStr = new Date().toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });

  const onTouchEnd = (event: React.TouchEvent) => {
    const delta = event.changedTouches[0].clientY - touchStartY.current;
    if (delta > 65 && (scrollRef.current?.scrollTop ?? 0) === 0 && !refreshing) boot(true);
  };

  return <div ref={scrollRef} onTouchStart={(e) => { touchStartY.current = e.touches[0].clientY; }} onTouchEnd={onTouchEnd} style={{ paddingTop: 2, paddingBottom: 28 }}>
    {refreshing && <div style={{ textAlign: "center", fontSize: 11, color: "#059669", padding: "5px 0", fontWeight: 800 }}>Updating today…</div>}
    <PulseHeader snap={snap} name={name} avatarUrl={avatarUrl} selectedKey={effectiveKey} onSelectedKeyChange={setSelectedKey} schools={schools} activeSchoolId={activeSchoolId ?? snap.schoolId} onSchoolChange={handleSchoolChange} onOpenNotifications={() => showToast("Notifications — coming soon")} />
    <TodayHero snap={snap} focusSlot={focusSlot} focusRoster={focusRoster} onOpenTimetable={() => router.push("/teacher/timetable")} onOpenStudents={() => router.push("/teacher/students")} onOpenAttendance={() => router.push("/teacher/attendance")} />
    <div style={{ fontSize: 11, color: "#94a3b8", margin: "-8px 4px 12px" }}>{DAYS[new Date().getDay()]} · {dateStr}{snap.termNumber != null && snap.weekNumber != null ? ` · Term ${snap.termNumber}, Week ${snap.weekNumber}` : ""}{usingCachedSnap ? " · Offline" : ""}</div>
    <NextTeachingAction task={tasks[0] ?? null} hasLessons={safeTodaySlots.length > 0} headline={guideHeadline} snap={snap} onNavigate={(href) => router.push(href)} />
    {tasks.length > 1 && <button onClick={() => router.push(tasks[1].href)} style={{ width: "100%", padding: "12px 14px", border: "1px solid #e2e8f0", borderRadius: 14, background: "#fff", color: "#334155", textAlign: "left", fontWeight: 800 }}>Also today · {tasks[1].label} <span style={{ float: "right" }}>›</span></button>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8, marginTop: 12 }}>
      <button onClick={() => router.push("/teacher/scheme")} style={quick}>Scheme</button>
      <button onClick={() => router.push("/teacher/assessment")} style={quick}>Assess</button>
      <button onClick={() => router.push("/teacher/twin")} style={quick}>Ask Twin</button>
    </div>
  </div>;
}

const quick: React.CSSProperties = { padding: "11px 8px", border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff", color: "#334155", fontSize: 12, fontWeight: 800, cursor: "pointer" };
