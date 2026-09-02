"use client"

import { useCallback, useEffect, useState } from "react"
import { hqSupabase } from "@/lib/hq/supabase"
import { HQPanel, HQ_THEME as C } from "@/components/hq/HQShell"

type Claim = {
  id: string
  reference_code: string
  status: string
  requested_levels: string[]
  created_at: string
  school_id: string | null
  directory_school_id: string | null
  school_name: string | null
  county: string | null
  teacher_name: string | null
}

type ReviewAction = "approved" | "needs_information" | "rejected"

type ReviewDialog = {
  claim: Claim
  action: ReviewAction
}

export default function TeacherSchoolClaimQueue() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState("")
  const [dialog, setDialog] = useState<ReviewDialog | null>(null)
  const [note, setNote] = useState("")

  const refresh = useCallback(async () => {
    setLoading(true)
    setError("")
    const { data, error: e } = await hqSupabase.rpc("hq_list_teacher_school_claims", {
      p_status: "pending",
      p_limit: 100,
    })
    if (e) {
      setClaims([])
      setError("Teacher-school claims could not be loaded with owner authority.")
    } else {
      setClaims((data || []) as Claim[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  function openReview(claim: Claim, action: ReviewAction) {
    setDialog({ claim, action })
    setNote("")
    setError("")
  }

  async function submitReview() {
    if (!dialog) return
    if (dialog.action !== "approved" && note.trim().length < 3) {
      setError("Add a short review note before requesting information or rejecting a claim.")
      return
    }
    setBusy(dialog.claim.id)
    setError("")
    const { error: e } = await hqSupabase.rpc("review_teacher_school_claim", {
      p_claim_id: dialog.claim.id,
      p_action: dialog.action,
      p_note: note.trim() || null,
    })
    setBusy("")
    if (e) {
      setError(e.message?.includes("canonical_school_resolution_required")
        ? "Resolve this directory school to a canonical school before approval."
        : "The claim review was not applied. No school authority was changed.")
      return
    }
    setDialog(null)
    await refresh()
  }

  return (
    <HQPanel
      title="Teacher school access claims"
      description="School selection is evidence only. Approval is the point where verified school membership can be created."
    >
      {error && <div className="tsc-alert" role="status">{error}</div>}
      <div className="tsc-toolbar">
        <span>{loading ? "Loading…" : `${claims.length} pending claim${claims.length === 1 ? "" : "s"}`}</span>
        <button onClick={() => void refresh()} disabled={loading}>Refresh</button>
      </div>
      {loading ? (
        <div className="tsc-empty">Loading teacher-school claims…</div>
      ) : claims.length === 0 ? (
        <div className="tsc-empty">No pending teacher-school access claims.</div>
      ) : (
        <div className="tsc-list">
          {claims.map((claim) => (
            <article key={claim.id}>
              <div className="tsc-copy">
                <strong>{claim.teacher_name || "Teacher"}</strong>
                <span>{claim.school_name || "Unresolved directory school"}</span>
                <small>{[claim.county, ...(claim.requested_levels || []), claim.reference_code].filter(Boolean).join(" · ")}</small>
              </div>
              <div className="tsc-actions">
                <button
                  className="approve"
                  disabled={busy === claim.id || !claim.school_id}
                  title={!claim.school_id ? "Resolve the directory identity before approval" : undefined}
                  onClick={() => openReview(claim, "approved")}
                >Approve</button>
                <button disabled={busy === claim.id} onClick={() => openReview(claim, "needs_information")}>Needs info</button>
                <button disabled={busy === claim.id} onClick={() => openReview(claim, "rejected")}>Reject</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {dialog && (
        <div className="tsc-modal" role="dialog" aria-modal="true" aria-label="Review teacher school claim">
          <div className="tsc-dialog">
            <h2>{dialog.action === "approved" ? "Approve school access" : dialog.action === "needs_information" ? "Request more information" : "Reject school access claim"}</h2>
            <p><b>{dialog.claim.teacher_name || "Teacher"}</b> · {dialog.claim.school_name || "Unresolved school"}</p>
            <p className="tsc-warning">
              {dialog.action === "approved"
                ? "Approval creates verified teacher membership for this canonical school. Existing admin/owner roles are preserved."
                : "This action does not create school authority."}
            </p>
            <textarea
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={dialog.action === "approved" ? "Approval note (optional)" : "Review note (required)"}
            />
            <div className="tsc-dialog-actions">
              <button onClick={() => setDialog(null)} disabled={Boolean(busy)}>Cancel</button>
              <button className={dialog.action === "approved" ? "approve" : ""} onClick={() => void submitReview()} disabled={Boolean(busy)}>
                {busy ? "Applying…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .tsc-alert{margin:0 13px 10px;padding:10px;border:1px solid rgba(239,68,68,.3);border-radius:9px;background:rgba(239,68,68,.08);color:#fecaca;font-size:10px}
        .tsc-toolbar{display:flex;justify-content:space-between;align-items:center;padding:0 13px 10px;color:${C.muted};font-size:10px}.tsc-toolbar button,.tsc-actions button,.tsc-dialog-actions button{min-height:38px;padding:0 10px;border:1px solid ${C.border};border-radius:9px;background:rgba(255,255,255,.035);color:#dbeafe;font-size:9px;font-weight:850;cursor:pointer}.tsc-toolbar button:disabled,.tsc-actions button:disabled,.tsc-dialog-actions button:disabled{opacity:.5;cursor:not-allowed}.tsc-empty{padding:15px;color:${C.muted};font-size:11px}.tsc-list{padding:0 13px}.tsc-list article{display:flex;justify-content:space-between;gap:15px;padding:13px 0;border-bottom:1px solid ${C.border}}.tsc-copy strong,.tsc-copy span,.tsc-copy small{display:block}.tsc-copy strong{font-size:11px}.tsc-copy span{font-size:10px;margin-top:4px}.tsc-copy small{font-size:9px;color:${C.muted};margin-top:4px}.tsc-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.tsc-actions .approve,.tsc-dialog-actions .approve{border-color:rgba(34,197,94,.45);background:rgba(34,197,94,.12);color:#bbf7d0}.tsc-modal{position:fixed;z-index:220;inset:0;display:grid;place-items:center;padding:18px;background:rgba(2,6,23,.84)}.tsc-dialog{width:min(100%,500px);padding:18px;border:1px solid ${C.border};border-radius:15px;background:${C.panel};color:#fff}.tsc-dialog h2{margin:0 0 7px;font-size:17px}.tsc-dialog p{font-size:10px;color:${C.muted};line-height:1.5}.tsc-warning{padding:10px;border:1px solid ${C.border};border-radius:9px;background:rgba(255,255,255,.025)}.tsc-dialog textarea{width:100%;box-sizing:border-box;padding:11px;border:1px solid ${C.border};border-radius:9px;background:rgba(255,255,255,.035);color:#fff;resize:vertical}.tsc-dialog-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:11px}
        @media(max-width:720px){.tsc-list article{display:block}.tsc-actions{justify-content:flex-start;margin-top:10px}.tsc-actions button{min-height:42px}}
      `}</style>
    </HQPanel>
  )
}
