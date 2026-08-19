"use client"
export const dynamic = "force-dynamic"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getAdminSchoolAuthority } from "@/lib/admin/authority"

const DAYS: Record<number, string> = { 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday", 7: "Sunday" }

type Slot = {
  id: string
  teacher_id: string
  class_id: string
  subject_id: string
  day_of_week: number
  start_time: string
  end_time: string
  room: string | null
  effective_from: string
  effective_until: string | null
}
type ClassRow = { id: string; name: string; stream: string | null }
type SubjectRow = { id: string; name: string }
type ProfileRow = { id: string; full_name: string }

export default function AdminTimetablePage() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [teachers, setTeachers] = useState<ProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    setError("")
    try {
      const authority = await getAdminSchoolAuthority()
      const sid = authority.schoolId
      const today = new Date().toISOString().slice(0, 10)
      const [slotRes, classRes, subjectRes, teacherMemberRes] = await Promise.all([
        supabase.from("timetable_slots").select("id,teacher_id,class_id,subject_id,day_of_week,start_time,end_time,room,effective_from,effective_until").eq("school_id", sid).lte("effective_from", today).or(`effective_until.is.null,effective_until.gte.${today}`).order("day_of_week").order("start_time"),
        supabase.from("classes").select("id,name,stream").eq("school_id", sid),
        supabase.from("subjects").select("id,name").eq("school_id", sid),
        supabase.from("school_members").select("profile_id").eq("school_id", sid).eq("role", "teacher"),
      ])
      const firstError = [slotRes.error, classRes.error, subjectRes.error, teacherMemberRes.error].find(Boolean)
      if (firstError) throw firstError
      const teacherIds = (teacherMemberRes.data ?? []).map(row => row.profile_id)
      const profileRes = teacherIds.length ? await supabase.from("profiles").select("id,full_name").in("id", teacherIds) : { data: [], error: null }
      if (profileRes.error) throw profileRes.error
      setSlots((slotRes.data ?? []) as Slot[])
      setClasses((classRes.data ?? []) as ClassRow[])
      setSubjects((subjectRes.data ?? []) as SubjectRow[])
      setTeachers((profileRes.data ?? []) as ProfileRow[])
    } catch (cause) {
      console.error("Admin timetable load failed", cause)
      setError(cause instanceof Error ? cause.message : "Timetable oversight could not be loaded.")
    } finally {
      setLoading(false)
    }
  }

  const classMap = useMemo(() => new Map(classes.map(row => [row.id, `${row.name}${row.stream ? ` ${row.stream}` : ""}`])), [classes])
  const subjectMap = useMemo(() => new Map(subjects.map(row => [row.id, row.name])), [subjects])
  const teacherMap = useMemo(() => new Map(teachers.map(row => [row.id, row.full_name])), [teachers])
  const days = useMemo(() => Object.keys(DAYS).map(Number).filter(day => slots.some(slot => slot.day_of_week === day)), [slots])

  if (loading) return <div aria-busy="true" style={{ minHeight: 260, borderRadius: 18, background: "#e2e8f0" }} />

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 16 }}>
      <header><h1 style={{ margin: 0, fontSize: 24 }}>Timetable oversight</h1><p style={{ color: "#64748b", margin: "5px 0 0" }}>Current effective slots only. Database exclusion constraints prevent teacher, class and room overlaps.</p></header>
      {error && <div role="alert" style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", padding: 12, borderRadius: 12 }}>{error}</div>}
      {slots.length === 0 ? (
        <section style={{ background: "white", border: "1px solid #f59e0b", borderRadius: 16, padding: 22 }}><strong>No active timetable slots</strong><p style={{ color: "#64748b" }}>Teacher timetable setup can proceed once classes, subjects and teacher assignments exist.</p></section>
      ) : days.map(day => (
        <section key={day} style={{ display: "grid", gap: 8 }}>
          <h2 style={{ fontSize: 16, margin: "5px 0" }}>{DAYS[day]}</h2>
          {slots.filter(slot => slot.day_of_week === day).map(slot => (
            <article key={slot.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 13, padding: 13, display: "grid", gridTemplateColumns: "110px minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
              <strong style={{ fontSize: 13 }}>{slot.start_time.slice(0,5)}–{slot.end_time.slice(0,5)}</strong>
              <div style={{ minWidth: 0 }}><div style={{ fontWeight: 730, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{classMap.get(slot.class_id) ?? "Unknown class"} · {subjectMap.get(slot.subject_id) ?? "Unknown subject"}</div><div style={{ color: "#64748b", fontSize: 12, marginTop: 3 }}>{teacherMap.get(slot.teacher_id) ?? "Unknown teacher"}</div></div>
              <div style={{ color: "#64748b", fontSize: 12 }}>{slot.room || "—"}</div>
            </article>
          ))}
        </section>
      ))}
    </main>
  )
}
