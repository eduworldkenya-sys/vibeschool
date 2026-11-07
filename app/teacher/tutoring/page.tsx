"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, BookOpen, Users, GraduationCap, ArrowRight, RefreshCw, Video, MessageCircle, BarChart3 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";

type Listing = {
  display_name: string; subjects: string[] | null; levels: string[] | null;
  teaching_mode: "online" | "physical" | "either"; area: string | null;
  rate_kes: number | null; available_days: string[] | null; status: "published" | "paused";
};
type LoadState = "loading" | "ready" | "error";
type TuitionStudent = { id: string; student: string | null; status: string };
type TuitionLesson = { id: string; invitation_id: string; title: string; starts_at: string; status: string };

const labels: Record<string, string> = { Mon: "Mon", Tue: "Tue", Wed: "Wed", Thu: "Thu", Fri: "Fri", Sat: "Sat", Sun: "Sun" };
const order = Object.keys(labels);
const panel: React.CSSProperties = { padding: 18, background: "var(--teacher-surface, #fff)", border: "1px solid var(--teacher-border, #dfe5de)", borderRadius: 18 };
const linkStyle: React.CSSProperties = { minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 14px", borderRadius: 12, fontWeight: 750, textDecoration: "none", background: "var(--teacher-green, #087451)", color: "#fff" };

export default function TeacherTutoringPage() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>("loading");
  const [listing, setListing] = useState<Listing | null>(null);
  const [students, setStudents] = useState<TuitionStudent[] | null>(null);
  const [lessons, setLessons] = useState<TuitionLesson[] | null>(null);
  const load = useCallback(async () => {
    setState("loading");
    try {
      const client = getSupabaseClient();
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) { router.replace("/login?redirect=%2Fteacher%2Ftutoring"); return; }
      const { data, error } = await client.from("vibetutor_tutors")
        .select("display_name,subjects,levels,teaching_mode,area,rate_kes,available_days,status")
        .eq("profile_id", auth.user.id).maybeSingle();
      if (error) throw error;
      setListing(data as Listing | null);
      // Reuse the same owner-scoped RPCs as My tuition students. Failure in one
      // summary never blocks listing management or exposes school learner data.
      const [invitesResult, lessonsResult] = await Promise.all([
        client.rpc("vibetutor_my_student_invites"),
        client.rpc("vibetutor_my_lessons"),
      ]);
      setStudents(invitesResult.error ? null : (invitesResult.data ?? []).filter(row => row.status === "accepted"));
      setLessons(lessonsResult.error ? null : (lessonsResult.data ?? []).filter(row => row.status === "scheduled"));
      setState("ready");
    } catch {
      setState("error");
    }
  }, [router]);
  useEffect(() => { void load(); }, [load]);
  const days = order.filter(day => listing?.available_days?.includes(day));
  const subjects = listing?.subjects ?? [];
  const connectedIds = new Set(students?.map(student => student.id) ?? []);
  const upcoming = (lessons ?? []).filter(lesson => connectedIds.has(lesson.invitation_id) && new Date(lesson.starts_at).getTime() >= Date.now()).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const nextLesson = upcoming[0];

  const muted = "var(--teacher-muted, #627168)";
  const green = "var(--teacher-green, #087451)";
  const firstName = listing?.display_name?.trim().split(/\s+/)[0] || "Tutor";
  const tools = [
    { label: "My Students", detail: students === null ? "Your connected learners" : `${students.length} connected ${students.length === 1 ? "learner" : "learners"}`, href: "/teacher/tutoring/students", icon: Users },
    { label: "Lessons", detail: "Schedule & timetable", href: "/teacher/tutoring/students?tool=lessons", icon: CalendarDays },
    { label: "Live Classroom", detail: "Join through your lessons", href: "/teacher/tutoring/students?tool=lessons", icon: Video },
    { label: "Messages", detail: "Private conversations", href: "/teacher/tutoring/students?tool=messages", icon: MessageCircle },
  ];
  const futureTools = [
    { label: "Resources", detail: "Teaching materials", icon: BookOpen },
    { label: "Progress", detail: "Learning outcomes", icon: BarChart3 },
  ];
  return <div style={{ width: "100%", maxWidth: 900, margin: "0 auto", padding: "20px 14px 100px", display: "grid", gap: 16, color: "var(--teacher-ink, #1c2923)" }}>
    <header>
      <span style={{ color: green, fontSize: 12, fontWeight: 750, letterSpacing: ".05em" }}>VIBESCHOOL · MY TUTORING</span>
      <h1 style={{ fontSize: "clamp(24px, 3vw, 30px)", margin: "7px 0 4px" }}>Good morning, {firstName}</h1>
      <p style={{ margin: 0, fontSize: 13, color: muted }}>Manage your private teaching</p>
    </header>
    {state === "loading" && <section role="status" style={panel}>Loading your tutoring details…</section>}
    {state === "error" && <section role="alert" style={panel}>We could not load your tutoring details. <button type="button" onClick={() => void load()} style={{ padding: 10, marginLeft: 8, cursor: "pointer" }}><RefreshCw size={15} aria-hidden="true" /> Retry</button></section>}
    {state === "ready" && <>
      <section aria-label="Tutoring summary" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        {[
          { number: students?.length ?? "—", label: "Students" },
          { number: upcoming.length, label: "Upcoming lessons" },
          { number: "—", label: "Messages" },
        ].map(item => <div key={item.label} style={{ padding: "13px 7px", borderRadius: 12, background: "var(--teacher-surface, #fff)", border: "1px solid var(--teacher-border, #dfe5de)", textAlign: "center" }}>
          <strong style={{ display: "block", fontSize: 23 }}>{item.number}</strong>
          <span style={{ fontSize: 11, color: muted }}>{item.label}</span>
        </div>)}
      </section>
      <section aria-label="Next lesson" style={panel}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <h2 style={{ fontSize: 17, margin: 0 }}>Next lesson</h2>
          {nextLesson && <span style={{ fontSize: 12, fontWeight: 700, color: "#047857" }}>Scheduled</span>}
        </div>
        {nextLesson ? <>
          <p style={{ margin: "12px 0 3px", fontSize: 16, fontWeight: 750 }}>{nextLesson.title}</p>
          <p style={{ fontSize: 13, color: muted, margin: "0 0 14px" }}>{new Date(nextLesson.starts_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" })} · Open lesson details to join</p>
          <Link href="/teacher/tutoring/students" style={{ ...linkStyle, display: "flex", width: "100%" }}>View classroom <ArrowRight size={16} aria-hidden="true" /></Link>
        </> : <p style={{ color: muted, margin: "10px 0 0", fontSize: 14 }}>No upcoming lessons. Schedule one with a connected student.</p>}
      </section>
      <section aria-label="Teaching tools">
        <h2 style={{ fontSize: 17, margin: "0 0 11px" }}>Teaching tools</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          {tools.map(tool => {
            const Icon = tool.icon;
            return <Link key={tool.label} href={tool.href} style={{ ...panel, display: "grid", alignContent: "start", gap: 5, minWidth: 0, minHeight: 108, padding: 14, color: "inherit", textDecoration: "none" }}>
              <Icon size={21} color={green} aria-hidden="true" />
              <strong style={{ fontSize: 14 }}>{tool.label}</strong>
              <span style={{ fontSize: 12, color: muted }}>{tool.detail}</span>
            </Link>;
          })}
          {futureTools.map(tool => {
            const Icon = tool.icon;
            return <div key={tool.label} aria-label={`${tool.label} is not available yet`} style={{ ...panel, display: "grid", alignContent: "start", gap: 5, minWidth: 0, minHeight: 108, padding: 14, opacity: .7 }}>
              <Icon size={21} color={green} aria-hidden="true" />
              <strong style={{ fontSize: 14 }}>{tool.label}</strong>
              <span style={{ fontSize: 12, color: muted }}>{tool.detail} · Coming later</span>
            </div>;
          })}
        </div>
      </section>
      <section aria-label="My tutor listing" style={{ ...panel, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: "1 1 210px" }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>My tutor listing {listing && <span style={{ fontSize: 11, color: listing.status === "published" ? "#047857" : "#92400e", marginLeft: 8 }}>{listing.status === "published" ? "Published" : "Paused"}</span>}</h2>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: muted }}>{listing ? [subjects.join(", "), days.join(", "), listing.rate_kes ? `KSh ${listing.rate_kes}/hour` : ""].filter(Boolean).join(" · ") || "Complete your listing" : "Create your tutor listing"}</p>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/vibetutor/availability" style={{ color: green, fontSize: 13, fontWeight: 700 }}>Availability</Link>
          <Link href="/vibetutor/become-tutor" style={{ color: green, fontSize: 13, fontWeight: 700 }}>{listing ? "Manage listing" : "Create listing"} →</Link>
        </div>
      </section>
      <p style={{ margin: 0, fontSize: 12, color: muted }}><GraduationCap size={14} style={{ verticalAlign: "middle" }} aria-hidden="true" /> Private tutoring records remain separate from school records.</p>
    </>}
  </div>;
}
