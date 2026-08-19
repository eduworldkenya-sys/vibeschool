"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Context = {
  teacher_id: string;
  school_id: string | null;
  state: "ready" | "needs_school" | "needs_class";
  schools: Array<{ id: string; name: string; active: boolean }>;
  classes: Array<{ class_id: string; class_name: string; stream: string | null; subject_id: string; subject_name: string; is_class_teacher: boolean }>;
};

type FormState = {
  fullName: string;
  phone: string;
  bio: string;
  gender: string;
  dateOfBirth: string;
  avatarUrl: string;
  tscNumber: string;
  employmentType: string;
  designation: string;
  teachingStyle: string;
  notificationPrefs: Record<string, boolean>;
};

const EMPTY: FormState = {
  fullName: "",
  phone: "",
  bio: "",
  gender: "",
  dateOfBirth: "",
  avatarUrl: "",
  tscNumber: "",
  employmentType: "",
  designation: "",
  teachingStyle: "",
  notificationPrefs: {},
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 11, fontWeight: 900, color: "#6b7280" }}>{label}</span>{children}</label>;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 46,
  border: "1px solid #d1d5db",
  borderRadius: 12,
  padding: "10px 12px",
  background: "#fff",
  color: "#111827",
  fontSize: 14,
  boxSizing: "border-box",
};

export default function TeacherProfilePage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [context, setContext] = useState<Context | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const db = supabase as any;

  const loadContext = useCallback(async (requestedSchoolId?: string | null) => {
    const { data, error } = await supabase.rpc("teacher_get_operating_context", {
      p_requested_school_id: requestedSchoolId ?? undefined,
    });
    if (error) throw error;
    return data as unknown as Context;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }
      setEmail(auth.user.email ?? "");
      const [profileRes, teacherRes, ctx] = await Promise.all([
        db.from("profiles").select("id,full_name,phone,bio,gender,date_of_birth,avatar_url,notification_prefs").eq("id", auth.user.id).single(),
        db.from("teacher_profiles").select("profile_id,tsc_number,employment_type,designation,teaching_style").eq("profile_id", auth.user.id).maybeSingle(),
        loadContext(),
      ]);
      if (profileRes.error) throw profileRes.error;
      if (teacherRes.error) throw teacherRes.error;
      setContext(ctx);
      setForm({
        fullName: profileRes.data?.full_name ?? "",
        phone: profileRes.data?.phone ?? "",
        bio: profileRes.data?.bio ?? "",
        gender: profileRes.data?.gender ?? "",
        dateOfBirth: profileRes.data?.date_of_birth ?? "",
        avatarUrl: profileRes.data?.avatar_url ?? "",
        notificationPrefs: profileRes.data?.notification_prefs && typeof profileRes.data.notification_prefs === "object" ? profileRes.data.notification_prefs : {},
        tscNumber: teacherRes.data?.tsc_number ?? "",
        employmentType: teacherRes.data?.employment_type ?? "",
        designation: teacherRes.data?.designation ?? "",
        teachingStyle: teacherRes.data?.teaching_style ?? "",
      });
    } catch (loadError) {
      console.error("[TeacherProfile] load", loadError);
      setNotice({ kind: "error", text: "Your professional profile could not be loaded. Check your connection and retry." });
    } finally {
      setLoading(false);
    }
  }, [db, loadContext, router]);

  useEffect(() => { void load(); }, [load]);

  async function changeSchool(schoolId: string) {
    if (!schoolId || schoolId === context?.school_id) return;
    setNotice(null);
    try {
      const { error } = await supabase.rpc("teacher_set_active_school", { p_school_id: schoolId });
      if (error) throw error;
      setContext(await loadContext(schoolId));
      setNotice({ kind: "success", text: "Active school changed. Your teaching assignments remain school-controlled records." });
    } catch (schoolError) {
      console.error("[TeacherProfile] school", schoolError);
      setNotice({ kind: "error", text: "That school could not be selected." });
    }
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw authError ?? new Error("not_authenticated");
      const fullName = form.fullName.trim();
      if (!fullName) {
        setNotice({ kind: "error", text: "Your professional name is required." });
        return;
      }
      const profileUpdate = await db.from("profiles").update({
        full_name: fullName,
        phone: form.phone.trim() || null,
        bio: form.bio.trim() || null,
        gender: form.gender || null,
        date_of_birth: form.dateOfBirth || null,
        notification_prefs: form.notificationPrefs,
        updated_at: new Date().toISOString(),
      }).eq("id", auth.user.id);
      if (profileUpdate.error) throw profileUpdate.error;

      const teacherUpdate = await db.from("teacher_profiles").upsert({
        profile_id: auth.user.id,
        school_id: context?.school_id ?? null,
        tsc_number: form.tscNumber.trim() || null,
        employment_type: form.employmentType || null,
        designation: form.designation.trim() || null,
        teaching_style: form.teachingStyle.trim() || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "profile_id" });
      if (teacherUpdate.error) throw teacherUpdate.error;
      setNotice({ kind: "success", text: "Professional profile saved." });
    } catch (saveError) {
      console.error("[TeacherProfile] save", saveError);
      setNotice({ kind: "error", text: "Your profile could not be saved. No school assignments were changed." });
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file: File) {
    if (uploading) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 3 * 1024 * 1024) {
      setNotice({ kind: "error", text: "Use a JPEG, PNG or WebP image up to 3 MB." });
      return;
    }
    setUploading(true);
    setNotice(null);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw authError ?? new Error("not_authenticated");
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${auth.user.id}/profile.${ext}`;
      const upload = await supabase.storage.from("avatars").upload(path, file, { upsert: true, cacheControl: "3600", contentType: file.type });
      if (upload.error) throw upload.error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
      const update = await db.from("profiles").update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq("id", auth.user.id);
      if (update.error) throw update.error;
      setForm((current) => ({ ...current, avatarUrl }));
      setNotice({ kind: "success", text: "Profile photo updated." });
    } catch (avatarError) {
      console.error("[TeacherProfile] avatar", avatarError);
      setNotice({ kind: "error", text: "Profile photo could not be updated." });
    } finally {
      setUploading(false);
    }
  }

  const assignments = context?.classes ?? [];
  const subjects = Array.from(new Set(assignments.map((item) => item.subject_name).filter(Boolean)));
  const classes = Array.from(new Map(assignments.map((item) => [item.class_id, `${item.class_name}${item.stream ? ` ${item.stream}` : ""}`])).values());
  const activeSchool = context?.schools.find((school) => school.id === context.school_id)?.name ?? "No active school";

  if (loading) return <div style={{ padding: 18 }} aria-label="Loading teacher profile"><div style={{ height: 160, borderRadius: 18, background: "#e5e7eb" }} /></div>;

  return (
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "16px 14px 112px" }}>
      <section style={{ background: "linear-gradient(135deg,#1e1b4b,#4338ca)", borderRadius: 20, padding: 18, color: "#fff", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} aria-label="Change profile photo" style={{ width: 72, height: 72, flexShrink: 0, borderRadius: 99, border: "3px solid rgba(255,255,255,.65)", overflow: "hidden", background: "rgba(255,255,255,.15)", color: "#fff", fontSize: 25, fontWeight: 900 }}>
            {form.avatarUrl ? <img src={form.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (form.fullName.trim()[0]?.toUpperCase() ?? "T")}
          </button>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAvatar(file); event.target.value = ""; }} />
          <div style={{ minWidth: 0 }}><div style={{ fontSize: 11, fontWeight: 900, opacity: .72, textTransform: "uppercase", letterSpacing: 1 }}>Teacher profile</div><h1 style={{ margin: "4px 0", fontSize: 23 }}>{form.fullName || "Teacher"}</h1><div style={{ fontSize: 12, opacity: .78 }}>{form.designation || "Teacher"} · {activeSchool}</div><div style={{ marginTop: 4, fontSize: 11, opacity: .68 }}>{email}</div></div>
        </div>
      </section>

      {notice && <div role={notice.kind === "error" ? "alert" : "status"} style={{ borderRadius: 14, padding: 13, marginBottom: 12, fontSize: 13, background: notice.kind === "error" ? "#fef2f2" : "#ecfdf5", color: notice.kind === "error" ? "#991b1b" : "#065f46" }}>{notice.text}</div>}

      <section style={{ background: "#fff", borderRadius: 18, padding: 15, marginBottom: 12, boxShadow: "0 2px 14px rgba(0,0,0,.05)" }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 10 }}>SCHOOL & TEACHING SCOPE</div>
        {context && context.schools.length > 1 ? <Field label="Active school"><select value={context.school_id ?? ""} onChange={(event) => void changeSchool(event.target.value)} style={inputStyle}>{context.schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></Field> : <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>{activeSchool}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10, marginTop: 12 }}><div style={{ background: "#f8fafc", borderRadius: 12, padding: 11 }}><div style={{ fontSize: 10, fontWeight: 900, color: "#6b7280" }}>CLASSES</div><div style={{ marginTop: 5, fontSize: 12, color: "#111827", lineHeight: 1.5 }}>{classes.length ? classes.join(", ") : "No classes assigned"}</div></div><div style={{ background: "#f8fafc", borderRadius: 12, padding: 11 }}><div style={{ fontSize: 10, fontWeight: 900, color: "#6b7280" }}>SUBJECTS</div><div style={{ marginTop: 5, fontSize: 12, color: "#111827", lineHeight: 1.5 }}>{subjects.length ? subjects.join(", ") : "No subjects assigned"}</div></div></div>
        <div style={{ marginTop: 9, fontSize: 11, color: "#6b7280" }}>School membership, classes and subjects are read-only here because they are authoritative school records.</div>
      </section>

      <section style={{ background: "#fff", borderRadius: 18, padding: 15, marginBottom: 12, boxShadow: "0 2px 14px rgba(0,0,0,.05)" }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 11 }}>PROFESSIONAL DETAILS</div>
        <div style={{ display: "grid", gap: 12 }}>
          <Field label="Professional name"><input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} style={inputStyle} /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}><Field label="TSC number"><input value={form.tscNumber} onChange={(event) => setForm((current) => ({ ...current, tscNumber: event.target.value }))} style={inputStyle} /></Field><Field label="Designation"><input value={form.designation} placeholder="e.g. Subject Teacher" onChange={(event) => setForm((current) => ({ ...current, designation: event.target.value }))} style={inputStyle} /></Field></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}><Field label="Employment type"><select value={form.employmentType} onChange={(event) => setForm((current) => ({ ...current, employmentType: event.target.value }))} style={inputStyle}><option value="">Not specified</option><option value="permanent">Permanent</option><option value="contract">Contract</option><option value="intern">Intern</option><option value="private">Private school</option><option value="other">Other</option></select></Field><Field label="Phone"><input type="tel" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} style={inputStyle} /></Field></div>
          <Field label="Professional bio"><textarea value={form.bio} onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))} rows={4} style={{ ...inputStyle, resize: "vertical" }} /></Field>
          <Field label="Teaching style / approach"><textarea value={form.teachingStyle} onChange={(event) => setForm((current) => ({ ...current, teachingStyle: event.target.value }))} rows={4} style={{ ...inputStyle, resize: "vertical" }} /></Field>
        </div>
      </section>

      <section style={{ background: "#fff", borderRadius: 18, padding: 15, marginBottom: 12, boxShadow: "0 2px 14px rgba(0,0,0,.05)" }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 11 }}>PERSONAL & PREFERENCES</div>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}><Field label="Gender"><select value={form.gender} onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))} style={inputStyle}><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></Field><Field label="Date of birth"><input type="date" value={form.dateOfBirth} onChange={(event) => setForm((current) => ({ ...current, dateOfBirth: event.target.value }))} style={inputStyle} /></Field></div>
          {[{ key: "school_announcements", label: "School announcements" }, { key: "homework_submissions", label: "Learner homework submissions" }, { key: "attendance_updates", label: "Attendance actions" }].map((pref) => <label key={pref.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, minHeight: 44, border: "1px solid #e5e7eb", borderRadius: 12, padding: "0 12px", fontSize: 13, fontWeight: 800, color: "#374151" }}><span>{pref.label}</span><input type="checkbox" checked={form.notificationPrefs[pref.key] !== false} onChange={(event) => setForm((current) => ({ ...current, notificationPrefs: { ...current.notificationPrefs, [pref.key]: event.target.checked } }))} /></label>)}
        </div>
      </section>

      <button type="button" onClick={() => void save()} disabled={saving} style={{ width: "100%", minHeight: 50, border: 0, borderRadius: 13, background: saving ? "#9ca3af" : "#111827", color: "#fff", fontSize: 14, fontWeight: 900 }}>{saving ? "Saving…" : "Save profile"}</button>
    </div>
  );
}
