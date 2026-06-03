export const dynamic = 'force-dynamic'

"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter }             from "next/navigation";
import { supabase }                         from "@/lib/supabase";
import type { ChildProfile, ChildBadge, StudentFull } from "@/lib/types";

// ─── Colors ──────────────────────────────────────────────────────────────────
const dark   = "#1e1b4b";
const accent = "#10b981";
const bg     = "#f0f2f5";
const red    = "#ef4444";
const amber  = "#f59e0b";

// ─── Completeness scoring ─────────────────────────────────────────────────────
function calcScore(p: Partial<ChildProfile>): number {
  let s = 0;
  if (p.photo_url)               s += 15;
  if (p.nickname?.trim())        s += 5;
  if (p.bio?.trim())             s += 10;
  if (p.favourite_color?.trim()) s += 5;
  if (p.favourite_food?.trim())  s += 5;
  if (p.favourite_animal?.trim())s += 5;
  if (p.favourite_sport?.trim()) s += 5;
  if (p.favourite_book?.trim())  s += 5;
  if (p.blood_group?.trim())     s += 10;
  if (p.allergies?.trim())       s += 10;
  if (p.emergency_contact_name?.trim() && p.emergency_contact_phone?.trim()) s += 15;
  return s;
}

function nudgeMessage(p: Partial<ChildProfile>, firstName: string): string {
  if (!p.photo_url)               return `Add ${firstName}'s photo — it makes this page come alive.`;
  if (!p.blood_group?.trim())     return `Add ${firstName}'s blood group — it keeps them safe anywhere.`;
  if (!p.emergency_contact_name?.trim()) return `Who do we call if ${firstName} needs help? Add an emergency contact.`;
  if (!p.allergies?.trim())       return `Does ${firstName} have any allergies? A small detail that matters a lot.`;
  if (!p.bio?.trim())             return `Tell ${firstName}'s story in a few words. Every word counts.`;
  if (!p.favourite_color?.trim()) return `What is ${firstName}'s favourite colour?`;
  if (!p.favourite_food?.trim())  return `What does ${firstName} love to eat?`;
  if (!p.favourite_sport?.trim()) return `What sport does ${firstName} play?`;
  if (!p.favourite_book?.trim())  return `What book has ${firstName} read lately?`;
  if (!p.favourite_animal?.trim())return `What is ${firstName}'s favourite animal?`;
  return `${firstName}'s profile is complete. You are an amazing parent.`;
}

function calcAge(dob: string | null): string {
  if (!dob) return "";
  const diff = Date.now() - new Date(dob).getTime();
  const age  = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  return `Age ${age}`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ w = "100%", h = 16, radius = 8 }: { w?: string | number; h?: number; radius?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius, flexShrink: 0,
      background: "linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
    }} />
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ animation: "fadeIn 0.2s ease", paddingBottom: 120 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 28, marginBottom: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <Skeleton w={96} h={96} radius={48} />
        <Skeleton w={160} h={18} />
        <Skeleton w={110} h={12} />
        <Skeleton w={200} h={10} />
      </div>
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, marginBottom: 12 }}>
        {[1,2,3,4].map(i => <div key={i} style={{ marginBottom: 14 }}><Skeleton h={13} /></div>)}
      </div>
      <div style={{ background: "#fff", borderRadius: 16, padding: 20 }}>
        {[1,2].map(i => <div key={i} style={{ marginBottom: 14 }}><Skeleton h={13} /></div>)}
      </div>
    </div>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function Toast({ msg, type = "dark" }: { msg: string; type?: "dark" | "badge" }) {
  return (
    <div style={{
      position:  "fixed",
      bottom:    100,
      left:      "50%",
      transform: "translateX(-50%)",
      background: type === "badge" ? accent : dark,
      color:     "#fff",
      padding:   "12px 24px",
      borderRadius: 14,
      fontSize:  13,
      fontWeight: 700,
      zIndex:    9999,
      animation: "fadeIn 0.2s ease",
      boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
      whiteSpace: "nowrap",
      maxWidth:  "90vw",
      textAlign: "center",
    }}>
      {msg}
    </div>
  );
}

// ─── Offline banner ───────────────────────────────────────────────────────────
function OfflineBanner() {
  return (
    <div style={{
      background: amber, color: "#fff",
      padding:    "8px 16px",
      fontSize:   12, fontWeight: 700,
      textAlign:  "center",
      borderRadius: 10,
      marginBottom: 12,
    }}>
      You are offline — changes will not save until you reconnect.
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color: dark }}>{title}</span>
    </div>
  );
}

// ─── Field row ────────────────────────────────────────────────────────────────
function FieldRow({
  label, value, editMode, inputValue, onChange, placeholder, multiline,
}: {
  label:       string;
  value:       string | null;
  editMode:    boolean;
  inputValue:  string;
  onChange:    (v: string) => void;
  placeholder: string;
  multiline?:  boolean;
}) {
  const empty = !value?.trim();
  if (!editMode && empty) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </div>
      {editMode ? (
        multiline ? (
          <textarea
            value={inputValue}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            rows={3}
            style={{
              width: "100%", borderRadius: 10, border: "1.5px solid #e5e7eb",
              padding: "10px 12px", fontSize: 13, color: dark, fontFamily: "inherit",
              resize: "vertical", outline: "none", background: "#f9fafb",
              boxSizing: "border-box",
            }}
          />
        ) : (
          <input
            value={inputValue}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            style={{
              width: "100%", borderRadius: 10, border: "1.5px solid #e5e7eb",
              padding: "10px 12px", fontSize: 13, color: dark, fontFamily: "inherit",
              outline: "none", background: "#f9fafb", boxSizing: "border-box",
            }}
          />
        )
      ) : (
        <div style={{ fontSize: 14, color: "#111827", fontWeight: 500, lineHeight: 1.5 }}>
          {value}
        </div>
      )}
    </div>
  );
}

// ─── Favourite chip ───────────────────────────────────────────────────────────
function FavChip({ icon, label, value }: { icon: string; label: string; value: string | null }) {
  if (!value?.trim()) return null;
  return (
    <div style={{
      display:      "inline-flex",
      alignItems:   "center",
      gap:          6,
      background:   "#f0fdf4",
      border:       "1px solid #d1fae5",
      borderRadius: 20,
      padding:      "6px 12px",
      fontSize:     13,
      color:        "#065f46",
      fontWeight:   600,
      margin:       "0 6px 8px 0",
    }}>
      <span>{icon}</span>
      <span style={{ fontSize: 11, color: "#6b7280" }}>{label}:</span>
      <span>{value}</span>
    </div>
  );
}

// ─── Request change bottom sheet ──────────────────────────────────────────────
function RequestChangeSheet({
  field, currentValue, studentId, parentId, onClose, showToast,
}: {
  field:        string;
  currentValue: string;
  studentId:    string;
  parentId:     string;
  onClose:      () => void;
  showToast:    (msg: string) => void;
}) {
  const [newValue, setNewValue] = useState("");
  const [reason,   setReason]   = useState("");
  const [saving,   setSaving]   = useState(false);

  async function submit() {
    if (!newValue.trim()) return;
    setSaving(true);
    await supabase.from("child_change_requests").insert({
      student_id: studentId,
      parent_id:  parentId,
      field,
      old_value:  currentValue,
      new_value:  newValue.trim(),
      reason:     reason.trim() || null,
      status:     "pending",
    });
    setSaving(false);
    onClose();
    showToast("Change request sent to the school.");
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: "28px 24px 48px", width: "100%", maxWidth: 640, animation: "slideUp 0.22s ease" }}
      >
        <div style={{ fontSize: 15, fontWeight: 800, color: dark, marginBottom: 4 }}>Request a Change</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>
          The school will review your request and update the record.
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>Current {field}</div>
        <div style={{ fontSize: 13, color: "#374151", marginBottom: 16, padding: "8px 12px", background: bg, borderRadius: 8 }}>{currentValue || "—"}</div>
        <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>New {field}</div>
        <input
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
          placeholder={`Enter correct ${field}`}
          style={{ width: "100%", borderRadius: 10, border: "1.5px solid #e5e7eb", padding: "10px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 14, boxSizing: "border-box" }}
        />
        <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>Reason (optional)</div>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Why does this need to change?"
          rows={2}
          style={{ width: "100%", borderRadius: 10, border: "1.5px solid #e5e7eb", padding: "10px 12px", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", marginBottom: 20, boxSizing: "border-box" }}
        />
        <button
          onClick={submit}
          disabled={saving || !newValue.trim()}
          style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: saving || !newValue.trim() ? "#d1d5db" : accent, color: "#fff", fontWeight: 700, fontSize: 15, cursor: saving || !newValue.trim() ? "not-allowed" : "pointer", fontFamily: "inherit" }}
        >
          {saving ? "Sending..." : "Send Request"}
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ChildProfilePage() {
  const params   = useParams();
  const router   = useRouter();
  const id       = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const [loading,      setLoading]      = useState(true);
  const [offline,      setOffline]      = useState(false);
  const [student,      setStudent]      = useState<StudentFull | null>(null);
  const [profile,      setProfile]      = useState<ChildProfile | null>(null);
  const [badges,       setBadges]       = useState<ChildBadge[]>([]);
  const [parentId,     setParentId]     = useState("");
  const [className,    setClassName]    = useState("—");
  const [schoolName,   setSchoolName]   = useState("—");
  const [editMode,     setEditMode]     = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [toastMsg,     setToastMsg]     = useState<string | null>(null);
  const [toastType,    setToastType]    = useState<"dark"|"badge">("dark");
  const [changeField,  setChangeField]  = useState<string | null>(null);

  // ── Draft state ────────────────────────────────────────────────────────────
  const [dNickname,   setDNickname]   = useState("");
  const [dBio,        setDBio]        = useState("");
  const [dColor,      setDColor]      = useState("");
  const [dFood,       setDFood]       = useState("");
  const [dAnimal,     setDAnimal]     = useState("");
  const [dSport,      setDSport]      = useState("");
  const [dBook,       setDBook]       = useState("");
  const [dBlood,      setDBlood]      = useState("");
  const [dAllergies,  setDAllergies]  = useState("");
  const [dMedical,    setDMedical]    = useState("");
  const [dSpecial,    setDSpecial]    = useState("");
  const [dEcName,     setDEcName]     = useState("");
  const [dEcPhone,    setDEcPhone]    = useState("");

  // ── Toast helper ───────────────────────────────────────────────────────────
  const fireToast = useCallback((msg: string, type: "dark"|"badge" = "dark") => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(null), 3000);
  }, []);

  // ── Offline detection ──────────────────────────────────────────────────────
  useEffect(() => {
    const on  = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    setOffline(!navigator.onLine);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // ── Fetch all ──────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!id) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/academy/signin?role=parent"); return; }
    setParentId(user.id);

    // Student
    const { data: stu } = await supabase
      .from("students")
      .select("id, name, class_id, admission_number, date_of_birth, gender, autonomy_level")
      .eq("id", id)
      .single();
    if (!stu) { setLoading(false); return; }
    setStudent(stu as StudentFull);

    // Class
    const { data: cls } = stu.class_id
      ? await supabase.from("classes").select("id, name, stream, school_id").eq("id", stu.class_id).single()
      : { data: null };
    setClassName(cls ? cls.name + (cls.stream ? " " + cls.stream : "") : "—");

    // School
    const { data: sch } = cls?.school_id
      ? await supabase.from("schools").select("id, name").eq("id", cls.school_id).single()
      : { data: null };
    setSchoolName(sch?.name ?? "—");

    // Child profile
    const { data: cp } = await supabase
      .from("child_profiles")
      .select("*")
      .eq("student_id", id)
      .eq("parent_id", user.id)
      .maybeSingle();
    if (cp) {
      setProfile(cp as ChildProfile);
      loadDraft(cp as ChildProfile);
    }

    // Badges
    const { data: cb } = await supabase
      .from("child_badges")
      .select("id, student_id, badge_id, earned_at, awarded_by, badges(code, name, icon, description)")
      .eq("student_id", id);
    setBadges((cb ?? []) as unknown as ChildBadge[]);

    setLoading(false);
  }, [id, router]);

  function loadDraft(cp: ChildProfile) {
    setDNickname(cp.nickname          ?? "");
    setDBio(cp.bio                    ?? "");
    setDColor(cp.favourite_color      ?? "");
    setDFood(cp.favourite_food        ?? "");
    setDAnimal(cp.favourite_animal    ?? "");
    setDSport(cp.favourite_sport      ?? "");
    setDBook(cp.favourite_book        ?? "");
    setDBlood(cp.blood_group          ?? "");
    setDAllergies(cp.allergies        ?? "");
    setDMedical(cp.medical_notes      ?? "");
    setDSpecial(cp.special_needs      ?? "");
    setDEcName(cp.emergency_contact_name  ?? "");
    setDEcPhone(cp.emergency_contact_phone ?? "");
  }

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Badge check ────────────────────────────────────────────────────────────
  async function checkBadges(score: number, stuId: string, pId: string, existingBadges: ChildBadge[]) {
    const earned = existingBadges.map(b => b.badges?.code);

    if (score >= 50 && !earned.includes("life_builder_1")) {
      const { data: badge } = await supabase.from("badges").select("id").eq("code", "life_builder_1").single();
      if (badge) {
        await supabase.from("child_badges").insert({ student_id: stuId, badge_id: badge.id, awarded_by: "system" });
        fireToast("🏗️ Life Builder I unlocked — profile 50% complete!", "badge");
      }
    }
    if (score === 100 && !earned.includes("life_builder_2")) {
      const { data: badge } = await supabase.from("badges").select("id").eq("code", "life_builder_2").single();
      if (badge) {
        await supabase.from("child_badges").insert({ student_id: stuId, badge_id: badge.id, awarded_by: "system" });
        fireToast("🏗️ Life Builder II unlocked — profile 100% complete!", "badge");
      }
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!student || !parentId || offline) {
      if (offline) fireToast("You are offline — please reconnect to save.");
      return;
    }
    setSaving(true);

    const payload = {
      student_id:              student.id,
      parent_id:               parentId,
      nickname:                dNickname.trim()  || null,
      bio:                     dBio.trim()       || null,
      favourite_color:         dColor.trim()     || null,
      favourite_food:          dFood.trim()      || null,
      favourite_animal:        dAnimal.trim()    || null,
      favourite_sport:         dSport.trim()     || null,
      favourite_book:          dBook.trim()      || null,
      blood_group:             dBlood.trim()     || null,
      allergies:               dAllergies.trim() || null,
      medical_notes:           dMedical.trim()   || null,
      special_needs:           dSpecial.trim()   || null,
      emergency_contact_name:  dEcName.trim()    || null,
      emergency_contact_phone: dEcPhone.trim()   || null,
      updated_at:              new Date().toISOString(),
    };

    const { data: saved, error } = profile
      ? await supabase.from("child_profiles").update(payload).eq("id", profile.id).select().single()
      : await supabase.from("child_profiles").insert(payload).select().single();

    if (error) {
      fireToast("Something went wrong — try again.");
      setSaving(false);
      return;
    }

    const updated = saved as ChildProfile;
    setProfile(updated);
    loadDraft(updated);

    const score = calcScore(updated);
    await checkBadges(score, student.id, parentId, badges);

    // Refresh badges
    const { data: cb } = await supabase
      .from("child_badges")
      .select("id, student_id, badge_id, earned_at, awarded_by, badges(code, name, icon, description)")
      .eq("student_id", student.id);
    setBadges((cb ?? []) as unknown as ChildBadge[]);

    setSaving(false);
    setEditMode(false);
    if (!toastMsg) fireToast("Profile saved.");
  }

  function cancelEdit() {
    if (profile) loadDraft(profile);
    setEditMode(false);
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  if (loading) return <LoadingSkeleton />;
  if (!student) return (
    <div style={{ textAlign: "center", padding: 48, color: "#6b7280", fontSize: 14 }}>
      Child not found.
    </div>
  );

  const firstName  = student.name.split(" ")[0];
  const score      = calcScore(profile ?? {});
  const nudge      = nudgeMessage(profile ?? {}, firstName);
  const age        = calcAge(student.date_of_birth);
  const genderIcon = student.gender === "female" ? "👧" : student.gender === "male" ? "👦" : "🧒";
  const hasProfile = !!profile;

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!hasProfile && !editMode) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: "40px 24px", textAlign: "center", animation: "fadeIn 0.3s ease" }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>🌱</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: dark, marginBottom: 10 }}>
          {firstName}&apos;s story starts here.
        </div>
        <div style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.7, maxWidth: 320, marginBottom: 32 }}>
          Add a photo, a favourite colour, or a few words about who {firstName} is.
          Every detail becomes part of their life record.
        </div>
        <button
          onClick={() => setEditMode(true)}
          style={{ padding: "14px 32px", borderRadius: 14, border: "none", background: accent, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 18px rgba(16,185,129,0.35)" }}
        >
          Start {firstName}&apos;s Profile
        </button>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{transform:translateY(40px);opacity:0} to{transform:translateY(0);opacity:1} }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ paddingBottom: 140, animation: "fadeIn 0.25s ease", maxWidth: 720, margin: "0 auto" }}>

        {/* ── CHILD HUB TABS ── */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
          {[
            { label: "👤 Profile", href: "profile", active: true },
            { label: "🌱 Life",     href: "life",    active: false },
            { label: "📈 Growth",  href: "growth",  active: false },
            { label: "💰 Finance", href: "finance", active: false },
            { label: "📸 Memories",href: "memories",active: false },
            { label: "❤️ Health",  href: "health",  active: false },
          ].map(t => (
            <button key={t.href} onClick={() => router.push(`/parent/child/${id}/${t.href}`)} style={{ flexShrink: 0, padding: "8px 16px", borderRadius: 20, border: "1.5px solid", borderColor: t.active ? dark : "#e5e7eb", background: t.active ? dark : "#fff", color: t.active ? "#fff" : "#6b7280", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{t.label}</button>
          ))}
        </div>
        {offline && <OfflineBanner />}

        {/* ── HERO ── */}
        <div style={{
          background:    "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
          borderRadius:  20,
          padding:       "28px 20px 24px",
          marginBottom:  16,
          display:       "flex",
          flexDirection: "column",
          alignItems:    "center",
          textAlign:     "center",
          gap:           6,
          position:      "relative",
        }}>
          {/* Photo circle */}
          <div style={{
            width:        96,
            height:       96,
            borderRadius: "50%",
            background:   profile?.photo_url ? "transparent" : accent,
            backgroundImage: profile?.photo_url ? `url(${profile.photo_url})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            display:      "flex",
            alignItems:   "center",
            justifyContent: "center",
            fontSize:     38,
            fontWeight:   900,
            color:        "#fff",
            marginBottom: 8,
            boxShadow:    "0 4px 20px rgba(16,185,129,0.45)",
            border:       "3px solid rgba(255,255,255,0.2)",
            cursor:       "pointer",
          }}>
            {!profile?.photo_url && student.name[0].toUpperCase()}
          </div>
          {editMode && (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: -4, marginBottom: 4 }}>
              Photo upload coming soon
            </div>
          )}

          {/* Name */}
          <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: -0.4 }}>
            {student.name}
          </div>

          {/* Nickname */}
          {profile?.nickname && (
            <div style={{ fontSize: 13, color: accent, fontWeight: 700, fontStyle: "italic" }}>
              "{profile.nickname}"
            </div>
          )}

          {/* Meta row */}
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {age && <span>{age}</span>}
            {student.gender && <span>{genderIcon} {student.gender}</span>}
            <span>{className}</span>
            <span>{schoolName}</span>
          </div>
        </div>

        {/* ── COMPLETENESS BAR ── */}
        <div style={{ background: "#fff", borderRadius: 16, padding: "16px 18px", marginBottom: 14, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: dark }}>
              {firstName}&apos;s profile is {score}% complete
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: score === 100 ? accent : amber }}>
              {score === 100 ? "Complete ✓" : `${100 - score} pts left`}
            </div>
          </div>
          <div style={{ height: 8, borderRadius: 6, background: "#f3f4f6", overflow: "hidden" }}>
            <div style={{
              height:       "100%",
              width:        `${score}%`,
              borderRadius: 6,
              background:   score === 100 ? accent : score >= 50 ? accent : amber,
              transition:   "width 0.6s ease",
            }} />
          </div>
          {score < 100 && (
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8, lineHeight: 1.5 }}>
              💡 {nudge}
            </div>
          )}
        </div>

        {/* ── FAVOURITE THINGS ── */}
        <div style={{ background: "#fff", borderRadius: 16, padding: "18px", marginBottom: 14, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <SectionHeader icon="✨" title={`Who ${firstName} Is`} />

          {/* Chips — view mode */}
          {!editMode && (
            <div style={{ display: "flex", flexWrap: "wrap", marginBottom: profile?.bio ? 12 : 0 }}>
              <FavChip icon="🎨" label="Colour"  value={profile?.favourite_color  ?? null} />
              <FavChip icon="🍕" label="Food"    value={profile?.favourite_food   ?? null} />
              <FavChip icon="🐘" label="Animal"  value={profile?.favourite_animal ?? null} />
              <FavChip icon="⚽" label="Sport"   value={profile?.favourite_sport  ?? null} />
              <FavChip icon="📖" label="Book"    value={profile?.favourite_book   ?? null} />
              {!profile?.favourite_color && !profile?.favourite_food && !profile?.favourite_animal && !profile?.favourite_sport && !profile?.favourite_book && (
                <div style={{ fontSize: 13, color: "#9ca3af", fontStyle: "italic" }}>
                  No favourites added yet — tap the pencil to add some.
                </div>
              )}
            </div>
          )}

          {/* Edit mode fields */}
          {editMode && (
            <>
              <FieldRow label="Favourite Colour"  value={profile?.favourite_color  ?? null} editMode={editMode} inputValue={dColor}  onChange={setDColor}  placeholder="e.g. Blue" />
              <FieldRow label="Favourite Food"    value={profile?.favourite_food   ?? null} editMode={editMode} inputValue={dFood}   onChange={setDFood}   placeholder="e.g. Pizza" />
              <FieldRow label="Favourite Animal"  value={profile?.favourite_animal ?? null} editMode={editMode} inputValue={dAnimal} onChange={setDAnimal} placeholder="e.g. Elephant" />
              <FieldRow label="Favourite Sport"   value={profile?.favourite_sport  ?? null} editMode={editMode} inputValue={dSport}  onChange={setDSport}  placeholder="e.g. Football" />
              <FieldRow label="Favourite Book"    value={profile?.favourite_book   ?? null} editMode={editMode} inputValue={dBook}   onChange={setDBook}   placeholder="e.g. Lion Boy" />
            </>
          )}

          {/* Nickname edit */}
          <FieldRow label="Nickname"  value={profile?.nickname ?? null} editMode={editMode} inputValue={dNickname} onChange={setDNickname} placeholder={`What do you call ${firstName} at home?`} />

          {/* Bio */}
          <FieldRow label={`About ${firstName}`} value={profile?.bio ?? null} editMode={editMode} inputValue={dBio} onChange={setDBio} placeholder={`A few words about ${firstName} — their personality, what makes them laugh, what they love...`} multiline />
        </div>

        {/* ── KEEP SAFE ── */}
        <div style={{ background: "#fff", borderRadius: 16, padding: "18px", marginBottom: 14, border: "1px solid #e5e7eb", borderLeft: `4px solid ${amber}`, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <SectionHeader icon="🛡️" title={`Keep ${firstName} Safe`} />
          <FieldRow label="Blood Group"   value={profile?.blood_group   ?? null} editMode={editMode} inputValue={dBlood}     onChange={setDBlood}     placeholder="e.g. A+" />
          <FieldRow label="Allergies"     value={profile?.allergies     ?? null} editMode={editMode} inputValue={dAllergies} onChange={setDAllergies} placeholder="e.g. Peanuts, Dust" />
          <FieldRow label="Special Needs" value={profile?.special_needs ?? null} editMode={editMode} inputValue={dSpecial}   onChange={setDSpecial}   placeholder="e.g. Mild asthma" />
          <FieldRow label="Medical Notes" value={profile?.medical_notes ?? null} editMode={editMode} inputValue={dMedical}   onChange={setDMedical}   placeholder="e.g. Carries inhaler" multiline />
          {!editMode && !profile?.blood_group && !profile?.allergies && !profile?.special_needs && !profile?.medical_notes && (
            <div style={{ fontSize: 13, color: "#9ca3af", fontStyle: "italic" }}>
              Add {firstName}&apos;s health details so they are protected everywhere.
            </div>
          )}
        </div>

        {/* ── EMERGENCY CONTACT ── */}
        <div style={{ background: "#fff", borderRadius: 16, padding: "18px", marginBottom: 14, border: "1px solid #e5e7eb", borderLeft: `4px solid ${red}`, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <SectionHeader icon="🆘" title="Emergency Contact" />
          <FieldRow label="Contact Name"  value={profile?.emergency_contact_name  ?? null} editMode={editMode} inputValue={dEcName}  onChange={setDEcName}  placeholder="e.g. Aunt Grace" />
          <FieldRow label="Contact Phone" value={profile?.emergency_contact_phone ?? null} editMode={editMode} inputValue={dEcPhone} onChange={setDEcPhone} placeholder="e.g. 0712 345 678" />
          {!editMode && profile?.emergency_contact_phone && (
            <a
              href={`tel:${profile.emergency_contact_phone}`}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: accent, fontWeight: 700, textDecoration: "none", marginTop: 4 }}
            >
              📞 Call now
            </a>
          )}
          {!editMode && !profile?.emergency_contact_name && !profile?.emergency_contact_phone && (
            <div style={{ fontSize: 13, color: "#9ca3af", fontStyle: "italic" }}>
              Who do we call if {firstName} needs help?
            </div>
          )}
        </div>

        {/* ── SCHOOL INFO ── */}
        <div style={{ background: "#fff", borderRadius: 16, padding: "18px", marginBottom: 14, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <SectionHeader icon="🏫" title="School Info" />
          {[
            { label: "Full Name",      value: student.name,             field: "name" },
            { label: "Admission No.",  value: student.admission_number, field: "admission_number" },
            { label: "Class",          value: className,                field: "class" },
            { label: "School",         value: schoolName,               field: "school" },
          ].map(row => (
            <div key={row.field} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>{row.label}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>{row.value || "—"}</div>
                <button
                  onClick={() => setChangeField(row.field)}
                  style={{ fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, padding: "2px 6px" }}
                >
                  Request Change
                </button>
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: "#d1d5db", marginTop: 4 }}>
            🔒 School records are managed by the school. Tap "Request Change" to submit a correction.
          </div>
        </div>

        {/* ── BADGES ── */}
        {badges.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 16, padding: "18px", marginBottom: 14, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
            <SectionHeader icon="🏅" title={`${firstName}'s Badges`} />
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
              {badges.map(b => (
                <div key={b.id} style={{
                  flexShrink:    0,
                  display:       "flex",
                  flexDirection: "column",
                  alignItems:    "center",
                  gap:           4,
                  background:    "#f0fdf4",
                  border:        "1px solid #d1fae5",
                  borderRadius:  14,
                  padding:       "10px 14px",
                  minWidth:      80,
                }}>
                  <div style={{ fontSize: 24 }}>{b.badges?.icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: dark, textAlign: "center", lineHeight: 1.3 }}>{b.badges?.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── EDIT MODE SAVE / CANCEL ── */}
        {editMode && (
          <div style={{ display: "flex", gap: 10, marginTop: 8, marginBottom: 16 }}>
            <button
              onClick={cancelEdit}
              style={{ flex: 1, padding: 14, borderRadius: 12, border: "1.5px solid #e5e7eb", background: "#fff", color: dark, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ flex: 2, padding: 14, borderRadius: 12, border: "none", background: saving ? "#d1d5db" : accent, color: "#fff", fontWeight: 800, fontSize: 15, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: saving ? "none" : "0 4px 14px rgba(16,185,129,0.35)" }}
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        )}

        {/* ── FLOATING EDIT BUTTON ── */}
        {!editMode && (
          <button
            onClick={() => setEditMode(true)}
            style={{
              position:   "fixed",
              bottom:     88,
              right:      20,
              width:      52,
              height:     52,
              borderRadius: "50%",
              background: accent,
              border:     "none",
              color:      "#fff",
              fontSize:   22,
              cursor:     "pointer",
              boxShadow:  "0 4px 18px rgba(16,185,129,0.45)",
              display:    "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex:     800,
            }}
          >
            ✏️
          </button>
        )}

      </div>

      {/* ── REQUEST CHANGE SHEET ── */}
      {changeField && student && (
        <RequestChangeSheet
          field={changeField}
          currentValue={
            changeField === "name"             ? student.name                   :
            changeField === "admission_number" ? (student.admission_number ?? ""):
            changeField === "class"            ? className                      :
            schoolName
          }
          studentId={student.id}
          parentId={parentId}
          onClose={() => setChangeField(null)}
          showToast={msg => fireToast(msg)}
        />
      )}

      {/* ── TOAST ── */}
      {toastMsg && <Toast msg={toastMsg} type={toastType} />}
    </>
  );
}
