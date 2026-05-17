"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const dark   = "#1e1b4b";
const accent = "#10b981";
const bg     = "#f0f2f5";
const amber  = "#f59e0b";

interface GrowthEntry {
  id: string;
  height_cm: number | null;
  weight_kg: number | null;
  notes: string | null;
  recorded_at: string;
}

function Shimmer({ w = "100%", h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite", flexShrink: 0,
    }} />
  );
}

function Toast({ msg }: { msg: string }) {
  return (
    <div style={{
      position: "fixed", bottom: 140, left: "50%", transform: "translateX(-50%)",
      background: dark, color: "#fff", padding: "11px 22px", borderRadius: 12,
      fontSize: 13, fontWeight: 600, zIndex: 9999, animation: "fadeIn 0.2s ease",
      boxShadow: "0 8px 24px rgba(0,0,0,0.18)", whiteSpace: "nowrap",
    }}>{msg}</div>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: "20px 20px 0 0",
        padding: "28px 20px 48px", width: "100%", maxWidth: 768,
        animation: "slideUp 0.22s ease",
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
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", color: dark }} />
    </div>
  );
}

// ── Inline SVG line chart ─────────────────────────────────────────────────────
function LineChart({ entries, field, color, label }: { entries: GrowthEntry[]; field: "height_cm" | "weight_kg"; color: string; label: string }) {
  const data = entries.filter(e => e[field] !== null).slice().reverse();
  if (data.length < 2) return (
    <div style={{ textAlign: "center", padding: "20px 0", color: "#9ca3af", fontSize: 13 }}>
      Log at least 2 entries to see the chart
    </div>
  );

  const values = data.map(e => e[field] as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 320;
  const H = 120;
  const pad = 20;

  const points = data.map((_, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2);
    const y = H - pad - ((values[i] - min) / range) * (H - pad * 2);
    return { x, y, val: values[i], date: data[i].recorded_at };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = `${pathD} L ${points[points.length-1].x} ${H - pad} L ${points[0].x} ${H - pad} Z`;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={W} height={H} style={{ display: "block", margin: "0 auto" }}>
        <defs>
          <linearGradient id={`grad-${field}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#grad-${field})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} fill={color} />
            <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fill="#6b7280">{p.val}</text>
          </g>
        ))}
        <text x={points[0].x} y={H - 4} textAnchor="middle" fontSize="8" fill="#9ca3af">{points[0].date?.slice(5)}</text>
        <text x={points[points.length-1].x} y={H - 4} textAnchor="middle" fontSize="8" fill="#9ca3af">{points[points.length-1].date?.slice(5)}</text>
      </svg>
    </div>
  );
}

export default function GrowthPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const [childName, setChildName] = useState("");
  const [userId, setUserId]       = useState("");
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState<string | null>(null);
  const [entries, setEntries]     = useState<GrowthEntry[]>([]);
  const [showSheet, setShowSheet] = useState(false);
  const [gHeight, setGHeight]     = useState("");
  const [gWeight, setGWeight]     = useState("");
  const [gNotes, setGNotes]       = useState("");
  const [gDate, setGDate]         = useState(new Date().toISOString().split("T")[0]);
  const [activeChart, setActiveChart] = useState<"height" | "weight">("height");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }, []);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/academy/signin?role=parent"); return; }
    setUserId(user.id);
    const { data: student } = await supabase.from("students").select("name").eq("id", id).single();
    setChildName(student?.name ?? "");
    const { data } = await supabase.from("child_growth").select("*").eq("student_id", id).is("deleted_at", null).order("recorded_at", { ascending: false });
    setEntries((data ?? []) as GrowthEntry[]);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const firstName = childName.split(" ")[0];
  const latest = entries[0];

  async function addEntry() {
    if (!gHeight && !gWeight) { showToast("Enter height or weight"); return; }
    setSaving(true);
    const { error } = await supabase.from("child_growth").insert({
      student_id: id, parent_id: userId,
      height_cm: gHeight ? parseFloat(gHeight) : null,
      weight_kg: gWeight ? parseFloat(gWeight) : null,
      notes: gNotes.trim() || null,
      recorded_at: gDate,
    });
    setSaving(false);
    if (error) { showToast("Something went wrong — try again"); return; }
    setShowSheet(false);
    setGHeight(""); setGWeight(""); setGNotes(""); setGDate(new Date().toISOString().split("T")[0]);
    await fetchAll();
    showToast("Growth entry saved!");
  }

  const HUB_TABS = [
    { label: "👤 Profile",  href: "profile",  active: false },
    { label: "🌱 Life",     href: "life",     active: false },
    { label: "📈 Growth",   href: "growth",   active: true  },
    { label: "💰 Finance",  href: "finance",  active: false },
    { label: "📸 Memories", href: "memories", active: false },
    { label: "❤️ Health",   href: "health",   active: false },
  ];

  return (
    <div style={{ paddingBottom: 120, animation: "fadeIn 0.2s ease" }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{transform:translateY(40px);opacity:0} to{transform:translateY(0);opacity:1} }
      `}</style>

      {/* ── HUB TABS ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
        {HUB_TABS.map(t => (
          <button key={t.href} onClick={() => router.push(`/parent/child/${id}/${t.href}`)} style={{
            flexShrink: 0, padding: "8px 16px", borderRadius: 20, border: "1.5px solid",
            borderColor: t.active ? dark : "#e5e7eb", background: t.active ? dark : "#fff",
            color: t.active ? "#fff" : "#6b7280", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── HEADER ── */}
      <div style={{ background: `linear-gradient(135deg, ${dark} 0%, #312e81 100%)`, borderRadius: 20, padding: "20px 20px 16px", marginBottom: 16, color: "#fff" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>{firstName}&apos;s Journey</div>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.4, marginBottom: 12 }}>Growth</div>
        {loading ? (
          <div style={{ display: "flex", gap: 20 }}><Shimmer w={60} h={40} r={8} /><Shimmer w={60} h={40} r={8} /></div>
        ) : latest ? (
          <div style={{ display: "flex", gap: 20 }}>
            {latest.height_cm && (
              <div>
                <div style={{ fontSize: 26, fontWeight: 900, color: accent }}>{latest.height_cm}<span style={{ fontSize: 13 }}>cm</span></div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Height</div>
              </div>
            )}
            {latest.weight_kg && (
              <div>
                <div style={{ fontSize: 26, fontWeight: 900, color: amber }}>{latest.weight_kg}<span style={{ fontSize: 13 }}>kg</span></div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Weight</div>
              </div>
            )}
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Last recorded</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>{latest.recorded_at}</div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{firstName}&apos;s story starts here</div>
        )}
      </div>

      {/* ── CHART ── */}
      {!loading && entries.length >= 2 && (
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", padding: "16px", marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[{ id: "height", label: "Height", color: accent }, { id: "weight", label: "Weight", color: amber }].map(c => (
              <button key={c.id} onClick={() => setActiveChart(c.id as "height" | "weight")} style={{
                padding: "6px 14px", borderRadius: 20, border: "1.5px solid",
                borderColor: activeChart === c.id ? c.color : "#e5e7eb",
                background: activeChart === c.id ? c.color + "18" : "#fff",
                color: activeChart === c.id ? c.color : "#9ca3af",
                fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              }}>{c.label}</button>
            ))}
          </div>
          {activeChart === "height"
            ? <LineChart entries={entries} field="height_cm" color={accent} label="Height (cm)" />
            : <LineChart entries={entries} field="weight_kg" color={amber} label="Weight (kg)" />
          }
        </div>
      )}

      {/* ── LOG BUTTON ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: dark }}>History</div>
        <button onClick={() => setShowSheet(true)} style={{ padding: "7px 16px", borderRadius: 20, border: "none", background: accent, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
          + Log Entry
        </button>
      </div>

      {/* ── LOADING ── */}
      {loading && [1,2,3].map(i => (
        <div key={i} style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, border: "1px solid #e5e7eb", display: "flex", flexDirection: "column", gap: 8 }}>
          <Shimmer h={14} w="50%" /><Shimmer h={11} w="30%" />
        </div>
      ))}

      {/* ── EMPTY ── */}
      {!loading && entries.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af", fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📏</div>
          <div style={{ fontWeight: 700, color: dark, marginBottom: 4 }}>{firstName}&apos;s story starts here</div>
          <div>Log the first measurement to begin tracking</div>
        </div>
      )}

      {/* ── HISTORY LIST ── */}
      {!loading && entries.map(e => (
        <div key={e.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "14px 16px", marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
            <div style={{ display: "flex", gap: 14 }}>
              {e.height_cm && <div><span style={{ fontSize: 16, fontWeight: 800, color: accent }}>{e.height_cm}</span><span style={{ fontSize: 11, color: "#9ca3af" }}> cm</span></div>}
              {e.weight_kg && <div><span style={{ fontSize: 16, fontWeight: 800, color: amber }}>{e.weight_kg}</span><span style={{ fontSize: 11, color: "#9ca3af" }}> kg</span></div>}
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>{e.recorded_at}</div>
          </div>
          {e.notes && <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{e.notes}</div>}
        </div>
      ))}

      {/* ── SHEET ── */}
      {showSheet && (
        <Sheet title="Log Growth" onClose={() => setShowSheet(false)}>
          <Input label="Height (cm)" value={gHeight} onChange={setGHeight} placeholder="e.g. 112.5" type="number" />
          <Input label="Weight (kg)" value={gWeight} onChange={setGWeight} placeholder="e.g. 22.3" type="number" />
          <Input label="Date" value={gDate} onChange={setGDate} type="date" />
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: dark, marginBottom: 6 }}>Notes (optional)</div>
            <textarea value={gNotes} onChange={e => setGNotes(e.target.value)} placeholder="Any observations?" rows={2}
              style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", resize: "none", color: dark }} />
          </div>
          <button onClick={addEntry} disabled={saving} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: saving ? "#9ca3af" : accent, color: "#fff", fontWeight: 700, fontSize: 15, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </Sheet>
      )}

      {toast && <Toast msg={toast} />}
    </div>
  );
}
