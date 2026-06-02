'use client'

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const accent  = "#10b981"
const amber   = "#f59e0b"
const red     = "#ef4444"
const surface = "rgba(255,255,255,0.03)"
const card    = "rgba(255,255,255,0.05)"
const border  = "#334155"
const muted   = "rgba(255,255,255,0.4)"
const white   = "#1e293b"

const fmt = (n: number) => `KES ${Number(n).toLocaleString("en-KE", { minimumFractionDigits: 0 })}`

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px",
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "10px", color: "#f1f5f9", fontSize: "14px", outline: "none",
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

interface ClassRow { id: string; name: string; stream: string; subject: string }
interface StudentRow { id: string; name: string; admission_number: string | null; class_id: string }
interface FeeStructure { id: string; class_id: string; label: string; amount: number }
interface ExistingInvoice { student_id: string }
interface PreviewRow {
  student: StudentRow; className: string; feeLines: FeeStructure[]
  total: number; alreadyInvoiced: boolean; included: boolean
}
interface GenerateResult { success: number; skipped: { name: string; reason: string }[] }
type Step = 1 | 2 | 3

export default function GenerateInvoicesPage() {
  const router = useRouter()
  const [step, setStep]               = useState<Step>(1)
  const [schoolId, setSchoolId]       = useState("")
  const [userId, setUserId]           = useState("")
  const [loading, setLoading]         = useState(true)
  const [generating, setGenerating]   = useState(false)
  const [previewing, setPreviewing]   = useState(false)
  const [toast, setToast]             = useState({ msg: "", type: "success" })
  const [classes, setClasses]         = useState<ClassRow[]>([])
  const [term, setTerm]               = useState("Term 1")
  const [year, setYear]               = useState(new Date().getFullYear())
  const [selectedClasses, setSelectedClasses] = useState<string[]>([])
  const [dueDate, setDueDate]         = useState("")
  const [notes, setNotes]             = useState("")
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [includeExisting, setIncludeExisting] = useState(false)
  const [result, setResult]           = useState<GenerateResult | null>(null)

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: "", type: "success" }), 3500)
  }

  const loadClasses = useCallback(async (sid: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("classes").select("id,name,stream,subject")
        .eq("school_id", sid).order("name")
      if (error) throw error
      setClasses(data ?? [])
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to load classes", "error")
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/admin/login"); return }
      const { data: p } = await supabase.from("profiles").select("school_id").eq("id", user.id).single()
      if (!p?.school_id) { router.push("/admin/login"); return }
      setSchoolId(p.school_id)
      setUserId(user.id)
      await loadClasses(p.school_id)
    }
    init()
  }, [router, loadClasses])

  function toggleClass(id: string) {
    setSelectedClasses(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  async function handlePreview() {
    if (!term || !year || selectedClasses.length === 0) {
      showToast("Select term, year and at least one class", "error"); return
    }
    setPreviewing(true)
    try {
      const { data: studs, error: studsErr } = await supabase
        .from("students").select("id,name,admission_number,class_id")
        .in("class_id", selectedClasses).is("deleted_at", null).order("name")
      if (studsErr) throw studsErr
      const students: StudentRow[] = studs ?? []

      const { data: fees, error: feesErr } = await supabase
        .from("finance_fee_structures").select("id,class_id,label,amount")
        .eq("school_id", schoolId).eq("term", term).eq("year", year)
        .in("class_id", selectedClasses).is("deleted_at", null)
      if (feesErr) throw feesErr
      const feeStructures: FeeStructure[] = fees ?? []

      const studentIds = students.map(s => s.id)
      let existingInvoices: ExistingInvoice[] = []
      if (studentIds.length > 0) {
        const { data: existing } = await supabase
          .from("finance_invoices").select("student_id")
          .eq("school_id", schoolId).eq("term", term).eq("year", year)
          .in("student_id", studentIds).is("deleted_at", null)
        existingInvoices = existing ?? []
      }
      const existingSet = new Set(existingInvoices.map(e => e.student_id))
      const classMap: Record<string, string> = {}
      classes.forEach(c => { classMap[c.id] = c.stream ? `${c.name} ${c.stream}` : c.name })

      const rows: PreviewRow[] = students.map(student => {
        const studentFees = feeStructures.filter(f => f.class_id === student.class_id)
        const total = studentFees.reduce((s, f) => s + Number(f.amount), 0)
        const alreadyInvoiced = existingSet.has(student.id)
        return { student, className: classMap[student.class_id] ?? "Unknown",
          feeLines: studentFees, total, alreadyInvoiced, included: !alreadyInvoiced }
      })
      setPreviewRows(rows)
      setStep(2)
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Preview failed", "error")
    } finally { setPreviewing(false) }
  }

  const effectiveRows = previewRows.map(r => ({
    ...r, included: r.alreadyInvoiced ? includeExisting : true,
  }))
  const toGenerate   = effectiveRows.filter(r => r.included)
  const totalAmount  = toGenerate.reduce((s, r) => s + r.total, 0)
  const alreadyCount = previewRows.filter(r => r.alreadyInvoiced).length

  async function handleGenerate() {
    if (toGenerate.length === 0) { showToast("No invoices to generate", "error"); return }
    setGenerating(true)
    try {
      const { data: period } = await supabase
        .from("finance_periods").select("status")
        .eq("school_id", schoolId).eq("term", term).eq("year", year).single()
      if (period?.status === "locked" || period?.status === "closed") {
        showToast(`${term} ${year} is ${period.status} — cannot generate invoices`, "error")
        setGenerating(false); return
      }
      let successCount = 0
      const skipped: { name: string; reason: string }[] = []
      for (const row of toGenerate) {
        if (row.feeLines.length === 0) {
          skipped.push({ name: row.student.name, reason: "No fee structure for this class/term" }); continue
        }
        const totalAmt = row.feeLines.reduce((s, f) => s + Number(f.amount), 0)
        const { data: inv, error: invErr } = await supabase
          .from("finance_invoices")
          .insert({
            school_id: schoolId, student_id: row.student.id, class_id: row.student.class_id,
            term, year, due_date: dueDate || null, status: "issued",
            total_amount: totalAmt, paid_amount: 0, notes: notes || null, created_by: userId,
          }).select("id").single()
        if (invErr || !inv) {
          skipped.push({ name: row.student.name, reason: invErr?.message ?? "Insert failed" }); continue
        }
        const lines = row.feeLines.map(f => ({
          invoice_id: inv.id, description: f.label, amount: f.amount,
        }))
        const { error: linesErr } = await supabase.from("finance_invoice_lines").insert(lines)
        if (linesErr) {
          skipped.push({ name: row.student.name, reason: `Lines failed: ${linesErr.message}` }); continue
        }
        successCount++
      }
      setResult({ success: successCount, skipped })
      setStep(3)
      if (successCount > 0) showToast(`${successCount} invoice${successCount > 1 ? "s" : ""} generated`)
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Generation failed", "error")
    } finally { setGenerating(false) }
  }

  function resetToStep1() {
    setStep(1); setPreviewRows([]); setResult(null)
    setIncludeExisting(false); setSelectedClasses([]); setDueDate(""); setNotes("")
  }

  const stepLabels = ["Configure", "Preview", "Done"]

  return (
    <div style={{ color: "#f1f5f9", fontFamily: "'Inter', sans-serif", maxWidth: "900px", background: "#0f172a", minHeight: "100vh", padding: "20px 16px 60px" }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        select option { background:#1e293b; color:#f1f5f9 }
        input[type=date]::-webkit-calendar-picker-indicator { filter:invert(1) opacity(0.4) }
        .cls-card:hover { border-color:rgba(16,185,129,0.4) !important; }
        .gen-row:hover { background:rgba(255,255,255,0.04) !important; }
      `}</style>

      {toast.msg && (
        <div style={{
          position:"fixed", bottom:"28px", right:"20px", zIndex:300,
          background: toast.type === "error" ? red : accent,
          color:white, padding:"14px 22px", borderRadius:"14px",
          fontSize:"13px", fontWeight:"700", animation:"slideUp 0.3s ease",
          boxShadow:"0 12px 40px rgba(0,0,0,0.5)", maxWidth:"320px",
          display:"flex", alignItems:"center", gap:"10px",
        }}>
          <span>{toast.type === "error" ? "⚠" : "✓"}</span>{toast.msg}
        </div>
      )}

      <button onClick={() => router.back()} style={{
        background:"none", border:"none", color:muted, fontSize:"13px",
        cursor:"pointer", display:"flex", alignItems:"center", gap:"6px", marginBottom:"20px", padding:0,
      }}>← Back</button>

      <div style={{ marginBottom:"28px" }}>
        <h1 style={{ fontSize:"26px", fontWeight:"800", margin:"0 0 6px", letterSpacing:"-0.5px" }}>Generate Invoices</h1>
        <p style={{ fontSize:"13px", color:muted, margin:0 }}>Bulk invoice generation by class and term</p>
      </div>

      {/* Step indicator */}
      <div style={{ display:"flex", alignItems:"center", marginBottom:"28px" }}>
        {stepLabels.map((label, i) => {
          const s = (i + 1) as Step
          const active = step === s
          const done   = step > s
          return (
            <div key={label} style={{ display:"flex", alignItems:"center", flex: i < 2 ? 1 : "none" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                <div style={{
                  width:"28px", height:"28px", borderRadius:"50%", flexShrink:0,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:"12px", fontWeight:"800",
                  background: done ? accent : active ? "rgba(16,185,129,0.2)" : "#1e293b",
                  color: done ? white : active ? accent : muted,
                  border: active ? `2px solid ${accent}` : "2px solid transparent",
                  transition:"all 0.3s ease",
                }}>{done ? "✓" : s}</div>
                <span style={{ fontSize:"12px", fontWeight: active ? "700" : "400",
                  color: active ? white : done ? accent : muted, whiteSpace:"nowrap" }}>
                  {label}
                </span>
              </div>
              {i < 2 && <div style={{
                flex:1, height:"2px", margin:"0 12px",
                background: done ? accent : "#334155", transition:"background 0.3s ease",
              }} />}
            </div>
          )
        })}
      </div>

      {/* STEP 1 */}
      {step === 1 && (
        <div style={{ animation:"fadeIn 0.3s ease", display:"flex", flexDirection:"column", gap:"20px" }}>
          <div style={{ background:card, border:`1px solid ${border}`, borderRadius:"16px", padding:"24px" }}>
            <div style={{ fontSize:"14px", fontWeight:"700", marginBottom:"20px" }}>📋 Invoice Configuration</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px", marginBottom:"16px" }}>
              <div>
                <label style={labelStyle}>Term *</label>
                <select value={term} onChange={e => setTerm(e.target.value)} style={{ ...inputStyle, appearance:"none" }}>
                  <option>Term 1</option><option>Term 2</option><option>Term 3</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Year *</label>
                <input type="number" value={year} onChange={e => setYear(Number(e.target.value))}
                  style={inputStyle} min={2020} max={2099} />
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px", marginBottom:"24px" }}>
              <div>
                <label style={labelStyle}>Due Date</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Optional" style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Classes * — select one or more</label>
              {loading ? (
                <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                  {[1,2,3].map(i => <Skeleton key={i} h={52} />)}
                </div>
              ) : classes.length === 0 ? (
                <p style={{ fontSize:"13px", color:muted, padding:"20px 0" }}>No classes found.</p>
              ) : (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))", gap:"8px" }}>
                  {classes.map(cls => {
                    const selected = selectedClasses.includes(cls.id)
                    return (
                      <div key={cls.id} className="cls-card" onClick={() => toggleClass(cls.id)} style={{
                        padding:"12px 14px", borderRadius:"12px", cursor:"pointer",
                        background: selected ? "rgba(16,185,129,0.1)" : surface,
                        border:`1px solid ${selected ? "rgba(16,185,129,0.4)" : border}`,
                        display:"flex", alignItems:"center", gap:"10px", transition:"all 0.15s ease",
                      }}>
                        <div style={{
                          width:"18px", height:"18px", borderRadius:"5px", flexShrink:0,
                          border:`2px solid ${selected ? accent : "#334155"}`,
                          background: selected ? accent : "transparent",
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:"11px", color:white, transition:"all 0.15s ease",
                        }}>{selected ? "✓" : ""}</div>
                        <div>
                          <div style={{ fontSize:"13px", fontWeight:"600" }}>
                            {cls.name}{cls.stream ? ` ${cls.stream}` : ""}
                          </div>
                          {cls.subject && <div style={{ fontSize:"11px", color:muted }}>{cls.subject}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {selectedClasses.length > 0 && (
                <div style={{ marginTop:"10px", fontSize:"12px", color:accent, fontWeight:"600" }}>
                  {selectedClasses.length} class{selectedClasses.length > 1 ? "es" : ""} selected
                </div>
              )}
            </div>
          </div>
          <button onClick={handlePreview} disabled={previewing || loading} style={{
            width:"100%", padding:"16px", borderRadius:"12px", border:"none",
            background: previewing ? "rgba(16,185,129,0.3)" : `linear-gradient(135deg,${accent},#059669)`,
            color:white, fontSize:"15px", fontWeight:"800",
            cursor: previewing ? "not-allowed" : "pointer",
            boxShadow: previewing ? "none" : "0 4px 16px rgba(16,185,129,0.3)",
          }}>{previewing ? "Loading preview..." : "Preview Invoices →"}</button>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div style={{ animation:"fadeIn 0.3s ease", display:"flex", flexDirection:"column", gap:"16px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:"10px" }}>
            {[
              { label:"To Generate",     value:`${toGenerate.length}`,  icon:"📄", color:accent },
              { label:"Total Amount",    value:fmt(totalAmount),         icon:"💰", color:accent },
              { label:"Already Invoiced",value:`${alreadyCount}`,       icon:"⚠️", color:amber  },
              { label:"No Fee Structure",value:`${toGenerate.filter(r => r.feeLines.length === 0).length}`, icon:"❌", color:red },
            ].map(kpi => (
              <div key={kpi.label} style={{ background:card, border:`1px solid ${border}`, borderRadius:"14px", padding:"16px 14px" }}>
                <div style={{ fontSize:"20px", marginBottom:"8px" }}>{kpi.icon}</div>
                <div style={{ fontSize:"10px", color:muted, fontWeight:"600", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"4px" }}>{kpi.label}</div>
                <div style={{ fontSize:"16px", fontWeight:"800", color:kpi.color }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {alreadyCount > 0 && (
            <div style={{
              background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.2)",
              borderRadius:"12px", padding:"14px 16px", display:"flex", alignItems:"center", gap:"12px",
            }}>
              <input type="checkbox" id="include-existing" checked={includeExisting}
                onChange={e => setIncludeExisting(e.target.checked)}
                style={{ width:"16px", height:"16px", cursor:"pointer" }} />
              <label htmlFor="include-existing" style={{ fontSize:"13px", color:amber, cursor:"pointer", fontWeight:"600" }}>
                Re-invoice {alreadyCount} already-invoiced student{alreadyCount > 1 ? "s" : ""} (use for corrections)
              </label>
            </div>
          )}

          <div style={{ background:card, border:`1px solid ${border}`, borderRadius:"16px", overflow:"hidden" }}>
            <div style={{ padding:"16px 18px", borderBottom:`1px solid ${border}`, fontSize:"13px", fontWeight:"700" }}>
              {term} {year} — Invoice Preview
            </div>
            <div style={{
              display:"grid", gridTemplateColumns:"1fr 110px 1fr 100px 76px",
              padding:"10px 18px", borderBottom:`1px solid ${border}`,
              fontSize:"10px", color:muted, fontWeight:"700", textTransform:"uppercase", letterSpacing:"0.5px",
            }}>
              <span>Student</span><span>Class</span><span>Fee Lines</span>
              <span style={{ textAlign:"right" }}>Total</span><span style={{ textAlign:"center" }}>Status</span>
            </div>
            {effectiveRows.length === 0 ? (
              <div style={{ textAlign:"center", padding:"40px 20px" }}>
                <div style={{ fontSize:"32px", marginBottom:"10px" }}>🔍</div>
                <p style={{ color:muted, fontSize:"13px" }}>No students found for selected classes</p>
              </div>
            ) : effectiveRows.map((row, idx) => (
              <div key={row.student.id} className="gen-row" style={{
                display:"grid", gridTemplateColumns:"1fr 110px 1fr 100px 76px",
                padding:"13px 18px", alignItems:"center",
                borderBottom: idx < effectiveRows.length - 1 ? `1px solid ${border}` : "none",
                opacity: !row.included ? 0.4 : 1, transition:"opacity 0.2s ease",
              }}>
                <div>
                  <div style={{ fontSize:"13px", fontWeight:"600" }}>{row.student.name}</div>
                  {row.student.admission_number && <div style={{ fontSize:"11px", color:muted }}>{row.student.admission_number}</div>}
                </div>
                <div style={{ fontSize:"12px", color:muted }}>{row.className}</div>
                <div style={{ fontSize:"11px", color:muted }}>
                  {row.feeLines.length === 0
                    ? <span style={{ color:red }}>No fee structure</span>
                    : row.feeLines.map(f => f.label).join(", ")}
                </div>
                <div style={{ textAlign:"right", fontSize:"13px", fontWeight:"700", color: row.feeLines.length === 0 ? red : white }}>
                  {row.feeLines.length === 0 ? "—" : fmt(row.total)}
                </div>
                <div style={{ textAlign:"center" }}>
                  {row.alreadyInvoiced
                    ? <span style={{ background:"rgba(245,158,11,0.15)", color:amber, fontSize:"10px", fontWeight:"700", padding:"3px 10px", borderRadius:"20px" }}>Exists</span>
                    : <span style={{ background:"rgba(16,185,129,0.15)", color:accent, fontSize:"10px", fontWeight:"700", padding:"3px 10px", borderRadius:"20px" }}>New</span>}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display:"flex", gap:"12px" }}>
            <button onClick={() => setStep(1)} style={{
              flex:1, padding:"14px", borderRadius:"12px",
              border:`1px solid ${border}`, background:surface,
              color:muted, fontSize:"14px", fontWeight:"700", cursor:"pointer",
            }}>← Back</button>
            <button onClick={handleGenerate} disabled={generating || toGenerate.length === 0} style={{
              flex:2, padding:"14px", borderRadius:"12px", border:"none",
              background: generating || toGenerate.length === 0 ? "rgba(16,185,129,0.3)" : `linear-gradient(135deg,${accent},#059669)`,
              color:white, fontSize:"14px", fontWeight:"800",
              cursor: generating || toGenerate.length === 0 ? "not-allowed" : "pointer",
              boxShadow: generating || toGenerate.length === 0 ? "none" : "0 4px 16px rgba(16,185,129,0.3)",
            }}>{generating ? "Generating..." : `Generate ${toGenerate.length} Invoice${toGenerate.length !== 1 ? "s" : ""}`}</button>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && result && (
        <div style={{ animation:"fadeIn 0.3s ease", display:"flex", flexDirection:"column", gap:"16px" }}>
          <div style={{
            background: result.success > 0 ? "rgba(16,185,129,0.08)" : "rgba(245,158,11,0.08)",
            border:`1px solid ${result.success > 0 ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)"}`,
            borderRadius:"20px", padding:"32px 24px", textAlign:"center",
          }}>
            <div style={{ fontSize:"48px", marginBottom:"16px" }}>{result.success > 0 ? "✅" : "⚠️"}</div>
            <div style={{ fontSize:"24px", fontWeight:"800", marginBottom:"8px" }}>
              {result.success} Invoice{result.success !== 1 ? "s" : ""} Generated
            </div>
            <div style={{ fontSize:"13px", color:muted }}>
              {term} {year}{result.skipped.length > 0 ? ` · ${result.skipped.length} skipped` : ""}
            </div>
          </div>

          {result.skipped.length > 0 && (
            <div style={{ background:card, border:`1px solid ${border}`, borderRadius:"16px", overflow:"hidden" }}>
              <div style={{ padding:"14px 18px", borderBottom:`1px solid ${border}`, fontSize:"13px", fontWeight:"700", color:amber }}>
                ⚠️ Skipped ({result.skipped.length})
              </div>
              {result.skipped.map((s, i) => (
                <div key={i} style={{
                  padding:"12px 18px", display:"flex", justifyContent:"space-between", alignItems:"center",
                  borderBottom: i < result.skipped.length - 1 ? `1px solid ${border}` : "none",
                }}>
                  <span style={{ fontSize:"13px", fontWeight:"600" }}>{s.name}</span>
                  <span style={{ fontSize:"12px", color:red }}>{s.reason}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display:"flex", gap:"12px" }}>
            <button onClick={resetToStep1} style={{
              flex:1, padding:"14px", borderRadius:"12px",
              border:`1px solid ${border}`, background:surface,
              color:muted, fontSize:"14px", fontWeight:"700", cursor:"pointer",
            }}>Generate Again</button>
            <button onClick={() => router.push("/admin/finance")} style={{
              flex:2, padding:"14px", borderRadius:"12px", border:"none",
              background:`linear-gradient(135deg,${accent},#059669)`,
              color:white, fontSize:"14px", fontWeight:"800", cursor:"pointer",
              boxShadow:"0 4px 16px rgba(16,185,129,0.3)",
            }}>View Invoices →</button>
          </div>
        </div>
      )}
    </div>
  )
}
