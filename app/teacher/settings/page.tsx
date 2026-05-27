"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, SectionLabel, Btn, C } from "@/components/teacher/ui";
import { useRouter } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────
interface NotifPrefs {
  attendance:    boolean;
  flags:         boolean;
  messages:      boolean;
  lessonPlans:   boolean;
  schoolNotices: boolean;
  news:          boolean;
}

const NOTIF_LABELS: Record<keyof NotifPrefs, string> = {
  attendance:    "Attendance reminders",
  flags:         "Early warning flags",
  messages:      "VibeConnect messages",
  lessonPlans:   "Lesson plan alerts",
  schoolNotices: "School notices",
  news:          "Education news",
};

const DEFAULT_PREFS: NotifPrefs = {
  attendance:    true,
  flags:         true,
  messages:      true,
  lessonPlans:   true,
  schoolNotices: false,
  news:          false,
};

// ── Toggle ─────────────────────────────────────────────────────────────────
function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        cursor: "pointer",
        background: value ? C.accent : C.border,
        position: "relative",
        transition: "background 0.2s",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 3,
          left: value ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      />
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "11px 0",
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <span style={{ fontSize: 13, color: C.textMuted }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary }}>
        {value}
      </span>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [profile, setProfile] = useState<{
    full_name: string;
    phone: string;
    role: string;
  } | null>(null);

  const [notifs, setNotifs]       = useState<NotifPrefs>(DEFAULT_PREFS);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const router = useRouter();

  // ── Classes ──────────────────────────────────────────────────────────────
  interface ClassItem { id: string; name: string; stream: string; subject: string }
  const GRADES   = ['PP1','PP2','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9']
  const SUBJECTS = ['Mathematics','English','Kiswahili','Science and Technology','Social Studies','Religious Education','Creative Arts and Sports','Agriculture and Nutrition','Home Science','Indigenous Languages','French','German','Arabic','Kenyan Sign Language']
  const [classes,     setClasses]     = useState<ClassItem[]>([])
  const [classLoading,setClassLoading]= useState(false)
  const [showClassForm,setShowClassForm]=useState(false)
  const [classForm,   setClassForm]   = useState({ name: '', stream: '', subject: '' })
  const [classSaving, setClassSaving] = useState(false)
  const [classError,  setClassError]  = useState('')
  const [classDeleting,setClassDeleting]=useState<string|null>(null)
  const [schoolId,    setSchoolId]    = useState<string|null>(null)
  const [userId,      setUserId]      = useState<string|null>(null)

  // ── Load ──────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone, role, notification_prefs")
        .eq("id", user.id)
        .single();

      if (error) { setLoading(false); return; }

      setProfile({
        full_name: data.full_name ?? "—",
        phone:     data.phone     ?? "—",
        role:      data.role      ?? "—",
      });

      if (data.notification_prefs) {
        setNotifs({ ...DEFAULT_PREFS, ...data.notification_prefs });
      }

      setLoading(false);
    }

    load();
  }, []);

  useEffect(() => {
    async function loadClasses() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const [memberRes, teacherRes, profileRes] = await Promise.all([
        supabase.from('school_members').select('school_id').eq('profile_id', user.id).maybeSingle(),
        supabase.from('teacher_profiles').select('school_id').eq('profile_id', user.id).maybeSingle(),
        supabase.from('profiles').select('school_id').eq('id', user.id).single(),
      ])
      const sid = memberRes.data?.school_id ?? teacherRes.data?.school_id ?? profileRes.data?.school_id ?? null
      setSchoolId(sid)
      setClassLoading(true)
      const tcRes = await supabase.from('teacher_classes').select('class_id').eq('teacher_id', user.id).eq('is_class_teacher', true)
      const ids = (tcRes.data ?? []).map((r: { class_id: string }) => r.class_id)
      if (ids.length > 0) {
        const { data } = await supabase.from('classes').select('id,name,stream,subject').in('id', ids).order('created_at', { ascending: true })
        setClasses(data ?? [])
      } else {
        setClasses([])
      }
      setClassLoading(false)
    }
    loadClasses()
  }, []);

  async function handleCreateClass() {
    setClassError('')
    if (!classForm.name)    { setClassError('Select a grade.'); return }
    if (!classForm.subject) { setClassError('Select a subject.'); return }
    if (!userId) return
    setClassSaving(true)
    const { error: err } = await supabase.rpc('onboard_teacher_class', {
      p_school_id:  schoolId,
      p_teacher_id: userId,
      p_grade:      classForm.name,
      p_stream:     classForm.stream.trim(),
      p_subject:    classForm.subject,
    })
    setClassSaving(false)
    if (err) { setClassError(err.message); return }
    setClassForm({ name: '', stream: '', subject: '' })
    setShowClassForm(false)
    // reload
    const tcRes = await supabase.from('teacher_classes').select('class_id').eq('teacher_id', userId).eq('is_class_teacher', true)
    const ids = (tcRes.data ?? []).map((r: { class_id: string }) => r.class_id)
    if (ids.length > 0) {
      const { data } = await supabase.from('classes').select('id,name,stream,subject').in('id', ids).order('created_at', { ascending: true })
      setClasses(data ?? [])
    }
  }

  async function handleDeleteClass(id: string) {
    if (!window.confirm('Delete this class? This cannot be undone.')) return
    setClassDeleting(id)
    await supabase.from('classes').delete().eq('id', id)
    setClassDeleting(null)
    setClasses(c => c.filter(x => x.id !== id))
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/academy/signin?role=teacher')
  }

  // ── Save ──────────────────────────────────────────────────────────────
  async function save() {
    setSaving(true);
    setSaveState("idle");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) { setSaving(false); setSaveState("error"); return; }

    const { error } = await supabase
      .from("profiles")
      .update({ notification_prefs: notifs })
      .eq("id", user.id);

    setSaving(false);
    setSaveState(error ? "error" : "saved");
    if (!error) setTimeout(() => setSaveState("idle"), 2500);
  }

  // ── Loading state ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 0",
          color: C.textMuted,
          fontSize: 14,
        }}
      >
        Loading settings…
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Hero */}
      <div
        style={{
          background: "linear-gradient(135deg, #374151 0%, #6b7280 100%)",
          borderRadius: 20,
          padding: "20px",
          marginBottom: 14,
          color: "#fff",
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.55)",
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          Settings
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>
          Account & Preferences
        </div>
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.65)",
            marginTop: 6,
          }}
        >
          Manage your VibeSchool experience.
        </div>
      </div>

      {/* Account */}
      <Card>
        <SectionLabel>Account</SectionLabel>
        {profile ? (
          <>
            <InfoRow label="Name"        value={profile.full_name} />
            <InfoRow label="Phone"       value={profile.phone} />
            <InfoRow label="Role"        value={profile.role} />
            <InfoRow label="Language"    value="English (Kenya)" />
            <InfoRow label="Time Zone"   value="Africa/Nairobi (EAT)" />
            <InfoRow label="Date Format" value="DD/MM/YYYY" />
          </>
        ) : (
          <div style={{ fontSize: 13, color: C.textMuted, padding: "12px 0" }}>
            No profile data found.
          </div>
        )}
      </Card>

      {/* Notifications */}
      <Card>
        <SectionLabel>Notifications</SectionLabel>
        {(Object.keys(notifs) as (keyof NotifPrefs)[]).map((key) => (
          <div
            key={key}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 0",
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            <span style={{ fontSize: 13, color: C.textPrimary, fontWeight: 600 }}>
              {NOTIF_LABELS[key]}
            </span>
            <Toggle
              value={notifs[key]}
              onChange={(v) => setNotifs((p) => ({ ...p, [key]: v }))}
            />
          </div>
        ))}
      </Card>

      {/* Save */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <Btn
          style={{ flex: 1, justifyContent: "center" }}
          onClick={save}
          disabled={saving}
        >
          {saving
            ? "Saving…"
            : saveState === "saved"
            ? "✓ Saved"
            : saveState === "error"
            ? "Error — retry"
            : "Save Changes"}
        </Btn>
        <Btn
          variant="ghost"
          style={{ flex: 1, justifyContent: "center" }}
          onClick={() => setNotifs(DEFAULT_PREFS)}
        >
          Reset to Default
        </Btn>
      </div>

      {/* My Classes */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <SectionLabel>My Classes</SectionLabel>
          <button onClick={() => { setShowClassForm(v => !v); setClassError('') }}
            style={{ padding: "6px 14px", borderRadius: 10, border: "none", background: showClassForm ? "#f3f4f6" : C.dark, color: showClassForm ? C.textPrimary : "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            {showClassForm ? "Cancel" : "+ Add Class"}
          </button>
        </div>

        {showClassForm && (
          <div style={{ marginBottom: 16, padding: 16, background: "#f9fafb", borderRadius: 12, border: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 1, textTransform: "uppercase" as const }}>Grade</label>
                <select value={classForm.name} onChange={e => setClassForm(f => ({ ...f, name: e.target.value }))}
                  style={{ width: "100%", marginTop: 4, padding: "9px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", background: "#fff" }}>
                  <option value="">Select grade</option>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 1, textTransform: "uppercase" as const }}>Subject</label>
                <select value={classForm.subject} onChange={e => setClassForm(f => ({ ...f, subject: e.target.value }))}
                  style={{ width: "100%", marginTop: 4, padding: "9px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", background: "#fff" }}>
                  <option value="">Select subject</option>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 1, textTransform: "uppercase" as const }}>Stream (optional)</label>
                <input value={classForm.stream} onChange={e => setClassForm(f => ({ ...f, stream: e.target.value }))}
                  placeholder="e.g. East, Blue, A"
                  style={{ width: "100%", marginTop: 4, padding: "9px 12px", borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", background: "#fff", boxSizing: "border-box" as const }} />
              </div>
            </div>
            {classError && <p style={{ color: C.error, fontSize: 12, marginTop: 8 }}>{classError}</p>}
            <button onClick={handleCreateClass} disabled={classSaving}
              style={{ marginTop: 12, width: "100%", padding: "10px", borderRadius: 10, border: "none", background: classSaving ? "#9ca3af" : C.accent, color: "#fff", fontWeight: 700, fontSize: 13, cursor: classSaving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              {classSaving ? "Creating…" : "Create Class"}
            </button>
          </div>
        )}

        {classLoading && <p style={{ fontSize: 13, color: C.textMuted }}>Loading…</p>}
        {!classLoading && classes.length === 0 && !showClassForm && (
          <p style={{ fontSize: 13, color: C.textMuted }}>No classes yet. Tap + Add Class to create one.</p>
        )}
        {!classLoading && classes.map(cls => (
          <div key={cls.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, margin: 0 }}>{cls.name}{cls.stream ? " · " + cls.stream : ""}</p>
              <p style={{ fontSize: 12, color: C.textMuted, margin: "2px 0 0" }}>{cls.subject}</p>
            </div>
            <button onClick={() => handleDeleteClass(cls.id)} disabled={classDeleting === cls.id}
              style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid #fca5a5", background: "transparent", color: C.error, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              {classDeleting === cls.id ? "…" : "Delete"}
            </button>
          </div>
        ))}
      </Card>

      {/* Logout */}
      <div style={{ marginBottom: 14 }}>
        <Btn variant="ghost" style={{ width: "100%", justifyContent: "center" }} onClick={handleLogout}>
          Log Out
        </Btn>
      </div>

      {/* Danger Zone */}
      <Card>
        <SectionLabel>Danger Zone</SectionLabel>
        <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>
          These actions are permanent and cannot be undone.
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="danger">Delete Account</Btn>
          <Btn variant="muted">Export My Data</Btn>
        </div>
      </Card>
    </div>
  );
}