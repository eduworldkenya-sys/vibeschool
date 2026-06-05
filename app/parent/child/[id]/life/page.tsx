
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const dark   = "#1e1b4b";
const accent = "#10b981";
const bg     = "#f0f2f5";
const red    = "#ef4444";
const amber  = "#f59e0b";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Goal {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  target_date: string | null;
  completed_at: string | null;
  recorded_at: string | null;
}
interface Milestone {
  id: string;
  goal_id: string;
  title: string;
  is_done: boolean;
  done_at: string | null;
}
interface Skill {
  id: string;
  name: string;
  category: string | null;
  level: string | null;
  notes: string | null;
}
interface Book {
  id: string;
  title: string;
  author: string | null;
  category: string | null;
  pages: number | null;
  rating: number | null;
  notes: string | null;
  recorded_at: string | null;
}
interface ChildEvent {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  location: string | null;
  status: string | null;
  outcome: string | null;
  recorded_at: string | null;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Shimmer({ w = "100%", h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
      flexShrink: 0,
    }} />
  );
}

function SkeletonCard() {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, border: "1px solid #e5e7eb", display: "flex", flexDirection: "column", gap: 10 }}>
      <Shimmer h={14} w="60%" />
      <Shimmer h={11} w="40%" />
      <Shimmer h={11} w="80%" />
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg }: { msg: string }) {
  return (
    <div style={{
      position: "fixed", bottom: 140, left: "50%", transform: "translateX(-50%)",
      background: dark, color: "#fff", padding: "11px 22px", borderRadius: 12,
      fontSize: 13, fontWeight: 600, zIndex: 9999, animation: "fadeIn 0.2s ease",
      boxShadow: "0 8px 24px rgba(0,0,0,0.18)", whiteSpace: "nowrap",
    }}>
      {msg}
    </div>
  );
}

// ─── Bottom Sheet ─────────────────────────────────────────────────────────────
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: "20px 20px 0 0",
        padding: "28px 20px 48px", width: "100%", maxWidth: 768,
        animation: "slideUp 0.22s ease", maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: dark }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: dark, marginBottom: 6 }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", padding: "11px 14px", borderRadius: 10,
          border: "1.5px solid #e5e7eb", fontSize: 14, fontFamily: "inherit",
          outline: "none", boxSizing: "border-box", color: dark,
        }}
      />
    </div>
  );
}

function Textarea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: dark, marginBottom: 6 }}>{label}</div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{
          width: "100%", padding: "11px 14px", borderRadius: 10,
          border: "1.5px solid #e5e7eb", fontSize: 14, fontFamily: "inherit",
          outline: "none", boxSizing: "border-box", resize: "none", color: dark,
        }}
      />
    </div>
  );
}

function SaveBtn({ label = "Save", onClick, loading }: { label?: string; onClick: () => void; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        width: "100%", padding: 14, borderRadius: 12, border: "none",
        background: loading ? "#9ca3af" : accent, color: "#fff",
        fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
        fontFamily: "inherit", marginTop: 4,
      }}
    >
      {loading ? "Saving…" : label}
    </button>
  );
}

// ─── Star Rating ──────────────────────────────────────────────────────────────
function Stars({ rating, onChange }: { rating: number; onChange?: (n: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          onClick={() => onChange && onChange(n)}
          style={{ fontSize: 20, cursor: onChange ? "pointer" : "default", color: n <= rating ? amber : "#e5e7eb" }}
        >★</span>
      ))}
    </div>
  );
}

// ─── Level Badge ──────────────────────────────────────────────────────────────
function LevelBadge({ level }: { level: string | null }) {
  const map: Record<string, { bg: string; color: string }> = {
    beginner:     { bg: "#fef3c7", color: amber },
    intermediate: { bg: "#dbeafe", color: "#2563eb" },
    advanced:     { bg: "#d1fae5", color: accent },
    expert:       { bg: "#ede9fe", color: "#7c3aed" },
  };
  const l = (level ?? "beginner").toLowerCase();
  const style = map[l] ?? { bg: "#f3f4f6", color: "#6b7280" };
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
      background: style.bg, color: style.color, textTransform: "capitalize",
    }}>
      {level ?? "Beginner"}
    </span>
  );
}

// ─── Status Pill ──────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    active:    { bg: "#d1fae5", color: accent },
    completed: { bg: "#dbeafe", color: "#2563eb" },
    paused:    { bg: "#fef3c7", color: amber },
    cancelled: { bg: "#fee2e2", color: red },
    scheduled: { bg: "#ede9fe", color: "#7c3aed" },
    past:      { bg: "#f3f4f6", color: "#6b7280" },
  };
  const s = status.toLowerCase();
  const st = map[s] ?? { bg: "#f3f4f6", color: "#6b7280" };
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20,
      background: st.bg, color: st.color, textTransform: "capitalize",
    }}>
      {status}
    </span>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LifePage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const [tab, setTab]           = useState<"goals" | "skills" | "books" | "events">("goals");
  const [childName, setChildName] = useState("");
  const [userId, setUserId]     = useState("");
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState<string | null>(null);

  // Data
  const [goals, setGoals]       = useState<Goal[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [skills, setSkills]     = useState<Skill[]>([]);
  const [books, setBooks]       = useState<Book[]>([]);
  const [events, setEvents]     = useState<ChildEvent[]>([]);

  // Expanded goals
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);

  // Sheets
  const [showGoalSheet,  setShowGoalSheet]  = useState(false);
  const [showSkillSheet, setShowSkillSheet] = useState(false);
  const [showBookSheet,  setShowBookSheet]  = useState(false);
  const [showEventSheet, setShowEventSheet] = useState(false);

  // Goal form
  const [gTitle, setGTitle]       = useState("");
  const [gDesc,  setGDesc]        = useState("");
  const [gCat,   setGCat]         = useState("");
  const [gDate,  setGDate]        = useState("");

  // Skill form
  const [sName,  setSName]  = useState("");
  const [sCat,   setSCat]   = useState("");
  const [sLevel, setSLevel] = useState("Beginner");
  const [sNotes, setSNotes] = useState("");

  // Book form
  const [bTitle,  setBTitle]  = useState("");
  const [bAuthor, setBAuthor] = useState("");
  const [bCat,    setBCat]    = useState("");
  const [bPages,  setBPages]  = useState("");
  const [bRating, setBRating] = useState(0);
  const [bNotes,  setBNotes]  = useState("");

  // Event form
  const [eTitle, setETitle] = useState("");
  const [eDesc,  setEDesc]  = useState("");
  const [eCat,   setECat]   = useState("");
  const [eLoc,   setELoc]   = useState("");
  const [eDate,  setEDate]  = useState("");
  const [eStatus,setEStatus]= useState("scheduled");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }, []);

  // ── Badge check ──────────────────────────────────────────────────────────────
  const checkBadges = useCallback(async (uid: string, sid: string, name: string) => {
    const { data: existing } = await supabase
      .from("child_badges")
      .select("badge_id, badges(code)")
      .eq("student_id", sid);

    const earned = new Set((existing ?? []).map((b: any) => b.badges?.code));

    const { data: allBooks }  = await supabase.from("child_books").select("id").eq("student_id", sid).is("deleted_at", null);
    const { data: allGoals }  = await supabase.from("child_goals").select("id,status").eq("student_id", sid).is("deleted_at", null);
    const { data: allSkills } = await supabase.from("child_skills").select("id").eq("student_id", sid).is("deleted_at", null);
    const { data: allEvents } = await supabase.from("child_events").select("id").eq("student_id", sid).is("deleted_at", null);

    const bookCount     = allBooks?.length ?? 0;
    const goalCount     = allGoals?.length ?? 0;
    const completedGoals= allGoals?.filter(g => g.status === "completed").length ?? 0;
    const skillCount    = allSkills?.length ?? 0;
    const eventCount    = allEvents?.length ?? 0;

    const candidates: { code: string; label: string }[] = [];

    if (bookCount >= 1  && !earned.has("bookworm_1"))    candidates.push({ code: "bookworm_1",    label: "📚 Bookworm I" });
    if (bookCount >= 5  && !earned.has("bookworm_2"))    candidates.push({ code: "bookworm_2",    label: "📚 Bookworm II" });
    if (bookCount >= 20 && !earned.has("bookworm_3"))    candidates.push({ code: "bookworm_3",    label: "📚 Bookworm III" });
    if (goalCount >= 1  && !earned.has("goal_getter_1")) candidates.push({ code: "goal_getter_1", label: "🎯 Goal Getter I" });
    if (completedGoals >= 1 && !earned.has("goal_getter_2")) candidates.push({ code: "goal_getter_2", label: "🎯 Goal Getter II" });
    if (completedGoals >= 5 && !earned.has("goal_getter_3")) candidates.push({ code: "goal_getter_3", label: "🎯 Goal Getter III" });
    if (skillCount >= 1 && !earned.has("skilled_1"))     candidates.push({ code: "skilled_1",     label: "⭐ Skilled I" });
    if (skillCount >= 5 && !earned.has("skilled_2"))     candidates.push({ code: "skilled_2",     label: "⭐ Skilled II" });
    if (eventCount >= 1 && !earned.has("explorer_1"))    candidates.push({ code: "explorer_1",    label: "🌍 Explorer I" });
    if (eventCount >= 5 && !earned.has("explorer_2"))    candidates.push({ code: "explorer_2",    label: "🌍 Explorer II" });

    for (const c of candidates) {
      const { data: badge } = await supabase.from("badges").select("id").eq("code", c.code).single();
      if (!badge) continue;
      await supabase.from("child_badges").insert({
        student_id: sid,
        badge_id:   badge.id,
        awarded_by: uid,
      });
      showToast(`${name} earned ${c.label}!`);
    }
  }, [showToast]);

  // ── Fetch all ────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/admin/login"); return; }
    setUserId(user.id);

    const { data: student } = await supabase.from("students").select("name").eq("id", id).single();
    setChildName(student?.name ?? "");

    const [g, m, s, b, e] = await Promise.all([
      supabase.from("child_goals").select("*").eq("student_id", id).is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("child_goal_milestones").select("*").eq("student_id", id).is("deleted_at", null),
      supabase.from("child_skills").select("*").eq("student_id", id).is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("child_books").select("*").eq("student_id", id).is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("child_events").select("*").eq("student_id", id).is("deleted_at", null).order("recorded_at", { ascending: false }),
    ]);

    setGoals((g.data ?? []) as Goal[]);
    setMilestones((m.data ?? []) as Milestone[]);
    setSkills((s.data ?? []) as Skill[]);
    setBooks((b.data ?? []) as Book[]);
    setEvents((e.data ?? []) as ChildEvent[]);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const firstName = childName.split(" ")[0];

  // ── Add Goal ─────────────────────────────────────────────────────────────────
  async function addGoal() {
    if (!gTitle.trim()) { showToast("Please add a title"); return; }
    setSaving(true);
    const { error } = await supabase.from("child_goals").insert({
      student_id: id, parent_id: userId,
      title: gTitle.trim(), description: gDesc.trim() || null,
      category: gCat.trim() || null, target_date: gDate || null,
      status: "active", recorded_at: new Date().toISOString().split("T")[0],
    });
    setSaving(false);
    if (error) { showToast("Something went wrong — try again"); return; }
    setShowGoalSheet(false);
    setGTitle(""); setGDesc(""); setGCat(""); setGDate("");
    await fetchAll();
    await checkBadges(userId, id, firstName);
    showToast("Goal added!");
  }

  // ── Add Skill ────────────────────────────────────────────────────────────────
  async function addSkill() {
    if (!sName.trim()) { showToast("Please add a skill name"); return; }
    setSaving(true);
    const { error } = await supabase.from("child_skills").insert({
      student_id: id, parent_id: userId,
      name: sName.trim(), category: sCat.trim() || null,
      level: sLevel, notes: sNotes.trim() || null,
      recorded_at: new Date().toISOString().split("T")[0],
    });
    setSaving(false);
    if (error) { showToast("Something went wrong — try again"); return; }
    setShowSkillSheet(false);
    setSName(""); setSCat(""); setSLevel("Beginner"); setSNotes("");
    await fetchAll();
    await checkBadges(userId, id, firstName);
    showToast("Skill logged!");
  }

  // ── Add Book ─────────────────────────────────────────────────────────────────
  async function addBook() {
    if (!bTitle.trim()) { showToast("Please add a book title"); return; }
    setSaving(true);
    const { error } = await supabase.from("child_books").insert({
      student_id: id, parent_id: userId,
      title: bTitle.trim(), author: bAuthor.trim() || null,
      category: bCat.trim() || null,
      pages: bPages ? parseInt(bPages) : null,
      rating: bRating || null, notes: bNotes.trim() || null,
      recorded_at: new Date().toISOString().split("T")[0],
    });
    setSaving(false);
    if (error) { showToast("Something went wrong — try again"); return; }
    setShowBookSheet(false);
    setBTitle(""); setBAuthor(""); setBCat(""); setBPages(""); setBRating(0); setBNotes("");
    await fetchAll();
    await checkBadges(userId, id, firstName);
    showToast("Book logged!");
  }

  // ── Add Event ────────────────────────────────────────────────────────────────
  async function addEvent() {
    if (!eTitle.trim()) { showToast("Please add a title"); return; }
    setSaving(true);
    const { error } = await supabase.from("child_events").insert({
      student_id: id, parent_id: userId,
      title: eTitle.trim(), description: eDesc.trim() || null,
      category: eCat.trim() || null, location: eLoc.trim() || null,
      status: eStatus, recorded_at: eDate || new Date().toISOString().split("T")[0],
    });
    setSaving(false);
    if (error) { showToast("Something went wrong — try again"); return; }
    setShowEventSheet(false);
    setETitle(""); setEDesc(""); setECat(""); setELoc(""); setEDate(""); setEStatus("scheduled");
    await fetchAll();
    await checkBadges(userId, id, firstName);
    showToast("Event logged!");
  }

  // ── Toggle milestone ─────────────────────────────────────────────────────────
  async function toggleMilestone(m: Milestone) {
    const done = !m.is_done;
    await supabase.from("child_goal_milestones").update({
      is_done: done,
      done_at: done ? new Date().toISOString() : null,
    }).eq("id", m.id);
    setMilestones(prev => prev.map(x => x.id === m.id ? { ...x, is_done: done, done_at: done ? new Date().toISOString() : null } : x));
  }

  // ── Mark goal complete ───────────────────────────────────────────────────────
  async function completeGoal(g: Goal) {
    await supabase.from("child_goals").update({
      status: "completed", completed_at: new Date().toISOString(),
    }).eq("id", g.id);
    await fetchAll();
    await checkBadges(userId, id, firstName);
    showToast(`${firstName} completed "${g.title}"! 🎉`);
  }

  // ── Books this month streak ──────────────────────────────────────────────────
  const thisMonth = new Date().toISOString().slice(0, 7);
  const booksThisMonth = books.filter(b => (b.recorded_at ?? "").startsWith(thisMonth)).length;

  // ── Tab content ───────────────────────────────────────────────────────────────
  const TABS = [
    { id: "goals",  label: "🎯 Goals" },
    { id: "skills", label: "⭐ Skills" },
    { id: "books",  label: "📚 Books" },
    { id: "events", label: "🌍 Events" },
  ] as const;

  return (
    <div style={{ paddingBottom: 120, animation: "fadeIn 0.2s ease" }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{transform:translateY(40px);opacity:0} to{transform:translateY(0);opacity:1} }
      `}</style>
      {/* ── CHILD HUB TABS ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
        {[
          { label: "👤 Profile", href: "profile", active: false },
          { label: "🌱 Life",     href: "life",    active: true },
          { label: "📈 Growth",  href: "growth",  active: false },
          { label: "💰 Finance", href: "finance", active: false },
          { label: "📸 Memories",href: "memories",active: false },
          { label: "❤️ Health",  href: "health",  active: false },
        ].map(t => (
          <button key={t.href} onClick={() => router.push(`/parent/child/${id}/${t.href}`)} style={{ flexShrink: 0, padding: "8px 16px", borderRadius: 20, border: "1.5px solid", borderColor: t.active ? dark : "#e5e7eb", background: t.active ? dark : "#fff", color: t.active ? "#fff" : "#6b7280", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{t.label}</button>
        ))}
      </div>

      {/* ── Header ── */}
      <div style={{
        background: `linear-gradient(135deg, ${dark} 0%, #312e81 100%)`,
        borderRadius: 20, padding: "20px 20px 16px", marginBottom: 16,
        color: "#fff",
      }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
          {firstName}&apos;s Journey
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.4 }}>Life & Learning</div>
        <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
          {[
            { n: goals.filter(g => g.status === "active").length,     label: "Active Goals" },
            { n: skills.length,                                         label: "Skills" },
            { n: books.length,                                          label: "Books Read" },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: accent }}>{stat.n}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div style={{
        display: "flex", gap: 6, marginBottom: 16,
        overflowX: "auto", paddingBottom: 2,
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flexShrink: 0, padding: "8px 16px", borderRadius: 20,
              border: "1.5px solid",
              borderColor: tab === t.id ? dark : "#e5e7eb",
              background: tab === t.id ? dark : "#fff",
              color: tab === t.id ? "#fff" : "#6b7280",
              fontWeight: 700, fontSize: 12, cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1,2,3].map(i => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* GOALS TAB */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {!loading && tab === "goals" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: dark }}>Goals</div>
            <button
              onClick={() => setShowGoalSheet(true)}
              style={{ padding: "7px 16px", borderRadius: 20, border: "none", background: accent, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
            >
              + Add Goal
            </button>
          </div>

          {goals.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af", fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
              <div style={{ fontWeight: 700, color: dark, marginBottom: 4 }}>{firstName}&apos;s story starts here</div>
              <div>Add the first goal to get started</div>
            </div>
          )}

          {goals.map(g => {
            const gMilestones = milestones.filter(m => m.goal_id === g.id);
            const doneMilestones = gMilestones.filter(m => m.is_done).length;
            const expanded = expandedGoal === g.id;
            return (
              <div key={g.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", marginBottom: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <div
                  onClick={() => setExpandedGoal(expanded ? null : g.id)}
                  style={{ padding: "14px 16px", cursor: "pointer" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: dark, marginBottom: 4 }}>{g.title}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <StatusPill status={g.status} />
                        {g.category && <span style={{ fontSize: 10, color: "#9ca3af" }}>{g.category}</span>}
                        {g.target_date && <span style={{ fontSize: 10, color: "#9ca3af" }}>Due {g.target_date}</span>}
                      </div>
                    </div>
                    <div style={{ fontSize: 18, color: "#9ca3af" }}>{expanded ? "▲" : "▽"}</div>
                  </div>
                  {gMilestones.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ height: 4, borderRadius: 4, background: "#f3f4f6", overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 4, background: accent, width: `${Math.round((doneMilestones / gMilestones.length) * 100)}%`, transition: "width 0.3s ease" }} />
                      </div>
                      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>{doneMilestones}/{gMilestones.length} milestones</div>
                    </div>
                  )}
                </div>

                {expanded && (
                  <div style={{ borderTop: "1px solid #f3f4f6", padding: "12px 16px", background: "#fafafa" }}>
                    {g.description && (
                      <div style={{ fontSize: 13, color: "#374151", marginBottom: 12, lineHeight: 1.6 }}>{g.description}</div>
                    )}
                    {gMilestones.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: dark, marginBottom: 8 }}>MILESTONES</div>
                        {gMilestones.map(m => (
                          <div
                            key={m.id}
                            onClick={() => toggleMilestone(m)}
                            style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, cursor: "pointer" }}
                          >
                            <div style={{
                              width: 20, height: 20, borderRadius: 6,
                              border: `2px solid ${m.is_done ? accent : "#d1d5db"}`,
                              background: m.is_done ? accent : "#fff",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              flexShrink: 0, fontSize: 11, color: "#fff",
                            }}>
                              {m.is_done && "✓"}
                            </div>
                            <div style={{ fontSize: 13, color: m.is_done ? "#9ca3af" : dark, textDecoration: m.is_done ? "line-through" : "none" }}>
                              {m.title}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {g.status === "active" && (
                      <button
                        onClick={() => completeGoal(g)}
                        style={{
                          padding: "8px 16px", borderRadius: 10, border: `1.5px solid ${accent}`,
                          background: "#fff", color: accent, fontWeight: 700, fontSize: 12,
                          cursor: "pointer", fontFamily: "inherit",
                        }}
                      >
                        Mark Complete ✓
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SKILLS TAB */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {!loading && tab === "skills" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: dark }}>Skills</div>
            <button
              onClick={() => setShowSkillSheet(true)}
              style={{ padding: "7px 16px", borderRadius: 20, border: "none", background: accent, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
            >
              + Log Skill
            </button>
          </div>

          {skills.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af", fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⭐</div>
              <div style={{ fontWeight: 700, color: dark, marginBottom: 4 }}>{firstName}&apos;s story starts here</div>
              <div>Log the first skill to get started</div>
            </div>
          )}

          {skills.map(s => (
            <div key={s.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "14px 16px", marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: dark }}>{s.name}</div>
                <LevelBadge level={s.level} />
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {s.category && <span style={{ fontSize: 11, color: "#9ca3af" }}>{s.category}</span>}
              </div>
              {s.notes && (
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8, lineHeight: 1.5 }}>{s.notes}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* BOOKS TAB */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {!loading && tab === "books" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: dark }}>Books</div>
            <button
              onClick={() => setShowBookSheet(true)}
              style={{ padding: "7px 16px", borderRadius: 20, border: "none", background: accent, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
            >
              + Log Book
            </button>
          </div>

          {booksThisMonth > 0 && (
            <div style={{ background: `linear-gradient(135deg,${dark},#312e81)`, borderRadius: 14, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 28 }}>📚</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{booksThisMonth} book{booksThisMonth > 1 ? "s" : ""} this month</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>Keep it up, {firstName}!</div>
              </div>
            </div>
          )}

          {books.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af", fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📚</div>
              <div style={{ fontWeight: 700, color: dark, marginBottom: 4 }}>{firstName}&apos;s story starts here</div>
              <div>Log the first book to get started</div>
            </div>
          )}

          {books.map(b => (
            <div key={b.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "14px 16px", marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: dark, marginBottom: 4 }}>{b.title}</div>
              {b.author && <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>by {b.author}</div>}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {b.rating && b.rating > 0 && <Stars rating={b.rating} />}
                {b.category && <span style={{ fontSize: 11, color: "#9ca3af" }}>{b.category}</span>}
                {b.pages && <span style={{ fontSize: 11, color: "#9ca3af" }}>{b.pages} pages</span>}
              </div>
              {b.notes && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8, lineHeight: 1.5 }}>{b.notes}</div>}
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* EVENTS TAB */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {!loading && tab === "events" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: dark }}>Events</div>
            <button
              onClick={() => setShowEventSheet(true)}
              style={{ padding: "7px 16px", borderRadius: 20, border: "none", background: accent, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
            >
              + Add Event
            </button>
          </div>

          {events.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af", fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🌍</div>
              <div style={{ fontWeight: 700, color: dark, marginBottom: 4 }}>{firstName}&apos;s story starts here</div>
              <div>Log the first event to get started</div>
            </div>
          )}

          {(() => {
            const today = new Date().toISOString().split("T")[0];
            const upcoming = events.filter(e => (e.recorded_at ?? "") >= today && e.status === "scheduled");
            const past     = events.filter(e => !upcoming.includes(e));
            return (
              <>
                {upcoming.length > 0 && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", marginBottom: 8, letterSpacing: 0.5 }}>UPCOMING</div>
                )}
                {upcoming.map(e => (
                  <div key={e.id} style={{ background: "#fff", borderRadius: 14, border: `1.5px solid ${accent}`, padding: "14px 16px", marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: dark }}>{e.title}</div>
                      {e.status && <StatusPill status={e.status} />}
                    </div>
                    {e.location && <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>📍 {e.location}</div>}
                    {e.recorded_at && <div style={{ fontSize: 11, color: "#9ca3af" }}>{e.recorded_at}</div>}
                    {e.category && <div style={{ fontSize: 11, color: "#9ca3af" }}>{e.category}</div>}
                  </div>
                ))}

                {past.length > 0 && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", marginBottom: 8, marginTop: upcoming.length > 0 ? 12 : 0, letterSpacing: 0.5 }}>PAST</div>
                )}
                {past.map(e => (
                  <div key={e.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "14px 16px", marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: dark }}>{e.title}</div>
                      {e.status && <StatusPill status={e.status} />}
                    </div>
                    {e.location && <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>📍 {e.location}</div>}
                    {e.recorded_at && <div style={{ fontSize: 11, color: "#9ca3af" }}>{e.recorded_at}</div>}
                    {e.outcome && <div style={{ fontSize: 12, color: "#374151", marginTop: 6, lineHeight: 1.5 }}>{e.outcome}</div>}
                  </div>
                ))}
              </>
            );
          })()}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SHEETS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}

      {showGoalSheet && (
        <Sheet title="Add a Goal" onClose={() => setShowGoalSheet(false)}>
          <Input label="Title" value={gTitle} onChange={setGTitle} placeholder="e.g. Read 10 books this term" />
          <Textarea label="Description (optional)" value={gDesc} onChange={setGDesc} placeholder="What does success look like?" />
          <Input label="Category (optional)" value={gCat} onChange={setGCat} placeholder="e.g. Reading, Sport, Social" />
          <Input label="Target Date (optional)" value={gDate} onChange={setGDate} type="date" />
          <SaveBtn onClick={addGoal} loading={saving} />
        </Sheet>
      )}

      {showSkillSheet && (
        <Sheet title="Log a Skill" onClose={() => setShowSkillSheet(false)}>
          <Input label="Skill Name" value={sName} onChange={setSName} placeholder="e.g. Swimming, Piano, Coding" />
          <Input label="Category (optional)" value={sCat} onChange={setSCat} placeholder="e.g. Sport, Arts, Technology" />
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: dark, marginBottom: 6 }}>Level</div>
            <div style={{ display: "flex", gap: 8 }}>
              {["Beginner", "Intermediate", "Advanced", "Expert"].map(l => (
                <button
                  key={l}
                  onClick={() => setSLevel(l)}
                  style={{
                    flex: 1, padding: "8px 4px", borderRadius: 10,
                    border: `1.5px solid ${sLevel === l ? dark : "#e5e7eb"}`,
                    background: sLevel === l ? dark : "#fff",
                    color: sLevel === l ? "#fff" : "#6b7280",
                    fontWeight: 600, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <Textarea label="Notes (optional)" value={sNotes} onChange={setSNotes} placeholder="How did they show this skill?" />
          <SaveBtn onClick={addSkill} loading={saving} />
        </Sheet>
      )}

      {showBookSheet && (
        <Sheet title="Log a Book" onClose={() => setShowBookSheet(false)}>
          <Input label="Title" value={bTitle} onChange={setBTitle} placeholder="Book title" />
          <Input label="Author (optional)" value={bAuthor} onChange={setBAuthor} placeholder="Author name" />
          <Input label="Category (optional)" value={bCat} onChange={setBCat} placeholder="e.g. Fiction, Science, Adventure" />
          <Input label="Pages (optional)" value={bPages} onChange={setBPages} placeholder="Number of pages" type="number" />
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: dark, marginBottom: 8 }}>Rating</div>
            <Stars rating={bRating} onChange={setBRating} />
          </div>
          <Textarea label="Notes (optional)" value={bNotes} onChange={setBNotes} placeholder="What did they think of it?" />
          <SaveBtn onClick={addBook} loading={saving} />
        </Sheet>
      )}

      {showEventSheet && (
        <Sheet title="Add an Event" onClose={() => setShowEventSheet(false)}>
          <Input label="Title" value={eTitle} onChange={setETitle} placeholder="e.g. School Sports Day" />
          <Textarea label="Description (optional)" value={eDesc} onChange={setEDesc} placeholder="What happened or what to expect?" />
          <Input label="Category (optional)" value={eCat} onChange={setECat} placeholder="e.g. Sport, Art, Academic" />
          <Input label="Location (optional)" value={eLoc} onChange={setELoc} placeholder="Where is it?" />
          <Input label="Date" value={eDate} onChange={setEDate} type="date" />
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: dark, marginBottom: 6 }}>Status</div>
            <div style={{ display: "flex", gap: 8 }}>
              {["scheduled", "past"].map(st => (
                <button
                  key={st}
                  onClick={() => setEStatus(st)}
                  style={{
                    flex: 1, padding: "8px 4px", borderRadius: 10,
                    border: `1.5px solid ${eStatus === st ? dark : "#e5e7eb"}`,
                    background: eStatus === st ? dark : "#fff",
                    color: eStatus === st ? "#fff" : "#6b7280",
                    fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                    textTransform: "capitalize",
                  }}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
          <SaveBtn onClick={addEvent} loading={saving} />
        </Sheet>
      )}

      {toast && <Toast msg={toast} />}
    </div>
  );
}
