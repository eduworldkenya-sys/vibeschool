"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

const dark   = "#1e1b4b"
const accent = "#10b981"
const bg     = "#f0f2f5"
const red    = "#ef4444"
const amber  = "#f59e0b"
const violet = "#8b5cf6"

interface Term {
  id:         string
  name:       string
  year:       number
  start_date: string
  end_date:   string
  status:     string
}

interface Subject {
  id:         string
  name:       string
  class_id:   string
  teacher_id: string | null
  class_name: string
  teacher_name: string | null
}

interface ClassRow {
  id:   string
  name: string
  stream: string | null
}

function Toast({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{
      position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
      background: dark, color: "#fff", padding: "12px 24px", borderRadius: 40,
      fontSize: 13, fontWeight: 700, zIndex: 9999, whiteSpace: "nowrap",
      boxShadow: "0 4px 24px rgba(0,0,0,0.25)", animation: "fadeIn 0.2s ease",
    }}>{msg}</div>
  )
}

export default function AcademicsPage() {
  const router = useRouter()

  const [schoolId,   setSchoolId]   = useState("")
  const [loading,    setLoading]    = useState(true)
  const [toast,      setToast]      = useState("")
  const [terms,      setTerms]      = useState<Term[]>([])
  const [subjects,   setSubjects]   = useState<Subject[]>([])
  const [classes,    setClasses]    = useState<ClassRow[]>([])
  const [teachers,   setTeachers]   = useState<{id:string;full_name:string}[]>([])
  const [tab,        setTab]        = useState<"overview"|"terms"|"subjects">("overview")
  const [showAddTerm,    setShowAddTerm]    = useState(false)
  const [showAddSubject, setShowAddSubject] = useState(false)
  const [saving,     setSaving]     = useState(false)

  const [termForm, setTermForm] = useState({
    name: "", year: new Date().getFullYear().toString(),
    start_date: "", end_date: "",
  })

  const [subjectForm, setSubjectForm] = useState({
    name: "", class_id: "", teacher_id: "",
  })

  const fireToast = useCallback((msg: string) => {
    setToast(msg); setTimeout(() => setToast(""), 3000)
  }, [])

  useEffect(() => { bootstrap() }, [])

  async function bootstrap() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/admin/login"); return }
      const { data: p } = await supabase.from("profiles").select("school_id").eq("id", user.id).single()
      if (!p?.school_id) { router.push("/admin/login"); return }
      setSchoolId(p.school_id)
      await loadAll(p.school_id)
    } catch { router.push("/admin/login") }
    finally { setLoading(false) }
  }

  async function loadAll(sid: string) {
    const [termsRes, classRes, teacherRes] = await Promise.all([
      supabase.from("academic_terms").select("*").eq("school_id", sid).order("year", { ascending: false }),
      supabase.from("classes").select("id,name,stream").eq("school_id", sid).order("name"),
      supabase.from("staff").select("id,full_name").eq("school_id", sid).eq("category", "teaching").eq("status", "active").is("deleted_at", null).order("full_name"),
    ])
    const classList = (classRes.data ?? []) as ClassRow[]
    setTerms((termsRes.data ?? []) as Term[])
    setClasses(classList)
    setTeachers((teacherRes.data ?? []) as {id:string;full_name:string}[])

    if (classList.length > 0) {
      await loadSubjects(sid, classList)
    }
  }

  async function loadSubjects(sid: string, classList: ClassRow[]) {
    const { data } = await supabase
      .from("academic_subjects")
      .select("id,name,class_id,teacher_id,profiles:teacher_id(full_name)")
      .eq("school_id", sid)
      .is("deleted_at", null)
      .order("name")

    const classMap: Record<string, string> = {}
    classList.forEach(c => { classMap[c.id] = c.name + (c.stream ? " " + c.stream : "") })

    const mapped = ((data ?? []) as any[]).map(s => ({
      id:           s.id,
      name:         s.name,
      class_id:     s.class_id,
      teacher_id:   s.teacher_id,
      class_name:   classMap[s.class_id] ?? "Unknown",
      teacher_name: s.profiles?.full_name ?? null,
    }))
    setSubjects(mapped)
  }

  async function handleAddTerm() {
    if (!termForm.name.trim()) { fireToast("Term name required."); return }
    if (!termForm.start_date || !termForm.end_date) { fireToast("Dates required."); return }
    setSaving(true)
    const { error } = await supabase.from("academic_terms").insert({
      school_id:  schoolId,
      name:       termForm.name.trim(),
      year:       parseInt(termForm.year),
      start_date: termForm.start_date,
      end_date:   termForm.end_date,
      status:     "open",
      created_at: new Date().toISOString(),
    })
    setSaving(false)
    if (error) { fireToast("Error saving term."); return }
    fireToast("Term created.")
    setShowAddTerm(false)
    setTermForm({ name: "", year: new Date().getFullYear().toString(), start_date: "", end_date: "" })
    await loadAll(schoolId)
  }

  async function handleAddSubject() {
    if (!subjectForm.name.trim()) { fireToast("Subject name required."); return }
    if (!subjectForm.class_id)    { fireToast("Select a class."); return }
    setSaving(true)
    const { error } = await supabase.from("academic_subjects").insert({
      school_id:  schoolId,
      name:       subjectForm.name.trim(),
      class_id:   subjectForm.class_id,
      teacher_id: subjectForm.teacher_id || null,
      created_at: new Date().toISOString(),
    })
    setSaving(false)
    if (error) { fireToast("Error saving subject."); return }
    fireToast("Subject added.")
    setShowAddSubject(false)
    setSubjectForm({ name: "", class_id: "", teacher_id: "" })
    await loadAll(schoolId)
  }

  async function toggleTermStatus(term: Term) {
    const next = term.status === "open" ? "locked" : "open"
    await supabase.from("academic_terms").update({ status: next }).eq("id", term.id)
    fireToast(next === "locked" ? "Term locked." : "Term reopened.")
    await loadAll(schoolId)
  }

  const activeTerm = terms.find(t => t.status === "open")
  const daysLeft   = activeTerm ? Math.ceil((new Date(activeTerm.end_date).getTime() - Date.now()) / (1000*60*60*24)) : 0

  const inp: React.CSSProperties = {
    width: "100%", borderRadius: 10, border: "1.5px solid #e5e7eb",
    padding: "11px 14px", fontSize: 14, color: dark,
    fontFamily: "inherit", outline: "none", background: "#fafafa",
    boxSizing: "border-box", marginBottom: 14,
  }
  const sel: React.CSSProperties = { ...inp, cursor: "pointer" }
  const lbl: React.CSSProperties = {
    fontSize: 11, color: "#9ca3af", fontWeight: 700,
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 5, display: "block",
  }
  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
    background: active ? dark : "transparent",
    color: active ? "#fff" : "#9ca3af",
    fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
  })

  if (loading) return (
    <div style={{ padding: 24 }}>
      <div style={{ height: 120, borderRadius: 16, background: "linear-gradient(135deg,#1e1b4b,#2d2a6e)", marginBottom: 16 }} />
      {[1,2,3].map(i => <div key={i} style={{ height: 64, borderRadius: 12, background: "#e5e7eb", marginBottom: 10 }} />)}
    </div>
  )

  return (
    <div style={{ background: bg, minHeight: "100vh", paddingBottom: 100 }}>
      <style>{`
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{transform:translateY(60px);opacity:0} to{transform:translateY(0);opacity:1} }
        * { box-sizing: border-box; }
        input::placeholder { color: #c4c4c4; }
      `}</style>

      {/* HERO */}
      <div style={{
        background: `linear-gradient(135deg, ${dark} 0%, #2d2a6e 100%)`,
        padding: "28px 20px 32px", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ position: "absolute", bottom: -20, right: 40, width: 80, height: 80, borderRadius: "50%", background: "rgba(16,185,129,0.12)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600, marginBottom: 4, letterSpacing: 0.5 }}>SCHOOL</div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: -0.5, marginBottom: 10 }}>Academics</div>
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: accent }} />
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{subjects.length} Subjects</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: violet }} />
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{classes.length} Classes</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: amber }} />
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{terms.length} Terms</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px 16px" }}>

        {/* ACTIVE TERM BANNER */}
        {activeTerm && (
          <div style={{
            background: "#fff", borderRadius: 16, padding: "16px 18px", marginBottom: 16,
            border: `1px solid ${accent}40`, borderLeft: `4px solid ${accent}`,
            boxShadow: "0 2px 12px rgba(16,185,129,0.10)", display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <div style={{ fontSize: 11, color: accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Active Term</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: dark }}>{activeTerm.name} {activeTerm.year}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                {activeTerm.start_date} → {activeTerm.end_date}
                {daysLeft > 0 && <span style={{ color: daysLeft < 14 ? red : "#6b7280", fontWeight: 600 }}> · {daysLeft}d left</span>}
              </div>
            </div>
            <button
              onClick={() => toggleTermStatus(activeTerm)}
              style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: red + "15", color: red, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
            >
              Lock Term
            </button>
          </div>
        )}

        {/* TABS */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 4, marginBottom: 16, display: "flex", gap: 4, border: "1px solid #e5e7eb" }}>
          <button onClick={() => setTab("overview")}  style={tabStyle(tab === "overview")}>Overview</button>
          <button onClick={() => setTab("terms")}     style={tabStyle(tab === "terms")}>Terms</button>
          <button onClick={() => setTab("subjects")}  style={tabStyle(tab === "subjects")}>Subjects</button>
        </div>

        {/* OVERVIEW TAB */}
        {tab === "overview" && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: dark, marginBottom: 12 }}>Classes & Subjects</div>
            {classes.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 24px", color: "#9ca3af", fontSize: 14 }}>No classes found. Add classes first.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {classes.map(c => {
                  const classSubjects = subjects.filter(s => s.class_id === c.id)
                  return (
                    <div key={c.id} style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                      <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: classSubjects.length > 0 ? "1px solid #f3f4f6" : "none" }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: dark }}>{c.name}{c.stream ? " " + c.stream : ""}</div>
                          <div style={{ fontSize: 12, color: "#9ca3af" }}>{classSubjects.length} subject{classSubjects.length !== 1 ? "s" : ""}</div>
                        </div>
                        <button
                          onClick={() => router.push(`/admin/academics/gradebook?class=${c.id}`)}
                          style={{ padding: "8px 14px", borderRadius: 10, border: "none", background: dark, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
                        >
                          Gradebook →
                        </button>
                      </div>
                      {classSubjects.length > 0 && (
                        <div style={{ padding: "10px 16px", display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {classSubjects.map(s => (
                            <div key={s.id} style={{ background: bg, borderRadius: 10, padding: "6px 12px" }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: dark }}>{s.name}</div>
                              {s.teacher_name && <div style={{ fontSize: 11, color: "#9ca3af" }}>{s.teacher_name}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* TERMS TAB */}
        {tab === "terms" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: dark }}>Academic Terms</div>
              <button onClick={() => setShowAddTerm(true)} style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: accent, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                + New Term
              </button>
            </div>
            {terms.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 24px", color: "#9ca3af", fontSize: 14 }}>No terms yet. Create your first term.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {terms.map(t => (
                  <div key={t.id} style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", border: "1px solid #e5e7eb", borderLeft: `4px solid ${t.status === "open" ? accent : "#e5e7eb"}`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: dark }}>{t.name} {t.year}</div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{t.start_date} → {t.end_date}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: t.status === "open" ? accent : "#9ca3af", background: t.status === "open" ? accent + "15" : "#f3f4f6", padding: "3px 10px", borderRadius: 20 }}>
                          {t.status === "open" ? "Open" : "Locked"}
                        </div>
                        <button
                          onClick={() => toggleTermStatus(t)}
                          style={{ fontSize: 11, fontWeight: 700, color: t.status === "open" ? red : accent, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
                        >
                          {t.status === "open" ? "Lock" : "Reopen"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SUBJECTS TAB */}
        {tab === "subjects" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: dark }}>Subjects</div>
              <button onClick={() => setShowAddSubject(true)} style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: accent, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                + Add Subject
              </button>
            </div>
            {subjects.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 24px", color: "#9ca3af", fontSize: 14 }}>No subjects yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {subjects.map(s => (
                  <div key={s.id} style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", border: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: dark }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{s.class_name}</div>
                      {s.teacher_name && <div style={{ fontSize: 11, color: accent, fontWeight: 600, marginTop: 2 }}>{s.teacher_name}</div>}
                    </div>
                    <button
                      onClick={() => router.push(`/admin/academics/gradebook?class=${s.class_id}&subject=${s.id}`)}
                      style={{ padding: "7px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", background: "#fff", color: dark, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Grades →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => tab === "subjects" ? setShowAddSubject(true) : setShowAddTerm(true)}
        style={{
          position: "fixed", bottom: 28, right: 24, width: 58, height: 58,
          borderRadius: "50%", border: "none",
          background: `linear-gradient(135deg, ${accent}, #059669)`,
          color: "#fff", fontSize: 26, cursor: "pointer", zIndex: 800,
          boxShadow: "0 6px 24px rgba(16,185,129,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >+</button>

      {/* ADD TERM MODAL */}
      {showAddTerm && (
        <div onClick={() => setShowAddTerm(false)} style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "24px 20px 48px", width: "100%", maxWidth: 640, animation: "slideUp 0.25s ease" }}>
            <div style={{ width: 40, height: 4, background: "#e5e7eb", borderRadius: 4, margin: "0 auto 20px" }} />
            <div style={{ fontSize: 18, fontWeight: 900, color: dark, marginBottom: 20 }}>New Academic Term</div>
            <span style={lbl}>Term Name</span>
            <input value={termForm.name} onChange={e => setTermForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Term 1, Semester 2" style={inp} />
            <span style={lbl}>Year</span>
            <input value={termForm.year} onChange={e => setTermForm(f => ({ ...f, year: e.target.value }))} placeholder="2025" style={inp} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <span style={lbl}>Start Date</span>
                <input type="date" value={termForm.start_date} onChange={e => setTermForm(f => ({ ...f, start_date: e.target.value }))} style={inp} />
              </div>
              <div>
                <span style={lbl}>End Date</span>
                <input type="date" value={termForm.end_date} onChange={e => setTermForm(f => ({ ...f, end_date: e.target.value }))} style={inp} />
              </div>
            </div>
            <button onClick={handleAddTerm} disabled={saving} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: saving ? "#d1d5db" : accent, color: "#fff", fontWeight: 800, fontSize: 15, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: saving ? "none" : "0 4px 14px rgba(16,185,129,0.35)" }}>
              {saving ? "Saving..." : "Create Term"}
            </button>
          </div>
        </div>
      )}

      {/* ADD SUBJECT MODAL */}
      {showAddSubject && (
        <div onClick={() => setShowAddSubject(false)} style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: "24px 24px 0 0", padding: "24px 20px 48px", width: "100%", maxWidth: 640, animation: "slideUp 0.25s ease" }}>
            <div style={{ width: 40, height: 4, background: "#e5e7eb", borderRadius: 4, margin: "0 auto 20px" }} />
            <div style={{ fontSize: 18, fontWeight: 900, color: dark, marginBottom: 20 }}>Add Subject</div>
            <span style={lbl}>Subject Name</span>
            <input value={subjectForm.name} onChange={e => setSubjectForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Mathematics, English, Science" style={inp} />
            <span style={lbl}>Class</span>
            <select value={subjectForm.class_id} onChange={e => setSubjectForm(f => ({ ...f, class_id: e.target.value }))} style={sel}>
              <option value="">Select class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}{c.stream ? " " + c.stream : ""}</option>)}
            </select>
            <span style={lbl}>Assign Teacher (optional)</span>
            <select value={subjectForm.teacher_id} onChange={e => setSubjectForm(f => ({ ...f, teacher_id: e.target.value }))} style={sel}>
              <option value="">No teacher assigned</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
            <button onClick={handleAddSubject} disabled={saving} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: saving ? "#d1d5db" : accent, color: "#fff", fontWeight: 800, fontSize: 15, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: saving ? "none" : "0 4px 14px rgba(16,185,129,0.35)" }}>
              {saving ? "Saving..." : "Add Subject"}
            </button>
          </div>
        </div>
      )}

      <Toast msg={toast} />
    </div>
  )
}
