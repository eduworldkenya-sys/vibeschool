"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/lib/database.types"

type GeneratedAdminAddStudentArgs =
  Database["public"]["Functions"]["admin_add_student"]["Args"]

type AdminAddStudentArgs = {
  p_name: string
  p_admission_number: string | null
  p_gender: string | null
  p_date_of_birth: string | null
  p_class_id: string | null
  p_school_id: string
}

const deepspace = "#0a1628"
const accent    = "#10b981"
const amber     = "#f59e0b"
const violet    = "#8b5cf6"
const red       = "#ef4444"

interface Student {
  id:               string
  name:             string
  admission_number: string | null
  gender:           string | null
  class_name:       string
  class_stream:     string
  parent_linked:    boolean
  fee_status:       "paid" | "partial" | "owing" | "none"
}

interface ClassFilter {
  id:   string
  name: string
  stream: string
}

export default function StudentsPage() {
  const router = useRouter()

  const [students,   setStudents]   = useState<Student[]>([])
  const [classes,    setClasses]    = useState<ClassFilter[]>([])
  const [schoolId,   setSchoolId]   = useState("")
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState("")
  const [classFilter,setClassFilter]= useState("all")
  const [showModal,  setShowModal]  = useState(false)
  const [saving,     setSaving]     = useState(false)

  const [form, setForm] = useState({
    name:             "",
    admission_number: "",
    class_id:         "",
    gender:           "",
    date_of_birth:    "",
  })

  const [stats, setStats] = useState({
    total:          0,
    withParent:     0,
    withoutParent:  0,
    owing:          0,
  })

  useEffect(() => { bootstrap() }, [])

  async function bootstrap() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/admin/login"); return }

      const { data: p } = await supabase
        .from("profiles")
        .select("school_id")
        .eq("id", user.id)
        .single()

      if (!p?.school_id) { router.push("/admin/login"); return }

      setSchoolId(p.school_id)
      await Promise.all([
        loadStudents(p.school_id),
        loadClasses(p.school_id),
      ])
    } catch {
      router.push("/admin/login")
    } finally {
      setLoading(false)
    }
  }

  async function loadClasses(sid: string) {
    const { data } = await supabase
      .from("classes")
      .select("id, name, stream")
      .eq("school_id", sid)
      .order("name")

    setClasses(
      (data ?? []).map(row => ({
        id: row.id,
        name: row.name,
        stream: row.stream ?? "",
      }))
    )
  }

  async function loadStudents(sid: string) {
    const { data: scRows } = await supabase
      .from("student_classes")
      .select("student_id, class_id, classes(id, name, stream)")
      .eq("school_id", sid)
      .eq("is_current", true)

    if (!scRows || scRows.length === 0) {
      setStudents([])
      setStats({ total: 0, withParent: 0, withoutParent: 0, owing: 0 })
      return
    }

    const studentIds = scRows
      .map(row => row.student_id)
      .filter(
        (studentId): studentId is string =>
          studentId !== null
      )

    if (studentIds.length === 0) {
      setStudents([])
      setStats({
        total: 0,
        withParent: 0,
        withoutParent: 0,
        owing: 0,
      })
      return
    }

    const [studentsRes, linksRes, invoicesRes] = await Promise.all([
      supabase
        .from("students")
        .select("id, name, admission_number, gender, date_of_birth")
        .in("id", studentIds)
        .is("deleted_at", null),
      supabase
        .from("parent_student_links")
        .select("student_id")
        .in("student_id", studentIds),
      supabase
        .from("finance_invoices")
        .select("student_id, status")
        .in("student_id", studentIds)
        .is("deleted_at", null),
    ])

    const linkedSet = new Set(
      (linksRes.data ?? [])
        .map(row => row.student_id)
        .filter(
          (studentId): studentId is string =>
            studentId !== null
        )
    )

    const invoiceMap = new Map<
      string,
      Student["fee_status"]
    >()

    for (const invoice of invoicesRes.data ?? []) {
      if (!invoice.student_id) continue

      const status: Student["fee_status"] =
        invoice.status === "paid" ||
        invoice.status === "partial" ||
        invoice.status === "owing"
          ? invoice.status
          : "none"

      const existing = invoiceMap.get(invoice.student_id)

      if (
        !existing ||
        status === "owing" ||
        status === "partial"
      ) {
        invoiceMap.set(invoice.student_id, status)
      }
    }

    const classMap = new Map<
      string,
      { name: string; stream: string }
    >()

    for (const row of scRows) {
      if (!row.student_id) continue

      const joinedClass = Array.isArray(row.classes)
        ? row.classes[0] ?? null
        : row.classes

      if (!joinedClass) continue

      classMap.set(row.student_id, {
        name: joinedClass.name,
        stream: joinedClass.stream ?? "",
      })
    }

    const rows: Student[] = (studentsRes.data ?? []).map(student => {
      const cls = classMap.get(student.id)

      return {
        id: student.id,
        name: student.name,
        admission_number: student.admission_number,
        gender: student.gender,
        class_name: cls?.name ?? "—",
        class_stream: cls?.stream ?? "",
        parent_linked: linkedSet.has(student.id),
        fee_status: invoiceMap.get(student.id) ?? "none",
      }
    })

    rows.sort((a, b) => {
      const aScore =
        (a.fee_status === "owing" ? 0 : 1) +
        (!a.parent_linked ? 0 : 2)
      const bScore =
        (b.fee_status === "owing" ? 0 : 1) +
        (!b.parent_linked ? 0 : 2)
      return aScore - bScore
    })

    setStudents(rows)
    setStats({
      total:         rows.length,
      withParent:    rows.filter(r => r.parent_linked).length,
      withoutParent: rows.filter(r => !r.parent_linked).length,
      owing:         rows.filter(r => r.fee_status === "owing" || r.fee_status === "partial").length,
    })
  }

  async function addStudent() {
    if (!schoolId || !form.name.trim()) return
    setSaving(true)
    try {
      const args: AdminAddStudentArgs = {
        p_name: form.name.trim(),
        p_admission_number: form.admission_number || null,
        p_gender: form.gender || null,
        p_date_of_birth: form.date_of_birth || null,
        p_class_id: form.class_id || null,
        p_school_id: schoolId,
      }

      // PostgreSQL accepts NULL for these optional arguments. The generated
      // function Args type does not preserve SQL parameter nullability.
      const { data: studentId, error } = await supabase.rpc(
        "admin_add_student",
        args as unknown as GeneratedAdminAddStudentArgs
      )

      if (error || !studentId) throw error


      setShowModal(false)
      setForm({ name: "", admission_number: "", class_id: "", gender: "", date_of_birth: "" })
      await loadStudents(schoolId)
    } catch (e: any) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const filtered = students.filter(s => {
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.admission_number ?? "").toLowerCase().includes(search.toLowerCase())
    const matchClass =
      classFilter === "all" || s.class_name === classFilter
    return matchSearch && matchClass
  })

  const feeColor = (status: Student["fee_status"]) =>
    status === "paid"    ? accent :
    status === "partial" ? amber  :
    status === "owing"   ? red    :
    "#e2e8f0"

  const feeLabel = (status: Student["fee_status"]) =>
    status === "paid"    ? "Paid"    :
    status === "partial" ? "Partial" :
    status === "owing"   ? "Owing"   :
    "No Invoice"

  const genderIcon = (g: string | null) =>
    g === "male" ? "👦" : g === "female" ? "👧" : "🧑"

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{
            height:       "72px",
            background:   "#ffffff",
            borderRadius: "16px",
            animation:    "pulse 1.5s ease-in-out infinite",
          }} />
        ))}
        <style>{`@keyframes pulse{0%,100%{opacity:.4}50%{opacity:.8}}`}</style>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        marginBottom:   "24px",
      }}>
        <div>
          <h1 style={{
            color:      "#0f172a",
            fontSize:   "22px",
            fontWeight: "800",
            margin:     "0 0 2px",
          }}>
            Students
          </h1>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px", margin: 0 }}>
            {stats.total} enrolled
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            background:   accent,
            border:       "none",
            borderRadius: "12px",
            padding:      "10px 18px",
            color:        "#0f172a",
            fontSize:     "13px",
            fontWeight:   "700",
            cursor:       "pointer",
          }}
        >
          + Add Student
        </button>
      </div>

      {/* ── Summary Bar ── */}
      <div style={{
        display:             "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap:                 "10px",
        marginBottom:        "20px",
      }}>
        {[
          { label: "Total",          value: stats.total,         color: "#111827" },
          { label: "Parent Linked",  value: stats.withParent,    color: accent    },
          { label: "No Parent",      value: stats.withoutParent, color: amber     },
          { label: "Fee Issues",     value: stats.owing,         color: red       },
        ].map(s => (
          <div key={s.label} style={{
            background:    "#ffffff",
            border:        "1px solid #e2e8f0",
            borderRadius:  "12px",
            padding:       "12px",
            textAlign:     "center",
            backdropFilter:"blur(12px)",
          }}>
            <div style={{
              color:      s.color,
              fontSize:   "22px",
              fontWeight: "800",
              fontFamily: "monospace",
            }}>
              {s.value}
            </div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "11px", marginTop: "2px" }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Search ── */}
      <input
        type="text"
        placeholder="Search by name or admission number..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width:        "100%",
          background:   "#f8fafc",
          border:       "1px solid #e2e8f0",
          borderRadius: "12px",
          padding:      "12px 16px",
          color:        "#0f172a",
          fontSize:     "14px",
          marginBottom: "12px",
          boxSizing:    "border-box",
          outline:      "none",
        }}
      />

      {/* ── Class Filter ── */}
      <div style={{
        display:      "flex",
        gap:          "8px",
        overflowX:    "auto",
        marginBottom: "20px",
        paddingBottom:"4px",
      }}>
        {["all", ...classes.map(c => c.name)].map(cls => (
          <button
            key={cls}
            onClick={() => setClassFilter(cls)}
            style={{
              background:   classFilter === cls ? accent : "rgba(255,255,255,0.05)",
              border:       "1px solid " + (classFilter === cls ? accent : "rgba(255,255,255,0.1)"),
              borderRadius: "20px",
              padding:      "6px 14px",
              color:        classFilter === cls ? "#ffffff" : "#6b7280",
              fontSize:     "12px",
              fontWeight:   "600",
              cursor:       "pointer",
              whiteSpace:   "nowrap",
            }}
          >
            {cls === "all" ? "All Classes" : cls}
          </button>
        ))}
      </div>

      {/* ── Student List ── */}
      {filtered.length === 0 ? (
        <div style={{
          textAlign:  "center",
          padding:    "60px 20px",
          color:      "#9ca3af",
          fontSize:   "14px",
        }}>
          {students.length === 0
            ? "No students enrolled yet. Add the first student."
            : "No students match your search."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filtered.map(s => (
            <button
              key={s.id}
              onClick={() => router.push(`/admin/students/${s.id}`)}
              style={{
                background:     "#ffffff",
                border:         "1px solid #e2e8f0",
                borderRadius:   "16px",
                padding:        "16px",
                display:        "flex",
                alignItems:     "center",
                gap:            "14px",
                cursor:         "pointer",
                textAlign:      "left",
                backdropFilter: "blur(12px)",
                transition:     "border-color 0.15s",
                width:          "100%",
              }}
            >
              {/* Avatar */}
              <div style={{
                width:          "44px",
                height:         "44px",
                borderRadius:   "50%",
                background:     "#f1f5f9",
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                fontSize:       "20px",
                flexShrink:     0,
              }}>
                {genderIcon(s.gender)}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  color:        "#0f172a",
                  fontSize:     "15px",
                  fontWeight:   "700",
                  marginBottom: "4px",
                  overflow:     "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace:   "nowrap",
                }}>
                  {s.name}
                </div>
                <div style={{
                  display:  "flex",
                  gap:      "8px",
                  flexWrap: "wrap",
                }}>
                  <span style={{
                    color:     "#64748b",
                    fontSize:  "12px",
                  }}>
                    {s.class_name}{s.class_stream ? " " + s.class_stream : ""}
                  </span>
                  {s.admission_number && (
                    <span style={{
                      color:    "#94a3b8",
                      fontSize: "12px",
                    }}>
                      #{s.admission_number}
                    </span>
                  )}
                </div>
              </div>

              {/* Chips */}
              <div style={{
                display:       "flex",
                flexDirection: "column",
                alignItems:    "flex-end",
                gap:           "6px",
                flexShrink:    0,
              }}>
                <span style={{
                  background:   s.parent_linked
                    ? "rgba(16,185,129,0.12)"
                    : "rgba(245,158,11,0.12)",
                  border:       "1px solid " + (s.parent_linked ? accent : amber),
                  borderRadius: "20px",
                  padding:      "2px 10px",
                  fontSize:     "11px",
                  fontWeight:   "600",
                  color:        s.parent_linked ? accent : amber,
                }}>
                  {s.parent_linked ? "Parent ✓" : "No Parent"}
                </span>
                <span style={{
                  background:   `rgba(${
                    s.fee_status === "paid"    ? "16,185,129"  :
                    s.fee_status === "partial" ? "245,158,11"  :
                    s.fee_status === "owing"   ? "239,68,68"   :
                    "255,255,255"
                  },0.10)`,
                  border:       "1px solid " + feeColor(s.fee_status),
                  borderRadius: "20px",
                  padding:      "2px 10px",
                  fontSize:     "11px",
                  fontWeight:   "600",
                  color:        feeColor(s.fee_status),
                }}>
                  {feeLabel(s.fee_status)}
                </span>
              </div>

              <span style={{ color: "#e2e8f0", fontSize: "16px" }}>›</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Add Student Modal ── */}
      {showModal && (
        <div style={{
          position:        "fixed",
          inset:           0,
          background:      "rgba(0,0,0,0.7)",
          backdropFilter:  "blur(8px)",
          display:         "flex",
          alignItems:      "flex-end",
          justifyContent:  "center",
          zIndex:          100,
        }}>
          <div style={{
            background:   "#0a1628",
            borderRadius: "24px 24px 0 0",
            padding:      "28px 24px 40px",
            width:        "100%",
            maxWidth:     "600px",
          }}>
            <div style={{
              display:        "flex",
              justifyContent: "space-between",
              alignItems:     "center",
              marginBottom:   "24px",
            }}>
              <h2 style={{ color: "#111827", fontSize: "18px", fontWeight: "800", margin: 0 }}>
                Add Student
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: "#e2e8f0",
                  border:     "none",
                  borderRadius:"50%",
                  width:      "32px",
                  height:     "32px",
                  color:      "#0f172a",
                  fontSize:   "16px",
                  cursor:     "pointer",
                }}
              >
                ×
              </button>
            </div>

            {[
              { label: "Full Name *",        key: "name",             type: "text",   placeholder: "e.g. James Mwangi"    },
              { label: "Admission Number",   key: "admission_number", type: "text",   placeholder: "e.g. 2026-001"        },
              { label: "Date of Birth",      key: "date_of_birth",    type: "date",   placeholder: ""                     },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: "16px" }}>
                <label style={{
                  color:        "#6b7280",
                  fontSize:     "12px",
                  fontWeight:   "600",
                  display:      "block",
                  marginBottom: "6px",
                }}>
                  {f.label}
                </label>
                <input
                  type={f.type}
                  placeholder={f.placeholder}
                  value={(form as any)[f.key]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{
                    width:        "100%",
                    background:   "#f1f5f9",
                    border:       "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding:      "10px 14px",
                    color:        "#0f172a",
                    fontSize:     "14px",
                    boxSizing:    "border-box",
                    outline:      "none",
                  }}
                />
              </div>
            ))}

            {/* Gender */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{
                color:        "#6b7280",
                fontSize:     "12px",
                fontWeight:   "600",
                display:      "block",
                marginBottom: "6px",
              }}>
                Gender
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                {["male", "female", "other"].map(g => (
                  <button
                    key={g}
                    onClick={() => setForm(prev => ({ ...prev, gender: g }))}
                    style={{
                      flex:         1,
                      background:   form.gender === g ? accent : "#f8fafc",
                      border:       "1px solid " + (form.gender === g ? accent : "rgba(255,255,255,0.1)"),
                      borderRadius: "10px",
                      padding:      "10px",
                      color:        form.gender === g ? "#ffffff" : "#6b7280",
                      fontSize:     "13px",
                      fontWeight:   "600",
                      cursor:       "pointer",
                      textTransform:"capitalize",
                    }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Class */}
            <div style={{ marginBottom: "24px" }}>
              <label style={{
                color:        "#6b7280",
                fontSize:     "12px",
                fontWeight:   "600",
                display:      "block",
                marginBottom: "6px",
              }}>
                Class
              </label>
              <select
                value={form.class_id}
                onChange={e => setForm(prev => ({ ...prev, class_id: e.target.value }))}
                style={{
                  width:        "100%",
                  background:   "#f1f5f9",
                  border:       "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding:      "10px 14px",
                  color:        form.class_id ? "#ffffff" : "#9ca3af",
                  fontSize:     "14px",
                  boxSizing:    "border-box",
                  outline:      "none",
                }}
              >
                <option value="">Select class</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.stream}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={addStudent}
              disabled={saving || !form.name.trim()}
              style={{
                width:        "100%",
                background:   saving || !form.name.trim() ? "rgba(16,185,129,0.4)" : accent,
                border:       "none",
                borderRadius: "12px",
                padding:      "14px",
                color:        "#0f172a",
                fontSize:     "15px",
                fontWeight:   "700",
                cursor:       saving || !form.name.trim() ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Saving..." : "Add Student"}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
