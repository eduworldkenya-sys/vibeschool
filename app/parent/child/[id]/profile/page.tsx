"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getLearnerCoreIdentity } from "@/lib/learner/profile-core";

const C = {
  bg: "#f0f2f5", surface: "#ffffff", border: "#e5e7eb", text: "#111827",
  muted: "#6b7280", dark: "#1e1b4b", accent: "#10b981", accentSoft: "#ecfdf5", error: "#ef4444",
};

type CorrectionField = "name" | "admission_number" | "date_of_birth" | "gender";

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

interface CorrectionRequest {
  id: string;
  field: string;
  new_value: string;
  status: string | null;
  review_note: string | null;
  created_at: string | null;
}

interface PageData {
  studentId: string;
  name: string;
  admissionNumber: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  className: string;
  schoolName: string;
  avatarUrl: string;
  family: FamilyProfile | null;
  badgeCount: number;
  canEditFamilyProfile: boolean;
  corrections: CorrectionRequest[];
}

function Card({ children }: { children: React.ReactNode }) {
  return <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 16 }}>{children}</section>;
}
function Heading({ title, sub }: { title: string; sub?: string }) {
  return <div style={{ marginBottom: 13 }}><h2 style={{ margin: 0, fontSize: 15, fontWeight: 850, color: C.text }}>{title}</h2>{sub && <p style={{ margin: "4px 0 0", fontSize: 11, lineHeight: 1.45, color: C.muted }}>{sub}</p>}</div>;
}
function Skeleton({ h = 60 }: { h?: number }) {
  return <div style={{ height: h, borderRadius: 16, background: "linear-gradient(90deg,#f0f0f0 25%,#e5e7eb 50%,#f0f0f0 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />;
}
function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" }) : "—";
}
function fieldLabel(field: string) {
  return ({ name: "Full name", admission_number: "Admission number", date_of_birth: "Date of birth", gender: "Gender" } as Record<string, string>)[field] ?? field;
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
    setLoading(true); setError("");
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) { router.replace("/"); return; }
      setParentId(user.id);
      const { data: link, error: linkError } = await supabase.from("parent_student_links").select("id,can_edit_profile").eq("parent_id", user.id).eq("student_id", studentId).maybeSingle();
      if (linkError || !link) throw new Error("You do not have access to this learner profile.");

      const identity = await getLearnerCoreIdentity(studentId);
      const [{ data: family }, { count: badgeCount }, { data: corrections }] = await Promise.all([
        supabase.from("child_profiles").select("id,nickname,bio,favourite_color,favourite_food,favourite_animal,favourite_sport,favourite_book,photo_url").eq("student_id", studentId).eq("parent_id", user.id).maybeSingle(),
        supabase.from("child_badges").select("id", { count: "exact", head: true }).eq("student_id", studentId),
        supabase.from("child_change_requests").select("id,field,new_value,status,review_note,created_at").eq("student_id", studentId).eq("parent_id", user.id).order("created_at", { ascending: false }).limit(8),
      ]);
      const familyProfile = family as FamilyProfile | null;
      setNickname(familyProfile?.nickname ?? ""); setBio(familyProfile?.bio ?? ""); setFavouriteColor(familyProfile?.favourite_color ?? ""); setFavouriteFood(familyProfile?.favourite_food ?? ""); setFavouriteAnimal(familyProfile?.favourite_animal ?? ""); setFavouriteSport(familyProfile?.favourite_sport ?? ""); setFavouriteBook(familyProfile?.favourite_book ?? "");
      setData({
        studentId: identity.studentId, name: identity.name, admissionNumber: identity.admissionNumber,
        dateOfBirth: identity.dateOfBirth, gender: identity.gender, className: identity.className || "—",
        schoolName: identity.schoolName || "—", avatarUrl: identity.avatarUrl || familyProfile?.photo_url || "",
        family: familyProfile, badgeCount: badgeCount ?? 0, canEditFamilyProfile: link.can_edit_profile === true,
        corrections: (corrections ?? []) as CorrectionRequest[],
      });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Learner profile could not be loaded."); }
    finally { setLoading(false); }
  }, [router, studentId]);
  useEffect(() => { void load(); }, [load]);

  async function saveFamilyNotes() {
    if (!data || !parentId || !data.canEditFamilyProfile) return;
    setSaving(true); setError(""); setNotice("");
    const payload = { student_id: data.studentId, parent_id: parentId, nickname: nickname.trim() || null, bio: bio.trim() || null, favourite_color: favouriteColor.trim() || null, favourite_food: favouriteFood.trim() || null, favourite_animal: favouriteAnimal.trim() || null, favourite_sport: favouriteSport.trim() || null, favourite_book: favouriteBook.trim() || null, updated_at: new Date().toISOString() };
    const result = data.family ? await supabase.from("child_profiles").update(payload).eq("id", data.family.id).select("id").single() : await supabase.from("child_profiles").insert(payload).select("id").single();
    setSaving(false);
    if (result.error) { setError("Family notes could not be saved."); return; }
    setEditing(false); setNotice("Family notes saved. School identity was not changed."); await load();
  }

  async function requestCorrection(field: CorrectionField, currentValue: string) {
    if (!data || !parentId) return;
    const pending = data.corrections.some(item => item.field === field && item.status === "pending");
    if (pending) { setNotice(`A ${fieldLabel(field).toLowerCase()} correction is already awaiting school review.`); return; }
    const next = window.prompt(`Enter the correct ${fieldLabel(field).toLowerCase()}:`, currentValue);
    if (!next?.trim() || next.trim() === currentValue) return;
    const reason = window.prompt("Reason for this correction (optional):", "") ?? "";
    const { error: requestError } = await supabase.from("child_change_requests").insert({ student_id: data.studentId, parent_id: parentId, field, old_value: currentValue, new_value: next.trim(), reason: reason.trim() || null, status: "pending" });
    if (requestError) setError("Correction request could not be sent.");
    else { setNotice("Correction request sent to the school for review."); await load(); }
  }

  const completeness = useMemo(() => {
    const values = [data?.family?.nickname, data?.family?.bio, data?.family?.favourite_color, data?.family?.favourite_food, data?.family?.favourite_animal, data?.family?.favourite_sport, data?.family?.favourite_book];
    return Math.round((values.filter(value => Boolean(value?.trim())).length / values.length) * 100);
  }, [data]);

  if (loading) return <div style={{ padding: 16, display: "grid", gap: 12 }}><style>{`@keyframes shimmer {0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style><Skeleton h={180} /><Skeleton h={130} /><Skeleton h={180} /></div>;
  if (!data) return <div style={{ padding: 20, color: C.error }}>{error || "Learner profile unavailable."}</div>;

  const quickLinks = [["📚", "Learning", `/parent/child/${data.studentId}`], ["🌱", "Growth", `/parent/child/${data.studentId}/growth`], ["🎯", "Life & Goals", `/parent/child/${data.studentId}/life`], ["❤️", "Health", `/parent/child/${data.studentId}/health`], ["📸", "Memories", `/parent/child/${data.studentId}/memories`], ["💳", "Finance", `/parent/child/${data.studentId}/finance`]] as const;
  const familyFacts = [["Favourite colour", data.family?.favourite_color], ["Favourite food", data.family?.favourite_food], ["Favourite animal", data.family?.favourite_animal], ["Favourite sport", data.family?.favourite_sport], ["Favourite book", data.family?.favourite_book]].filter(([, value]) => Boolean(value));

  return <main style={{ background: C.bg, minHeight: "100%", padding: "14px 14px 30px" }}>
    <style>{`@keyframes shimmer {0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    <button onClick={() => router.back()} style={{ border: "none", background: "none", color: C.muted, fontSize: 12, fontWeight: 700, padding: "2px 0 12px", cursor: "pointer" }}>← Back</button>
    <section style={{ background: C.dark, color: "#fff", borderRadius: 22, padding: 18, marginBottom: 12 }}><div style={{ display: "flex", alignItems: "center", gap: 14 }}><div style={{ width: 78, height: 78, borderRadius: "50%", overflow: "hidden", display: "grid", placeItems: "center", background: "#312e81", border: "3px solid rgba(255,255,255,.28)", fontSize: 30, flexShrink: 0 }}>{data.avatarUrl ? <img src={data.avatarUrl} alt={`${data.name} profile`} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🧒"}</div><div style={{ minWidth: 0 }}><div style={{ fontSize: 10, letterSpacing: 1.15, opacity: .65, fontWeight: 800 }}>MY CHILD · LEARNER PROFILE</div><h1 style={{ margin: "4px 0", fontSize: 22, lineHeight: 1.15 }}>{data.name}</h1><p style={{ margin: 0, fontSize: 12, opacity: .76 }}>{data.className}{data.schoolName !== "—" ? ` · ${data.schoolName}` : ""}</p></div></div><p style={{ margin: "14px 0 0", fontSize: 11, lineHeight: 1.55, opacity: .72 }}>One school learner identity, with family context kept separate and permission-controlled.</p></section>
    {error && <div style={{ marginBottom: 10, borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", padding: 11, fontSize: 11 }}>{error}</div>}
    {notice && <div style={{ marginBottom: 10, borderRadius: 12, border: "1px solid #a7f3d0", background: C.accentSoft, color: "#047857", padding: 11, fontSize: 11 }}>{notice}</div>}
    <div style={{ display: "grid", gap: 12 }}>
      <Card><Heading title="School identity" sub="Corrections are reviewed and applied to the canonical learner record." />{[
        ["Full name", data.name, "name"], ["Admission number", data.admissionNumber || "—", "admission_number"], ["Date of birth", formatDate(data.dateOfBirth), "date_of_birth"], ["Gender", data.gender || "—", "gender"], ["Class", data.className, ""], ["School", data.schoolName, ""],
      ].map(([label, value, field]) => <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid #f3f4f6" }}><span style={{ color: C.muted, fontSize: 11 }}>{label}</span><div style={{ display: "flex", alignItems: "center", gap: 8 }}><strong style={{ color: C.text, fontSize: 11, textAlign: "right" }}>{value}</strong>{field && <button onClick={() => void requestCorrection(field as CorrectionField, String(value === "—" ? "" : value))} style={{ border: "none", background: "none", color: C.accent, fontSize: 10, fontWeight: 800, cursor: "pointer", padding: 2 }}>Correct</button>}</div></div>)}</Card>

      {data.corrections.length > 0 && <Card><Heading title="Correction requests" sub="Submitted requests are append-only. School review decides whether canonical identity changes." />{data.corrections.map(item => <div key={item.id} style={{ padding: "9px 0", borderBottom: "1px solid #f3f4f6" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><strong style={{ fontSize: 11 }}>{fieldLabel(item.field)}</strong><span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: item.status === "approved" ? "#047857" : item.status === "rejected" ? "#b91c1c" : "#b45309" }}>{item.status ?? "pending"}</span></div><div style={{ marginTop: 3, fontSize: 10, color: C.muted }}>Requested: {item.new_value}</div>{item.review_note && <div style={{ marginTop: 3, fontSize: 10, color: C.muted }}>School note: {item.review_note}</div>}</div>)}</Card>}

      <Card><Heading title="Family view" sub={`Optional family context · ${completeness}% complete. Health and school identity stay in their authoritative domains.`} />{editing && data.canEditFamilyProfile ? <div style={{ display: "grid", gap: 9 }}>{[["Nickname", nickname, setNickname], ["Favourite colour", favouriteColor, setFavouriteColor], ["Favourite food", favouriteFood, setFavouriteFood], ["Favourite animal", favouriteAnimal, setFavouriteAnimal], ["Favourite sport", favouriteSport, setFavouriteSport], ["Favourite book", favouriteBook, setFavouriteBook]].map(([label, value, setter]) => <label key={String(label)} style={{ display: "grid", gap: 4, fontSize: 10, color: C.muted, fontWeight: 750 }}>{String(label)}<input value={String(value)} onChange={event => (setter as (value: string) => void)(event.target.value)} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 11px", fontFamily: "inherit", fontSize: 12 }} /></label>)}<label style={{ display: "grid", gap: 4, fontSize: 10, color: C.muted, fontWeight: 750 }}>A few words about {data.name.split(" ")[0]}<textarea value={bio} onChange={event => setBio(event.target.value)} rows={3} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 11px", resize: "vertical", fontFamily: "inherit", fontSize: 12 }} /></label><div style={{ display: "flex", gap: 8 }}><button onClick={() => setEditing(false)} style={{ flex: 1, padding: 11, borderRadius: 11, border: `1px solid ${C.border}`, background: "#fff", fontWeight: 800, cursor: "pointer" }}>Cancel</button><button disabled={saving} onClick={() => void saveFamilyNotes()} style={{ flex: 1, padding: 11, borderRadius: 11, border: "none", background: saving ? "#9ca3af" : C.accent, color: "#fff", fontWeight: 800, cursor: "pointer" }}>{saving ? "Saving…" : "Save family notes"}</button></div></div> : <>{(data.family?.nickname || data.family?.bio || familyFacts.length > 0) ? <>{data.family?.nickname && <div style={{ fontSize: 13, fontWeight: 850, color: C.text, marginBottom: 5 }}>Nickname: {data.family.nickname}</div>}{data.family?.bio && <p style={{ margin: "0 0 10px", fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{data.family.bio}</p>}<div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{familyFacts.map(([label, value]) => <span key={String(label)} style={{ borderRadius: 99, background: C.accentSoft, color: "#065f46", padding: "6px 9px", fontSize: 10, fontWeight: 700 }}>{label}: {value}</span>)}</div></> : <p style={{ color: C.muted, fontSize: 11, margin: 0 }}>No family notes yet.</p>}{data.canEditFamilyProfile ? <button onClick={() => setEditing(true)} style={{ width: "100%", marginTop: 12, padding: 10, borderRadius: 11, border: `1px solid ${C.border}`, background: "#fff", color: C.accent, fontWeight: 800, cursor: "pointer" }}>Edit family notes</button> : <div style={{ marginTop: 12, padding: 10, borderRadius: 11, background: "#f8fafc", border: `1px solid ${C.border}`, color: C.muted, fontSize: 10, lineHeight: 1.45 }}>Your current learner-link permissions are view-only for family profile notes.</div>}</>}</Card>
      <Card><Heading title="Learner spaces" sub="Sensitive domains stay separated instead of being flattened into one profile." /><div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>{quickLinks.map(([icon, label, href]) => <button key={label} onClick={() => router.push(href)} style={{ minHeight: 72, borderRadius: 13, border: `1px solid ${C.border}`, background: "#fff", textAlign: "left", padding: 11, cursor: "pointer" }}><span style={{ fontSize: 18 }}>{icon}</span><strong style={{ display: "block", marginTop: 5, fontSize: 11, color: C.text }}>{label}</strong></button>)}</div></Card>
      <Card><Heading title="Achievements" /><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><strong style={{ fontSize: 22, color: C.text }}>{data.badgeCount}</strong><div style={{ fontSize: 10, color: C.muted }}>badges recorded</div></div><button onClick={() => router.push(`/parent/child/${data.studentId}/growth`)} style={{ border: "none", borderRadius: 10, background: C.accentSoft, color: C.accent, fontSize: 10, fontWeight: 850, padding: "9px 11px", cursor: "pointer" }}>View growth</button></div></Card>
      <div style={{ padding: 12, borderRadius: 14, border: `1px dashed ${C.border}`, color: C.muted, fontSize: 10, lineHeight: 1.5, textAlign: "center" }}>Health and emergency information stays in the protected Health area. Academic evidence stays in the learner&apos;s school record. Family notes stay in the permission-controlled parent layer.</div>
    </div>
  </main>;
}
