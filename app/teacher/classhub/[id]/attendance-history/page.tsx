"use client";
export const dynamic = "force-dynamic";
import { C } from "@/components/teacher/ui";
import { useEffect, useState, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import { getAttendanceRecords, summarizeAttendance, summarizeByStudent } from "@/lib/attendance/summary";
import { getRangeDates } from "@/lib/attendance/ranges";
import type { AttendanceRange, AttendanceRangeSummary } from "@/lib/types";

interface ClassInfo { name: string; stream: string | null }
interface StudentRow { id: string; name: string; admNo: string }

const RANGES: { id: AttendanceRange; label: string }[] = [
  { id: "week",  label: "Week"  },
  { id: "month", label: "Month" },
  { id: "term",  label: "Term"  },
  { id: "year",  label: "Year"  },
]

function AttendanceHistoryInner() {
  const router  = useRouter()
  const params  = useParams()
  const classId = params.id as string

  const [classInfo,  setClassInfo]  = useState<ClassInfo | null>(null)
  const [students,   setStudents]   = useState<StudentRow[]>([])
  const [range,      setRange]      = useState<AttendanceRange>("week")
  const [summaries,  setSummaries]  = useState<Record<string, AttendanceRangeSummary>>({})
  const [overall,    setOverall]    = useState<AttendanceRangeSummary>({ total: 0, present: 0, absent: 0, late: 0, rate: 0 })
  const [loading,    setLoading]    = useState(true)
  const [rangeLabel, setRangeLabel] = useState("")

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/"); return }

      const { data: owned } = await supabase
        .from("teacher_classes")
        .select("class_id")
        .eq("teacher_id", user.id)
        .eq("class_id", classId)
        .maybeSingle()
      if (!owned) { setLoading(false); router.replace("/teacher/classhub"); return }

      const [clsRes, stuRes] = await Promise.all([
        supabase.from("classes").select("name, stream").eq("id", classId).single(),
        supabase.from("student_classes").select("student_id, students(id, name, admission_number)").eq("class_id", classId).eq("is_current", true),
      ])

      setClassInfo(clsRes.data ? { name: clsRes.data.name, stream: clsRes.data.stream } : null)
      setStudents(
        (stuRes.data ?? [])
          .map((r: any) => r.students)
          .filter(Boolean)
          .map((s: any) => ({ id: s.id, name: s.name, admNo: s.admission_number ?? "" }))
      )
    }
    init()
  }, [classId])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { startDate, endDate } = await getRangeDates(range)
      setRangeLabel(startDate === endDate ? startDate : `${startDate} \u2192 ${endDate}`)
      const records = await getAttendanceRecords({ classId, startDate, endDate })
      setSummaries(summarizeByStudent(records))
      setOverall(summarizeAttendance(records))
      setLoading(false)
    }
    if (classId) load()
  }, [classId, range])

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: C.textMuted, paddingBottom: 80, background: C.surface, minHeight: "100%" }}>

      <div style={{ background: "linear-gradient(135deg, #065f46 0%, #10b981 100%)", padding: "20px 16px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, width: 36, height: 36, color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>\u2190</button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: "#fff", margin: 0 }}>Attendance History</h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", margin: "2px 0 0" }}>
              {classInfo ? `${classInfo.name}${classInfo.stream ? " \u00b7 " + classInfo.stream : ""}` : ""}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {RANGES.map(r => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              style={{
                flex: 1, padding: "9px 8px", borderRadius: 12, border: "none", cursor: "pointer",
                fontFamily: "inherit", fontWeight: 800, fontSize: 12,
                background: range === r.id ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.15)",
                color: range === r.id ? "#065f46" : "rgba(255,255,255,0.85)",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
        {rangeLabel && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 8 }}>{rangeLabel}</p>}
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[
            { label: "Rate",    value: overall.rate + "%" },
            { label: "Present", value: overall.present },
            { label: "Absent",  value: overall.absent },
            { label: "Late",    value: overall.late },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, background: "#fff", borderRadius: 14, padding: "12px 6px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: C.textPrimary }}>{s.value}</div>
              <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: C.textPrimary }}>Per Student</p>
          </div>
          {loading ? (
            <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: C.textMuted }}>Loading\u2026</div>
          ) : students.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: C.textMuted }}>No students found</div>
          ) : (
            students.map(s => {
              const sum = summaries[s.id] ?? { total: 0, present: 0, absent: 0, late: 0, rate: 0 }
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: `1px solid ${C.border}`, gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>{s.name}</div>
                    {s.admNo && <div style={{ fontSize: 10, color: C.textMuted }}>{s.admNo}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: "#065f46", fontWeight: 700 }}>{sum.present}P</span>
                    <span style={{ fontSize: 11, color: "#991b1b", fontWeight: 700 }}>{sum.absent}A</span>
                    <span style={{ fontSize: 11, color: "#92400e", fontWeight: 700 }}>{sum.late}L</span>
                    <span style={{ fontSize: 12, fontWeight: 900, color: C.textPrimary, minWidth: 36, textAlign: "right" }}>{sum.rate}%</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default function AttendanceHistoryPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, fontSize: 13, color: "#6b7280" }}>Loading\u2026</div>}>
      <AttendanceHistoryInner />
    </Suspense>
  )
}
