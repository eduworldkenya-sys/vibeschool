"use client";
import { nairobiDateStr } from '@/lib/time'
export const dynamic = "force-dynamic";

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
const white   = "#1e293b"

const fmt = (n: number) => `KES ${Number(n).toLocaleString("en-KE", { minimumFractionDigits: 0 })}`

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px",
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "10px", color: "#f1f5f9", fontSize: "14px", outline: "none",
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
    unmatched: ["rgba(245,158,11,0.15)", "#f59e0b"],
    matched:   ["rgba(16,185,129,0.15)", "#10b981"],
    paid:      ["rgba(16,185,129,0.15)", "#10b981"],
    partial:   ["rgba(245,158,11,0.15)", "#f59e0b"],
    issued:    ["rgba(139,92,246,0.15)", "#8b5cf6"],
    overdue:   ["rgba(239,68,68,0.15)",  "#ef4444"],
    draft:     ["#1e293b","rgba(255,255,255,0.4)"],
  }
  const [bg, color] = map[status] ?? ["#1e293b", "rgba(255,255,255,0.4)"]
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
        <h2 style={{ fontSize:"18px", fontWeight:"800", margin:0, color: "#f1f5f9" }}>{title}</h2>
        <button onClick={onClose} style={{ background:"#e2e8f0", border:"none",
          color:"#fff", width:"32px", height:"32px", borderRadius:"50%", cursor:"pointer",
          fontSize:"16px", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
      </div>
      {children}
    </div>
  </div>
)

interface ParsedSMS {
  raw_message: string
  amount: number
  reference: string
  sender_name: string
  sender_phone: string
  transaction_date: string
}

interface MpesaStatement {
  id: string
  raw_message: string | null
  amount: number | null
  reference: string | null
  sender_phone: string | null
  sender_name: string | null
  transaction_date: string | null
  matched_payment_id: string | null
  status: string
  created_at: string | null
}

interface UnpaidInvoice {
  id: string
  student_id: string
  term: string
  year: number
  total_amount: number
  paid_amount: number
  student_name: string
}

interface Period {
  id: string
  term: string
  year: number
  status: string
}

export default function ReconciliationPage() {
  const router = useRouter()

  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period | null>(null)

  const [pasteText, setPasteText] = useState("")
  const [parsed, setParsed] = useState<ParsedSMS[]>([])
  const [saving, setSaving] = useState(false)

  const [unmatched, setUnmatched] = useState<MpesaStatement[]>([])
  const [matched, setMatched] = useState<MpesaStatement[]>([])
  const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[]>([])

  const [matchModal, setMatchModal] = useState<MpesaStatement | null>(null)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("")
  const [matching, setMatching] = useState(false)

  const [toast, setToast] = useState({ msg: "", type: "success" })

  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: "", type: "success" }), 3500)
  }

  const load = useCallback(async (sid: string) => {
    setLoading(true)
    try {
      const today = nairobiDateStr()

      const [{ data: unmatchedData }, { data: matchedData }, { data: periodData }] = await Promise.all([
        supabase.from("finance_mpesa_statements").select("*").eq("school_id", sid).eq("status", "unmatched").order("created_at", { ascending: false }),
        supabase.from("finance_mpesa_statements").select("*").eq("school_id", sid).eq("status", "matched").gte("created_at", today).order("created_at", { ascending: false }),
        supabase.from("finance_periods").select("*").eq("school_id", sid).eq("status", "open").order("created_at", { ascending: false }).limit(1).single(),
      ])

      setUnmatched(unmatchedData ?? [])
      setMatched(matchedData ?? [])
      setPeriod(periodData ?? null)

      // Load unpaid invoices with student names
      const { data: invoices } = await supabase
        .from("finance_invoices")
        .select("id, student_id, term, year, total_amount, paid_amount, status")
        .eq("school_id", sid)
        .in("status", ["issued", "partial", "overdue"])
        .is("deleted_at", null)

      if (invoices && invoices.length > 0) {
        const studentIds = Array.from(new Set(invoices.map((i: any) => i.student_id)))
        const { data: students } = await supabase
          .from("students")
          .select("id, name")
          .in("id", studentIds)

        const studentMap: Record<string, string> = {}
        students?.forEach((s: any) => { studentMap[s.id] = s.name })

        setUnpaidInvoices(invoices.map((inv: any) => ({
          ...inv,
          student_name: studentMap[inv.student_id] ?? "Unknown",
        })))
      } else {
        setUnpaidInvoices([])
      }
    } catch (e) {
      showToast("Failed to load data", "error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/admin/login"); return }
      setCurrentUserId(user.id)
      const { data: p } = await supabase.from("profiles").select("school_id").eq("id", user.id).single()
      if (!p?.school_id) { router.push("/admin/login"); return }
      setSchoolId(p.school_id)
      await load(p.school_id)
    }
    init()
  }, [router, load])

  const isLocked = period?.status === "locked"

  function parseSMS(text: string): ParsedSMS[] {
    const messages = text.split(/\n{2,}|\r\n\r\n/).map(m => m.trim()).filter(Boolean)
    const results: ParsedSMS[] = []

    for (const msg of messages) {
      try {
        // Reference code: starts message e.g. SJ12ABC3DE
        const refMatch = msg.match(/^([A-Z0-9]{8,12})\s+Confirmed/i)
        // Amount: Ksh1,500.00
        const amtMatch = msg.match(/Ksh([\d,]+\.?\d*)\s+received/i)
        // Sender name and phone
        const senderMatch = msg.match(/received from\s+([A-Z ]+)\s+(07\d{8}|01\d{8}|\+254\d{9})/i)
        // Date: 18/5/26 or 18/5/2026
        const dateMatch = msg.match(/on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+at\s+(\d{1,2}:\d{2}\s*[AP]M)/i)

        if (!refMatch || !amtMatch) continue

        const reference = refMatch[1]
        const amount = parseFloat(amtMatch[1].replace(/,/g, ""))
        const sender_name = senderMatch ? senderMatch[1].trim() : ""
        const sender_phone = senderMatch ? senderMatch[2].trim() : ""

        let transaction_date = new Date().toISOString()
        if (dateMatch) {
          const [d, m, y] = dateMatch[1].split("/")
          const fullYear = y.length === 2 ? `20${y}` : y
          const timeStr = dateMatch[2].trim()
          transaction_date = new Date(`${fullYear}-${m.padStart(2,"0")}-${d.padStart(2,"0")} ${timeStr}`).toISOString()
        }

        results.push({ raw_message: msg, amount, reference, sender_name, sender_phone, transaction_date })
      } catch {
        continue
      }
    }
    return results
  }

  const handleParse = () => {
    const results = parseSMS(pasteText)
    if (results.length === 0) {
      showToast("No valid Mpesa messages found", "error")
      return
    }
    setParsed(results)
    showToast(`Parsed ${results.length} message${results.length !== 1 ? "s" : ""}`)
  }

  const handleSaveAll = async () => {
    if (!schoolId || parsed.length === 0) return
    setSaving(true)
    try {
      const rows = parsed.map(p => ({
        school_id: schoolId,
        raw_message: p.raw_message,
        amount: p.amount,
        reference: p.reference,
        sender_name: p.sender_name,
        sender_phone: p.sender_phone,
        transaction_date: p.transaction_date,
        status: "unmatched",
      }))

      const { error } = await supabase.from("finance_mpesa_statements").insert(rows)
      if (error) throw error

      showToast(`${parsed.length} statement${parsed.length !== 1 ? "s" : ""} saved`)
      setParsed([])
      setPasteText("")
      await load(schoolId)
    } catch (e: any) {
      showToast(e?.message ?? "Failed to save statements", "error")
    } finally {
      setSaving(false)
    }
  }

  const handleMatch = async () => {
    if (!matchModal || !selectedInvoiceId || !schoolId || !currentUserId) return
    setMatching(true)
    try {
      const invoice = unpaidInvoices.find(i => i.id === selectedInvoiceId)
      if (!invoice) throw new Error("Invoice not found")

      // Get next receipt number
      const { data: seq } = await supabase
        .from("finance_receipt_sequences")
        .select("*")
        .eq("school_id", schoolId)
        .single()

      const nextNum = (seq?.last_number ?? 0) + 1
      const prefix = seq?.prefix ?? "REC"
      const receiptNumber = `${prefix}-${String(nextNum).padStart(5, "0")}`

      if (seq) {
        await supabase.from("finance_receipt_sequences")
          .update({ last_number: nextNum, updated_at: new Date().toISOString() })
          .eq("school_id", schoolId)
      } else {
        await supabase.from("finance_receipt_sequences")
          .insert({ school_id: schoolId, last_number: nextNum, prefix: "REC", updated_at: new Date().toISOString() })
      }

      // Insert payment
      const { data: newPayment, error: payErr } = await supabase
        .from("finance_payments")
        .insert({
          school_id: schoolId,
          invoice_id: selectedInvoiceId,
          student_id: invoice.student_id,
          amount: matchModal.amount,
          method: "mpesa",
          reference: matchModal.reference,
          receipt_number: receiptNumber,
          received_by: currentUserId,
          received_at: matchModal.transaction_date,
          notes: `Matched from Mpesa statement. Sender: ${matchModal.sender_name} ${matchModal.sender_phone}`,
        })
        .select()
        .single()

      if (payErr) throw payErr

      // Update invoice paid_amount
      const newPaid = (invoice.paid_amount ?? 0) + matchModal.amount
      const newStatus = newPaid >= invoice.total_amount ? "paid" : "partial"
      await supabase.from("finance_invoices")
        .update({ paid_amount: newPaid, status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", selectedInvoiceId)

      // Update statement
      await supabase.from("finance_mpesa_statements")
        .update({ status: "matched", matched_payment_id: newPayment.id })
        .eq("id", matchModal.id)

      showToast("Statement matched and payment recorded")
      setMatchModal(null)
      setSelectedInvoiceId("")
      await load(schoolId)
    } catch (e: any) {
      showToast(e?.message ?? "Failed to match statement", "error")
    } finally {
      setMatching(false)
    }
  }

  const todayStr = nairobiDateStr()
  const totalUnmatched = unmatched.length
  const totalMatched = matched.length
  const totalKesToday = [...unmatched, ...matched]
    .filter(s => s.created_at?.slice(0, 10) === todayStr)
    .reduce((sum, s) => sum + (s.amount ?? 0), 0)

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f1f5f9", fontFamily: "system-ui, sans-serif", padding: "20px 16px 60px" }}>
      <style>{`
        @keyframes shimmer { 0% { background-position:200% 0 } 100% { background-position:-200% 0 } }
        @keyframes slideUp { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes pulse   { 0%,100% { opacity:1 } 50% { opacity:0.5 } }
        select option { background:#1e293b; color:#f1f5f9 }
        * { box-sizing: border-box }
      `}</style>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <button onClick={() => router.back()} style={{
          background:"none", border:"none", color: muted,
          fontSize:"13px", cursor:"pointer", display:"flex", alignItems:"center",
          gap:"6px", marginBottom:"20px", padding:0
        }}>← Back</button>

        <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 900 }}>Mpesa Reconciliation</h1>
        <p style={{ margin: "0 0 24px", fontSize: 14, color: muted }}>Paste SMS messages, parse, and match to invoices.</p>

        {isLocked && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>🔒</span>
            <span style={{ fontSize: 13, color: red, fontWeight: 600 }}>Period is locked. Matching is disabled.</span>
          </div>
        )}

        {/* Stats strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Unmatched", value: totalUnmatched, color: amber },
            { label: "Matched Today", value: totalMatched, color: accent },
            { label: "KES Parsed Today", value: fmtK(totalKesToday), color: blue },
          ].map(stat => (
            <div key={stat.label} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 14, padding: "16px" }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{stat.label}</p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Paste area */}
        <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>Paste Mpesa SMS Messages</h2>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: muted }}>Separate multiple messages with a blank line.</p>
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder={"SJ12ABC3DE Confirmed. Ksh1,500.00 received from JOHN KAMAU 0712345678 on 18/5/26 at 10:23 AM. New M-Pesa balance is Ksh3,200.00. Transaction cost, Ksh0.00.\n\nQK98XYZ12A Confirmed. Ksh2,000.00 received from JANE WANJIKU 0723456789 on 18/5/26 at 11:45 AM. New M-Pesa balance is Ksh5,000.00. Transaction cost, Ksh0.00."}
            style={{ ...inputStyle, minHeight: 140, resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
          />
          <button
            onClick={handleParse}
            disabled={!pasteText.trim()}
            style={{
              marginTop: 12, padding: "11px 24px", borderRadius: 10,
              background: pasteText.trim() ? accent : "#1e293b",
              color: pasteText.trim() ? dark : muted,
              border: "none", fontSize: 14, fontWeight: 700,
              cursor: pasteText.trim() ? "pointer" : "not-allowed",
            }}
          >
            Parse Messages
          </button>
        </div>

        {/* Parsed preview */}
        {parsed.length > 0 && (
          <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: 20, marginBottom: 16, animation: "fadeIn 0.3s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Parsed Preview — {parsed.length} message{parsed.length !== 1 ? "s" : ""}</h2>
              <button
                onClick={handleSaveAll}
                disabled={saving || isLocked}
                style={{
                  padding: "9px 20px", borderRadius: 10,
                  background: saving || isLocked ? "#1e293b" : accent,
                  color: saving || isLocked ? muted : dark,
                  border: "none", fontSize: 13, fontWeight: 700,
                  cursor: saving || isLocked ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Saving…" : "Save All"}
              </button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Reference", "Amount", "Sender", "Phone", "Date"].map(h => (
                      <th key={h} style={{ textAlign: "left", fontSize: 11, color: muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", paddingBottom: 10, paddingRight: 16 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((row, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "10px 16px 10px 0", fontFamily: "monospace", color: accent, fontSize: 12 }}>{row.reference}</td>
                      <td style={{ padding: "10px 16px 10px 0", fontWeight: 700 }}>{fmt(row.amount)}</td>
                      <td style={{ padding: "10px 16px 10px 0", color: "#f1f5f9" }}>{row.sender_name || "—"}</td>
                      <td style={{ padding: "10px 16px 10px 0", color: muted, fontSize: 12 }}>{row.sender_phone || "—"}</td>
                      <td style={{ padding: "10px 0", color: muted, fontSize: 12 }}>
                        {row.transaction_date ? new Date(row.transaction_date).toLocaleDateString("en-KE") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Unmatched statements */}
        <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>
            Unmatched Statements <span style={{ color: amber, marginLeft: 8 }}>{unmatched.length}</span>
          </h2>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Skeleton h={60} /><Skeleton h={60} />
            </div>
          ) : unmatched.length === 0 ? (
            <p style={{ color: muted, fontSize: 13, margin: 0 }}>No unmatched statements. 🎉</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {unmatched.map(s => (
                <div key={s.id} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <span style={{ fontFamily: "monospace", fontSize: 12, color: accent, fontWeight: 700 }}>{s.reference}</span>
                        <StatusChip status={s.status} />
                      </div>
                      <p style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700 }}>{fmt(s.amount)}</p>
                      <p style={{ margin: 0, fontSize: 12, color: muted }}>
                        {s.sender_name} {s.sender_phone} · {s.transaction_date ? new Date(s.transaction_date).toLocaleDateString("en-KE") : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => { if (!isLocked) { setMatchModal(s); setSelectedInvoiceId("") } }}
                      disabled={isLocked}
                      style={{
                        padding: "8px 16px", borderRadius: 10,
                        background: isLocked ? "#1e293b" : "rgba(16,185,129,0.15)",
                        color: isLocked ? muted : accent,
                        border: `1px solid ${isLocked ? border : "rgba(16,185,129,0.3)"}`,
                        fontSize: 13, fontWeight: 700,
                        cursor: isLocked ? "not-allowed" : "pointer",
                      }}
                    >
                      Match
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Matched today */}
        {matched.length > 0 && (
          <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 16, padding: 20, animation: "fadeIn 0.3s ease" }}>
            <h2 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>
              Matched Today <span style={{ color: accent, marginLeft: 8 }}>{matched.length}</span>
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {matched.map(s => (
                <div key={s.id} style={{ background: "#1e293b", border: `1px solid rgba(16,185,129,0.15)`, borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <span style={{ fontFamily: "monospace", fontSize: 12, color: accent, fontWeight: 700 }}>{s.reference}</span>
                        <StatusChip status={s.status} />
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: muted }}>{s.sender_name} · {fmt(s.amount)}</p>
                    </div>
                    <span style={{ fontSize: 12, color: muted }}>
                      {s.transaction_date ? new Date(s.transaction_date).toLocaleDateString("en-KE") : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Match modal */}
      {matchModal && (
        <Modal title="Match to Invoice" onClose={() => setMatchModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: 14 }}>
              <p style={{ margin: "0 0 4px", fontSize: 12, color: muted, fontWeight: 600, textTransform: "uppercase" }}>Statement</p>
              <p style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700 }}>{fmt(matchModal.amount)}</p>
              <p style={{ margin: 0, fontSize: 12, color: muted }}>{matchModal.reference} · {matchModal.sender_name} {matchModal.sender_phone}</p>
            </div>
            <div>
              <label style={labelStyle}>Select Invoice</label>
              <select
                value={selectedInvoiceId}
                onChange={e => setSelectedInvoiceId(e.target.value)}
                style={inputStyle}
              >
                <option value="">— Choose an invoice —</option>
                {unpaidInvoices.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.student_name} · {inv.term} {inv.year} · Balance: {fmt((inv.total_amount ?? 0) - (inv.paid_amount ?? 0))}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleMatch}
              disabled={!selectedInvoiceId || matching}
              style={{
                width: "100%", padding: "14px", borderRadius: 12,
                background: !selectedInvoiceId || matching ? "#1e293b" : accent,
                color: !selectedInvoiceId || matching ? muted : dark,
                border: "none", fontSize: 15, fontWeight: 800,
                cursor: !selectedInvoiceId || matching ? "not-allowed" : "pointer",
              }}
            >
              {matching ? "Matching…" : "Confirm Match"}
            </button>
          </div>
        </Modal>
      )}

      {toast.msg && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: toast.type === "error" ? "rgba(239,68,68,0.95)" : "rgba(16,185,129,0.95)",
          color: "#f1f5f9", padding: "12px 24px", borderRadius: 12, fontSize: 14, fontWeight: 600,
          zIndex: 200, animation: "slideUp 0.3s ease", whiteSpace: "nowrap", maxWidth: "90vw",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

function fmtK(n: number) {
  return n >= 1000000 ? `KES ${(n/1000000).toFixed(1)}M` : n >= 1000 ? `KES ${(n/1000).toFixed(0)}K` : fmt(n)
}
