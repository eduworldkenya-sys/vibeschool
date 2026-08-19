"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface LinkedChildRow {
  studentId: string;
  name: string;
  relationship: string | null;
  receivesAlerts: boolean;
}

const C = {
  dark: "#1e1b4b",
  accent: "#059669",
  bg: "#f0f2f5",
  surface: "#ffffff",
  border: "#e2e8f0",
  text: "#0f172a",
  muted: "#64748b",
  red: "#b91c1c",
};

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "P";
}

export default function ParentProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState({ id: "", fullName: "", countryCode: "" });
  const [form, setForm] = useState({ fullName: "", countryCode: "" });
  const [children, setChildren] = useState<LinkedChildRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }

      const [{ data: account, error: accountError }, { data: links, error: linksError }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, country_code").eq("id", user.id).single(),
        supabase.from("parent_student_links").select("student_id, relationship, receives_alerts, students(id, name)").eq("parent_id", user.id),
      ]);
      if (accountError) throw accountError;
      if (linksError) throw linksError;

      const nextProfile = {
        id: account.id,
        fullName: account.full_name ?? "",
        countryCode: account.country_code ?? "",
      };
      setProfile(nextProfile);
      setForm(nextProfile);
      setChildren((links ?? []).flatMap((link: any) => link.students ? [{
        studentId: link.students.id ?? link.student_id,
        name: link.students.name ?? "Learner",
        relationship: link.relationship ?? null,
        receivesAlerts: link.receives_alerts !== false,
      }] : []));
    } catch (error) {
      console.error("[ParentProfile] load failed", error);
      setMessage("Account details are temporarily unavailable. Try again after checking your connection.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!profile.id || !form.fullName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: form.fullName.trim(),
      country_code: form.countryCode.trim() || null,
    }).eq("id", profile.id);
    setSaving(false);
    if (error) {
      setMessage("Changes were not saved. Please try again.");
      return;
    }
    setProfile(current => ({ ...current, fullName: form.fullName.trim(), countryCode: form.countryCode.trim() }));
    setEditing(false);
    setMessage("Account details updated.");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    document.cookie = "vibe_role=; path=/; max-age=0";
    router.replace("/");
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", color: C.text }}>
      <header style={{ marginBottom: 18 }}>
        <div style={{ color: C.accent, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8 }}>Account</div>
        <h1 style={{ margin: "3px 0 4px", fontSize: 24, color: C.dark }}>Profile & security</h1>
        <p style={{ margin: 0, color: C.muted, fontSize: 13 }}>Manage your account and review which learners are currently linked to you.</p>
      </header>

      {message && <div role="status" style={{ marginBottom: 12, borderRadius: 12, padding: "10px 12px", background: "#ecfdf5", color: "#166534", fontSize: 12 }}>{message}</div>}

      <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 18, marginBottom: 14 }}>
        {loading ? (
          <div role="status" aria-label="Loading account details" style={{ height: 112, borderRadius: 14, background: "#e2e8f0" }} />
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div aria-hidden="true" style={{ width: 54, height: 54, borderRadius: "50%", background: C.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>{initials(profile.fullName)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 850 }}>{profile.fullName || "Parent / guardian"}</div>
                <div style={{ fontSize: 12, color: C.muted }}>Parent / guardian account</div>
              </div>
              <button type="button" onClick={() => { setEditing(value => !value); setMessage(null); }} style={{ minHeight: 44, padding: "0 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: "#fff", color: C.dark, fontWeight: 750, cursor: "pointer" }}>{editing ? "Cancel" : "Edit"}</button>
            </div>

            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }} htmlFor="parent-full-name">Full name</label>
            <input id="parent-full-name" disabled={!editing} value={form.fullName} onChange={event => setForm(current => ({ ...current, fullName: event.target.value }))} style={{ width: "100%", minHeight: 44, borderRadius: 10, border: `1px solid ${C.border}`, padding: "0 12px", background: editing ? "#fff" : C.bg, color: C.text, marginBottom: 14 }} />

            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 5 }} htmlFor="parent-country">Country code</label>
            <input id="parent-country" disabled={!editing} value={form.countryCode} onChange={event => setForm(current => ({ ...current, countryCode: event.target.value }))} placeholder="KE" style={{ width: "100%", minHeight: 44, borderRadius: 10, border: `1px solid ${C.border}`, padding: "0 12px", background: editing ? "#fff" : C.bg, color: C.text }} />

            {editing && <button type="button" disabled={saving || !form.fullName.trim()} onClick={() => void save()} style={{ width: "100%", minHeight: 46, marginTop: 14, borderRadius: 11, border: "none", background: saving ? "#cbd5e1" : C.accent, color: "#fff", fontWeight: 850, cursor: saving ? "not-allowed" : "pointer" }}>{saving ? "Saving…" : "Save changes"}</button>}
          </>
        )}
      </section>

      <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 18, marginBottom: 14 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 17 }}>Linked children</h2>
        <p style={{ margin: "0 0 14px", color: C.muted, fontSize: 12, lineHeight: 1.5 }}>Child access is controlled by the verified school relationship. You cannot gain access by entering a learner name.</p>
        {!loading && children.length === 0 && <div style={{ padding: "12px 0", color: C.muted, fontSize: 13 }}>No verified child is linked to this account.</div>}
        {children.map(child => (
          <button key={child.studentId} type="button" onClick={() => router.push(`/parent/child/${child.studentId}`)} style={{ width: "100%", minHeight: 58, display: "flex", alignItems: "center", gap: 10, textAlign: "left", border: `1px solid ${C.border}`, background: C.bg, borderRadius: 12, padding: "10px 12px", marginBottom: 8, cursor: "pointer" }}>
            <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: "50%", background: C.dark, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{initials(child.name)}</span>
            <span style={{ flex: 1 }}>
              <strong style={{ display: "block", fontSize: 14 }}>{child.name}</strong>
              <span style={{ display: "block", color: C.muted, fontSize: 11, marginTop: 2 }}>{child.relationship ? `Relationship: ${child.relationship}` : "Verified family relationship"} · {child.receivesAlerts ? "Important updates on" : "Alerts limited"}</span>
            </span>
            <span aria-hidden="true" style={{ color: C.muted, fontSize: 20 }}>›</span>
          </button>
        ))}
        <button type="button" onClick={() => router.push("/parent/link-child")} style={{ width: "100%", minHeight: 44, marginTop: 4, borderRadius: 11, border: `1px dashed ${C.accent}`, background: "transparent", color: C.accent, fontWeight: 800, cursor: "pointer" }}>Link or request access to a child</button>
      </section>

      <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 18, marginBottom: 14 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 17 }}>Notifications</h2>
        <p style={{ margin: 0, color: C.muted, fontSize: 12, lineHeight: 1.55 }}>VibeSchool only shows notification controls when the backend can save and enforce them. Current relationship-level alert status is shown above; no pretend switches are displayed.</p>
      </section>

      <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 18, marginBottom: 14 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 17 }}>Help & account safety</h2>
        <p style={{ margin: "0 0 12px", color: C.muted, fontSize: 12, lineHeight: 1.55 }}>If a child is missing, wrongly linked, or access has changed, do not share screenshots containing learner information. Use the support route so VibeSchool can capture safe diagnostic context.</p>
        <button type="button" onClick={() => router.push("/parent/support")} style={{ width: "100%", minHeight: 44, borderRadius: 11, border: `1px solid ${C.border}`, background: "#fff", color: C.dark, fontWeight: 800, cursor: "pointer" }}>Report a problem</button>
      </section>

      <button type="button" onClick={() => void signOut()} style={{ width: "100%", minHeight: 48, borderRadius: 12, border: `1.5px solid ${C.red}`, background: "transparent", color: C.red, fontWeight: 850, cursor: "pointer" }}>Sign out</button>
    </div>
  );
}
