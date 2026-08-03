"use client";
export const dynamic = "force-dynamic";


import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
const dark    = "#0a1628"
const accent  = "#10b981"
const amber   = "#f59e0b"
const red     = "#ef4444"
const border  = "#e2e8f0"
const muted   = "#6b7280"
const white   = "#ffffff"
const card    = "#ffffff"
const surface = "#f8fafc"
type Tab = "now" | "today" | "history"
interface Visitor {
  id:            string
  school_id:     string
  full_name:     string
  phone:         string | null
  id_number:     string | null
  purpose:       string | null
  visiting_whom: string | null
  time_in:       string
  time_out:      string | null
  flagged:       boolean
  flag_reason:   string | null
  recorded_by:   string | null
  created_at:    string
}
function Skeleton({ h = 48 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 12,
      background: "linear-gradient(90deg,#e5e7eb 25%,#d1d5db 50%,#e5e7eb 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
    }} />
  )
}
function duration(timeIn: string): { label: string; overstay: boolean } {
  const mins = Math.floor((Date.now() - new Date(timeIn).getTime()) / 60000)
  const h    = Math.floor(mins / 60)
  const m    = mins % 60
  const label = h > 0 ? `${h}h ${m}m` : `${m}m`
  return { label, overstay: mins > 120 }
}
function timeLabel(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })
}
function dateLabel(ts: string): string {
  return new Date(ts).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })
}
function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
  return (
    <div style={{
      width: 40, height: 40, borderRadius: "12px", flexShrink: 0,
      background: `linear-gradient(135deg, ${accent}33, ${accent}11)`,
      border: `1px solid ${accent}33`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "14px", fontWeight: "800", color: accent,
    }}>{initials}</div>
  )
}
export default function VisitorsPage() {
  const router = useRouter()
  const [tab,      setTab]      = useState<Tab>("now")
  const [schoolId, setSchoolId] = useState("")
  const [userId,   setUserId]   = useState("")
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [search,   setSearch]   = useState("")
  const [toast,    setToast]    = useState({ msg: "", type: "success" })
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [showModal, setShowModal] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [form, setForm] = useState({
    full_name: "", phone: "", id_number: "",
    purpose: "", visiting_whom: "",
  })
  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: "", type: "success" }), 3500)
  }
  const load = useCallback(async (sid: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("admin_visitors")
        .select("*")
        .eq("school_id", sid)
        .order("time_in", { ascending: false })
        .limit(300)
      if (error) throw error
      setVisitors(data ?? [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/admin/login"); return }
      const { data: p } = await supabase.from("profiles").select("school_id").eq("id", user.id).single()
      if (!p?.school_id) { router.push("/admin/login"); return }
      setSchoolId(p.school_id)
      setUserId(user.id)
      await load(p.school_id)
    }
    init()
  }, [router, load])
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])
  const today = new Date().toISOString().split("T")[0]
  const nowVisitors     = visitors.filter(v => !v.time_out)
  const todayVisitors   = visitors.filter(v => v.time_in.startsWith(today))
  const historyVisitors = visitors.filter(v => !v.time_in.startsWith(today))
  const filtered = (list: Visitor[]) =>
    !search ? list : list.filter(v =>
      v.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (v.visiting_whom ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (v.purpose ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (v.phone ?? "").includes(search)
    )
  async function handleSignOut(id: string) {
    try {
      const { error } = await supabase
        .from("admin_visitors")
        .update({ time_out: new Date().toISOString() })
        .eq("id", id)
      if (error) throw error
      showToast("Visitor signed out")
      await load(schoolId)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to sign out", "error")
    }
  }
  async function handleAddVisitor() {
    if (!schoolId || !userId) {
      showToast("School session is unavailable. Refresh and try again.", "error")
      return
    }

    const validSchoolId: string = schoolId
    const validUserId: string = userId

    if (!form.full_name.trim()) { showToast("Enter visitor name", "error"); return }
    if (!form.purpose.trim()) { showToast("Enter visit purpose", "error"); return }
    if (!form.visiting_whom.trim()) { showToast("Enter who they are visiting", "error"); return }
    setSaving(true)
    try {
      const { error } = await supabase.from("admin_visitors").insert({
        school_id:     validSchoolId,
        full_name:     form.full_name.trim(),
        phone:         form.phone.trim() || null,
        id_number:     form.id_number.trim() || null,
        purpose:       form.purpose.trim(),
        visiting_whom: form.visiting_whom.trim(),
        time_in:       new Date().toISOString(),
        recorded_by:   validUserId,
        flagged:       false,
      })
      if (error) throw error
      showToast("Visitor logged")
      setShowModal(false)
      setForm({ full_name: "", phone: "", id_number: "", purpose: "", visiting_whom: "" })
      await load(validSchoolId)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Failed to log visitor", "error")
    } finally { setSaving(false) }
  }
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px",
    background: "#f8fafc", border: "1px solid #e2e8f0",
    borderRadius: "10px", color: "#111827",
    fontSize: "14px", outline: "none", boxSizing: "border-box",
  }
  const labelStyle: React.CSSProperties = {
    fontSize: "11px", color: "#6b7280",
    marginBottom: "6px", display: "block",
    fontWeight: "600", letterSpacing: "0.5px", textTransform: "uppercase",
  }
  function NowCard({ v }: { v: Visitor }) {
    const { label, overstay } = duration(v.time_in)
    return (
      <div style={{
        padding: "16px", borderRadius: "16px",
        background: overstay ? "rgba(245,158,11,0.06)" : card,
        border: `1px solid ${overstay ? "rgba(245,158,11,0.2)" : border}`,
        marginBottom: "10px",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <Avatar name={v.full_name} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "#111827" }}>{v.full_name}</div>
              <span style={{
                fontSize: "11px", fontWeight: "700", padding: "3px 10px",
                borderRadius: "20px", whiteSpace: "nowrap", flexShrink: 0,
                background: overstay ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.12)",
                color: overstay ? amber : accent,
              }}>{label}</span>
            </div>
            <div style={{ fontSize: "12px", color: muted, marginTop: "2px" }}>
              Seeing: <span style={{ color: "#374151", fontWeight: "600" }}>{v.visiting_whom}</span>
            </div>
            {v.purpose && (
              <div style={{ fontSize: "11px", color: muted, marginTop: "2px" }}>{v.purpose}</div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px" }}>
              <span style={{ fontSize: "11px", color: muted }}>In at {timeLabel(v.time_in)}</span>
              <button
                onClick={() => handleSignOut(v.id)}
                style={{
                  padding: "7px 16px", borderRadius: "8px", border: "none",
                  background: `linear-gradient(135deg, ${accent}, #059669)`,
                  color: "#111827", fontSize: "12px", fontWeight: "700", cursor: "pointer",
                }}
              >Sign Out</button>
            </div>
          </div>
        </div>
      </div>
    )
  }
  function VisitorRow({ v }: { v: Visitor }) {
    const active = !v.time_out
    return (
      <div style={{
        padding: "14px 16px",
        borderBottom: "1px solid #e2e8f0",
        display: "flex", alignItems: "center", gap: "12px",
      }}>
        <Avatar name={v.full_name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>{v.full_name}</div>
          <div style={{ fontSize: "11px", color: muted, marginTop: "1px" }}>
            {v.visiting_whom} {v.purpose ? ` ${v.purpose}` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{
            fontSize: "11px", fontWeight: "700", padding: "3px 10px",
            borderRadius: "20px", marginBottom: "4px",
            background: active ? "rgba(16,185,129,0.12)" : "#f8fafc",
            color: active ? accent : muted,
          }}>{active ? "Active" : "Left"}</div>
          <div style={{ fontSize: "10px", color: muted }}>
            {timeLabel(v.time_in)}{v.time_out ? `  ${timeLabel(v.time_out)}` : ""}
          </div>
        </div>
      </div>
    )
  }
  function HistoryRow({ v }: { v: Visitor }) {
    return (
      <div style={{
        padding: "14px 16px",
        borderBottom: "1px solid #e2e8f0",
        display: "flex", alignItems: "center", gap: "12px",
      }}>
        <Avatar name={v.full_name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: "700", color: "#111827" }}>{v.full_name}</div>
          <div style={{ fontSize: "11px", color: muted, marginTop: "1px" }}>
            {v.visiting_whom}{v.purpose ? `  ${v.purpose}` : ""}
          </div>
          <div style={{ fontSize: "10px", color: muted, marginTop: "2px" }}>{dateLabel(v.time_in)}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "10px", color: muted }}>
            {timeLabel(v.time_in)}{v.time_out ? `  ${timeLabel(v.time_out)}` : "  active"}
          </div>
          {v.flagged && (
            <div style={{ fontSize: "10px", color: amber, marginTop: "3px" }}> Flagged</div>
          )}
        </div>
      </div>
    )
  }
  const tabList: { id: Tab; label: string; count?: number }[] = [
    { id: "now",     label: `Now${nowVisitors.length > 0 ? ` (${nowVisitors.length})` : ""}` },
    { id: "today",   label: `Today${todayVisitors.length > 0 ? ` (${todayVisitors.length})` : ""}` },
    { id: "history", label: "History" },
  ]
  return (
    <div style={{ color: "#111827", fontFamily: "'Inter', sans-serif", maxWidth: "900px" }}>
      <style>{`
        @keyframes shimmer { 0% { background-position:200% 0 } 100% { background-position:-200% 0 } }
        @keyframes slideUp { from { opacity:0;transform:translateY(20px) } to { opacity:1;transform:translateY(0) } }
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        input::placeholder { color: #9ca3af }
        select option { background:#0a1628;color:#fff }
      `}</style>
      {toast.msg && (
        <div style={{
          position: "fixed", bottom: "88px", right: "16px", zIndex: 300,
          background: toast.type === "error" ? red : accent,
          color: "#111827", padding: "14px 22px", borderRadius: "14px",
          fontSize: "13px", fontWeight: "700", animation: "slideUp 0.3s ease",
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)", maxWidth: "320px",
          display: "flex", alignItems: "center", gap: "10px",
        }}>
          <span>{toast.type === "error" ? "!" : ""}</span>{toast.msg}
        </div>
      )}
      {/* Header */}
      <div style={{ marginBottom: "24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "14px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "800", margin: 0, letterSpacing: "-0.5px" }}>Visitors</h1>
          <p style={{ fontSize: "12px", color: muted, margin: "4px 0 0" }}>
            {nowVisitors.length} on campus  {todayVisitors.length} today
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: "10px 18px", borderRadius: "10px", border: "none",
            background: `linear-gradient(135deg, ${accent}, #059669)`,
            color: "#111827", fontSize: "13px", fontWeight: "700", cursor: "pointer",
            boxShadow: "0 4px 16px rgba(16,185,129,0.25)",
          }}
        >+ New Visitor</button>
      </div>
      {/* Tabs */}
      <div style={{
        display: "flex", gap: "2px", marginBottom: "20px",
        background: "#ffffff", padding: "4px",
        borderRadius: "14px", border: "1px solid #e2e8f0",
      }}>
        {tabList.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSearch("") }} style={{
            flex: 1, padding: "10px 8px", borderRadius: "10px", border: "none",
            background: tab === t.id ? "rgba(16,185,129,0.15)" : "transparent",
            color: tab === t.id ? accent : "#6b7280",
            fontSize: "12px", fontWeight: tab === t.id ? "700" : "500",
            cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s ease",
          }}>{t.label}</button>
        ))}
      </div>
      {/* NOW TAB */}
      {tab === "now" && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[1,2,3].map(i => <Skeleton key={i} h={100} />)}
            </div>
          ) : nowVisitors.length === 0 ? (
            <div style={{ textAlign: "center", padding: "64px 20px" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}></div>
              <p style={{ fontSize: "14px", color: muted, fontWeight: "600" }}>No visitors on campus</p>
              <button onClick={() => setShowModal(true)} style={{
                marginTop: "16px", padding: "10px 20px", borderRadius: "10px",
                border: "none", background: accent, color: "#111827",
                fontSize: "13px", fontWeight: "700", cursor: "pointer",
              }}>Log a visitor</button>
            </div>
          ) : (
            nowVisitors.map(v => <NowCard key={v.id} v={v} />)
          )}
        </div>
      )}
      {/* TODAY TAB */}
      {tab === "today" && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          <div style={{ marginBottom: "14px", display: "flex", gap: "10px" }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, purpose, host..."
              style={inputStyle}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: muted, cursor: "pointer", fontSize: "18px" }}></button>
            )}
          </div>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {[1,2,3,4].map(i => <Skeleton key={i} h={60} />)}
              </div>
            ) : filtered(todayVisitors).length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px" }}>
                <div style={{ fontSize: "32px", marginBottom: "10px" }}></div>
                <p style={{ fontSize: "13px", color: muted, fontWeight: "600" }}>No visitors today</p>
              </div>
            ) : (
              filtered(todayVisitors).map(v => <VisitorRow key={v.id} v={v} />)
            )}
          </div>
        </div>
      )}
      {/* HISTORY TAB */}
      {tab === "history" && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          <div style={{ marginBottom: "14px", display: "flex", gap: "10px" }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, purpose, host..."
              style={inputStyle}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: muted, cursor: "pointer", fontSize: "18px" }}></button>
            )}
          </div>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", overflow: "hidden" }}>
            {loading ? (
              <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {[1,2,3,4,5].map(i => <Skeleton key={i} h={60} />)}
              </div>
            ) : filtered(historyVisitors).length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px" }}>
                <div style={{ fontSize: "32px", marginBottom: "10px" }}></div>
                <p style={{ fontSize: "13px", color: muted, fontWeight: "600" }}>No history yet</p>
              </div>
            ) : (
              filtered(historyVisitors).map(v => <HistoryRow key={v.id} v={v} />)
            )}
          </div>
        </div>
      )}
      {/* NEW VISITOR MODAL */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
          zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center",
          backdropFilter: "blur(6px)",
        }}>
          <div style={{
            background: "#ffffff", border: "1px solid #e2e8f0",
            borderRadius: "24px 24px 0 0", padding: "24px 20px 48px",
            width: "100%", maxWidth: "540px", maxHeight: "92vh",
            overflowY: "auto", animation: "slideUp 0.3s ease",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "800", margin: 0, color: "#111827" }}>Log Visitor</h2>
              <button onClick={() => setShowModal(false)} style={{
                background: "#f8fafc", border: "1px solid #e2e8f0", color: "#111827",
                width: "32px", height: "32px", borderRadius: "50%", cursor: "pointer",
                fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center",
              }}></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={labelStyle}>Full Name *</label>
                <input
                  type="text" value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="e.g. Jane Wanjiku" style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Visiting *</label>
                <input
                  type="text" value={form.visiting_whom}
                  onChange={e => setForm(f => ({ ...f, visiting_whom: e.target.value }))}
                  placeholder="e.g. Mr. Kamau / Principal" style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Purpose</label>
                <input
                  type="text" value={form.purpose}
                  onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                  placeholder="e.g. Parent meeting, Delivery" style={inputStyle}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input
                    type="tel" value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="07XX XXX XXX" style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>ID Number</label>
                  <input
                    type="text" value={form.id_number}
                    onChange={e => setForm(f => ({ ...f, id_number: e.target.value }))}
                    placeholder="Optional" style={inputStyle}
                  />
                </div>
              </div>
              <button
                onClick={handleAddVisitor}
                disabled={saving}
                style={{
                  width: "100%", padding: "15px", borderRadius: "12px", border: "none",
                  background: saving ? "rgba(16,185,129,0.3)" : `linear-gradient(135deg, ${accent}, #059669)`,
                  color: "#111827", fontSize: "15px", fontWeight: "800",
                  cursor: saving ? "not-allowed" : "pointer", marginTop: "4px",
                }}
              >{saving ? "Logging..." : "Log Visitor"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
