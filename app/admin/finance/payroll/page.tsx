'use client'
"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const dark    = "#0a1628"
const accent  = "#10b981"
const amber   = "#f59e0b"
const red     = "#ef4444"
const violet  = "#8b5cf6"
const blue    = "#3b82f6"
const surface = "rgba(255,255,255,0.03)"
const card    = "rgba(255,255,255,0.05)"
const border  = "#e2e8f0"
const muted   = "rgba(255,255,255,0.4)"
const white   = "#ffffff"

const fmt  = (n: number) => `KES ${Number(n).toLocaleString("en-KE", { minimumFractionDigits: 0 })}`
const fmtK = (n: number) => n >= 1000000 ? `KES ${(n/1000000).toFixed(1)}M` : n >= 1000 ? `KES ${(n/1000).toFixed(0)}K` : fmt(n)

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "10px", color: "#111827", fontSize: "14px", outline: "none",
  boxSizing: "border-box",
}
const labelStyle: React.CSSProperties = {
  fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "6px",
  display: "block", fontWeight: "600", letterSpacing: "0.5px", textTransform: "uppercase",
}

function Skeleton({ h = 48 }: { h?: number }) {
  return (
    <div style={{
      height: h, borderRadius: 12,
      background: "linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.09) 50%,rgba(255,255,255,0.04) 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
    }} />
  )
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    draft:    ["#f8fafc", "rgba(255,255,255,0.4)"],
    approved: ["rgba(16,185,129,0.15)",  "#10b981"],
    paid:     ["rgba(59,130,246,0.15)",  "#3b82f6"],
  }
  const [bg, color] = map[status] ?? ["#f8fafc", "rgba(255,255,255,0.4)"]
  return (
    <span style={{ background: bg, color, fontSize: "11px", fontWeight: "700",
      padding: "3px 12px", borderRadius: "20px", whiteSpace: "nowrap", letterSpacing: "0.3px" }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
  <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:100,
    display:"flex", alignItems:"flex-end", justifyContent:"center", backdropFilter:"blur(6px)" }}>
    <div style={{ background:"#0a1628", border:"1px solid rgba(255,255,255,0.08)",
      borderRadius:"24px 24px 0 0", padding:"24px 20px 40px", width:"100%",
      maxWidth:"540px", maxHeight:"92vh", overflowY:"auto", animation:"slideUp 0.3s ease" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px" }}>
        <h2 style={{ fontSize:"18px", fontWeight:"800", margin:0, color: "#111827" }}>{title}</h2>
        <button onClick={onClose} style={{ background:"#e2e8f0", border:"none",
          color:"#fff", width:"32px", height:"32px", borderRadius:"50%", cursor:"pointer",
          fontSize:"16px", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
      </div>
      {children}
    </div>
  </div>
)

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
]

interface PayrollRun {
  id: string
  school_id: string
  month: number
  year: number
  status: string
  total: number
  approved_by: string | null
  paid_at: string | null
  created_by: string | null
  created_at: string
}

interface PayrollLine {
  id: string
  run_id: string
  staff_id: string
  gross: number
  deductions: number
  net: number
  paid_via: string
  reference: string
  staff_name?: string
}

interface StaffProfile {
  id: string
  full_name: string
  role: string
}

export default function PayrollPage() {
  const router = useRouter()

  const [schoolId, setSchoolId]         = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading]           = useState(true)
  const [runs, setRuns]                 = useState<PayrollRun[]>([])
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)
  const [linesMap, setLinesMap]         = useState<Record<string, PayrollLine[]>>({})
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([])
  const [toast, setToast]               = useState({ msg: "", type: "success" })

  // New run modal
  const [showRunModal, setShowRunModal] = useState(false)
  const [runForm, setRunForm]           = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() })
  const [savingRun, setSavingRun]       = useState(false)

  // Add line modal
  const [lineRunId, setLineRunId]       = useState<string | null>(null)
  const [lineForm, setLineForm]         = useState({ staff_id: "", gross: "", deductions: "0", net: "", paid_via: "bank", reference: "" })
  const [savingLine, setSavingLine]     = useState(false)

  // Action loading
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: "", type: "success" }), 3500)
  }

  const loadRuns = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from("finance_payroll_runs")
      .select("*")
      .eq("school_id", sid)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
    setRuns(data ?? [])
  }, [])

  const loadStaff = useCallback(async (sid: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("school_id", sid)
      
    setStaffProfiles(data ?? [])
  }, [])

  const loadLines = useCallback(async (runId: string) => {
    const { data: lines } = await supabase
      .from("finance_payroll_lines")
      .select("*")
      .eq("run_id", runId)
      .order("created_at")

    if (!lines || lines.length === 0) {
      setLinesMap(prev => ({ ...prev, [runId]: [] }))
      return
    }

    const staffIds = Array.from(new Set(lines.map((l: PayrollLine) => l.staff_id).filter(Boolean)))
    let nameMap: Record<string, string> = {}
    if (staffIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", staffIds)
      for (const p of (profiles ?? []) as Array<{ id: string; full_name: string }>) {
        nameMap[p.id] = p.full_name
      }
    }

    const enriched: PayrollLine[] = lines.map((l: PayrollLine) => ({
      ...l,
      staff_name: nameMap[l.staff_id] ?? "Unknown",
    }))

    setLinesMap(prev => ({ ...prev, [runId]: enriched }))
  }, [])

  const init = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/admin/login"); return }
    setCurrentUserId(user.id)
    const { data: p } = await supabase.from("profiles").select("school_id").eq("id", user.id).single()
    if (!p?.school_id) { router.push("/admin/login"); return }
    setSchoolId(p.school_id)
    await Promise.all([loadRuns(p.school_id), loadStaff(p.school_id)])
    setLoading(false)
  }, [router, loadRuns, loadStaff])

  useEffect(() => { init() }, [init])

  const handleToggleRun = async (runId: string) => {
    if (expandedRunId === runId) {
      setExpandedRunId(null)
      return
    }
    setExpandedRunId(runId)
    if (!linesMap[runId]) await loadLines(runId)
  }

  const handleCreateRun = async () => {
    if (!schoolId || !currentUserId) return
    setSavingRun(true)
    try {
      const { error } = await supabase.from("finance_payroll_runs").insert({
        school_id: schoolId,
        month: runForm.month,
        year: runForm.year,
        status: "draft",
        total: 0,
        created_by: currentUserId,
      })
      if (error) throw error
      showToast("Payroll run created")
      setShowRunModal(false)
      await loadRuns(schoolId)
    } catch (e: any) {
      showToast(e?.message ?? "Failed to create run", "error")
    } finally {
      setSavingRun(false)
    }
  }

  const handleAddLine = async () => {
    if (!lineRunId || !schoolId) return
    const gross = parseFloat(lineForm.gross)
    const deductions = parseFloat(lineForm.deductions) || 0
    const net = gross - deductions
    if (!lineForm.staff_id) { showToast("Select a staff member", "error"); return }
    if (!gross || gross <= 0) { showToast("Enter a valid gross amount", "error"); return }

    setSavingLine(true)
    try {
      const { error: lineErr } = await supabase.from("finance_payroll_lines").insert({
        run_id: lineRunId,
        staff_id: lineForm.staff_id,
        gross,
        deductions,
        net,
        paid_via: lineForm.paid_via,
        reference: lineForm.reference || null,
      })
      if (lineErr) throw lineErr

      // Update run total
      const currentLines = linesMap[lineRunId] ?? []
      const newTotal = currentLines.reduce((s, l) => s + Number(l.net ?? 0), 0) + net
      await supabase.from("finance_payroll_runs")
        .update({ total: newTotal })
        .eq("id", lineRunId)

      showToast("Staff line added")
      setLineRunId(null)
      setLineForm({ staff_id: "", gross: "", deductions: "0", net: "", paid_via: "bank", reference: "" })
      await Promise.all([loadLines(lineRunId), loadRuns(schoolId)])
    } catch (e: any) {
      showToast(e?.message ?? "Failed to add line", "error")
    } finally {
      setSavingLine(false)
    }
  }

  const handleApprove = async (run: PayrollRun) => {
    if (!currentUserId) return
    setActionLoading(run.id + "_approve")
    try {
      const { error } = await supabase.from("finance_payroll_runs")
        .update({ status: "approved", approved_by: currentUserId })
        .eq("id", run.id)
      if (error) throw error
      showToast("Payroll run approved")
      if (schoolId) await loadRuns(schoolId)
    } catch (e: any) {
      showToast(e?.message ?? "Failed to approve", "error")
    } finally {
      setActionLoading(null)
    }
  }

  const handleMarkPaid = async (run: PayrollRun) => {
    setActionLoading(run.id + "_paid")
    try {
      const { error } = await supabase.from("finance_payroll_runs")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", run.id)
      if (error) throw error
      showToast("Payroll marked as paid")
      if (schoolId) await loadRuns(schoolId)
    } catch (e: any) {
      showToast(e?.message ?? "Failed to mark paid", "error")
    } finally {
      setActionLoading(null)
    }
  }

  const currentYear = new Date().getFullYear()
  const totalDraft    = runs.filter(r => r.status === "draft"    && r.year === currentYear).reduce((s, r) => s + Number(r.total ?? 0), 0)
  const totalApproved = runs.filter(r => r.status === "approved" && r.year === currentYear).reduce((s, r) => s + Number(r.total ?? 0), 0)
  const totalPaid     = runs.filter(r => r.status === "paid"     && r.year === currentYear).reduce((s, r) => s + Number(r.total ?? 0), 0)

  // Auto-calc net in line form
  const autoNet = (parseFloat(lineForm.gross) || 0) - (parseFloat(lineForm.deductions) || 0)

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", color: "#111827", fontFamily: "system-ui, sans-serif", padding: "20px 16px 60px" }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.5} }
        select option { background:#ffffff; color:#111827 }
        * { box-sizing:border-box }
      `}</style>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <button onClick={() => router.back()} style={{
          background:"none", border:"none", color: muted,
          fontSize:"13px", cursor:"pointer", display:"flex", alignItems:"center",
          gap:"6px", marginBottom:"20px", padding:0
        }}>← Back</button>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12, marginBottom:24 }}>
          <div>
            <h1 style={{ margin:"0 0 4px", fontSize:24, fontWeight:900 }}>Payroll</h1>
            <p style={{ margin:0, fontSize:14, color:muted }}>Manage staff payroll runs for {currentYear}</p>
          </div>
          <button
            onClick={() => setShowRunModal(true)}
            style={{ padding:"11px 22px", borderRadius:12, background:accent, color:dark,
              border:"none", fontSize:14, fontWeight:800, cursor:"pointer" }}
          >
            + New Payroll Run
          </button>
        </div>

        {/* Summary strip */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:24 }}>
          {[
            { label:`Draft ${currentYear}`,    value: fmtK(totalDraft),    color: muted   },
            { label:`Approved ${currentYear}`, value: fmtK(totalApproved), color: amber   },
            { label:`Paid ${currentYear}`,     value: fmtK(totalPaid),     color: accent  },
          ].map(s => (
            <div key={s.label} style={{ background:card, border:`1px solid ${border}`, borderRadius:14, padding:"16px" }}>
              <p style={{ margin:"0 0 4px", fontSize:11, color:muted, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.5px" }}>{s.label}</p>
              <p style={{ margin:0, fontSize:18, fontWeight:800, color:s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Runs list */}
        {loading ? (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <Skeleton h={80} /><Skeleton h={80} /><Skeleton h={80} />
          </div>
        ) : runs.length === 0 ? (
          <div style={{ background:card, border:`1px solid ${border}`, borderRadius:16, padding:40, textAlign:"center" }}>
            <p style={{ color:muted, fontSize:14, margin:0 }}>No payroll runs yet. Create your first one.</p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:12, animation:"fadeIn 0.3s ease" }}>
            {runs.map(run => {
              const isExpanded = expandedRunId === run.id
              const lines = linesMap[run.id] ?? []
              const approvingThis = actionLoading === run.id + "_approve"
              const payingThis    = actionLoading === run.id + "_paid"

              return (
                <div key={run.id} style={{ background:card, border:`1px solid ${border}`, borderRadius:16, overflow:"hidden" }}>
                  {/* Run header */}
                  <div
                    onClick={() => handleToggleRun(run.id)}
                    style={{ padding:"18px 20px", cursor:"pointer", display:"flex",
                      justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}
                  >
                    <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
                      <div>
                        <p style={{ margin:"0 0 4px", fontSize:16, fontWeight:800 }}>
                          {MONTHS[run.month - 1]} {run.year}
                        </p>
                        <p style={{ margin:0, fontSize:12, color:muted }}>
                          Created {new Date(run.created_at).toLocaleDateString("en-KE")}
                          {run.paid_at ? ` · Paid ${new Date(run.paid_at).toLocaleDateString("en-KE")}` : ""}
                        </p>
                      </div>
                      <StatusChip status={run.status} />
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <span style={{ fontSize:18, fontWeight:800, color: run.status==="paid" ? blue : run.status==="approved" ? accent : white }}>
                        {fmtK(run.total ?? 0)}
                      </span>
                      <span style={{ fontSize:18, color:muted }}>{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {/* Expanded accordion */}
                  {isExpanded && (
                    <div style={{ borderTop:`1px solid ${border}`, padding:"20px", animation:"fadeIn 0.2s ease" }}>

                      {/* Action buttons */}
                      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
                        {run.status === "draft" && (
                          <>
                            <button
                              onClick={() => { setLineRunId(run.id); setLineForm({ staff_id:"", gross:"", deductions:"0", net:"", paid_via:"bank", reference:"" }) }}
                              style={{ padding:"9px 18px", borderRadius:10,
                                background:"rgba(16,185,129,0.12)", color:accent,
                                border:`1px solid rgba(16,185,129,0.25)`,
                                fontSize:13, fontWeight:700, cursor:"pointer" }}
                            >+ Add Staff Line</button>
                            <button
                              onClick={() => handleApprove(run)}
                              disabled={approvingThis || lines.length === 0}
                              style={{ padding:"9px 18px", borderRadius:10,
                                background: approvingThis || lines.length===0 ? "#f8fafc" : "rgba(245,158,11,0.15)",
                                color: approvingThis || lines.length===0 ? muted : amber,
                                border:`1px solid ${approvingThis || lines.length===0 ? border : "rgba(245,158,11,0.3)"}`,
                                fontSize:13, fontWeight:700,
                                cursor: approvingThis || lines.length===0 ? "not-allowed" : "pointer" }}
                            >{approvingThis ? "Approving…" : "Approve Run"}</button>
                          </>
                        )}
                        {run.status === "approved" && (
                          <button
                            onClick={() => handleMarkPaid(run)}
                            disabled={payingThis}
                            style={{ padding:"9px 18px", borderRadius:10,
                              background: payingThis ? "#f8fafc" : "rgba(59,130,246,0.15)",
                              color: payingThis ? muted : blue,
                              border:`1px solid ${payingThis ? border : "rgba(59,130,246,0.3)"}`,
                              fontSize:13, fontWeight:700,
                              cursor: payingThis ? "not-allowed" : "pointer" }}
                          >{payingThis ? "Processing…" : "Mark as Paid"}</button>
                        )}
                      </div>

                      {/* Lines table */}
                      {lines.length === 0 ? (
                        <p style={{ color:muted, fontSize:13, margin:0 }}>No staff lines yet. Add one above.</p>
                      ) : (
                        <div style={{ overflowX:"auto" }}>
                          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                            <thead>
                              <tr>
                                {["Staff","Gross","Deductions","Net","Via","Reference"].map(h => (
                                  <th key={h} style={{
                                    textAlign: h==="Staff"||h==="Via"||h==="Reference" ? "left" : "right",
                                    fontSize:11, color:muted, fontWeight:600, textTransform:"uppercase",
                                    letterSpacing:"0.5px", paddingBottom:10, paddingRight:12
                                  }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {lines.map(line => (
                                <tr key={line.id} style={{ borderTop:`1px solid ${border}` }}>
                                  <td style={{ padding:"11px 12px 11px 0", color:white, fontWeight:600 }}>{line.staff_name ?? "—"}</td>
                                  <td style={{ padding:"11px 12px 11px 0", textAlign:"right", color:white }}>{fmt(line.gross)}</td>
                                  <td style={{ padding:"11px 12px 11px 0", textAlign:"right", color: line.deductions > 0 ? red : muted }}>{fmt(line.deductions)}</td>
                                  <td style={{ padding:"11px 12px 11px 0", textAlign:"right", color:accent, fontWeight:700 }}>{fmt(line.net)}</td>
                                  <td style={{ padding:"11px 12px 11px 0", color:muted, textTransform:"uppercase", fontSize:11 }}>{line.paid_via}</td>
                                  <td style={{ padding:"11px 0", color:muted, fontFamily:"monospace", fontSize:12 }}>{line.reference || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr style={{ borderTop:`2px solid ${border}` }}>
                                <td style={{ padding:"12px 12px 0 0", fontWeight:700, fontSize:13 }}>Total</td>
                                <td style={{ padding:"12px 12px 0 0", textAlign:"right", fontWeight:700 }}>{fmt(lines.reduce((s,l)=>s+Number(l.gross??0),0))}</td>
                                <td style={{ padding:"12px 12px 0 0", textAlign:"right", fontWeight:700, color:red }}>{fmt(lines.reduce((s,l)=>s+Number(l.deductions??0),0))}</td>
                                <td style={{ padding:"12px 12px 0 0", textAlign:"right", fontWeight:800, color:accent, fontSize:14 }}>{fmt(lines.reduce((s,l)=>s+Number(l.net??0),0))}</td>
                                <td colSpan={2} />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* New run modal */}
      {showRunModal && (
        <Modal title="New Payroll Run" onClose={() => setShowRunModal(false)}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div>
              <label style={labelStyle}>Month</label>
              <select
                value={runForm.month}
                onChange={e => setRunForm(f => ({ ...f, month: Number(e.target.value) }))}
                style={inputStyle}
              >
                {MONTHS.map((m, i) => (
                  <option key={i+1} value={i+1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Year</label>
              <input
                type="number"
                value={runForm.year}
                onChange={e => setRunForm(f => ({ ...f, year: Number(e.target.value) }))}
                style={inputStyle}
                min={2020}
                max={2099}
              />
            </div>
            <button
              onClick={handleCreateRun}
              disabled={savingRun}
              style={{
                width:"100%", padding:"14px", borderRadius:12,
                background: savingRun ? "rgba(16,185,129,0.4)" : accent,
                color:dark, border:"none", fontSize:15, fontWeight:800,
                cursor: savingRun ? "not-allowed" : "pointer", marginTop:4,
              }}
            >{savingRun ? "Creating…" : "Create Payroll Run"}</button>
          </div>
        </Modal>
      )}

      {/* Add staff line modal */}
      {lineRunId && (
        <Modal title="Add Staff Line" onClose={() => setLineRunId(null)}>
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div>
              <label style={labelStyle}>Staff Member</label>
              <select
                value={lineForm.staff_id}
                onChange={e => setLineForm(f => ({ ...f, staff_id: e.target.value }))}
                style={inputStyle}
              >
                <option value="">— Select staff —</option>
                {staffProfiles.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Gross Pay (KES)</label>
              <input
                type="number"
                value={lineForm.gross}
                onChange={e => setLineForm(f => ({ ...f, gross: e.target.value }))}
                style={inputStyle}
                placeholder="e.g. 45000"
                min={0}
              />
            </div>
            <div>
              <label style={labelStyle}>Deductions (KES)</label>
              <input
                type="number"
                value={lineForm.deductions}
                onChange={e => setLineForm(f => ({ ...f, deductions: e.target.value }))}
                style={inputStyle}
                placeholder="0"
                min={0}
              />
            </div>
            <div style={{ background:surface, border:`1px solid ${border}`, borderRadius:10, padding:"12px 14px",
              display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:13, color:muted, fontWeight:600 }}>Net Pay</span>
              <span style={{ fontSize:16, fontWeight:800, color:accent }}>{fmt(autoNet > 0 ? autoNet : 0)}</span>
            </div>
            <div>
              <label style={labelStyle}>Payment Method</label>
              <select
                value={lineForm.paid_via}
                onChange={e => setLineForm(f => ({ ...f, paid_via: e.target.value }))}
                style={inputStyle}
              >
                <option value="bank">🏦 Bank Transfer</option>
                <option value="mpesa">📱 M-Pesa</option>
                <option value="cash">💵 Cash</option>
                <option value="cheque">📝 Cheque</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Reference (optional)</label>
              <input
                type="text"
                value={lineForm.reference}
                onChange={e => setLineForm(f => ({ ...f, reference: e.target.value }))}
                style={inputStyle}
                placeholder="Transaction reference"
              />
            </div>
            <button
              onClick={handleAddLine}
              disabled={savingLine}
              style={{
                width:"100%", padding:"14px", borderRadius:12,
                background: savingLine ? "rgba(16,185,129,0.4)" : accent,
                color:dark, border:"none", fontSize:15, fontWeight:800,
                cursor: savingLine ? "not-allowed" : "pointer", marginTop:4,
              }}
            >{savingLine ? "Adding…" : "Add Staff Line"}</button>
          </div>
        </Modal>
      )}

      {toast.msg && (
        <div style={{
          position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)",
          background: toast.type==="error" ? "rgba(239,68,68,0.95)" : "rgba(16,185,129,0.95)",
          color:white, padding:"12px 24px", borderRadius:12, fontSize:14, fontWeight:600,
          zIndex:200, animation:"slideUp 0.3s ease", whiteSpace:"nowrap", maxWidth:"90vw",
          boxShadow:"0 8px 32px rgba(0,0,0,0.4)",
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
