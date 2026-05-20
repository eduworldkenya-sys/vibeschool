"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const dark   = "#0a1628"
const accent = "#10b981"
const bg     = "#f0f2f5"
const red    = "#ef4444"
const amber  = "#f59e0b"

interface StaffRow {
  id:          string
  full_name:   string
  category:    string
  designation: string | null
}

interface StudentRow {
  id:               string
  name:             string
  admission_number: string | null
}

interface ClassRow {
  id:     string
  name:   string
  stream: string | null
}

type StaffStatus   = "present" | "absent" | "late" | "on_leave"
type StudentStatus = "present" | "absent" | "late"

function Shimmer({ w = "100%", h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#e5e7eb 25%,#d1d5db 50%,#e5e7eb 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
    }} />
  )
}

function Toast({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      background: "#f0f4f8", color: "#111827", padding: "12px 24px", borderRadius: 40,
      fontSize: 13, fontWeight: 700, zIndex: 9999, whiteSpace: "nowrap",
      boxShadow: "0 4px 24px rgba(0,0,0,0.18)", animation: "fadeIn 0.2s ease",
    }}>{msg}</div>
  )
}

export default function AttendancePage() {
  const router = useRouter()

  const [schoolId,     setSchoolId]     = useState("")
  const [adminId,      setAdminId]      = useState("")
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [toast,        setToast]        = useState("")
  const [tab,          setTab]          = useState<"staff" | "students">("staff")
  const [date,         setDate]         = useState(() => new Date().toISOString().slice(0, 10))
  const [staffList,    setStaffList]    = useState<StaffRow[]>([])
  const [classes,      setClasses]      = useState<ClassRow[]>([])
  const [students,     setStudents]     = useState<StudentRow[]>([])
  const [classId,      setClassId]      = useState("")
  const [staffMarks,   setStaffMarks]   = useState<Record<string, StaffStatus>>({})
  const [studentMarks, setStudentMarks] = useState<Record<string, StudentStatus>>({})

  const fireToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(""), 3000)
  }, [])

  useEffect(() => { bootstrap() }, [])

  async function bootstrap() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/admin/login"); return }
      setAdminId(user.id)
      const { data: p } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single()
      if (!p?.school_id) { router.push("/admin/login"); return }
      setSchoolId(p.school_id)
      await Promise.all([loadStaff(p.school_id), loadClasses(p.school_id)])
    } catch {
      router.push("/admin/login")
    } finally {
      setLoading(false)
    }
  }

  async function loadStaff(sid: string) {
    const { data } = await supabase
      .from("staff")
      .select("id,full_name,category,designation")
      .eq("school_id", sid)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("full_name")
    setStaffList((data ?? []) as StaffRow[])
  }

  async function loadClasses(sid: string) {
    const { data } = await supabase
      .from("classes")
      .select("id,name,stream")
      .eq("school_id", sid)
      .order("name")
    const list = (data ?? []) as ClassRow[]
    setClasses(list)
    if (list.length > 0) {
      setClassId(list[0].id)
      await loadStudents(list[0].id)
    }
  }

  async function loadStudents(cid: string) {
    const { data } = await supabase
      .from("students")
      .select("id,name,admission_number")
      .eq("class_id", cid)
      .is("deleted_at", null)
      .order("name")
    setStudents((data ?? []) as StudentRow[])
    setStudentMarks({})
  }

  async function loadExistingStaff(sid: string, d: string) {
    const { data } = await supabase
      .from("staff_attendance")
      .select("staff_id,status")
      .eq("school_id", sid)
      .eq("date", d)
    if (data && data.length > 0) {
      const marks: Record<string, StaffStatus> = {}
      data.forEach((r: { staff_id: string; status: string }) => {
        marks[r.staff_id] = r.status as StaffStatus
      })
      setStaffMarks(marks)
    } else {
      setStaffMarks({})
    }
  }

  async function loadExistingStudents(cid: string, d: string) {
    const { data } = await supabase
      .from("attendance")
      .select("student_id,status")
      .eq("class_id", cid)
      .eq("date", d)
    if (data && data.length > 0) {
      const marks: Record<string, StudentStatus> = {}
      data.forEach((r: { student_id: string; status: string }) => {
        marks[r.student_id] = r.status as StudentStatus
      })
      setStudentMarks(marks)
    } else {
      setStudentMarks({})
    }
  }

  useEffect(() => {
    if (!schoolId || !date) return
    if (tab === "staff") loadExistingStaff(schoolId, date)
    if (tab === "students" && classId) loadExistingStudents(classId, date)
  }, [date, tab, schoolId, classId])

  async function handleClassChange(cid: string) {
    setClassId(cid)
    await loadStudents(cid)
    if (date) await loadExistingStudents(cid, date)
  }

  function markStaff(id: string, status: StaffStatus) {
    setStaffMarks(m => ({ ...m, [id]: status }))
  }

  function markStudent(id: string, status: StudentStatus) {
    setStudentMarks(m => ({ ...m, [id]: status }))
  }

  function markAllStaff(status: StaffStatus) {
    const marks: Record<string, StaffStatus> = {}
    staffList.forEach(s => { marks[s.id] = status })
    setStaffMarks(marks)
  }

  function markAllStudents(status: StudentStatus) {
    const marks: Record<string, StudentStatus> = {}
    students.forEach(s => { marks[s.id] = status })
    setStudentMarks(marks)
  }

  async function saveStaff() {
    if (staffList.length === 0) { fireToast("No staff to save."); return }
    setSaving(true)
    const rows = staffList.map(s => ({
      school_id:   schoolId,
      staff_id:    s.id,
      date,
      status:      staffMarks[s.id] ?? "absent",
      recorded_by: adminId,
      created_at:  new Date().toISOString(),
    }))
    const { error } = await supabase
      .from("staff_attendance")
      .upsert(rows, { onConflict: "staff_id,date" })
    setSaving(false)
    if (error) { fireToast("Error saving — try again."); return }
    fireToast("Staff attendance saved.")
  }

  async function saveStudents() {
    if (students.length === 0) { fireToast("No students to save."); return }
    if (!classId) { fireToast("Select a class first."); return }
    setSaving(true)
    const rows = students.map(s => ({
      school_id:         schoolId,
      class_id:          classId,
      student_id:        s.id,
      teacher_id:        adminId,
      date,
      status:            studentMarks[s.id] ?? "absent",
      is_late:           studentMarks[s.id] === "late",
      timetable_slot_id: null,
      marked_at:         new Date().toISOString(),
    }))
    const { error } = await supabase
      .from("attendance")
      .upsert(rows, { onConflict: "student_id,date,class_id" })
    setSaving(false)
    if (error) { fireToast("Error saving — try again."); return }
    fireToast("Student attendance saved.")
  }

  const ss  = {
    present: staffList.filter(s => staffMarks[s.id] === "present").length,
    absent:  staffList.filter(s => staffMarks[s.id] === "absent").length,
    late:    staffList.filter(s => staffMarks[s.id] === "late").length,
    leave:   staffList.filter(s => staffMarks[s.id] === "on_leave").length,
  }

  const stu = {
    present: students.filter(s => studentMarks[s.id] === "present").length,
    absent:  students.filter(s => studentMarks[s.id] === "absent").length,
    late:    students.filter(s => studentMarks[s.id] === "late").length,
  }

  const btnBase: React.CSSProperties = {
    flex: 1, padding: "7px 0", borderRadius: 8,
    fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "11px 0", borderRadius: 12,
    background: active ? dark : "#fff",
    color: active ? "#fff" : "#6b7280",
    fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
    border: active ? "2px solid transparent" : "1.5px solid #e5e7eb",
  })

  if (loading) return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      {[1,2,3,4,5].map(i => <Shimmer key={i} h={64} r={14} />)}
    </div>
  )

  return (
    <div style={{ background: bg, minHeight: "100vh", padding: "0 0 80px" }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px 16px" }}>

        {/* HEADER */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: dark, letterSpacing: -0.5 }}>Attendance</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>Mark daily attendance</div>
        </div>

        {/* DATE */}
        <div style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", marginBottom: 16, border: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: dark }}>Date</div>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: dark, fontFamily: "inherit", outline: "none", background: bg }}
          />
        </div>

        {/* TABS */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button onClick={() => setTab("staff")}    style={tabStyle(tab === "staff")}>Staff</button>
          <button onClick={() => setTab("students")} style={tabStyle(tab === "students")}>Students</button>
        </div>

        {/* ── STAFF TAB ── */}
        {tab === "staff" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>
              {[
                { label: "Present", value: ss.present, color: accent },
                { label: "Absent",  value: ss.absent,  color: red    },
                { label: "Late",    value: ss.late,    color: amber  },
                { label: "Leave",   value: ss.leave,   color: "#6b7280" },
              ].map(s => (
                <div key={s.label} style={{ background: "#fff", borderRadius: 12, padding: "10px 8px", textAlign: "center", border: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: s.color, fontFamily: "monospace" }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {(["present","absent","late","on_leave"] as StaffStatus[]).map(st => (
                <button key={st} onClick={() => markAllStaff(st)} style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "1.5px solid #e5e7eb", background: "#fff", color: dark, fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>
                  All {st.replace("_"," ")}
                </button>
              ))}
            </div>

            {staffList.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 24px", color: "#9ca3af", fontSize: 14 }}>No active staff found.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {staffList.map(s => {
                  const mark = staffMarks[s.id]
                  return (
                    <div key={s.id} style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", border: "1px solid #e5e7eb", animation: "fadeIn 0.2s ease" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: dark }}>{s.full_name}</div>
                          <div style={{ fontSize: 12, color: "#6b7280" }}>{s.designation ?? s.category}</div>
                        </div>
                        {mark && (
                          <div style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: mark === "present" ? accent+"20" : mark === "absent" ? red+"20" : mark === "late" ? amber+"20" : "#6b728020", color: mark === "present" ? accent : mark === "absent" ? red : mark === "late" ? amber : "#6b7280" }}>
                            {mark.replace("_"," ")}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {([
                          { st: "present"  as StaffStatus, label: "Present", color: accent },
                          { st: "absent"   as StaffStatus, label: "Absent",  color: red    },
                          { st: "late"     as StaffStatus, label: "Late",    color: amber  },
                          { st: "on_leave" as StaffStatus, label: "Leave",   color: "#6b7280" },
                        ]).map(({ st, label, color }) => (
                          <button key={st} onClick={() => markStaff(s.id, st)} style={{ ...btnBase, background: mark === st ? color : "#fff", color: mark === st ? "#fff" : "#6b7280", border: mark === st ? `1.5px solid ${color}` : "1.5px solid #e5e7eb" }}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <button onClick={saveStaff} disabled={saving} style={{ width: "100%", marginTop: 20, padding: 15, borderRadius: 14, border: "none", background: saving ? "#d1d5db" : accent, color: "#111827", fontWeight: 800, fontSize: 15, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: saving ? "none" : "0 4px 14px rgba(16,185,129,0.35)" }}>
              {saving ? "Saving..." : "Save Staff Attendance"}
            </button>
          </div>
        )}

        {/* ── STUDENTS TAB ── */}
        {tab === "students" && (
          <div>
            <div style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", marginBottom: 14, border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Class</div>
              <select value={classId} onChange={e => handleClassChange(e.target.value)} style={{ width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: dark, fontFamily: "inherit", outline: "none", background: bg }}>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.stream ? " " + c.stream : ""}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
              {[
                { label: "Present", value: stu.present, color: accent },
                { label: "Absent",  value: stu.absent,  color: red    },
                { label: "Late",    value: stu.late,    color: amber  },
              ].map(s => (
                <div key={s.label} style={{ background: "#fff", borderRadius: 12, padding: "10px 8px", textAlign: "center", border: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: s.color, fontFamily: "monospace" }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {(["present","absent","late"] as StudentStatus[]).map(st => (
                <button key={st} onClick={() => markAllStudents(st)} style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "1.5px solid #e5e7eb", background: "#fff", color: dark, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>
                  All {st}
                </button>
              ))}
            </div>

            {students.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 24px", color: "#9ca3af", fontSize: 14 }}>No students in this class.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {students.map((s, i) => {
                  const mark = studentMarks[s.id]
                  return (
                    <div key={s.id} style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", border: "1px solid #e5e7eb", animation: "fadeIn 0.2s ease" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f0f4f8"+"15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: dark }}>
                            {i + 1}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: dark }}>{s.name}</div>
                            {s.admission_number && <div style={{ fontSize: 11, color: "#9ca3af" }}>{s.admission_number}</div>}
                          </div>
                        </div>
                        {mark && (
                          <div style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: mark === "present" ? accent+"20" : mark === "absent" ? red+"20" : amber+"20", color: mark === "present" ? accent : mark === "absent" ? red : amber }}>
                            {mark}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {([
                          { st: "present" as StudentStatus, label: "Present", color: accent },
                          { st: "absent"  as StudentStatus, label: "Absent",  color: red    },
                          { st: "late"    as StudentStatus, label: "Late",    color: amber  },
                        ]).map(({ st, label, color }) => (
                          <button key={st} onClick={() => markStudent(s.id, st)} style={{ ...btnBase, background: mark === st ? color : "#fff", color: mark === st ? "#fff" : "#6b7280", border: mark === st ? `1.5px solid ${color}` : "1.5px solid #e5e7eb" }}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <button onClick={saveStudents} disabled={saving} style={{ width: "100%", marginTop: 20, padding: 15, borderRadius: 14, border: "none", background: saving ? "#d1d5db" : accent, color: "#111827", fontWeight: 800, fontSize: 15, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: saving ? "none" : "0 4px 14px rgba(16,185,129,0.35)" }}>
              {saving ? "Saving..." : "Save Student Attendance"}
            </button>
          </div>
        )}

      </div>
      <Toast msg={toast} />
    </div>
  )
}
