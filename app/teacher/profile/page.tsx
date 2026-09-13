"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Context = {
  teacher_id: string;
  school_id: string | null;
  state: "ready" | "needs_school" | "needs_class";
  schools: Array<{ id: string; name: string; active: boolean }>;
  classes: Array<{
    class_id: string;
    class_name: string;
    stream: string | null;
    subject_id: string;
    subject_name: string;
    is_class_teacher: boolean;
  }>;
};

type FormState = {
  fullName: string;
  phone: string;
  bio: string;
  gender: string;
  dateOfBirth: string;
  avatarUrl: string;
  tscNumber: string;
  teachingStyle: string;
};

type InstitutionState = {
  employmentType: string;
  designation: string;
};

type VerificationState = {
  tsc_status: string;
  school_status: string;
  employment_status: string;
};

const EMPTY: FormState = {
  fullName: "",
  phone: "",
  bio: "",
  gender: "",
  dateOfBirth: "",
  avatarUrl: "",
  tscNumber: "",
  teachingStyle: "",
};

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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 11, fontWeight: 900, color: "#6b7280" }}>{label}</span>{hint && <small style={{ color: "#94a3b8", lineHeight: 1.4 }}>{hint}</small>}{children}</label>;
}

function ManagedValue({ label, value }: { label: string; value: string }) {
  return <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, background: "#f8fafc" }}><div style={{ fontSize: 10, fontWeight: 900, color: "#6b7280" }}>{label}</div><div style={{ marginTop: 5, fontSize: 13, fontWeight: 800, color: "#111827" }}>{value || "Not recorded"}</div><div style={{ marginTop: 4, fontSize: 10, color: "#64748b" }}>Managed by your school</div></div>;
}

export default function TeacherProfilePage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [context, setContext] = useState<Context | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [institution, setInstitution] = useState<InstitutionState>({ employmentType: "", designation: "" });
  const [verification, setVerification] = useState<VerificationState>({ tsc_status: "unverified", school_status: "unverified", employment_status: "unverified" });
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
      const [profileRes, teacherRes, verificationRes, ctx] = await Promise.all([
        db.from("profiles").select("id,full_name,phone,bio,gender,date_of_birth,avatar_url").eq("id", auth.user.id).single(),
        db.from("teacher_profiles").select("profile_id,tsc_number,employment_type,designation,teaching_style").eq("profile_id", auth.user.id).maybeSingle(),
        db.from("teacher_profile_verifications").select("tsc_status,school_status,employment_status").eq("profile_id", auth.user.id).maybeSingle(),
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
        tscNumber: teacherRes.data?.tsc_number ?? "",
        teachingStyle: teacherRes.data?.teaching_style ?? "",
      });
      setInstitution({ employmentType: teacherRes.data?.employment_type ?? "", designation: teacherRes.data?.designation ?? "" });
      if (verificationRes.data) setVerification(verificationRes.data as VerificationState);
    } catch (loadError) {
      console.error("[TeacherProfile] load", loadError);
      setNotice({ kind: "error", text: "Your professional profile could not be loaded. Retry, or use Help if the problem continues." });
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
      setNotice({ kind: "success", text: "Active school changed. School records and teaching assignments were not modified." });
    } catch (schoolError) {
      console.error("[TeacherProfile] school", schoolError);
      setNotice({ kind: "error", text: "That school could not be selected. Your previous school context is unchanged." });
    }
  }

  async function save() {
    if (saving) return;
    const fullName = form.fullName.trim();
    if (!fullName) {
      setNotice({ kind: "error", text: "Your professional name is required." });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const { error } = await supabase.rpc("teacher_update_my_profile", {
        p_full_name: fullName,
        p_phone: form.phone.trim() || null,
        p_bio: form.bio.trim() || null,
        p_gender: form.gender || null,
        p_date_of_birth: form.dateOfBirth || null,
        p_tsc_number: form.tscNumber.trim() || null,
        p_teaching_style: form.teachingStyle.trim() || null,
      });
      if (error) throw error;
      setForm((current) => ({ ...current, fullName }));
      setNotice({ kind: "success", text: "Profile saved. School, role and teaching assignments remain school-managed." });
    } catch (saveError) {
      console.error("[TeacherProfile] save", saveError);
      setNotice({ kind: "error", text: "Your profile could not be saved. Your school membership and assignments were not changed." });
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
      setNotice({ kind: "error", text: "Profile photo could not be updated. Your existing photo is unchanged." });
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
          <div style={{ minWidth: 0 }}><div style={{ fontSize: 11, fontWeight: 900, opacity: .72, textTransform: "uppercase", letterSpacing: 1 }}>Teacher profile</div><h1 style={{ margin: "4px 0", fontSize: 23 }}>{form.fullName || "Teacher"}</h1><div style={{ fontSize: 12, opacity: .8 }}>{institution.designation || "Teacher"} · {activeSchool}</div><div style={{ marginTop: 4, fontSize: 11, opacity: .68 }}>{email}</div></div>
        </div>
      </section>

      {notice && <div role={notice.kind === "error" ? "alert" : "status"} aria-live="polite" style={{ borderRadius: 14, padding: 13, marginBottom: 12, fontSize: 13, background: notice.kind === "error" ? "#fef2f2" : "#ecfdf5", color: notice.kind === "error" ? "#991b1b" : "#065f46" }}>{notice.text}</div>}

      {context?.state === "needs_school" && <section role="status" style={{ borderRadius: 16, padding: 14, marginBottom: 12, background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412" }}><strong style={{ display: "block", fontSize: 13 }}>School membership required</strong><span style={{ display: "block", marginTop: 4, fontSize: 12, lineHeight: 1.5 }}>Your account is signed in, but no active teacher school relationship is available. Ask your school administrator to restore or confirm your membership.</span></section>}
      {context?.state === "needs_class" && <section role="status" style={{ borderRadius: 16, padding: 14, marginBottom: 12, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8" }}><strong style={{ display: "block", fontSize: 13 }}>No teaching assignment yet</strong><span style={{ display: "block", marginTop: 4, fontSize: 12, lineHeight: 1.5 }}>Your school membership is valid, but no classes or subjects are assigned in this school yet.</span></section>}

      <section style={{ background: "#fff", borderRadius: 18, padding: 15, marginBottom: 12, boxShadow: "0 2px 14px rgba(0,0,0,.05)" }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 10 }}>SCHOOL & TEACHING SCOPE</div>
        {context && context.schools.length > 1 ? <Field label="Current school" hint="Switching context changes which school you are working in; it does not change membership."><select value={context.school_id ?? ""} onChange={(event) => void changeSchool(event.target.value)} style={inputStyle}>{context.schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></Field> : <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>{activeSchool}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10, marginTop: 12 }}><div style={{ background: "#f8fafc", borderRadius: 12, padding: 11 }}><div style={{ fontSize: 10, fontWeight: 900, color: "#6b7280" }}>CLASSES</div><div style={{ marginTop: 5, fontSize: 12, color: "#111827", lineHeight: 1.5 }}>{classes.length ? classes.join(", ") : "No classes assigned"}</div></div><div style={{ background: "#f8fafc", borderRadius: 12, padding: 11 }}><div style={{ fontSize: 10, fontWeight: 900, color: "#6b7280" }}>SUBJECTS</div><div style={{ marginTop: 5, fontSize: 12, color: "#111827", lineHeight: 1.5 }}>{subjects.length ? subjects.join(", ") : "No subjects assigned"}</div></div></div>
        <div style={{ marginTop: 9, fontSize: 11, color: "#6b7280" }}>School membership, classes and subjects are authoritative school records and cannot be edited from Profile.</div>
      </section>

      <section style={{ background: "#fff", borderRadius: 18, padding: 15, marginBottom: 12, boxShadow: "0 2px 14px rgba(0,0,0,.05)" }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 11 }}>PROFESSIONAL IDENTITY</div>
        <div style={{ display: "grid", gap: 12 }}>
          <Field label="Professional name"><input maxLength={120} value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} style={inputStyle} /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}><ManagedValue label="Designation" value={institution.designation} /><ManagedValue label="Employment type" value={institution.employmentType} /></div>
          <Field label="TSC number" hint={`Self-declared profile value. Verification status: ${verification.tsc_status.replaceAll("_", " ")}.`}><input maxLength={40} value={form.tscNumber} onChange={(event) => setForm((current) => ({ ...current, tscNumber: event.target.value }))} style={inputStyle} /></Field>
          <Field label="Phone"><input type="tel" maxLength={32} value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} style={inputStyle} /></Field>
          <Field label="Professional bio"><textarea maxLength={600} value={form.bio} onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))} rows={4} style={{ ...inputStyle, resize: "vertical" }} /></Field>
          <Field label="Teaching style / approach"><textarea maxLength={1000} value={form.teachingStyle} onChange={(event) => setForm((current) => ({ ...current, teachingStyle: event.target.value }))} rows={4} style={{ ...inputStyle, resize: "vertical" }} /></Field>
        </div>
      </section>

      <section style={{ background: "#fff", borderRadius: 18, padding: 15, marginBottom: 12, boxShadow: "0 2px 14px rgba(0,0,0,.05)" }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", marginBottom: 11 }}>PERSONAL DETAILS</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}><Field label="Gender"><select value={form.gender} onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))} style={inputStyle}><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></Field><Field label="Date of birth"><input type="date" value={form.dateOfBirth} onChange={(event) => setForm((current) => ({ ...current, dateOfBirth: event.target.value }))} style={inputStyle} /></Field></div>
      </section>

      <button type="button" onClick={() => void save()} disabled={saving} style={{ width: "100%", minHeight: 50, border: 0, borderRadius: 13, background: saving ? "#9ca3af" : "#111827", color: "#fff", fontSize: 14, fontWeight: 900 }}>{saving ? "Saving…" : "Save editable profile details"}</button>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10, marginTop: 12 }}>
        <Link href="/teacher/profile/account" style={{ minHeight: 48, borderRadius: 13, border: "1px solid #dbe2ea", background: "#fff", color: "#111827", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900 }}>Account security & privacy</Link>
        <Link href="/teacher/settings" style={{ minHeight: 48, borderRadius: 13, border: "1px solid #dbe2ea", background: "#fff", color: "#111827", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900 }}>Notification settings</Link>
        <Link href="/teacher" style={{ minHeight: 48, borderRadius: 13, border: "1px solid #dbe2ea", background: "#fff", color: "#111827", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900 }}>Back to Teacher Home</Link>
        <Link href="/teacher/help" style={{ minHeight: 48, borderRadius: 13, border: "1px solid #dbe2ea", background: "#fff", color: "#111827", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900 }}>Help / Report a problem</Link>
      </section>
    </div>
  );
}
