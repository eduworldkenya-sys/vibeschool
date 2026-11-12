"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { updateTimetableReleaseStatus, type TimetableReleaseStatus } from "@/lib/timetable/operations"

export type SchoolTimetableRelease = {
  id: string
  school_id: string
  label: string
  status: TimetableReleaseStatus
  effective_from: string
  created_at: string
  published_at: string | null
  approved_at: string | null
}
export type SchoolTimetableReleasePreflight = {
  release_id: string
  school_id: string
  ready: boolean
  period_count: number
  slot_count: number
  invalid_period_count: number
  invalid_assignment_count: number
  outside_release_count: number
  missing_allocation_count: number
  allocation_mismatch_count: number
  ambiguous_allocation_count: number
}

export const publicationBlockerLabels: ReadonlyArray<[keyof SchoolTimetableReleasePreflight,string]> = [
  ["period_count", "Confirmed teaching periods"],
  ["slot_count", "Assigned recurring lessons"],
  ["invalid_period_count", "Lessons without matching confirmed school periods"],
  ["invalid_assignment_count", "Unverified teacher, class or subject assignments"],
  ["outside_release_count", "Active slots outside this release"],
  ["missing_allocation_count", "Subjects without effective approved allocations"],
  ["allocation_mismatch_count", "Weekly allocation mismatches"],
  ["ambiguous_allocation_count", "Overlapping allocation targets"],
]

const shell: React.CSSProperties = {
  padding: 16, background: "#fff", border: "1px solid #dfe5e7",
  borderRadius: 12, display: "grid", gap: 12,
}
const button: React.CSSProperties = {
  padding: "9px 12px", borderRadius: 9, border: "1px solid #bbcfc5",
  background: "#f7fcf9", color: "#075a39", fontWeight: 700, cursor: "pointer",
}

/**
 * Operator-facing control over the EXISTING release state machine.
 * No silent release selection, admin impersonation or write from a read-only
 * teacher. Every transition re-verifies authority and blockers on the server.
 */
export default function SchoolTimetablePublicationPanel({
  schoolId, schoolName, onChanged,
}: {schoolId: string; schoolName: string; onChanged?: () => Promise<void>}) {
  const [releases, setReleases] = useState<SchoolTimetableRelease[]>([])
  const [selected, setSelected] = useState("")
  const [gate, setGate] = useState<SchoolTimetableReleasePreflight | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setGate(null)
    setError("")
    const result = await supabase.from("timetable_releases")
      .select("id,school_id,label,status,effective_from,created_at,published_at,approved_at")
      .eq("school_id",schoolId).order("created_at",{ascending:false}).limit(40)
    if (result.error) setError(result.error.message)
    else {
      const rows=(result.data ?? []) as SchoolTimetableRelease[]
      setReleases(rows)
      setSelected(current => rows.some(r=>r.id===current) ? current : (rows[0]?.id ?? ""))
    }
    setLoading(false)
  },[schoolId])

  useEffect(() => { void load() },[load])
  const current=releases.find(row=>row.id===selected)
  const published=releases.find(row=>row.status==="published")

  async function inspect() {
    if(!current) return
    setError(""); setNotice(""); setGate(null); setBusy(true)
    try {
      const {data,error:readError}=await supabase.rpc("school_timetable_release_preflight",{p_release_id:current.id})
      if(readError) throw readError
      if(!data || typeof data!=="object" || data.release_id!==current.id || data.school_id!==schoolId) {
        throw new Error("The publication check did not return valid school evidence.")
      }
      setGate(data as SchoolTimetableReleasePreflight)
    } catch(e) {
      setError(e instanceof Error?e.message:"The school timetable check failed.")
    } finally { setBusy(false) }
  }

  async function transition(target: "draft"|"review"|"approved"|"published"|"retired") {
    if(!current) return
    // No status button may stand in for verified release blockers.
    if((target==="approved"||target==="published")&& (!gate?.ready||gate.release_id!==current.id)) {
      setError("Complete the server publication checks before approving or publishing.")
      return
    }
    const label=target==="draft" ? "return the reviewed timetable to draft for correction"
      : target==="published" ? "publish the official school timetable for all linked teachers"
      : target==="retired" ? "retire the current official school timetable"
      : target==="approved" ? "approve the school's reviewed timetable"
      : "send or return this timetable for school review"
    if(!window.confirm(`Confirm you want to ${label} for ${schoolName}? This is a school-wide decision.`)) return
    setBusy(true);setError("");setNotice("")
    try {
      const result=await updateTimetableReleaseStatus(current.id,target)
      if(!result||result.school_id!==schoolId||result.status!==target) throw new Error("Publication was not confirmed by the server.")
      setNotice(target==="published"
        ? "Official school timetable published. Linked teachers use this approved release automatically."
        : target==="approved" ? "Timetable approved. Review the effective date before publishing."
        : target==="retired" ? "Release retired. No new official timetable was invented."
        : target==="draft" ? "Review returned to draft. Correct the timetable before resubmitting."
        : "Timetable returned or submitted for school review.")
      await load()
      if(onChanged) await onChanged()
    } catch(e) {
      setError(e instanceof Error?e.message:"Could not change publication status.")
    } finally {setBusy(false)}
  }

  return <section style={shell} aria-label="Official school timetable publication">
    <h2 style={{fontSize:17,margin:0}}>Official school timetable</h2>
    <p style={{fontSize:12,color:"#64748b",margin:0}}>
      School administrators review, approve and publish one shared timetable.
      Samples and drafts are never official until approved and published.
    </p>
    {published ? <div role="status" style={{background:"#ecfdf5",borderRadius:8,padding:10,fontSize:13}}>
      <strong>Published:</strong> {published.label} · effective {published.effective_from}.
      {published.published_at ? " Published " + new Date(published.published_at).toLocaleString("en-KE",{timeZone:"Africa/Nairobi"}) : ""}
    </div> : <p style={{fontSize:13,margin:0,color:"#92400e"}}>
      No official timetable has been published. Teachers can still prepare unscheduled lessons.
    </p>}
    {error&&<p role="alert" style={{fontSize:12,color:"#991b1b",margin:0}}>{error}</p>}
    {notice&&<p role="status" style={{fontSize:12,color:"#065f46",margin:0}}>{notice}</p>}
    {loading ? <p role="status">Loading releases…</p> : releases.length===0 ?
      <p style={{fontSize:13}}>Create a review release from the school timetable below.</p> : <>
        <label style={{display:"grid",gap:4,fontSize:12,fontWeight:700}}>
          Release to inspect
          <select aria-label="School timetable release" style={{padding:9,border:"1px solid #ccc",borderRadius:8}}
            value={selected} disabled={busy} onChange={e=>{setSelected(e.target.value);setGate(null);setNotice("");setError("")}}>
            {releases.map(row=><option key={row.id} value={row.id}>{row.label} · {row.status} · {row.effective_from}</option>)}
          </select>
        </label>
        {current&&<div style={{display:"grid",gap:9}}>
          <span style={{fontSize:12}}>Status: <strong>{current.status}</strong>. Starts: {current.effective_from}.</span>
          {current.status!=="retired"&&<button type="button" style={button} disabled={busy} onClick={()=>void inspect()}>
            {busy?"Checking…":"Check school readiness"}
          </button>}
          {gate&&<div style={{display:"grid",gap:6,fontSize:12}}>
            <strong>{gate.ready?"Ready for approval/publication checks":"Not ready for publication"}</strong>
            {publicationBlockerLabels.map(([field,label])=><div key={field} style={{display:"flex",justifyContent:"space-between",gap:12}}>
              <span>{label}</span><strong>{String(gate[field])}</strong>
            </div>)}
            <small>Readiness is checked again by the server when approving or publishing. This does not certify a live teacher replay.</small>
          </div>}
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {current.status==="draft"&&<button type="button" style={button} disabled={busy} onClick={()=>void transition("review")}>Send for review</button>}
            {current.status==="review"&&<>
              <button type="button" style={button} disabled={busy} onClick={()=>void transition("draft")}>Return to draft</button>
              <button type="button" style={button} disabled={busy||!gate?.ready} onClick={()=>void transition("approved")}>Approve</button>
            </>}
            {current.status==="approved"&&<>
              <button type="button" style={button} disabled={busy} onClick={()=>void transition("review")}>Return to review</button>
              <button type="button" style={button} disabled={busy||!gate?.ready} onClick={()=>void transition("published")}>Publish official timetable</button>
            </>}
            {current.status==="published"&&<button type="button" style={button} disabled={busy} onClick={()=>void transition("retired")}>Retire timetable</button>}
          </div>
        </div>}
      </>}
  </section>
}
