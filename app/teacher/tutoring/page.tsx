"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Users, GraduationCap, ArrowRight, RefreshCw, Video, MessageCircle } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { tuitionLessonState } from "@/lib/vibetutor/lessonLifecycle";

type Listing = {
  display_name: string; subjects: string[] | null; levels: string[] | null;
  teaching_mode: "online" | "physical" | "either"; area: string | null;
  rate_kes: number | null; available_days: string[] | null; status: "published" | "paused";
};
type LoadState = "loading" | "ready" | "error";
type TuitionStudent = { id: string; student: string | null; status: string };
type TuitionLesson = { id: string; invitation_id: string; title: string; starts_at: string; ends_at: string; status: string };

const labels: Record<string, string> = { Mon: "Mon", Tue: "Tue", Wed: "Wed", Thu: "Thu", Fri: "Fri", Sat: "Sat", Sun: "Sun" };
const order = Object.keys(labels);
const panel: React.CSSProperties = { padding: 18, background: "var(--teacher-surface, #fff)", border: "1px solid var(--teacher-border, #dfe5de)", borderRadius: 18 };
const linkStyle: React.CSSProperties = { minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 14px", borderRadius: 12, fontWeight: 750, textDecoration: "none", background: "var(--teacher-green, #087451)", color: "#fff" };

export default function TeacherTutoringPage() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>("loading");
  const [listing, setListing] = useState<Listing | null>(null);
  const [professionalName, setProfessionalName] = useState("");
  const [nairobiHour, setNairobiHour] = useState<number | null>(null);
  const [messageCount, setMessageCount] = useState<number | null>(null);
  const [students, setStudents] = useState<TuitionStudent[] | null>(null);
  const [lessons, setLessons] = useState<TuitionLesson[] | null>(null);
  const load = useCallback(async () => {
    setState("loading");
    setMessageCount(null);
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
      // The account identity is canonical; a separately editable public listing
      // must never change how Teacher OS addresses the signed-in teacher.
      const { data: profile } = await client.from("profiles")
        .select("full_name").eq("id", auth.user.id).maybeSingle();
      setProfessionalName(profile?.full_name?.trim() || "");
      // Reuse the same owner-scoped RPCs as My tuition students. Failure in one
      // summary never blocks listing management or exposes school learner data.
      const [invitesResult, lessonsResult] = await Promise.all([
        client.rpc("vibetutor_my_student_invites"),
        client.rpc("vibetutor_my_lessons"),
      ]);
      const accepted = invitesResult.error ? null : ((invitesResult.data ?? []) as TuitionStudent[]).filter(row => row.status === "accepted");
      setStudents(accepted);
      setLessons(lessonsResult.error ? null : (lessonsResult.data ?? []) as TuitionLesson[]);
      setState("ready");
      if (accepted) {
        // Scope every read to an accepted private connection. Errors remain unknown,
        // never a misleading zero; the underlying RPC returns up to 100 recent messages.
        const conversations = await Promise.all(accepted.map(row =>
          client.rpc("vibetutor_my_lesson_messages", { p_invitation: row.id })
        ));
        setMessageCount(conversations.some(item => item.error) ? null :
          conversations.reduce((total, item) => total + (Array.isArray(item.data) ? item.data.length : 0), 0));
      }
    } catch {
      setState("error");
    }
  }, [router]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Africa/Nairobi" }).format(new Date()));
    setNairobiHour(hour);
  }, []);
  const days = order.filter(day => listing?.available_days?.includes(day));
  const subjects = listing?.subjects ?? [];
  const connectedIds = new Set(students?.map(student => student.id) ?? []);
  const upcoming = (lessons ?? []).filter(lesson => connectedIds.has(lesson.invitation_id) && ["upcoming", "joinable"].includes(tuitionLessonState(lesson))).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const nextLesson = upcoming[0];
  const joinableLesson = upcoming.find(lesson => tuitionLessonState(lesson) === "joinable");

  const muted = "var(--teacher-muted, #627168)";
  const green = "var(--teacher-green, #087451)";
  const firstName = professionalName.split(/\s+/)[0] || "Tutor";
  const greeting = nairobiHour === null ? "Welcome" : nairobiHour < 12 ? "Good morning" : nairobiHour < 17 ? "Good afternoon" : "Good evening";
  const tools = [
    { label: "My Students", detail: students === null ? "Your connected learners" : `${students.length} connected ${students.length === 1 ? "learner" : "learners"}`, href: "/teacher/tutoring/students", icon: Users },
    { label: "Lessons", detail: "Schedule & timetable", href: "/teacher/tutoring/students?tool=lessons", icon: CalendarDays },
     { label: "Messages", detail: "Private conversations", href: "/teacher/tutoring/students?tool=messages", icon: MessageCircle },
  ];
  return <div style={{ width: "100%", maxWidth: 900, margin: "0 auto", padding: "20px 14px 100px", display: "grid", gap: 16, color: "var(--teacher-ink, #1c2923)" }}>
    <header>
      <span style={{ color: green, fontSize: 12, fontWeight: 750, letterSpacing: ".05em" }}>VIBESCHOOL · MY TUTORING</span>
      <h1 style={{ fontSize: "clamp(24px, 3vw, 30px)", margin: "7px 0 4px" }}>{greeting}, {firstName}</h1>
      <p style={{ margin: 0, fontSize: 13, color: muted }}>Manage your private teaching</p>
    </header>
    {state === "loading" && <section role="status" style={panel}>Loading your tutoring details…</section>}
    {state === "error" && <section role="alert" style={panel}>We could not load your tutoring details. <button type="button" onClick={() => void load()} style={{ padding: 10, marginLeft: 8, cursor: "pointer" }}><RefreshCw size={15} aria-hidden="true" /> Retry</button></section>}
    {state === "ready" && <>
      <section aria-label="Tutoring summary" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        {[
          { number: students?.length ?? "—", label: "Students" },
          { number: upcoming.length, label: "Upcoming lessons" },
          { number: messageCount === null ? "—" : messageCount >= 100 ? `${messageCount}+` : messageCount, label: "Recent messages" },
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
          <p style={{ fontSize: 13, color: muted, margin: "0 0 14px" }}>{new Date(nextLesson.starts_at).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" })} · {tuitionLessonState(nextLesson) === "joinable" ? "Classroom ready" : "Join opens 15 minutes before the lesson"}</p>
          <Link href={tuitionLessonState(nextLesson) === "joinable" ? "/tuition/lessons/" + nextLesson.id : "/teacher/tutoring/students?tool=lessons"} style={{ ...linkStyle, display: "flex", width: "100%" }}>{tuitionLessonState(nextLesson) === "joinable" ? "Join classroom" : "View lesson details"} <ArrowRight size={16} aria-hidden="true" /></Link>
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
          {joinableLesson ? <Link href={"/tuition/lessons/" + joinableLesson.id} style={{ ...panel, display: "grid", alignContent: "start", gap: 5, minHeight: 108, padding: 14, color: "inherit", textDecoration: "none" }}>
            <Video size={21} color={green} aria-hidden="true" />
            <strong style={{ fontSize: 14 }}>Join live classroom</strong>
            <span style={{ fontSize: 12, color: muted }}>{joinableLesson.title}</span>
          </Link> : null}

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
