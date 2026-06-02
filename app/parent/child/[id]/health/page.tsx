'use client'
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { HealthRecord, HealthVaccination } from "@/lib/types";

// ─── Colors ───────────────────────────────────────────────────────────────────
const dark   = "#1e1b4b";
const accent = "#10b981";
const bg     = "#f0f2f5";
const red    = "#ef4444";
const amber  = "#f59e0b";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function firstName(name: string) { return name.split(" ")[0]; }

function fmtDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function severityColor(s: string | null) {
  if (s === "severe")   return red;
  if (s === "moderate") return amber;
  return accent;
}

function typeColor(t: string) {
  if (t === "illness") return red;
  if (t === "injury")  return amber;
  if (t === "visit")   return accent;
  return "#8b5cf6";
}

function typeEmoji(t: string) {
  if (t === "illness") return "🤒";
  if (t === "injury")  return "🩹";
  if (t === "visit")   return "🏥";
  return "📋";
}

// ─── Shimmer ──────────────────────────────────────────────────────────────────
function Shimmer({ w = "100%", h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r, flexShrink: 0,
      background: "linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
    }} />
  );
}

function SkeletonCard() {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, border: "1px solid #e5e7eb", display: "flex", flexDirection: "column", gap: 10 }}>
      <Shimmer h={14} w="55%" />
      <Shimmer h={11} w="35%" />
      <Shimmer h={11} w="75%" />
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
      background: dark, color: "#fff", padding: "12px 24px", borderRadius: 40,
      fontSize: 13, fontWeight: 600, zIndex: 9999, whiteSpace: "nowrap",
      boxShadow: "0 4px 24px rgba(0,0,0,0.18)", animation: "slideUp 0.25s ease",
    }}>{msg}</div>
  );
}

// ─── Record Card ──────────────────────────────────────────────────────────────
function RecordCard({ rec, onArchive }: { rec: HealthRecord; onArchive: (id: string) => void }) {
  const tc = typeColor(rec.record_type);
  return (
    <div style={{
      background: "#fff", borderRadius: 16, padding: 16, marginBottom: 10,
      border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      borderLeft: `4px solid ${tc}`,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 18 }}>{typeEmoji(rec.record_type)}</span>
            <span style={{
              background: tc + "18", color: tc,
              fontSize: 10, fontWeight: 700, padding: "2px 10px",
              borderRadius: 20, textTransform: "capitalize",
            }}>{rec.record_type}</span>
            {rec.severity && (
              <span style={{
                background: severityColor(rec.severity) + "18",
                color: severityColor(rec.severity),
                fontSize: 10, fontWeight: 700, padding: "2px 10px",
                borderRadius: 20, textTransform: "capitalize",
              }}>{rec.severity}</span>
            )}
          </div>
          <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: dark }}>{rec.title}</p>
          {rec.provider && (
            <p style={{ margin: "0 0 4px", fontSize: 12, color: "#6b7280" }}>🏥 {rec.provider}</p>
          )}
          {rec.description && (
            <p style={{ margin: "0 0 4px", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{rec.description}</p>
          )}
          {rec.outcome && (
            <p style={{ margin: "0 0 4px", fontSize: 12, color: accent, fontWeight: 600 }}>✅ {rec.outcome}</p>
          )}
          {rec.recorded_at && (
            <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>{fmtDate(rec.recorded_at)}</p>
          )}
        </div>
        <button
          onClick={() => onArchive(rec.id)}
          style={{
            background: "none", border: "none", color: "#d1d5db",
            fontSize: 18, cursor: "pointer", padding: 4, flexShrink: 0,
          }}
          title="Archive"
        >🗄️</button>
      </div>
    </div>
  );
}

// ─── Vaccination Card ─────────────────────────────────────────────────────────
function VaccinationCard({ vac, onArchive }: { vac: HealthVaccination; onArchive: (id: string) => void }) {
  const overdue = isOverdue(vac.next_due_date);
  const hasDue  = !!vac.next_due_date;
  return (
    <div style={{
      background: "#fff", borderRadius: 16, padding: 16, marginBottom: 10,
      border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      borderLeft: `4px solid ${overdue ? red : accent}`,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 18 }}>💉</span>
            {vac.dose && (
              <span style={{
                background: "#f0f9ff", color: "#0284c7",
                fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 20,
              }}>{vac.dose}</span>
            )}
            {hasDue && (
              <span style={{
                background: overdue ? red + "18" : accent + "18",
                color: overdue ? red : accent,
                fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 20,
              }}>{overdue ? "⚠️ Overdue" : "✅ Up to date"}</span>
            )}
          </div>
          <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: dark }}>{vac.vaccine_name}</p>
          {vac.provider && (
            <p style={{ margin: "0 0 4px", fontSize: 12, color: "#6b7280" }}>🏥 {vac.provider}</p>
          )}
          {vac.administered_at && (
            <p style={{ margin: "0 0 4px", fontSize: 12, color: "#6b7280" }}>Given: {fmtDate(vac.administered_at)}</p>
          )}
          {vac.next_due_date && (
            <p style={{ margin: "0 0 4px", fontSize: 12, color: overdue ? red : "#6b7280", fontWeight: overdue ? 700 : 400 }}>
              Next due: {fmtDate(vac.next_due_date)}
            </p>
          )}
          {vac.notes && (
            <p style={{ margin: 0, fontSize: 12, color: "#9ca3af", lineHeight: 1.5 }}>{vac.notes}</p>
          )}
        </div>
        <button
          onClick={() => onArchive(vac.id)}
          style={{
            background: "none", border: "none", color: "#d1d5db",
            fontSize: 18, cursor: "pointer", padding: 4, flexShrink: 0,
          }}
          title="Archive"
        >🗄️</button>
      </div>
    </div>
  );
}

// ─── Record Form Sheet ────────────────────────────────────────────────────────
function RecordSheet({
  studentId, parentId, onClose, onSaved,
}: {
  studentId: string; parentId: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    record_type: "visit", title: "", description: "",
    provider: "", severity: "", outcome: "", recorded_at: "",
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  async function save() {
    if (!form.title.trim()) { setErr("Please add a title."); return; }
    setSaving(true); setErr("");
    const { error } = await supabase.from("health_records").insert({
      student_id:  studentId,
      parent_id:   parentId,
      record_type: form.record_type,
      title:       form.title.trim(),
      description: form.description.trim() || null,
      provider:    form.provider.trim()    || null,
      severity:    form.severity           || null,
      outcome:     form.outcome.trim()     || null,
      recorded_at: form.recorded_at        || new Date().toISOString(),
    });
    setSaving(false);
    if (error) { setErr("Something went wrong — try again."); return; }
    onSaved();
  }

  const field: React.CSSProperties = {
    width: "100%", padding: "11px 14px", borderRadius: 10,
    border: "1.5px solid #e5e7eb", fontSize: 14, color: dark,
    fontFamily: "inherit", background: "#f9fafb", boxSizing: "border-box",
    outline: "none",
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 7000, display: "flex", alignItems: "flex-end", animation: "fadeIn 0.2s ease" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", background: "#fff", borderRadius: "24px 24px 0 0", padding: "28px 20px 48px", maxHeight: "90vh", overflowY: "auto", animation: "slideUp 0.3s ease" }}>
        <div style={{ width: 40, height: 4, background: "#e5e7eb", borderRadius: 4, margin: "0 auto 24px" }} />
        <p style={{ fontSize: 18, fontWeight: 800, color: dark, margin: "0 0 20px" }}>Log a Health Visit</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Type */}
          <select value={form.record_type} onChange={e => setForm(f => ({ ...f, record_type: e.target.value }))} style={field}>
            <option value="visit">🏥 Doctor Visit</option>
            <option value="illness">🤒 Illness</option>
            <option value="injury">🩹 Injury</option>
            <option value="other">📋 Other</option>
          </select>

          {/* Title */}
          <input
            placeholder="Title (e.g. Flu, Broken arm, Check-up)"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            style={field}
          />

          {/* Provider */}
          <input
            placeholder="Doctor / clinic (optional)"
            value={form.provider}
            onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
            style={field}
          />

          {/* Severity */}
          <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} style={field}>
            <option value="">Severity (optional)</option>
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
          </select>

          {/* Description */}
          <textarea
            placeholder="What happened? (optional)"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={3}
            style={{ ...field, resize: "vertical" }}
          />

          {/* Outcome */}
          <input
            placeholder="Outcome / treatment (optional)"
            value={form.outcome}
            onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))}
            style={field}
          />

          {/* Date */}
          <input
            type="date"
            value={form.recorded_at ? form.recorded_at.slice(0, 10) : ""}
            onChange={e => setForm(f => ({ ...f, recorded_at: e.target.value }))}
            style={field}
          />

          {err && <p style={{ margin: 0, fontSize: 12, color: red }}>{err}</p>}

          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: "14px", background: saving ? "#d1d5db" : dark,
              color: "#fff", border: "none", borderRadius: 14,
              fontWeight: 700, fontSize: 15, cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >{saving ? "Saving…" : "Save Record"}</button>

          <button onClick={onClose} style={{ padding: "12px", background: "transparent", border: "none", color: "#9ca3af", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Vaccination Form Sheet ───────────────────────────────────────────────────
function VaccinationSheet({
  studentId, parentId, onClose, onSaved,
}: {
  studentId: string; parentId: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    vaccine_name: "", dose: "", administered_at: "",
    next_due_date: "", provider: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  async function save() {
    if (!form.vaccine_name.trim()) { setErr("Please enter the vaccine name."); return; }
    setSaving(true); setErr("");
    const { error } = await supabase.from("health_vaccinations").insert({
      student_id:      studentId,
      parent_id:       parentId,
      vaccine_name:    form.vaccine_name.trim(),
      dose:            form.dose.trim()          || null,
      administered_at: form.administered_at      || null,
      next_due_date:   form.next_due_date        || null,
      provider:        form.provider.trim()      || null,
      notes:           form.notes.trim()         || null,
    });
    setSaving(false);
    if (error) { setErr("Something went wrong — try again."); return; }
    onSaved();
  }

  const field: React.CSSProperties = {
    width: "100%", padding: "11px 14px", borderRadius: 10,
    border: "1.5px solid #e5e7eb", fontSize: 14, color: dark,
    fontFamily: "inherit", background: "#f9fafb", boxSizing: "border-box",
    outline: "none",
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 7000, display: "flex", alignItems: "flex-end", animation: "fadeIn 0.2s ease" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", background: "#fff", borderRadius: "24px 24px 0 0", padding: "28px 20px 48px", maxHeight: "90vh", overflowY: "auto", animation: "slideUp 0.3s ease" }}>
        <div style={{ width: 40, height: 4, background: "#e5e7eb", borderRadius: 4, margin: "0 auto 24px" }} />
        <p style={{ fontSize: 18, fontWeight: 800, color: dark, margin: "0 0 20px" }}>Log a Vaccination</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            placeholder="Vaccine name (e.g. MMR, Polio, COVID-19)"
            value={form.vaccine_name}
            onChange={e => setForm(f => ({ ...f, vaccine_name: e.target.value }))}
            style={field}
          />
          <input
            placeholder="Dose (e.g. 1st dose, Booster)"
            value={form.dose}
            onChange={e => setForm(f => ({ ...f, dose: e.target.value }))}
            style={field}
          />
          <input
            placeholder="Doctor / clinic (optional)"
            value={form.provider}
            onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
            style={field}
          />

          <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", margin: "4px 0 -4px" }}>Date given</label>
          <input
            type="date"
            value={form.administered_at}
            onChange={e => setForm(f => ({ ...f, administered_at: e.target.value }))}
            style={field}
          />

          <label style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", margin: "4px 0 -4px" }}>Next due date (optional)</label>
          <input
            type="date"
            value={form.next_due_date}
            onChange={e => setForm(f => ({ ...f, next_due_date: e.target.value }))}
            style={field}
          />

          <textarea
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={3}
            style={{ ...field, resize: "vertical" }}
          />

          {err && <p style={{ margin: 0, fontSize: 12, color: red }}>{err}</p>}

          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: "14px", background: saving ? "#d1d5db" : dark,
              color: "#fff", border: "none", borderRadius: 14,
              fontWeight: 700, fontSize: 15, cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >{saving ? "Saving…" : "Save Vaccination"}</button>

          <button onClick={onClose} style={{ padding: "12px", background: "transparent", border: "none", color: "#9ca3af", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HealthPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [childName,   setChildName]   = useState("");
  const [parentId,    setParentId]    = useState("");
  const [tab,         setTab]         = useState<"records" | "vaccinations">("records");
  const [records,     setRecords]     = useState<HealthRecord[]>([]);
  const [vacs,        setVacs]        = useState<HealthVaccination[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showRec,     setShowRec]     = useState(false);
  const [showVac,     setShowVac]     = useState(false);
  const [toast,       setToast]       = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3000);
  }, []);

  // ── Auth + child name ───────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setParentId(user.id);
      const { data } = await supabase.from("students").select("name").eq("id", id).single();
      if (data?.name) setChildName(data.name);
    }
    if (id) init();
  }, [id]);

  // ── Fetch records ───────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    const { data, error } = await supabase
      .from("health_records")
      .select("*")
      .eq("student_id", id)
      .is("deleted_at", null)
      .order("recorded_at", { ascending: false });
    if (!error && data) setRecords(data as HealthRecord[]);
  }, [id]);

  // ── Fetch vaccinations ──────────────────────────────────────────────────────
  const fetchVacs = useCallback(async () => {
    const { data, error } = await supabase
      .from("health_vaccinations")
      .select("*")
      .eq("student_id", id)
      .is("deleted_at", null)
      .order("administered_at", { ascending: false });
    if (!error && data) setVacs(data as HealthVaccination[]);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([fetchRecords(), fetchVacs()]).finally(() => setLoading(false));
  }, [id, fetchRecords, fetchVacs]);

  // ── Archive record ──────────────────────────────────────────────────────────
  async function archiveRecord(rid: string) {
    await supabase.from("health_records").update({ deleted_at: new Date().toISOString() }).eq("id", rid);
    setRecords(r => r.filter(x => x.id !== rid));
    showToast("Record archived.");
  }

  // ── Archive vaccination ─────────────────────────────────────────────────────
  async function archiveVac(vid: string) {
    await supabase.from("health_vaccinations").update({ deleted_at: new Date().toISOString() }).eq("id", vid);
    setVacs(v => v.filter(x => x.id !== vid));
    showToast("Vaccination archived.");
  }

  const name    = firstName(childName) || "…";
  const overdue = vacs.filter(v => isOverdue(v.next_due_date));

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{transform:translateY(40px);opacity:0} to{transform:translateY(0);opacity:1} }
      `}</style>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "16px 16px 120px" }}>

        {/* ── Hub Tab Bar ── */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
          {[
            { label: "👤 Profile",  href: "profile"  },
            { label: "🌱 Life",     href: "life"     },
            { label: "📈 Growth",   href: "growth"   },
            { label: "💰 Finance",  href: "finance"  },
            { label: "📸 Memories", href: "memories" },
            { label: "❤️ Health",   href: "health"   },
          ].map(t => {
            const active = t.href === "health";
            return (
              <button
                key={t.href}
                onClick={() => router.push(`/parent/child/${id}/${t.href}`)}
                style={{
                  flexShrink: 0, padding: "8px 16px", borderRadius: 20,
                  border: "1.5px solid", borderColor: active ? dark : "#e5e7eb",
                  background: active ? dark : "#fff",
                  color: active ? "#fff" : "#6b7280",
                  fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                }}
              >{t.label}</button>
            );
          })}
        </div>

        {/* ── Hero ── */}
        <div style={{
          background: `linear-gradient(135deg, ${dark} 0%, #312e81 100%)`,
          borderRadius: 20, padding: "20px 20px 18px", marginBottom: 16, color: "#fff",
        }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4, letterSpacing: 0.5, textTransform: "uppercase" }}>Health</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
            {childName ? `${name}'s Wellbeing` : "Loading…"}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginBottom: 16 }}>
            {records.length} {records.length === 1 ? "record" : "records"} · {vacs.length} {vacs.length === 1 ? "vaccination" : "vaccinations"}
            {overdue.length > 0 && ` · ⚠️ ${overdue.length} overdue`}
          </div>
          <button
            onClick={() => tab === "records" ? setShowRec(true) : setShowVac(true)}
            style={{
              padding: "10px 22px", background: accent, color: "#fff",
              border: "none", borderRadius: 24, fontWeight: 700, fontSize: 13,
              cursor: "pointer", fontFamily: "inherit",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >{tab === "records" ? "➕ Log a Visit" : "➕ Log Vaccination"}</button>
        </div>

        {/* ── Overdue Banner ── */}
        {overdue.length > 0 && (
          <div style={{
            background: red + "12", border: `1.5px solid ${red}30`,
            borderRadius: 14, padding: "12px 16px", marginBottom: 16,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: red }}>
                {overdue.length} vaccination{overdue.length > 1 ? "s" : ""} overdue
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6b7280" }}>
                {overdue.map(v => v.vaccine_name).join(", ")}
              </p>
            </div>
          </div>
        )}

        {/* ── Inner Tabs ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[
            { id: "records"       as const, label: "💊 Records",      count: records.length },
            { id: "vaccinations"  as const, label: "💉 Vaccinations",  count: vacs.length    },
          ].map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  flex: 1, padding: "10px 16px", borderRadius: 12,
                  border: "1.5px solid", borderColor: active ? dark : "#e5e7eb",
                  background: active ? dark : "#fff",
                  color: active ? "#fff" : "#6b7280",
                  fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                {t.label}
                <span style={{
                  background: active ? "rgba(255,255,255,0.2)" : "#f0f0f0",
                  color: active ? "#fff" : "#9ca3af",
                  borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 700,
                }}>{t.count}</span>
              </button>
            );
          })}
        </div>

        {/* ── Skeleton ── */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* ── Records ── */}
        {!loading && tab === "records" && (
          <>
            {records.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "60px 24px",
                background: "#fff", borderRadius: 20, border: "1.5px dashed #e5e7eb",
              }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>🏥</div>
                <p style={{ fontSize: 16, fontWeight: 700, color: dark, margin: "0 0 8px" }}>
                  {name}'s health journey starts here
                </p>
                <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 24px", lineHeight: 1.6 }}>
                  Log visits, illnesses, and injuries to keep a full picture.
                </p>
                <button
                  onClick={() => setShowRec(true)}
                  style={{
                    padding: "10px 24px", background: dark, color: "#fff",
                    border: "none", borderRadius: 24, fontWeight: 700,
                    fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                  }}
                >➕ Log First Visit</button>
              </div>
            ) : (
              records.map(r => <RecordCard key={r.id} rec={r} onArchive={archiveRecord} />)
            )}
          </>
        )}

        {/* ── Vaccinations ── */}
        {!loading && tab === "vaccinations" && (
          <>
            {vacs.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "60px 24px",
                background: "#fff", borderRadius: 20, border: "1.5px dashed #e5e7eb",
              }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>💉</div>
                <p style={{ fontSize: 16, fontWeight: 700, color: dark, margin: "0 0 8px" }}>
                  Log {name}'s first vaccination
                </p>
                <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 24px", lineHeight: 1.6 }}>
                  Keep track of every dose and never miss a due date.
                </p>
                <button
                  onClick={() => setShowVac(true)}
                  style={{
                    padding: "10px 24px", background: dark, color: "#fff",
                    border: "none", borderRadius: 24, fontWeight: 700,
                    fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                  }}
                >➕ Log First Vaccination</button>
              </div>
            ) : (
              vacs.map(v => <VaccinationCard key={v.id} vac={v} onArchive={archiveVac} />)
            )}
          </>
        )}
      </div>

      {/* ── Record Sheet ── */}
      {showRec && parentId && (
        <RecordSheet
          studentId={id as string}
          parentId={parentId}
          onClose={() => setShowRec(false)}
          onSaved={() => {
            setShowRec(false);
            fetchRecords();
            showToast("Health record saved ✅");
          }}
        />
      )}

      {/* ── Vaccination Sheet ── */}
      {showVac && parentId && (
        <VaccinationSheet
          studentId={id as string}
          parentId={parentId}
          onClose={() => setShowVac(false)}
          onSaved={() => {
            setShowVac(false);
            fetchVacs();
            showToast("Vaccination saved 💉");
          }}
        />
      )}

      {/* ── Toast ── */}
      <Toast msg={toast} />
    </div>
  );
}
