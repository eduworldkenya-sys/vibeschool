
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const dark   = "#1e1b4b";
const accent = "#10b981";
const bg     = "#f0f2f5";
const red    = "#ef4444";
const amber  = "#f59e0b";

interface FeePayment {
  id: string;
  amount: number;
  currency: string | null;
  method: string | null;
  reference: string | null;
  term: string | null;
  year: number | null;
  notes: string | null;
  recorded_at: string | null;
}
interface PocketMoney {
  id: string;
  type: string;
  amount: number;
  currency: string | null;
  description: string | null;
  category: string | null;
  recorded_at: string | null;
}
interface SavingsGoal {
  id: string;
  title: string;
  description: string | null;
  target_amount: number;
  saved_amount: number;
  currency: string | null;
  status: string;
  target_date: string | null;
}
interface SavingsContribution {
  id: string;
  goal_id: string;
  amount: number;
  notes: string | null;
  recorded_at: string | null;
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
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", color: dark }} />
    </div>
  );
}

function SaveBtn({ label = "Save", onClick, loading }: { label?: string; onClick: () => void; loading?: boolean }) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      width: "100%", padding: 14, borderRadius: 12, border: "none",
      background: loading ? "#9ca3af" : accent, color: "#fff",
      fontWeight: 700, fontSize: 15, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", marginTop: 4,
    }}>{loading ? "Saving…" : label}</button>
  );
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 8, borderRadius: 8, background: "#f3f4f6", overflow: "hidden", marginTop: 8 }}>
      <div style={{ height: "100%", borderRadius: 8, background: color, width: `${Math.min(pct, 100)}%`, transition: "width 0.4s ease" }} />
    </div>
  );
}

const HUB_TABS = [
  { label: "👤 Profile",  href: "profile",  active: false },
  { label: "🌱 Life",     href: "life",     active: false },
  { label: "📈 Growth",   href: "growth",   active: false },
  { label: "💰 Finance",  href: "finance",  active: true  },
  { label: "📸 Memories", href: "memories", active: false },
  { label: "❤️ Health",   href: "health",   active: false },
];

export default function FinancePage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const [childName, setChildName]   = useState("");
  const [userId, setUserId]         = useState("");
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState<string | null>(null);
  const [tab, setTab]               = useState<"fees" | "pocket" | "savings">("fees");

  const [fees, setFees]             = useState<FeePayment[]>([]);
  const [pocket, setPocket]         = useState<PocketMoney[]>([]);
  const [goals, setGoals]           = useState<SavingsGoal[]>([]);
  const [contributions, setContributions] = useState<SavingsContribution[]>([]);

  // Fee form
  const [fAmount, setFAmount]       = useState("");
  const [fMethod, setFMethod]       = useState("");
  const [fRef, setFRef]             = useState("");
  const [fTerm, setFTerm]           = useState("");
  const [fYear, setFYear]           = useState(new Date().getFullYear().toString());
  const [fNotes, setFNotes]         = useState("");
  const [fDate, setFDate]           = useState(new Date().toISOString().split("T")[0]);
  const [showFeeSheet, setShowFeeSheet] = useState(false);

  // Pocket money form
  const [pType, setPType]           = useState("allowance");
  const [pAmount, setPAmount]       = useState("");
  const [pDesc, setPDesc]           = useState("");
  const [pCat, setPCat]             = useState("");
  const [pDate, setPDate]           = useState(new Date().toISOString().split("T")[0]);
  const [showPocketSheet, setShowPocketSheet] = useState(false);

  // Savings goal form
  const [sTitle, setSTitle]         = useState("");
  const [sDesc, setSDesc]           = useState("");
  const [sTarget, setSTarget]       = useState("");
  const [sDate, setSDate]           = useState("");
  const [showGoalSheet, setShowGoalSheet] = useState(false);

  // Contribute form
  const [cGoalId, setCGoalId]       = useState("");
  const [cAmount, setCAmount]       = useState("");
  const [cNotes, setCNotes]         = useState("");
  const [showContribSheet, setShowContribSheet] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg); setTimeout(() => setToast(null), 2800);
  }, []);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/admin/login"); return; }
    setUserId(user.id);
    const { data: student } = await supabase.from("students").select("name").eq("id", id).single();
    setChildName(student?.name ?? "");

    const [f, p, g, c] = await Promise.all([
      supabase.from("finance_fee_payments").select("*").eq("student_id", id).is("deleted_at", null).order("recorded_at", { ascending: false }),
      supabase.from("finance_pocket_money").select("*").eq("student_id", id).is("deleted_at", null).order("recorded_at", { ascending: false }),
      supabase.from("finance_savings_goals").select("*").eq("student_id", id).is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("finance_savings_contributions").select("*").eq("student_id", id).is("deleted_at", null).order("recorded_at", { ascending: false }),
    ]);

    setFees((f.data ?? []) as FeePayment[]);
    setPocket((p.data ?? []) as PocketMoney[]);
    setGoals((g.data ?? []) as SavingsGoal[]);
    setContributions((c.data ?? []) as SavingsContribution[]);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const firstName = childName.split(" ")[0];

  const totalFees    = fees.reduce((s, f) => s + (f.amount ?? 0), 0);
  const pocketIn     = pocket.filter(p => p.type !== "spend").reduce((s, p) => s + (p.amount ?? 0), 0);
  const pocketOut    = pocket.filter(p => p.type === "spend").reduce((s, p) => s + (p.amount ?? 0), 0);
  const pocketBal    = pocketIn - pocketOut;

  async function addFee() {
    if (!fAmount) { showToast("Enter amount"); return; }
    setSaving(true);
    const { error } = await supabase.from("finance_fee_payments").insert({
      student_id: id, parent_id: userId,
      amount: parseFloat(fAmount), method: fMethod || null,
      reference: fRef || null, term: fTerm || null,
      year: fYear ? parseInt(fYear) : null,
      notes: fNotes || null, recorded_at: fDate,
    });
    setSaving(false);
    if (error) { showToast("Something went wrong — try again"); return; }
    setShowFeeSheet(false);
    setFAmount(""); setFMethod(""); setFRef(""); setFTerm(""); setFNotes("");
    await fetchAll();
    showToast("Fee payment logged!");
  }

  async function addPocket() {
    if (!pAmount) { showToast("Enter amount"); return; }
    setSaving(true);
    const { error } = await supabase.from("finance_pocket_money").insert({
      student_id: id, parent_id: userId,
      type: pType, amount: parseFloat(pAmount),
      description: pDesc || null, category: pCat || null,
      recorded_at: pDate,
    });
    setSaving(false);
    if (error) { showToast("Something went wrong — try again"); return; }
    setShowPocketSheet(false);
    setPAmount(""); setPDesc(""); setPCat(""); setPType("allowance");
    await fetchAll();
    showToast("Pocket money logged!");
  }

  async function addGoal() {
    if (!sTitle || !sTarget) { showToast("Enter title and target amount"); return; }
    setSaving(true);
    const { error } = await supabase.from("finance_savings_goals").insert({
      student_id: id, parent_id: userId,
      title: sTitle, description: sDesc || null,
      target_amount: parseFloat(sTarget), saved_amount: 0,
      status: "active", target_date: sDate || null,
      recorded_at: new Date().toISOString().split("T")[0],
    });
    setSaving(false);
    if (error) { showToast("Something went wrong — try again"); return; }
    setShowGoalSheet(false);
    setSTitle(""); setSDesc(""); setSTarget(""); setSDate("");
    await fetchAll();
    showToast("Savings goal created!");
  }

  async function addContribution() {
    if (!cGoalId || !cAmount) { showToast("Select a goal and enter amount"); return; }
    setSaving(true);
    const amt = parseFloat(cAmount);
    const { error: ce } = await supabase.from("finance_savings_contributions").insert({
      goal_id: cGoalId, student_id: id, parent_id: userId,
      amount: amt, notes: cNotes || null,
      recorded_at: new Date().toISOString().split("T")[0],
    });
    if (!ce) {
      const goal = goals.find(g => g.id === cGoalId);
      if (goal) {
        const newSaved = (goal.saved_amount ?? 0) + amt;
        await supabase.from("finance_savings_goals").update({
          saved_amount: newSaved,
          status: newSaved >= goal.target_amount ? "achieved" : "active",
          achieved_at: newSaved >= goal.target_amount ? new Date().toISOString() : null,
        }).eq("id", cGoalId);
      }
    }
    setSaving(false);
    if (ce) { showToast("Something went wrong — try again"); return; }
    setShowContribSheet(false);
    setCAmount(""); setCNotes(""); setCGoalId("");
    await fetchAll();
    showToast("Contribution added!");
  }

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
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.4, marginBottom: 12 }}>Finance</div>
        {loading ? (
          <div style={{ display: "flex", gap: 16 }}><Shimmer w={80} h={36} r={8} /><Shimmer w={80} h={36} r={8} /></div>
        ) : (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: accent }}>KES {totalFees.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Fees Paid</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: pocketBal >= 0 ? accent : red }}>KES {pocketBal.toLocaleString()}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Pocket Balance</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: amber }}>{goals.filter(g => g.status === "active").length}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Savings Goals</div>
            </div>
          </div>
        )}
      </div>

      {/* ── SUB TABS ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[
          { id: "fees",    label: "💳 Fees" },
          { id: "pocket",  label: "👛 Pocket" },
          { id: "savings", label: "🐷 Savings" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)} style={{
            flex: 1, padding: "9px 8px", borderRadius: 12, border: "1.5px solid",
            borderColor: tab === t.id ? dark : "#e5e7eb",
            background: tab === t.id ? dark : "#fff",
            color: tab === t.id ? "#fff" : "#6b7280",
            fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ══ FEES TAB ══ */}
      {tab === "fees" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: dark }}>Fee Payments</div>
            <button onClick={() => setShowFeeSheet(true)} style={{ padding: "7px 16px", borderRadius: 20, border: "none", background: accent, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>+ Log Payment</button>
          </div>
          {loading && [1,2].map(i => <div key={i} style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, border: "1px solid #e5e7eb" }}><Shimmer h={14} w="50%" /></div>)}
          {!loading && fees.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💳</div>
              <div style={{ fontWeight: 700, color: dark, marginBottom: 4 }}>{firstName}&apos;s story starts here</div>
              <div style={{ fontSize: 13 }}>Log the first fee payment</div>
            </div>
          )}
          {!loading && fees.map(f => (
            <div key={f.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "14px 16px", marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: accent }}>KES {(f.amount ?? 0).toLocaleString()}</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{f.recorded_at}</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {f.term && <span style={{ fontSize: 11, color: "#6b7280" }}>{f.term} {f.year}</span>}
                {f.method && <span style={{ fontSize: 11, color: "#9ca3af" }}>via {f.method}</span>}
                {f.reference && <span style={{ fontSize: 11, color: "#9ca3af" }}>Ref: {f.reference}</span>}
              </div>
              {f.notes && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>{f.notes}</div>}
            </div>
          ))}
        </div>
      )}

      {/* ══ POCKET MONEY TAB ══ */}
      {tab === "pocket" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: dark }}>Pocket Money</div>
            <button onClick={() => setShowPocketSheet(true)} style={{ padding: "7px 16px", borderRadius: 20, border: "none", background: accent, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>+ Log</button>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[
              { label: "In", value: `KES ${pocketIn.toLocaleString()}`, color: accent },
              { label: "Spent", value: `KES ${pocketOut.toLocaleString()}`, color: red },
              { label: "Balance", value: `KES ${pocketBal.toLocaleString()}`, color: pocketBal >= 0 ? accent : red },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: "#fff", borderRadius: 12, padding: "12px 10px", textAlign: "center", border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {loading && [1,2].map(i => <div key={i} style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, border: "1px solid #e5e7eb" }}><Shimmer h={14} w="50%" /></div>)}
          {!loading && pocket.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>👛</div>
              <div style={{ fontWeight: 700, color: dark, marginBottom: 4 }}>{firstName}&apos;s story starts here</div>
              <div style={{ fontSize: 13 }}>Log the first pocket money entry</div>
            </div>
          )}
          {!loading && pocket.map(p => (
            <div key={p.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "14px 16px", marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{p.type === "spend" ? "👆" : p.type === "bonus" ? "🎁" : "💵"}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: dark, textTransform: "capitalize" }}>{p.type}</div>
                    {p.description && <div style={{ fontSize: 12, color: "#6b7280" }}>{p.description}</div>}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: p.type === "spend" ? red : accent }}>
                    {p.type === "spend" ? "-" : "+"}KES {(p.amount ?? 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: "#9ca3af" }}>{p.recorded_at}</div>
                </div>
              </div>
              {p.category && <span style={{ fontSize: 11, color: "#9ca3af" }}>{p.category}</span>}
            </div>
          ))}
        </div>
      )}

      {/* ══ SAVINGS TAB ══ */}
      {tab === "savings" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: dark }}>Savings Goals</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowContribSheet(true)} style={{ padding: "7px 14px", borderRadius: 20, border: `1.5px solid ${dark}`, background: "#fff", color: dark, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>+ Contribute</button>
              <button onClick={() => setShowGoalSheet(true)} style={{ padding: "7px 14px", borderRadius: 20, border: "none", background: accent, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>+ Goal</button>
            </div>
          </div>
          {loading && [1,2].map(i => <div key={i} style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, border: "1px solid #e5e7eb" }}><Shimmer h={14} w="50%" /></div>)}
          {!loading && goals.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🐷</div>
              <div style={{ fontWeight: 700, color: dark, marginBottom: 4 }}>{firstName}&apos;s story starts here</div>
              <div style={{ fontSize: 13 }}>Create the first savings goal</div>
            </div>
          )}
          {!loading && goals.map(g => {
            const pct = g.target_amount > 0 ? Math.round((g.saved_amount / g.target_amount) * 100) : 0;
            const goalContribs = contributions.filter(c => c.goal_id === g.id);
            return (
              <div key={g.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "14px 16px", marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: dark }}>{g.title}</div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: g.status === "achieved" ? "#d1fae5" : "#fef3c7", color: g.status === "achieved" ? accent : amber, textTransform: "capitalize" }}>{g.status}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
                  <span>KES {(g.saved_amount ?? 0).toLocaleString()} saved</span>
                  <span>Goal: KES {(g.target_amount ?? 0).toLocaleString()}</span>
                </div>
                <ProgressBar pct={pct} color={g.status === "achieved" ? accent : amber} />
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{pct}% complete{g.target_date ? ` · Due ${g.target_date}` : ""}</div>
                {goalContribs.length > 0 && (
                  <div style={{ marginTop: 10, borderTop: "1px solid #f3f4f6", paddingTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", marginBottom: 6 }}>CONTRIBUTIONS</div>
                    {goalContribs.slice(0, 3).map(c => (
                      <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#374151", marginBottom: 4 }}>
                        <span>{c.recorded_at}</span>
                        <span style={{ fontWeight: 700, color: accent }}>+KES {(c.amount ?? 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ SHEETS ══ */}
      {showFeeSheet && (
        <Sheet title="Log Fee Payment" onClose={() => setShowFeeSheet(false)}>
          <Input label="Amount (KES)" value={fAmount} onChange={setFAmount} placeholder="e.g. 15000" type="number" />
          <Input label="Term" value={fTerm} onChange={setFTerm} placeholder="e.g. Term 1" />
          <Input label="Year" value={fYear} onChange={setFYear} type="number" />
          <Input label="Payment Method" value={fMethod} onChange={setFMethod} placeholder="e.g. M-Pesa, Bank" />
          <Input label="Reference" value={fRef} onChange={setFRef} placeholder="Transaction reference" />
          <Input label="Date" value={fDate} onChange={setFDate} type="date" />
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: dark, marginBottom: 6 }}>Notes (optional)</div>
            <textarea value={fNotes} onChange={e => setFNotes(e.target.value)} rows={2}
              style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", resize: "none", color: dark }} />
          </div>
          <SaveBtn onClick={addFee} loading={saving} />
        </Sheet>
      )}

      {showPocketSheet && (
        <Sheet title="Log Pocket Money" onClose={() => setShowPocketSheet(false)}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: dark, marginBottom: 6 }}>Type</div>
            <div style={{ display: "flex", gap: 8 }}>
              {["allowance", "bonus", "spend"].map(t => (
                <button key={t} onClick={() => setPType(t)} style={{
                  flex: 1, padding: "8px 4px", borderRadius: 10, border: "1.5px solid",
                  borderColor: pType === t ? dark : "#e5e7eb",
                  background: pType === t ? dark : "#fff",
                  color: pType === t ? "#fff" : "#6b7280",
                  fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize",
                }}>{t}</button>
              ))}
            </div>
          </div>
          <Input label="Amount (KES)" value={pAmount} onChange={setPAmount} placeholder="e.g. 200" type="number" />
          <Input label="Description (optional)" value={pDesc} onChange={setPDesc} placeholder="What was it for?" />
          <Input label="Category (optional)" value={pCat} onChange={setPCat} placeholder="e.g. Food, Transport" />
          <Input label="Date" value={pDate} onChange={setPDate} type="date" />
          <SaveBtn onClick={addPocket} loading={saving} />
        </Sheet>
      )}

      {showGoalSheet && (
        <Sheet title="New Savings Goal" onClose={() => setShowGoalSheet(false)}>
          <Input label="Title" value={sTitle} onChange={setSTitle} placeholder="e.g. New bicycle" />
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: dark, marginBottom: 6 }}>Description (optional)</div>
            <textarea value={sDesc} onChange={e => setSDesc(e.target.value)} rows={2} placeholder="What are we saving for?"
              style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", resize: "none", color: dark }} />
          </div>
          <Input label="Target Amount (KES)" value={sTarget} onChange={setSTarget} placeholder="e.g. 5000" type="number" />
          <Input label="Target Date (optional)" value={sDate} onChange={setSDate} type="date" />
          <SaveBtn onClick={addGoal} loading={saving} />
        </Sheet>
      )}

      {showContribSheet && (
        <Sheet title="Add Contribution" onClose={() => setShowContribSheet(false)}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: dark, marginBottom: 6 }}>Select Goal</div>
            <select value={cGoalId} onChange={e => setCGoalId(e.target.value)}
              style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 14, fontFamily: "inherit", outline: "none", color: dark, background: "#fff" }}>
              <option value="">Choose a goal…</option>
              {goals.filter(g => g.status === "active").map(g => (
                <option key={g.id} value={g.id}>{g.title} (KES {g.saved_amount}/{g.target_amount})</option>
              ))}
            </select>
          </div>
          <Input label="Amount (KES)" value={cAmount} onChange={setCAmount} placeholder="e.g. 500" type="number" />
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: dark, marginBottom: 6 }}>Notes (optional)</div>
            <textarea value={cNotes} onChange={e => setCNotes(e.target.value)} rows={2}
              style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", resize: "none", color: dark }} />
          </div>
          <SaveBtn onClick={addContribution} loading={saving} />
        </Sheet>
      )}

      {toast && <Toast msg={toast} />}
    </div>
  );
}
