"use client"
export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getAdminSchoolAuthority } from "@/lib/admin/authority"

const LEVELS = [
  "PP1", "PP2",
  "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6",
  "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12",
  "Form 1", "Form 2", "Form 3", "Form 4",
]

const SECONDARY_SYSTEMS = {
  cbe: { label: "CBE senior school", levels: ["Grade 10", "Grade 11", "Grade 12"] },
  eightFourFour: { label: "8-4-4 secondary", levels: ["Form 1", "Form 2", "Form 3", "Form 4"] },
} as const

type SecondarySystem = keyof typeof SECONDARY_SYSTEMS

interface ClassRow {
  id: string
  name: string
  stream: string | null
}

const fieldStyle = {
  width: "100%",
  padding: "11px 12px",
  boxSizing: "border-box" as const,
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  background: "white",
  fontSize: 14,
}

export default function AdminClassesSettingsPage() {
  const router = useRouter()
  const [schoolId, setSchoolId] = useState("")
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [level, setLevel] = useState("")
  const [stream, setStream] = useState("")
  const [editing, setEditing] = useState<ClassRow | null>(null)
  const [editName, setEditName] = useState("")
  const [editStream, setEditStream] = useState("")
  const [secondarySystem, setSecondarySystem] = useState<SecondarySystem>("eightFourFour")
  const [secondaryStream, setSecondaryStream] = useState("")
  const [setupMessage, setSetupMessage] = useState("")

  useEffect(() => {
    void bootstrap()
  }, [])

  async function bootstrap() {
    setLoading(true)
    setError("")
    try {
      const authority = await getAdminSchoolAuthority()
      setSchoolId(authority.schoolId)
      await loadClasses(authority.schoolId)
    } catch (cause) {
      console.error("Admin class setup failed", cause)
      setError(cause instanceof Error ? cause.message : "Class setup could not be loaded.")
    } finally {
      setLoading(false)
    }
  }

  async function loadClasses(sid: string) {
    const { data, error: queryError } = await supabase
      .from("classes")
      .select("id,name,stream")
      .eq("school_id", sid)
      .order("name")
      .order("stream")
    if (queryError) throw queryError
    setClasses((data ?? []) as ClassRow[])
  }

  async function addClass() {
    if (!schoolId || !level || saving) return
    setSaving(true)
    setError("")
    try {
      const normalizedStream = stream.trim()
      const duplicate = classes.some(row =>
        row.name.trim().toLowerCase() === level.trim().toLowerCase() &&
        (row.stream ?? "").trim().toLowerCase() === normalizedStream.toLowerCase()
      )
      if (duplicate) throw new Error("That class and stream already exists.")

      const { error: insertError } = await supabase.from("classes").insert({
        school_id: schoolId,
        name: level,
        stream: normalizedStream || "",
      })
      if (insertError) throw insertError
      setLevel("")
      setStream("")
      await loadClasses(schoolId)
    } catch (cause) {
      console.error("Admin class creation failed", cause)
      setError(cause instanceof Error ? cause.message : "Class could not be created.")
    } finally {
      setSaving(false)
    }
  }

  async function addSecondaryClasses() {
    if (!schoolId || saving) return
    setSaving(true)
    setError("")
    setSetupMessage("")
    try {
      const normalizedStream = secondaryStream.trim().replace(/\s+/g, " ")
      const levels = SECONDARY_SYSTEMS[secondarySystem].levels
      const existingKeys = new Set(classes.map(row => `${row.name.trim().toLowerCase()}|${(row.stream ?? "").trim().toLowerCase()}`))
      const rows = levels
        .filter(name => !existingKeys.has(`${name.toLowerCase()}|${normalizedStream.toLowerCase()}`))
        .map(name => ({ school_id: schoolId, name, stream: normalizedStream }))

      if (rows.length === 0) {
        setSetupMessage("Those secondary classes already exist. No duplicates were created.")
        return
      }
      const { error: insertError } = await supabase.from("classes").insert(rows)
      if (insertError) throw insertError
      await loadClasses(schoolId)
      setSetupMessage(`${rows.length} secondary class${rows.length === 1 ? "" : "es"} added${normalizedStream ? ` for stream ${normalizedStream}` : ""}.`)
      setSecondaryStream("")
    } catch (cause) {
      console.error("Admin secondary class setup failed", cause)
      setError(cause instanceof Error ? cause.message : "Secondary classes could not be created.")
    } finally {
      setSaving(false)
    }
  }

  function startEdit(row: ClassRow) {
    setEditing(row)
    setEditName(row.name)
    setEditStream(row.stream ?? "")
    setError("")
  }

  async function saveEdit() {
    if (!editing || !schoolId || !editName.trim() || saving) return
    setSaving(true)
    setError("")
    try {
      const name = editName.trim()
      const nextStream = editStream.trim()
      const duplicate = classes.some(row =>
        row.id !== editing.id &&
        row.name.trim().toLowerCase() === name.toLowerCase() &&
        (row.stream ?? "").trim().toLowerCase() === nextStream.toLowerCase()
      )
      if (duplicate) throw new Error("That class and stream already exists.")

      const { error: updateError } = await supabase
        .from("classes")
        .update({ name, stream: nextStream })
        .eq("id", editing.id)
        .eq("school_id", schoolId)
      if (updateError) throw updateError
      setEditing(null)
      await loadClasses(schoolId)
    } catch (cause) {
      console.error("Admin class update failed", cause)
      setError(cause instanceof Error ? cause.message : "Class could not be updated.")
    } finally {
      setSaving(false)
    }
  }

  async function removeUnusedClass(row: ClassRow) {
    if (!schoolId || saving) return
    setSaving(true)
    setError("")
    try {
      const [students, teachers, timetable, lessons, attendance, assessments] = await Promise.all([
        supabase.from("student_classes").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("class_id", row.id),
        supabase.from("teacher_classes").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("class_id", row.id),
        supabase.from("timetable_slots").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("class_id", row.id),
        supabase.from("lesson_plans").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("class_id", row.id),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("class_id", row.id),
        supabase.from("assessment_definitions").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("class_id", row.id),
      ])
      const firstError = [students.error, teachers.error, timetable.error, lessons.error, attendance.error, assessments.error].find(Boolean)
      if (firstError) throw firstError
      const evidence = [students.count, teachers.count, timetable.count, lessons.count, attendance.count, assessments.count].reduce<number>((sum, value) => sum + (value ?? 0), 0)
      if (evidence > 0) {
        throw new Error("This class has enrollment, teaching or assessment history and cannot be deleted. Historical school records are preserved.")
      }
      const { error: deleteError } = await supabase.from("classes").delete().eq("id", row.id).eq("school_id", schoolId)
      if (deleteError) throw deleteError
      await loadClasses(schoolId)
    } catch (cause) {
      console.error("Admin class removal failed", cause)
      setError(cause instanceof Error ? cause.message : "Class could not be removed.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div aria-busy="true" style={{ minHeight: 240, borderRadius: 18, background: "#e2e8f0" }} />

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", display: "grid", gap: 18 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button aria-label="Back" onClick={() => router.back()} style={{ border: 0, background: "transparent", fontSize: 26, cursor: "pointer" }}>‹</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Classes & streams</h1>
          <p style={{ color: "#64748b", margin: "4px 0 0" }}>One canonical class identity is shared by enrollment, teachers, timetable, attendance and assessment.</p>
        </div>
      </header>

      {error && <div role="alert" style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 12, padding: 12 }}>{error}</div>}

      <section style={{ background: "#0f172a", color: "white", borderRadius: 16, padding: 16, display: "grid", gap: 10 }}>
        <div><strong>Set up secondary school classes</strong><div style={{ color: "#cbd5e1", fontSize: 13, marginTop: 4 }}>Add the complete Kenyan secondary structure at once. Existing classes are preserved and duplicates are skipped.</div></div>
        <select aria-label="Secondary education system" value={secondarySystem} onChange={event => setSecondarySystem(event.target.value as SecondarySystem)} style={fieldStyle}>
          {Object.entries(SECONDARY_SYSTEMS).map(([value, config]) => <option key={value} value={value}>{config.label} · {config.levels.join("–")}</option>)}
        </select>
        <input aria-label="Stream for secondary classes" value={secondaryStream} onChange={event => setSecondaryStream(event.target.value)} placeholder="Stream, e.g. East or A (optional)" style={fieldStyle} />
        <button disabled={saving} onClick={() => void addSecondaryClasses()} style={{ border: 0, borderRadius: 11, padding: 12, background: "#10b981", color: "white", fontWeight: 800, cursor: saving ? "not-allowed" : "pointer" }}>{saving ? "Creating…" : `Add ${SECONDARY_SYSTEMS[secondarySystem].levels.join(", ")}`}</button>
        {setupMessage && <div role="status" style={{ color: "#bbf7d0", fontSize: 13 }}>{setupMessage}</div>}
      </section>

      <section style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, display: "grid", gap: 10 }}>
        <strong>Add class / stream</strong>
        <select value={level} onChange={event => setLevel(event.target.value)} style={fieldStyle}>
          <option value="">Choose level</option>
          {LEVELS.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
        <input value={stream} onChange={event => setStream(event.target.value)} placeholder="Stream, e.g. East, Blue, A (optional)" style={fieldStyle} />
        <button disabled={saving || !level} onClick={() => void addClass()} style={{ border: 0, borderRadius: 11, padding: 12, background: "#10b981", color: "white", fontWeight: 780, cursor: saving ? "not-allowed" : "pointer" }}>
          {saving ? "Saving…" : "Add class"}
        </button>
      </section>

      <section style={{ display: "grid", gap: 8 }}>
        {classes.length === 0 ? (
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 26, textAlign: "center" }}>
            <strong>No classes configured</strong>
            <p style={{ color: "#64748b" }}>Create the first class above. Repeating the same setup is blocked from creating duplicates.</p>
          </div>
        ) : classes.map(row => (
          <article key={row.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button onClick={() => router.push(`/admin/students?class=${row.id}`)} style={{ border: 0, background: "transparent", textAlign: "left", cursor: "pointer", minWidth: 160 }}>
              <strong>{row.name}{row.stream ? ` ${row.stream}` : ""}</strong>
              <div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>Open learner roster</div>
            </button>
            <div style={{ display: "flex", gap: 7 }}>
              <button onClick={() => startEdit(row)} style={{ border: "1px solid #cbd5e1", background: "white", borderRadius: 9, padding: "7px 10px", cursor: "pointer" }}>Edit</button>
              <button onClick={() => void removeUnusedClass(row)} disabled={saving} style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", borderRadius: 9, padding: "7px 10px", cursor: "pointer" }}>Remove if unused</button>
            </div>
          </article>
        ))}
      </section>

      {editing && (
        <div role="dialog" aria-modal="true" aria-label="Edit class" style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(15,23,42,.55)", display: "grid", placeItems: "end center" }}>
          <section style={{ width: "min(100%,620px)", background: "white", borderRadius: "22px 22px 0 0", padding: 20, display: "grid", gap: 12, boxSizing: "border-box" }}>
            <h2 style={{ margin: 0 }}>Edit class</h2>
            <label>Level / name<input value={editName} onChange={event => setEditName(event.target.value)} style={fieldStyle} /></label>
            <label>Stream<input value={editStream} onChange={event => setEditStream(event.target.value)} style={fieldStyle} /></label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button onClick={() => setEditing(null)} style={{ border: "1px solid #cbd5e1", borderRadius: 11, padding: 11, background: "white", cursor: "pointer" }}>Cancel</button>
              <button disabled={saving || !editName.trim()} onClick={() => void saveEdit()} style={{ border: 0, borderRadius: 11, padding: 11, background: "#10b981", color: "white", fontWeight: 780, cursor: "pointer" }}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
