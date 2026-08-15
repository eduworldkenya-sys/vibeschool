"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const C = {
  bg: "#f0f2f5",
  surface: "#ffffff",
  border: "#e5e7eb",
  text: "#111827",
  muted: "#6b7280",
  dark: "#1e1b4b",
  accent: "#10b981",
  accentSoft: "#ecfdf5",
  error: "#ef4444",
};

interface StudentRecord {
  id: string;
  name: string;
  profile_id: string | null;
  class_id: string | null;
  admission_number: string | null;
  date_of_birth: string | null;
  gender: string | null;
  autonomy_level: number | null;
  self_use_enabled: boolean | null;
}

interface FamilyProfile {
  id: string;
  nickname: string | null;
  bio: string | null;
  favourite_color: string | null;
  favourite_food: string | null;
  favourite_animal: string | null;
  favourite_sport: string | null;
  favourite_book: string | null;
  photo_url: string | null;
}

interface PageData {
  student: StudentRecord;
  className: string;
  schoolName: string;
  avatarUrl: string;
  family: FamilyProfile | null;
  badgeCount: number;
  canEditFamilyProfile: boolean;
}

function Card({ children }: { children: React.ReactNode }) {
  return <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16 }}>{children}</section>;
}

function Heading({ title, sub }: { title: string; sub?: string }) {
  return <div style={{ marginBottom: 13 }}>
    <h2 style={{ margin: 0, fontSize: 15, fontWeight: 850, color: C.text }}>{title}</h2>
    {sub && <p style={{ margin: "4px 0 0", fontSize: 11, lineHeight: 1.45, color: C.muted }}>{sub}</p>}
  </div>;
}

function Skeleton({ h = 60 }: { h?: number }) {
  return <div style={{ height: h, borderRadius: 16, background: "linear-gradient(90deg,#f0f0f0 25%,#e5e7eb 50%,#f0f0f0 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })
    : "—";
}

function requiresParentOptIn(className: string) {
  const match = className.match(/(?:grade|class)\s*(\d+)/i);
  return !match || Number(match[1]) < 6;
}

export default function ParentChildProfilePage() {
  const params = useParams();
  const router = useRouter();
  const studentId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const [parentId, setParentId] = useState("");
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [favouriteColor, setFavouriteColor] = useState("");
  const [favouriteFood, setFavouriteFood] = useState("");
  const [favouriteAnimal, setFavouriteAnimal] = useState("");
  const [favouriteSport, setFavouriteSport] = useState("");
  const [favouriteBook, setFavouriteBook] = useState("");

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError("");

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) { router.replace("/"); return; }
      setParentId(user.id);

      const { data: link, error: linkError } = await supabase
        .from("parent_student_links")
        .select("id,can_edit_profile")
        .eq("parent_id", user.id)
        .eq("student_id", studentId)
        .maybeSingle();

      if (linkError || !link) throw new Error("You do not have access to this learner profile.");

      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("*")
        .eq("id", studentId)
        .single();

      if (studentError || !student) throw new Error("Learner record could not be loaded.");

      let className = "—";
      let schoolName = "—";
      if (student.class_id) {
        const { data: cls } = await supabase
          .from("classes")
          .select("name,stream,school_id")
          .eq("id", student.class_id)
          .maybeSingle();
        if (cls) {
          className = cls.name + (cls.stream ? ` ${cls.stream}` : "");
          if (cls.school_id) {
            const { data: school } = await supabase.from("schools").select("name").eq("id", cls.school_id).maybeSingle();
            schoolName = school?.name ?? "—";
          }
        }
      }

      let avatarUrl = "";
      if (student.profile_id) {
        const { data: account } = await supabase.from("profiles").select("avatar_url").eq("id", student.profile_id).maybeSingle();
        avatarUrl = account?.avatar_url ?? "";
      }

      const { data: family } = await supabase
        .from("child_profiles")
        .select("id,nickname,bio,favourite_color,favourite_food,favourite_animal,favourite_sport,favourite_book,photo_url")
        .eq("student_id", studentId)
        .eq("parent_id", user.id)
        .maybeSingle();

      const { count: badgeCount } = await supabase
        .from("child_badges")
        .select("id", { count: "exact", head: true })
        .eq("student_id", studentId);

      const familyProfile = family as FamilyProfile | null;
      setNickname(familyProfile?.nickname ?? "");
      setBio(familyProfile?.bio ?? "");
      setFavouriteColor(familyProfile?.favourite_color ?? "");
      setFavouriteFood(familyProfile?.favourite_food ?? "");
      setFavouriteAnimal(familyProfile?.favourite_animal ?? "");
      setFavouriteSport(familyProfile?.favourite_sport ?? "");
      setFavouriteBook(familyProfile?.favourite_book ?? "");

      setData({
        student: student as unknown as StudentRecord,
        className,
        schoolName,
        avatarUrl: avatarUrl || familyProfile?.photo_url || "",
        family: familyProfile,
        badgeCount: badgeCount ?? 0,
        canEditFamilyProfile: link.can_edit_profile === true,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Learner profile could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [router, studentId]);

  useEffect(() => { void load(); }, [load]);

  async function setStudentSelfUse(enabled: boolean) {
    if (!data) return;
    setError("");
    setNotice("");
    const previous = data.student.self_use_enabled === true;
    setData(current => current ? { ...current, student: { ...current.student, self_use_enabled: enabled } } : current);
    const { error: rpcError } = await supabase.rpc("parent_set_student_self_use", { p_student_id: data.student.id, p_enabled: enabled });
    if (rpcError) {
      setData(current => current ? { ...current, student: { ...current.student, self_use_enabled: previous } } : current);
      setError("We could not update student access. Please try again.");
      return;
    }
    setNotice(enabled ? `${data.student.name} can now use their own account.` : `${data.student.name} will need your permission to use their own account.`);
  }

  async function saveFamilyNotes() {
    if (!data || !parentId || !data.canEditFamilyProfile) return;
    setSaving(true);
    setError("");
    setNotice("");

    const payload = {
      student_id: data.student.id,
      parent_id: parentId,
      nickname: nickname.trim() || null,
      bio: bio.trim() || null,
      favourite_color: favouriteColor.trim() || null,
      favourite_food: favouriteFood.trim() || null,
      favourite_animal: favouriteAnimal.trim() || null,
      favourite_sport: favouriteSport.trim() || null,
      favourite_book: favouriteBook.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const result = data.family
      ? await supabase.from("child_profiles").update(payload).eq("id", data.family.id).select("id").single()
      : await supabase.from("child_profiles").insert(payload).select("id").single();

    setSaving(false);
    if (result.error) { setError("Family notes could not be saved."); return; }
    setEditing(false);
    setNotice("Family notes saved. School identity was not changed.");
    await load();
  }

  async function requestCorrection(field: string, currentValue: string) {
    if (!data || !parentId) return;
    const next = window.prompt(`Enter the correct ${field}:`, currentValue);
    if (!next?.trim() || next.trim() === currentValue) return;

    const reason = window.prompt("Reason for this correction (optional):", "") ?? "";

    const { error: requestError } = await supabase.from("child_change_requests").insert({
      student_id: data.student.id,
      parent_id: parentId,
      field,
      old_value: currentValue,
      new_value: next.trim(),
      reason: reason.trim() || null,
      status: "pending",
    });

    if (requestError) setError("Correction request could not be sent.");
    else setNotice("Correction request sent to the school for review.");
  }

  if (loading) return <div style={{ padding: 16, display: "grid", gap: 12 }}><style>{`@keyframes shimmer {0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style><Skeleton h={180} /><Skeleton h={130} /><Skeleton h={180} /></div>;
  if (!data) return <div style={{ padding: 20, color: C.error }}>{error || "Learner profile unavailable."}</div>;

  const s = data.student;
  const quickLinks = [
    ["📚", "Learning", `/parent/child/${s.id}`],
    ["🌱", "Growth", `/parent/child/${s.id}/growth`],
    ["🎯", "Life & Goals", `/parent/child/${s.id}/life`],
    ["❤️", "Health", `/parent/child/${s.id}/health`],
    ["📸", "Memories", `/parent/child/${s.id}/memories`],
    ["💳", "Finance", `/parent/child/${s.id}/finance`],
  ] as const;

  const familyFacts = [
    ["Favourite colour", data.family?.favourite_color],
    ["Favourite food", data.family?.favourite_food],
    ["Favourite animal", data.family?.favourite_animal],
    ["Favourite sport", data.family?.favourite_sport],
    ["Favourite book", data.family?.favourite_book],
  ].filter(([, value]) => Boolean(value));

  return <main style={{ background: C.bg, minHeight: "100%", padding: "14px 14px 30px" }}>
    <style>{`@keyframes shimmer {0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    <button onClick={() => router.back()} style={{ border: "none", background: "none", color: C.muted, fontSize: 12, fontWeight: 700, padding: "2px 0 12px", cursor: "pointer" }}>← Back</button>

    <section style={{ background: C.dark, color: "#fff", borderRadius: 22, padding: 18, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 78, height: 78, borderRadius: "50%", overflow: "hidden", display: "grid", placeItems: "center", background: "#312e81", border: "3px solid rgba(255,255,255,.28)", fontSize: 30, flexShrink: 0 }}>
          {data.avatarUrl ? <img src={data.avatarUrl} alt={`${s.name} profile`} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🧒"}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, letterSpacing: 1.15, opacity: .65, fontWeight: 800 }}>MY CHILD · LEARNER PROFILE</div>
          <h1 style={{ margin: "4px 0", fontSize: 22, lineHeight: 1.15 }}>{s.name}</h1>
          <p style={{ margin: 0, fontSize: 12, opacity: .76 }}>{data.className}{data.schoolName !== "—" ? ` · ${data.schoolName}` : ""}</p>
        </div>
      </div>
      <p style={{ margin: "14px 0 0", fontSize: 11, lineHeight: 1.55, opacity: .72 }}>The school learner record is shared across student, teacher and parent views. Family notes are a separate permission-controlled layer and cannot silently overwrite school identity.</p>
    </section>

    {error && <div style={{ marginBottom: 10, borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", padding: 11, fontSize: 11 }}>{error}</div>}
    {notice && <div style={{ marginBottom: 10, borderRadius: 12, border: "1px solid #a7f3d0", background: C.accentSoft, color: "#047857", padding: 11, fontSize: 11 }}>{notice}</div>}

    <div style={{ display: "grid", gap: 12 }}>
      {requiresParentOptIn(data.className) && <Card>
        <Heading title="Student account access" sub={s.self_use_enabled ? `${s.name} has permission to use their own account.` : `${s.name} needs your permission before using their own account.`} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
          <div style={{ minWidth: 0 }}><strong style={{ display: "block", fontSize: 12, color: C.text }}>{s.self_use_enabled ? "Self-use enabled" : "Parent permission required"}</strong><p style={{ margin: "4px 0 0", fontSize: 10, lineHeight: 1.45, color: C.muted }}>You can change this anytime. VibeSchool checks your permission when the learner claims their account.</p></div>
          <button type="button" role="switch" aria-checked={s.self_use_enabled === true} aria-label={`${s.self_use_enabled ? "Disable" : "Enable"} independent student access for ${s.name}`} onClick={() => void setStudentSelfUse(!(s.self_use_enabled === true))} style={{ width: 52, height: 30, flexShrink: 0, borderRadius: 99, border: "none", padding: 3, background: s.self_use_enabled ? C.accent : "#d1d5db", cursor: "pointer" }}><span style={{ display: "block", width: 24, height: 24, borderRadius: "50%", background: "#fff", transform: s.self_use_enabled ? "translateX(22px)" : "translateX(0)", transition: "transform .15s ease", boxShadow: "0 1px 3px rgba(0,0,0,.18)" }} /></button>
        </div>
      </Card>}

      <Card>
        <Heading title="School identity" sub="These facts come from the canonical learner record. Corrections go through review instead of changing only the parent view." />
        {[
          ["Full name", s.name, "full_name"],
          ["Admission number", s.admission_number || "—", "admission_number"],
          ["Date of birth", formatDate(s.date_of_birth), "date_of_birth"],
          ["Gender", s.gender || "—", "gender"],
          ["Class", data.className, ""],
          ["School", data.schoolName, ""],
        ].map(([label, value, field]) => <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid #f3f4f6" }}>
          <span style={{ color: C.muted, fontSize: 11 }}>{label}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong style={{ color: C.text, fontSize: 11, textAlign: "right" }}>{value}</strong>
            {field && <button onClick={() => void requestCorrection(field, String(value === "—" ? "" : value))} style={{ border: "none", background: "none", color: C.accent, fontSize: 10, fontWeight: 800, cursor: "pointer", padding: 2 }}>Correct</button>}
          </div>
        </div>)}
      </Card>

      <Card>
        <Heading title="Family view" sub="Optional family context. It enriches your view of the child but does not redefine their school identity or Twin evidence." />
        {editing && data.canEditFamilyProfile ? <div style={{ display: "grid", gap: 9 }}>
          {[
            ["Nickname", nickname, setNickname],
            ["Favourite colour", favouriteColor, setFavouriteColor],
            ["Favourite food", favouriteFood, setFavouriteFood],
            ["Favourite animal", favouriteAnimal, setFavouriteAnimal],
            ["Favourite sport", favouriteSport, setFavouriteSport],
            ["Favourite book", favouriteBook, setFavouriteBook],
          ].map(([label, value, setter]) => <label key={String(label)} style={{ display: "grid", gap: 4, fontSize: 10, color: C.muted, fontWeight: 750 }}>{String(label)}<input value={String(value)} onChange={event => (setter as (value: string) => void)(event.target.value)} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 11px", fontFamily: "inherit", fontSize: 12 }} /></label>)}
          <label style={{ display: "grid", gap: 4, fontSize: 10, color: C.muted, fontWeight: 750 }}>A few words about {s.name.split(" ")[0]}<textarea value={bio} onChange={event => setBio(event.target.value)} rows={3} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 11px", resize: "vertical", fontFamily: "inherit", fontSize: 12 }} /></label>
          <div style={{ display: "flex", gap: 8 }}><button onClick={() => setEditing(false)} style={{ flex: 1, padding: 11, borderRadius: 11, border: `1px solid ${C.border}`, background: "#fff", fontWeight: 800, cursor: "pointer" }}>Cancel</button><button disabled={saving} onClick={() => void saveFamilyNotes()} style={{ flex: 1, padding: 11, borderRadius: 11, border: "none", background: saving ? "#9ca3af" : C.accent, color: "#fff", fontWeight: 800, cursor: "pointer" }}>{saving ? "Saving…" : "Save family notes"}</button></div>
        </div> : <>
          {(data.family?.nickname || data.family?.bio || familyFacts.length > 0) ? <>
            {data.family?.nickname && <div style={{ fontSize: 13, fontWeight: 850, color: C.text, marginBottom: 5 }}>Nickname: {data.family.nickname}</div>}
            {data.family?.bio && <p style={{ margin: "0 0 10px", fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{data.family.bio}</p>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{familyFacts.map(([label, value]) => <span key={String(label)} style={{ borderRadius: 99, background: C.accentSoft, color: "#065f46", padding: "6px 9px", fontSize: 10, fontWeight: 700 }}>{label}: {value}</span>)}</div>
          </> : <p style={{ color: C.muted, fontSize: 11, margin: 0 }}>No family notes yet.</p>}
          {data.canEditFamilyProfile ? <button onClick={() => setEditing(true)} style={{ width: "100%", marginTop: 12, padding: 10, borderRadius: 11, border: `1px solid ${C.border}`, background: "#fff", color: C.accent, fontWeight: 800, cursor: "pointer" }}>Edit family notes</button> : <div style={{ marginTop: 12, padding: 10, borderRadius: 11, background: "#f8fafc", border: `1px solid ${C.border}`, color: C.muted, fontSize: 10, lineHeight: 1.45 }}>Your current learner-link permissions are view-only for family profile notes.</div>}
        </>}
      </Card>

      <Card>
        <Heading title="Learner spaces" sub="Keep each sensitive domain in the right place instead of mixing everything into one profile." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>{quickLinks.map(([icon, label, href]) => <button key={label} onClick={() => router.push(href)} style={{ minHeight: 72, borderRadius: 13, border: `1px solid ${C.border}`, background: "#fff", textAlign: "left", padding: 11, cursor: "pointer" }}><span style={{ fontSize: 18 }}>{icon}</span><strong style={{ display: "block", marginTop: 5, fontSize: 11, color: C.text }}>{label}</strong></button>)}</div>
      </Card>

      <Card>
        <Heading title="Achievements" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><strong style={{ fontSize: 22, color: C.text }}>{data.badgeCount}</strong><div style={{ fontSize: 10, color: C.muted }}>badges recorded</div></div><button onClick={() => router.push(`/parent/child/${s.id}/growth`)} style={{ border: "none", borderRadius: 10, background: C.accentSoft, color: C.accent, fontSize: 10, fontWeight: 850, padding: "9px 11px", cursor: "pointer" }}>View growth</button></div>
      </Card>

      <div style={{ padding: 12, borderRadius: 14, border: `1px dashed ${C.border}`, color: C.muted, fontSize: 10, lineHeight: 1.5, textAlign: "center" }}>Health and emergency information stays in the protected Health area. Academic evidence stays in the learner&apos;s school record. Family notes stay in the permission-controlled parent layer.</div>
    </div>
  </main>;
}
