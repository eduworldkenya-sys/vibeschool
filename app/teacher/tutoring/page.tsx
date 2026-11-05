"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, BookOpen, Users, FolderOpen, Pencil, Clock3, GraduationCap, ArrowRight, RefreshCw } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";

type Listing = {
  display_name: string; subjects: string[] | null; levels: string[] | null;
  teaching_mode: "online" | "physical" | "either"; area: string | null;
  rate_kes: number | null; available_days: string[] | null; status: "published" | "paused";
};
type LoadState = "loading" | "ready" | "error";

const labels: Record<string, string> = { Mon: "Mon", Tue: "Tue", Wed: "Wed", Thu: "Thu", Fri: "Fri", Sat: "Sat", Sun: "Sun" };
const order = Object.keys(labels);
const panel: React.CSSProperties = { padding: 18, background: "var(--teacher-surface, #fff)", border: "1px solid var(--teacher-border, #dfe5de)", borderRadius: 18 };
const linkStyle: React.CSSProperties = { minHeight: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "10px 14px", borderRadius: 12, fontWeight: 750, textDecoration: "none", background: "var(--teacher-green, #087451)", color: "#fff" };

export default function TeacherTutoringPage() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>("loading");
  const [listing, setListing] = useState<Listing | null>(null);
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
      setState("ready");
    } catch {
      setState("error");
    }
  }, [router]);
  useEffect(() => { void load(); }, [load]);
  const days = order.filter(day => listing?.available_days?.includes(day));
  const subjects = listing?.subjects ?? [];

  return <div style={{ maxWidth: 840, margin: "0 auto", padding: "20px 14px 110px", display: "grid", gap: 14, color: "var(--teacher-ink, #1c2923)" }}>
    <div>
      <Link href="/teacher/profile" style={{ color: "var(--teacher-green, #087451)", fontSize: 13, fontWeight: 700 }}>← My account</Link>
      <h1 style={{ fontSize: 27, margin: "12px 0 5px" }}>My Tutoring</h1>
      <p style={{ margin: 0, fontSize: 14, color: "var(--teacher-muted, #627168)" }}>Your independent teaching space. School assignments stay separate.</p>
    </div>
    {state === "loading" && <section role="status" style={panel}>Loading your tutoring details…</section>}
    {state === "error" && <section role="alert" style={panel}>We could not load your tutoring details. <button type="button" onClick={() => void load()} style={{ padding: 10, marginLeft: 8, cursor: "pointer" }}><RefreshCw size={15} aria-hidden="true" /> Retry</button></section>}
    {state === "ready" && <>
      <section style={panel} aria-label="My tutor listing">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>My tutor listing</h2>
          {listing && <span style={{ fontSize: 12, fontWeight: 750, color: listing.status === "published" ? "#047857" : "#92400e" }}>{listing.status === "published" ? "Published" : "Paused"}</span>}
        </div>
        {listing ? <>
          <p style={{ margin: "8px 0", fontSize: 15, fontWeight: 650 }}>{listing.display_name}</p>
          <p style={{ margin: "4px 0 12px", color: "var(--teacher-muted, #627168)", fontSize: 13 }}>{subjects.join(" · ") || "Subjects not selected"}{listing.area ? ` · ${listing.area}` : ""}</p>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--teacher-muted, #627168)" }}>{listing.levels?.join(", ") || "No levels"} · {listing.teaching_mode === "either" ? "Online and in person" : listing.teaching_mode === "physical" ? "In person" : "Online"}{listing.rate_kes ? ` · KSh ${listing.rate_kes}/hour` : ""}</p>
        </> : <p style={{ fontSize: 14, color: "var(--teacher-muted, #627168)" }}>You have not created a tutor listing yet.</p>}
        <Link href="/vibetutor/become-tutor" style={linkStyle}><Pencil size={16} aria-hidden="true" />{listing ? "Manage listing" : "Create tutor listing"}<ArrowRight size={16} aria-hidden="true" /></Link>
      </section>
      <section style={panel} aria-label="My availability">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><CalendarDays size={19} aria-hidden="true" /><h2 style={{ margin: 0, fontSize: 18 }}>My availability</h2></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, margin: "12px 0" }}>
          {days.length ? days.map(day => <span key={day} style={{ borderRadius: 9, padding: "7px 11px", background: "var(--teacher-canvas, #f5f6f2)", border: "1px solid var(--teacher-border, #dfe5de)", fontSize: 13, fontWeight: 700 }}>{labels[day]}</span>) : <span style={{ fontSize: 13, color: "var(--teacher-muted, #627168)" }}>No available days saved</span>}
        </div>
        {listing ? <Link href="/vibetutor/availability" style={{ color: "var(--teacher-green, #087451)", fontSize: 14, fontWeight: 750 }}>Edit availability →</Link> : <Link href="/vibetutor/become-tutor" style={{ color: "var(--teacher-green, #087451)", fontSize: 14, fontWeight: 750 }}>Set availability in your listing →</Link>}
      </section>
      <section aria-label="Tutoring tools">
        <h2 style={{ fontSize: 17, margin: "6px 0 12px" }}>Teaching tools</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 215px), 1fr))", gap: 10 }}>
          {[
            { icon: Users, title: "My students", text: "A private tutoring learner register is not yet available." },
            { icon: Clock3, title: "Timetable", text: "Tuition lesson scheduling is not yet available." },
            { icon: BookOpen, title: "Subjects", text: subjects.length ? subjects.join(", ") : "Add subjects to your tutor listing." },
            { icon: FolderOpen, title: "Resources", text: "Private tutoring resources are not yet available." },
          ].map(item => <div key={item.title} style={{ ...panel, minHeight: 135 }}>
            <item.icon size={22} aria-hidden="true" style={{ color: "var(--teacher-green, #087451)" }} />
            <h3 style={{ fontSize: 15, margin: "9px 0 5px" }}>{item.title}</h3>
            <p style={{ fontSize: 12, lineHeight: 1.55, margin: 0, color: "var(--teacher-muted, #627168)" }}>{item.text}</p>
          </div>)}
        </div>
      </section>
      <p style={{ margin: 0, fontSize: 12, color: "var(--teacher-muted, #627168)" }}><GraduationCap size={14} style={{ verticalAlign: "middle" }} aria-hidden="true" /> Your tutoring listing is separate from school-assigned students, classes and records.</p>
    </>}
  </div>;
}
