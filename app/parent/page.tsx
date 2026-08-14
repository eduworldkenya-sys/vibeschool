"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface ChildData {
  id: string;
  name: string;
  admission_number: string | null;
  className: string;
  school: string;
  attendancePct: number | null;
  pendingApproval: boolean;
}

interface AttentionItem {
  tone: "warning" | "info";
  title: string;
  detail: string;
  href?: string;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function Skeleton({ w = "100%", h = 16, radius = 8 }: { w?: string | number; h?: number; radius?: number }) {
  return <div style={{ width: w, height: h, borderRadius: radius, background: "linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)", backgroundSize: "200% 100%", animation: "parentShimmer 1.4s infinite" }} />;
}

function statusFor(child: ChildData) {
  if (child.pendingApproval) return { label: "Waiting for school", tone: "#92400e", bg: "#fef3c7", icon: "⏳" };
  if (child.attendancePct !== null && child.attendancePct < 80) return { label: "Needs attention", tone: "#991b1b", bg: "#fee2e2", icon: "⚠️" };
  return { label: "Doing well", tone: "#065f46", bg: "#d1fae5", icon: "✓" };
}

export default function ParentHomePage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("Parent");
  const [children, setChildren] = useState<ChildData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noChild, setNoChild] = useState(false);

  async function loadDashboard() {
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/");
      return;
    }

    const [{ data: profile, error: profileError }, { data: links, error: linksError }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).single(),
      supabase.from("parent_student_links").select("student_id").eq("parent_id", user.id),
    ]);

    if (profileError || linksError) {
      setError("We couldn't load your family dashboard. Please try again.");
      setLoading(false);
      return;
    }

    const name = profile?.full_name ?? "Parent";
    setFirstName(name.split(" ")[0] || "Parent");

    if (!links || links.length === 0) {
      setNoChild(true);
      setChildren([]);
      setLoading(false);
      return;
    }

    const studentIds = links.map(link => link.student_id);
    const [{ data: students, error: studentsError }, { data: attendance, error: attendanceError }, { data: pendingReqs, error: pendingError }] = await Promise.all([
      supabase.from("students").select("id, name, admission_number, class_id").in("id", studentIds),
      supabase.from("attendance").select("student_id, status").in("student_id", studentIds),
      supabase.from("class_join_requests").select("student_id").in("student_id", studentIds).eq("status", "pending"),
    ]);

    if (studentsError || attendanceError || pendingError) {
      setError("Some family information could not be loaded. Please try again.");
      setLoading(false);
      return;
    }

    if (!students || students.length === 0) {
      setNoChild(true);
      setChildren([]);
      setLoading(false);
      return;
    }

    const classIds = students.map(student => student.class_id).filter(Boolean) as string[];
    const { data: classes, error: classesError } = classIds.length
      ? await supabase.from("classes").select("id, name, stream, school_id").in("id", classIds)
      : { data: [], error: null };

    if (classesError) {
      setError("We couldn't load your children's school information. Please try again.");
      setLoading(false);
      return;
    }

    const schoolIds = Array.from(new Set((classes ?? []).map(item => item.school_id).filter(Boolean))) as string[];
    const { data: schools, error: schoolsError } = schoolIds.length
      ? await supabase.from("schools").select("id, name").in("id", schoolIds)
      : { data: [], error: null };

    if (schoolsError) {
      setError("We couldn't load your children's school information. Please try again.");
      setLoading(false);
      return;
    }

    const pendingSet = new Set((pendingReqs ?? []).map(item => item.student_id));
    const childData = students.map(student => {
      const cls = (classes ?? []).find(item => item.id === student.class_id);
      const school = (schools ?? []).find(item => item.id === cls?.school_id);
      const rows = (attendance ?? []).filter(item => item.student_id === student.id);
      const recorded = rows.length;
      const present = rows.filter(item => item.status === "present").length;

      return {
        id: student.id,
        name: student.name,
        admission_number: student.admission_number,
        className: cls ? cls.name + (cls.stream ? ` ${cls.stream}` : "") : "Class not assigned",
        school: school?.name ?? "School not assigned",
        attendancePct: recorded > 0 ? Math.round((present / recorded) * 100) : null,
        pendingApproval: pendingSet.has(student.id) && !student.class_id,
      };
    });

    setChildren(childData);
    setNoChild(false);
    setLoading(false);
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const attention = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    children.forEach(child => {
      if (child.pendingApproval) {
        items.push({ tone: "warning", title: `${child.name} is waiting for school approval`, detail: "The child can appear here, but school access is not complete yet.", href: `/parent/child/${child.id}` });
      } else if (child.attendancePct !== null && child.attendancePct < 80) {
        items.push({ tone: "warning", title: `${child.name}'s attendance needs attention`, detail: `${child.attendancePct}% recorded attendance.`, href: `/parent/child/${child.id}` });
      }
    });
    return items.slice(0, 4);
  }, [children]);

  if (loading) {
    return (
      <div>
        <div style={{ background: "#1e1b4b", borderRadius: 20, padding: 18, marginBottom: 14 }}>
          <Skeleton w={130} h={10} />
          <div style={{ marginTop: 8 }}><Skeleton w={220} h={18} /></div>
          <div style={{ marginTop: 8 }}><Skeleton w={160} h={10} /></div>
        </div>
        <Skeleton h={150} radius={18} />
        <div style={{ marginTop: 12 }}><Skeleton h={100} radius={18} /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 18, padding: 24, textAlign: "center", marginTop: 20 }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>Your dashboard couldn't load</div>
        <div style={{ fontSize: 13, color: "#6b7280", margin: "8px 0 18px" }}>{error}</div>
        <button onClick={() => void loadDashboard()} style={{ border: "none", borderRadius: 12, padding: "11px 18px", background: "#1e1b4b", color: "#fff", fontWeight: 800, cursor: "pointer" }}>Try again</button>
      </div>
    );
  }

  if (noChild) {
    return (
      <div>
        <Hero firstName={firstName} childCount={0} />
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 18, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>👨‍👩‍👧</div>
          <div style={{ fontSize: 17, fontWeight: 800 }}>Let's connect your child</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: "#6b7280", margin: "8px auto 18px", maxWidth: 420 }}>Link an existing student with a claim code, or add your child to a class.</div>
          <div style={{ display: "grid", gap: 9 }}>
            <button onClick={() => router.push("/parent/link-child")} style={primaryButton}>🔗 Link with Claim Code</button>
            <button onClick={() => router.push("/parent/create-child")} style={secondaryButton}>+ Add Child to Class</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <Hero firstName={firstName} childCount={children.length} />

      <SectionTitle title="My children" subtitle="A quick view of how each child is doing." />
      <div style={{ display: "grid", gap: 10 }}>
        {children.map(child => {
          const status = statusFor(child);
          return (
            <div key={child.id} style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={avatar}>{child.name?.[0]?.toUpperCase() ?? "C"}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{child.name}</div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{child.className} · {child.school}</div>
                </div>
                <div style={{ background: status.bg, color: status.tone, borderRadius: 999, padding: "5px 8px", fontSize: 10, fontWeight: 800, whiteSpace: "nowrap" }}>{status.icon} {status.label}</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                <Metric label="Attendance" value={child.attendancePct === null ? "No data" : `${child.attendancePct}%`} />
                <Metric label="School access" value={child.pendingApproval ? "Pending" : "Active"} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 8, marginTop: 10 }}>
                <button onClick={() => router.push(`/parent/child/${child.id}`)} style={primaryButton}>View child</button>
                <button onClick={() => router.push(`/parent/messages?studentId=${child.id}`)} style={secondaryButton}>Message school</button>
              </div>
            </div>
          );
        })}
      </div>

      <SectionTitle title="Needs your attention" subtitle="Only the things that need a parent response." />
      <div style={card}>
        {attention.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: "#d1fae5", display: "grid", placeItems: "center" }}>✓</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#065f46" }}>Nothing needs your attention right now</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>We'll surface important changes here.</div>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 9 }}>
            {attention.map((item, index) => (
              <button key={`${item.title}-${index}`} onClick={() => item.href && router.push(item.href)} style={{ textAlign: "left", border: "1px solid #f3f4f6", background: item.tone === "warning" ? "#fffbeb" : "#f8fafc", borderRadius: 12, padding: 11, cursor: item.href ? "pointer" : "default" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>{item.title}</div>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>{item.detail}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <SectionTitle title="What you can do" subtitle="The most useful parent actions, one tap away." />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
        <Action icon="💬" label="Message teacher" onClick={() => router.push("/parent/messages")} />
        <Action icon="📝" label="Report cards" onClick={() => router.push("/parent/report-cards")} />
        <Action icon="📊" label="Learning progress" onClick={() => router.push("/parent/assessments")} />
        <Action icon="👨‍👩‍👧" label="Manage children" onClick={() => router.push("/parent/students")} />
      </div>

      <SectionTitle title="More for your family" subtitle="Keep the deeper tools available without crowding the home screen." />
      <div style={{ display: "grid", gap: 8 }}>
        <QuickLink icon="📚" label="Help my child learn" detail="Learning resources and homework" onClick={() => router.push("/parent/learn")} />
        <QuickLink icon="🎓" label="VibeLearn" detail="Explore guided learning experiences" onClick={() => router.push("/parent/vibe-learn")} />
        <QuickLink icon="🎮" label="FunHub" detail="Family-friendly activities" onClick={() => router.push("/parent/funhub")} />
      </div>
    </div>
  );
}

function Hero({ firstName, childCount }: { firstName: string; childCount: number }) {
  return (
    <section style={{ background: "linear-gradient(135deg,#1e1b4b 0%,#312e81 100%)", color: "#fff", borderRadius: 20, padding: 17, marginBottom: 16, boxShadow: "0 6px 24px rgba(30,27,75,.14)" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.5)", marginBottom: 4 }}>{new Date().toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })}</div>
      <div style={{ fontSize: 19, fontWeight: 850, letterSpacing: -0.4 }}>{greeting()}, {firstName} 👋</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,.62)", marginTop: 4 }}>{childCount ? `${childCount} ${childCount === 1 ? "child" : "children"} connected. Here's what matters today.` : "Let's get your family connected."}</div>
    </section>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div style={{ margin: "17px 2px 9px" }}><div style={{ fontSize: 15, fontWeight: 850, color: "#111827" }}>{title}</div><div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{subtitle}</div></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={{ background: "#f8fafc", borderRadius: 11, padding: "9px 10px" }}><div style={{ fontSize: 14, fontWeight: 850, color: "#111827" }}>{value}</div><div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{label}</div></div>;
}

function Action({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return <button onClick={onClick} style={{ ...card, cursor: "pointer", textAlign: "left", padding: 13 }}><div style={{ fontSize: 20 }}>{icon}</div><div style={{ fontSize: 12, fontWeight: 800, color: "#111827", marginTop: 6 }}>{label}</div></button>;
}

function QuickLink({ icon, label, detail, onClick }: { icon: string; label: string; detail: string; onClick: () => void }) {
  return <button onClick={onClick} style={{ ...card, display: "flex", alignItems: "center", gap: 11, cursor: "pointer", textAlign: "left", padding: 12 }}><div style={{ width: 38, height: 38, borderRadius: 12, background: "#eef2ff", display: "grid", placeItems: "center", fontSize: 18 }}>{icon}</div><div><div style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>{label}</div><div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{detail}</div></div><div style={{ marginLeft: "auto", color: "#9ca3af", fontSize: 20 }}>›</div></button>;
}

const card: CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,.04)" };
const avatar: CSSProperties = { width: 44, height: 44, borderRadius: "50%", background: "#ede9fe", color: "#1e1b4b", display: "grid", placeItems: "center", fontSize: 17, fontWeight: 850, flexShrink: 0 };
const primaryButton: CSSProperties = { border: "none", borderRadius: 11, padding: "10px 11px", background: "#1e1b4b", color: "#fff", fontWeight: 800, fontSize: 12, cursor: "pointer" };
const secondaryButton: CSSProperties = { border: "1px solid #d1d5db", borderRadius: 11, padding: "10px 11px", background: "#fff", color: "#1e1b4b", fontWeight: 800, fontSize: 12, cursor: "pointer" };
