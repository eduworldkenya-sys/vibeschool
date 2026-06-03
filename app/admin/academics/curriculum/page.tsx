"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

// ── DESIGN TOKENS (exact app colors) ──────────────────────────
const C = {
  bg:            "#f8fafc",
  surface:       "#ffffff",
  surface2:      "#f1f5f9",
  border:        "#e2e8f0",
  border2:       "#cbd5e1",
  text:          "#1e293b",
  text2:         "#64748b",
  text3:         "#94a3b8",
  headerBg:      "#1e2246",
  heroFrom:      "#3730a3",
  heroTo:        "#4338ca",
  teal:          "#0d9488",
  tealLight:     "#ccfbf1",
  tealMid:       "#14b8a6",
  indigo:        "#4f46e5",
  indigoLight:   "#e0e7ff",
  green:         "#16a34a",
  greenLight:    "#dcfce7",
  amber:         "#d97706",
  amberLight:    "#fef3c7",
  red:           "#e11d48",
  redLight:      "#ffe4e6",
  shadowSm:      "0 1px 3px rgba(0,0,0,0.08)",
  shadowMd:      "0 4px 16px rgba(0,0,0,0.08)",
} as const

// ── INTERFACES ─────────────────────────────────────────────────
interface ClassRow    { id: string; name: string; stream: string | null }
interface SchemeRow   {
  class_id: string; subject: string; strand: string
  sub_strand: string; topic: string; status: string
  week: number; term: number; academic_year: number
}
interface CurriculumRow {
  grade: string; subject: string; strand: string
  sub_strand: string; topic: string; week: number; term: number
}
interface Term {
  id: string; name: string; term: number; academic_year: number
  start_date: string; end_date: string; status: string
}

// ── HELPERS ────────────────────────────────────────────────────
const CBC_GRADES = ["PP1","PP2","Grade 1","Grade 2","Grade 3"]
function isCBC(name: string) {
  return CBC_GRADES.some(g => name.startsWith(g))
}

// Fixed: derive total weeks from term dates, fallback to 13
function totalWeeks(term: Term): number {
  const start = new Date(term.start_date)
  const end   = new Date(term.end_date)
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 13
  const weeks = Math.round((end.getTime() - start.getTime()) / (1000*60*60*24*7))
  return Math.max(1, weeks)
}

// Fixed: guard against future/malformed start dates
function currentWeekOf(term: Term): number {
  const start = new Date(term.start_date)
  if (isNaN(start.getTime())) return 1
  const now  = Date.now()
  if (now < start.getTime()) return 1
  const diff = Math.floor((now - start.getTime()) / (1000*60*60*24*7))
  return Math.max(1, Math.min(diff + 1, totalWeeks(term)))
}

// Fixed: weeklyStatus logic was inverted — behind means truly behind
function weeklyStatus(pct: number, expectedPct: number): "ahead" | "ontrack" | "behind" {
  if (pct >= expectedPct)        return "ontrack"
  if (pct >= expectedPct - 15)   return "behind"
  return "behind" // severely behind is still behind, never "ahead"
}

function weekCoverageLevel(pct: number): "full" | "partial" | "empty" {
  if (pct >= 80) return "full"
  if (pct > 0)   return "partial"
  return "empty"
}

// ── TOAST ──────────────────────────────────────────────────────
function Toast({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div style={{
      position:    "fixed",
      bottom:      90,
      left:        "50%",
      transform:   "translateX(-50%)",
      background:  C.text,
      color:       "#fff",
      padding:     "12px 24px",
      borderRadius: 40,
      fontSize:    13,
      fontWeight:  700,
      zIndex:      9999,
      whiteSpace:  "nowrap",
      boxShadow:   "0 4px 24px rgba(0,0,0,0.25)",
    }}>{msg}</div>
  )
}

// ── COVERAGE PILL ──────────────────────────────────────────────
function CoveragePill({ pct }: { pct: number }) {
  const color = pct >= 80 ? C.teal : pct >= 50 ? C.amber : C.red
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        flex: 1, height: 5,
        background: C.border,
        borderRadius: 99, overflow: "hidden",
      }}>
        <div style={{
          width:      `${pct}%`,
          height:     "100%",
          background: color,
          borderRadius: 99,
          transition: "width 0.5s ease",
        }} />
      </div>
      <div style={{
        fontSize:   12,
        fontWeight: 800,
        color,
        fontFamily: "monospace",
        minWidth:   36,
        textAlign:  "right",
      }}>{pct}%</div>
    </div>
  )
}

// ── SKELETON ───────────────────────────────────────────────────
function Skeleton({ h, mb = 10, radius = 12 }: { h: number; mb?: number; radius?: number }) {
  return (
    <div style={{
      height:       h,
      borderRadius: radius,
      background:   "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)",
      backgroundSize: "200% 100%",
      animation:    "shimmer 1.4s infinite",
      marginBottom: mb,
    }} />
  )
}

// ── STATUS BADGE ───────────────────────────────────────────────
function StatusBadge({ status }: { status: "ahead" | "ontrack" | "behind" }) {
  const map = {
    ontrack: { label: "On track", color: C.teal,  bg: C.tealLight  },
    behind:  { label: "Behind",   color: C.amber, bg: C.amberLight },
    ahead:   { label: "Ahead",    color: C.green, bg: C.greenLight },
  }
  const s = map[status]
  return (
    <div style={{
      fontSize:     11,
      fontWeight:   700,
      color:        s.color,
      background:   s.bg,
      padding:      "3px 10px",
      borderRadius: 20,
    }}>{s.label}</div>
  )
}

// ── EMPTY STATE ────────────────────────────────────────────────
function EmptyState({
  icon, title, desc, action
}: {
  icon: string; title: string; desc: string; action?: React.ReactNode
}) {
  return (
    <div style={{
      textAlign:    "center",
      padding:      "40px 24px",
      background:   C.surface,
      borderRadius: 16,
      border:       `1.5px dashed ${C.border2}`,
    }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <div style={{
        fontSize:   15,
        fontWeight: 800,
        color:      C.text,
        marginBottom: 6,
      }}>{title}</div>
      <div style={{
        fontSize:   13,
        color:      C.text3,
        lineHeight: 1.6,
        maxWidth:   260,
        margin:     "0 auto",
      }}>{desc}</div>
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  )
}

// ── WEEK GRID ──────────────────────────────────────────────────
function WeekGrid({
  totalWks, currentWk, weekCoverage, selectedWeek, onSelect
}: {
  totalWks:     number
  currentWk:    number
  weekCoverage: Record<number, number>
  selectedWeek: number | null
  onSelect:     (w: number) => void
}) {
  return (
    <div>
      <div style={{
        display:             "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap:                 6,
        marginBottom:        10,
      }}>
        {Array.from({ length: totalWks }, (_, i) => i + 1).map(w => {
          const pct     = weekCoverage[w] ?? 0
          const level   = weekCoverageLevel(pct)
          const active  = selectedWeek === w
          const current = currentWk === w

          const dotColor =
            level === "full"    ? C.teal  :
            level === "partial" ? C.amber : C.border2

          return (
            <div
              key={w}
              onClick={() => onSelect(w)}
              style={{
                aspectRatio:    "1",
                borderRadius:   10,
                display:        "flex",
                flexDirection:  "column",
                alignItems:     "center",
                justifyContent: "center",
                gap:            3,
                cursor:         "pointer",
                border:         active
                  ? `2px solid ${C.indigo}`
                  : current
                  ? `2px solid ${C.teal}`
                  : `1.5px solid ${C.border}`,
                background:     active
                  ? C.indigoLight
                  : current
                  ? C.tealLight
                  : C.surface2,
                transition:     "all 0.15s ease",
              }}
            >
              <div style={{
                fontSize:   10,
                fontWeight: 800,
                color:      active ? C.indigo : current ? C.teal : C.text2,
              }}>W{w}</div>
              <div style={{
                width:        5,
                height:       5,
                borderRadius: "50%",
                background:   active || current ? dotColor : dotColor,
                boxShadow:    level !== "empty"
                  ? `0 0 4px ${dotColor}`
                  : "none",
              }} />
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {[
          { color: C.teal,   label: "Covered"     },
          { color: C.amber,  label: "Partial"      },
          { color: C.border2,label: "Not started"  },
        ].map(l => (
          <div key={l.label} style={{
            display:    "flex",
            alignItems: "center",
            gap:        5,
            fontSize:   10,
            color:      C.text3,
            fontWeight: 500,
          }}>
            <div style={{
              width:        6,
              height:       6,
              borderRadius: "50%",
              background:   l.color,
              boxShadow:    l.color !== C.border2 ? `0 0 4px ${l.color}` : "none",
            }} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── STRAND CARDS ───────────────────────────────────────────────
function StrandCards({
  cls, subject, schemes, curriculum, week, term: termNum
}: {
  cls:        ClassRow
  subject:    string
  schemes:    SchemeRow[]
  curriculum: CurriculumRow[]
  week:       number
  term:       number
}) {
  const weekTopics = curriculum.filter(c =>
    c.grade === cls.name &&
    c.subject === subject &&
    c.week === week &&
    c.term === termNum
  )

  const strands = Array.from(new Set(weekTopics.map(t => t.strand)))

  if (strands.length === 0) {
    return (
      <EmptyState
        icon="📭"
        title="No strands yet"
        desc={`Week ${week} hasn't been set up for ${subject}. Add strands or copy from a previous week.`}
        action={
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button style={{
              padding:      "9px 18px",
              background:   `linear-gradient(135deg, ${C.indigo}, #6366f1)`,
              color:        "#fff",
              border:       "none",
              borderRadius: 12,
              fontSize:     13,
              fontWeight:   700,
              cursor:       "pointer",
            }}>+ Add Strands</button>
            {week > 1 && (
              <button style={{
                padding:      "9px 18px",
                background:   C.surface2,
                color:        C.text2,
                border:       `1.5px solid ${C.border2}`,
                borderRadius: 12,
                fontSize:     13,
                fontWeight:   700,
                cursor:       "pointer",
              }}>Copy W{week - 1}</button>
            )}
          </div>
        }
      />
    )
  }

  const accentColors = [C.indigo, C.teal, C.amber, C.green, C.red]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {strands.map((strand, si) => {
        const strandTopics = weekTopics.filter(t => t.strand === strand)
        const delivered    = strandTopics.filter(t =>
          schemes.some(s =>
            s.class_id === cls.id &&
            s.topic    === t.topic &&
            s.status   === "delivered"
          )
        ).length
        const total  = strandTopics.length
        const pct    = total > 0 ? Math.round((delivered / total) * 100) : 0
        const color  = accentColors[si % accentColors.length]

        const badge =
          pct === 100 ? { label: "Done",        bg: C.tealLight,  color: C.teal  } :
          pct > 0     ? { label: "In Progress",  bg: C.amberLight, color: C.amber } :
                        { label: "Not Started",  bg: C.surface2,   color: C.text3 }

        return (
          <div key={strand} style={{
            background:   C.surface,
            borderRadius: 14,
            border:       `1px solid ${C.border}`,
            padding:      "14px 16px",
            display:      "flex",
            alignItems:   "center",
            gap:          12,
            boxShadow:    C.shadowSm,
            position:     "relative",
            overflow:     "hidden",
          }}>
            {/* Left accent bar */}
            <div style={{
              position:     "absolute",
              left:         0, top: 0, bottom: 0,
              width:        3,
              background:   color,
              borderRadius: "0 2px 2px 0",
            }} />

            <div style={{
              width:          38,
              height:         38,
              borderRadius:   11,
              background:     color + "18",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              fontSize:       17,
              flexShrink:     0,
            }}>📚</div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize:     13,
                fontWeight:   800,
                color:        C.text,
                marginBottom: 2,
                whiteSpace:   "nowrap",
                overflow:     "hidden",
                textOverflow: "ellipsis",
              }}>{strand}</div>
              <div style={{ fontSize: 11, color: C.text3 }}>
                {total} topic{total !== 1 ? "s" : ""} · {delivered} delivered
              </div>
              <div style={{ marginTop: 6 }}>
                <CoveragePill pct={pct} />
              </div>
            </div>

            <div style={{
              fontSize:     11,
              fontWeight:   700,
              color:        badge.color,
              background:   badge.bg,
              padding:      "3px 9px",
              borderRadius: 99,
              flexShrink:   0,
              border:       `1px solid ${badge.color}22`,
            }}>{badge.label}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── MAIN PAGE ──────────────────────────────────────────────────
export default function CurriculumPage() {
  const router = useRouter()

  const [schoolId,      setSchoolId]      = useState("")
  const [loading,       setLoading]       = useState(true)
  const [toast,         setToast]         = useState("")
  const [term,          setTerm]          = useState<Term | null>(null)
  const [classes,       setClasses]       = useState<ClassRow[]>([])
  const [schemes,       setSchemes]       = useState<SchemeRow[]>([])
  const [curriculum,    setCurriculum]    = useState<CurriculumRow[]>([])
  const [selectedClass, setSelectedClass] = useState<string>("all")
  const [expandedClass, setExpandedClass] = useState<string | null>(null)
  const [selectedWeek,  setSelectedWeek]  = useState<number | null>(null)
  const [activeSubject, setActiveSubject] = useState<string | null>(null)

  const fireToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(""), 3000)
  }, [])

  const bootstrap = useCallback(async () => {
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

      const [termRes, classRes] = await Promise.all([
        supabase
          .from("academic_terms")
          .select("id,name,term,academic_year,start_date,end_date,status")
          .eq("school_id", p.school_id)
          .eq("status", "active")
          .single(),
        supabase
          .from("classes")
          .select("id,name,stream")
          .eq("school_id", p.school_id)
          .order("name"),
      ])

      const activeTerm = termRes.data as Term | null
      const classList  = (classRes.data ?? []) as ClassRow[]

      setTerm(activeTerm)
      setClasses(classList)

      if (!activeTerm || !classList.length) { setLoading(false); return }

      // Set default week to current
      const curWeek = currentWeekOf(activeTerm)
      setSelectedWeek(curWeek)

      const grades = Array.from(new Set(classList.map(c => c.name)))

      const [schemeRes, currRes] = await Promise.all([
        supabase
          .from("scheme_of_work")
          .select("class_id,subject,strand,sub_strand,topic,status,week,term,academic_year")
          .eq("school_id", p.school_id)
          .eq("term", activeTerm.term)
          .eq("academic_year", activeTerm.academic_year),
        supabase
          .from("curriculum")
          .select("grade,subject,strand,sub_strand,topic,week,term")
          .eq("term", activeTerm.term)
          .in("grade", grades),
      ])

      setSchemes((schemeRes.data  ?? []) as SchemeRow[])
      setCurriculum((currRes.data ?? []) as CurriculumRow[])
    } catch {
      fireToast("Failed to load curriculum data.")
    } finally {
      setLoading(false)
    }
  }, [router, fireToast])

  useEffect(() => { bootstrap() }, [bootstrap])

  // ── Memoized coverage calculations ────────────────────────────
  const classCoverageMap = useMemo(() => {
    const map: Record<string, {
      subjects:     string[]
      delivered:    number
      total:        number
      pct:          number
      status:       "ahead" | "ontrack" | "behind"
      weekCoverage: Record<number, number>
    }> = {}

    for (const cls of classes) {
      const kicdTopics    = curriculum.filter(c => c.grade === cls.name)
      const schemeRows    = schemes.filter(s => s.class_id === cls.id)
      const deliveredRows = schemeRows.filter(s => s.status === "delivered")
      const subjects      = Array.from(new Set(kicdTopics.map(k => k.subject)))
      const total         = kicdTopics.length
      const delivered     = deliveredRows.length
      const pct           = total > 0 ? Math.round((delivered / total) * 100) : 0

      const curWeek       = term ? currentWeekOf(term) : 0
      const totWks        = term ? totalWeeks(term) : 13
      const expectedPct   = Math.round((curWeek / totWks) * 100)
      const status        = weeklyStatus(pct, expectedPct)

      // Per-week coverage
      const weekCoverage: Record<number, number> = {}
      const totWksArr = Array.from({ length: totWks }, (_, i) => i + 1)
      for (const w of totWksArr) {
        const weekTopics    = kicdTopics.filter(k => k.week === w)
        const weekDelivered = weekTopics.filter(k =>
          schemeRows.some(s => s.topic === k.topic && s.status === "delivered")
        ).length
        weekCoverage[w] = weekTopics.length > 0
          ? Math.round((weekDelivered / weekTopics.length) * 100)
          : 0
      }

      map[cls.id] = { subjects, delivered, total, pct, status, weekCoverage }
    }

    return map
  }, [classes, curriculum, schemes, term])

  const subjectCoverageMap = useMemo(() => {
    const map: Record<string, Record<string, {
      delivered: number; total: number; pct: number
    }>> = {}

    for (const cls of classes) {
      map[cls.id] = {}
      const kicdTopics = curriculum.filter(c => c.grade === cls.name)
      const schemeRows = schemes.filter(s => s.class_id === cls.id)
      const subjects   = Array.from(new Set(kicdTopics.map(k => k.subject)))

      for (const subject of subjects) {
        const subTopics  = kicdTopics.filter(k => k.subject === subject)
        const delivered  = subTopics.filter(k =>
          schemeRows.some(s => s.topic === k.topic && s.status === "delivered")
        ).length
        const total = subTopics.length
        const pct   = total > 0 ? Math.round((delivered / total) * 100) : 0
        map[cls.id][subject] = { delivered, total, pct }
      }
    }

    return map
  }, [classes, curriculum, schemes])

  // ── Derived values ─────────────────────────────────────────────
  const curWeek   = term ? currentWeekOf(term) : 0
  const totWks    = term ? totalWeeks(term) : 13
  const weekPct   = Math.round((curWeek / totWks) * 100)

  const filteredClasses = useMemo(() =>
    selectedClass === "all"
      ? classes
      : classes.filter(c => c.id === selectedClass),
    [classes, selectedClass]
  )

  const { overallPct } = useMemo(() => {
    const delivered = filteredClasses.reduce((s, c) => s + (classCoverageMap[c.id]?.delivered ?? 0), 0)
    const total     = filteredClasses.reduce((s, c) => s + (classCoverageMap[c.id]?.total     ?? 0), 0)
    return { overallPct: total > 0 ? Math.round((delivered / total) * 100) : 0 }
  }, [filteredClasses, classCoverageMap])

  // ── Loading state ──────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding: 20 }}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>
      <Skeleton h={140} mb={16} radius={20} />
      <Skeleton h={44}  mb={10} />
      {[1,2,3].map(i => <Skeleton key={i} h={88} mb={10} />)}
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div style={{
      background:  C.bg,
      minHeight:   "100vh",
      paddingBottom: 100,
      fontFamily:  "'Inter', -apple-system, sans-serif",
    }}>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
        .chip:hover  { opacity: 0.85; transform: translateY(-1px); }
        .card:hover  { box-shadow: 0 6px 24px rgba(0,0,0,0.09) !important; }
        .btn:hover   { opacity: 0.9; transform: translateY(-1px); }
        .row:active  { background: ${C.surface2} !important; }
      `}</style>

      {/* ── HERO ── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.heroFrom} 0%, ${C.heroTo} 100%)`,
        padding:    "24px 20px 28px",
        position:   "relative",
        overflow:   "hidden",
      }}>
        {/* Decorative circles */}
        <div style={{
          position:     "absolute",
          top: -50, right: -50,
          width:        160, height: 160,
          borderRadius: "50%",
          background:   "rgba(255,255,255,0.06)",
        }} />
        <div style={{
          position:     "absolute",
          bottom: -40, left: 20,
          width:        100, height: 100,
          borderRadius: "50%",
          background:   "rgba(255,255,255,0.04)",
        }} />

        <div
          onClick={() => router.push("/admin/academics")}
          style={{
            fontSize:      12,
            color:         "rgba(255,255,255,0.5)",
            fontWeight:    700,
            letterSpacing: 1,
            textTransform: "uppercase",
            marginBottom:  6,
            cursor:        "pointer",
            display:       "inline-flex",
            alignItems:    "center",
            gap:           4,
          }}
        >‹ Academics</div>

        <div style={{
          fontSize:     11,
          fontWeight:   600,
          letterSpacing: 2,
          color:        "rgba(255,255,255,0.5)",
          textTransform: "uppercase",
          marginBottom:  4,
        }}>Scheme of Work</div>

        <div style={{
          fontSize:     24,
          fontWeight:   900,
          color:        "#fff",
          letterSpacing: -0.5,
          lineHeight:   1.15,
        }}>Curriculum Tracker</div>

        <div style={{
          fontSize:   13,
          color:      "rgba(255,255,255,0.6)",
          marginTop:  5,
          lineHeight: 1.5,
        }}>
          {term
            ? `${term.name} ${term.academic_year} · Week ${curWeek} of ${totWks}`
            : "No active term"}
        </div>

        {term && (
          <div style={{ marginTop: 18, position: "relative", zIndex: 1 }}>
            <div style={{
              display:        "flex",
              justifyContent: "space-between",
              alignItems:     "center",
              marginBottom:   8,
            }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>
                School coverage · expected {weekPct}%
              </div>
              <div style={{
                fontSize:   13,
                fontWeight: 900,
                color:      overallPct >= weekPct ? "#5eead4" : "#fca5a5",
              }}>{overallPct}%</div>
            </div>

            <div style={{
              height:       6,
              background:   "rgba(255,255,255,0.15)",
              borderRadius: 99,
              overflow:     "hidden",
              position:     "relative",
            }}>
              {/* Expected marker */}
              <div style={{
                position:   "absolute",
                left:       `${weekPct}%`,
                top:        0, bottom: 0,
                width:      2,
                background: "rgba(255,255,255,0.4)",
              }} />
              <div style={{
                height:     "100%",
                width:      `${overallPct}%`,
                background: overallPct >= weekPct
                  ? "linear-gradient(90deg, #0d9488, #5eead4)"
                  : "linear-gradient(90deg, #e11d48, #fca5a5)",
                borderRadius: 99,
                transition: "width 0.6s ease",
              }} />
            </div>

            <div style={{
              marginTop: 5,
              fontSize:  10,
              color:     "rgba(255,255,255,0.3)",
            }}>White line = where you should be today ({weekPct}%)</div>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px" }}>

        {/* ── CLASS FILTER ── */}
        <div style={{ marginBottom: 14 }}>
          <select
            value={selectedClass}
            onChange={e => {
              setSelectedClass(e.target.value)
              setExpandedClass(null)
              setActiveSubject(null)
            }}
            style={{
              width:        "100%",
              border:       `1.5px solid ${C.border}`,
              borderRadius: 12,
              padding:      "12px 14px",
              fontSize:     13,
              color:        C.text,
              fontFamily:   "inherit",
              outline:      "none",
              background:   C.surface,
              fontWeight:   600,
              cursor:       "pointer",
              appearance:   "none",
              boxShadow:    C.shadowSm,
            }}
          >
            <option value="all">All Classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.stream ? " " + c.stream : ""}
              </option>
            ))}
          </select>
        </div>

        {/* ── NO TERM ── */}
        {!term ? (
          <EmptyState
            icon="📅"
            title="No Active Term"
            desc="Go to Settings to activate a term before tracking curriculum."
          />
        ) : filteredClasses.length === 0 ? (
          <EmptyState
            icon="🏫"
            title="No Classes Found"
            desc="Add classes in Settings to start tracking curriculum coverage."
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredClasses.map(cls => {
              const cov      = classCoverageMap[cls.id]
              const subMap   = subjectCoverageMap[cls.id] ?? {}
              const expanded = expandedClass === cls.id
              if (!cov) return null

              return (
                <div
                  key={cls.id}
                  className="card"
                  style={{
                    background:   C.surface,
                    borderRadius: 16,
                    border:       `1px solid ${C.border}`,
                    overflow:     "hidden",
                    boxShadow:    C.shadowSm,
                    transition:   "box-shadow 0.2s ease",
                  }}
                >
                  {/* Class header row */}
                  <div
                    className="row"
                    onClick={() => {
                      setExpandedClass(expanded ? null : cls.id)
                      setActiveSubject(null)
                    }}
                    style={{
                      padding:    "16px",
                      cursor:     "pointer",
                      background: C.surface,
                    }}
                  >
                    <div style={{
                      display:        "flex",
                      justifyContent: "space-between",
                      alignItems:     "flex-start",
                      marginBottom:   12,
                    }}>
                      <div>
                        <div style={{
                          fontSize:   15,
                          fontWeight: 800,
                          color:      C.text,
                        }}>
                          {cls.name}{cls.stream ? " " + cls.stream : ""}
                        </div>
                        <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>
                          {isCBC(cls.name) ? "CBC · Rubric" : "Traditional · Marks"}
                          {" · "}{cov.subjects.length} subject{cov.subjects.length !== 1 ? "s" : ""}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <StatusBadge status={cov.status} />
                        <div style={{
                          fontSize:   18,
                          color:      C.border2,
                          transform:  expanded ? "rotate(90deg)" : "none",
                          transition: "transform 0.2s ease",
                        }}>›</div>
                      </div>
                    </div>

                    <CoveragePill pct={cov.pct} />
                    <div style={{ fontSize: 11, color: C.text3, marginTop: 5 }}>
                      {cov.total === 0
                        ? "No KICD topics loaded for this grade yet"
                        : `${cov.delivered} of ${cov.total} topics delivered`}
                    </div>
                  </div>

                  {/* Expanded section */}
                  {expanded && (
                    <div style={{ borderTop: `1px solid ${C.border}` }}>

                      {cov.subjects.length === 0 ? (
                        <div style={{ padding: "20px 16px" }}>
                          <EmptyState
                            icon="📖"
                            title="No KICD topics found"
                            desc="Teachers can still submit schemes — coverage tracking activates when KICD data is loaded."
                          />
                        </div>
                      ) : (
                        <div>
                          {/* Subject tabs */}
                          <div style={{
                            display:    "flex",
                            gap:        6,
                            padding:    "12px 16px",
                            overflowX:  "auto",
                            background: C.surface2,
                            borderBottom: `1px solid ${C.border}`,
                          }}>
                            {cov.subjects.map(subject => {
                              const sub    = subMap[subject]
                              const isActive = activeSubject === subject ||
                                (!activeSubject && subject === cov.subjects[0])

                              return (
                                <div
                                  key={subject}
                                  className="chip"
                                  onClick={() => setActiveSubject(subject)}
                                  style={{
                                    padding:      "6px 14px",
                                    borderRadius: 99,
                                    fontSize:     12,
                                    fontWeight:   700,
                                    cursor:       "pointer",
                                    whiteSpace:   "nowrap",
                                    transition:   "all 0.15s ease",
                                    flexShrink:   0,
                                    background:   isActive ? C.indigo : C.surface,
                                    color:        isActive ? "#fff" : C.text2,
                                    border:       `1.5px solid ${isActive ? C.indigo : C.border}`,
                                    boxShadow:    isActive ? `0 2px 8px ${C.indigo}33` : "none",
                                  }}
                                >
                                  {subject}
                                  {sub && (
                                    <span style={{
                                      marginLeft:   6,
                                      fontSize:     10,
                                      opacity:      0.75,
                                      fontWeight:   600,
                                    }}>{sub.pct}%</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>

                          {/* Week grid */}
                          <div style={{
                            padding:      "14px 16px",
                            borderBottom: `1px solid ${C.border}`,
                            background:   C.surface,
                          }}>
                            <div style={{
                              fontSize:     11,
                              fontWeight:   700,
                              color:        C.text3,
                              letterSpacing: 1,
                              textTransform: "uppercase",
                              marginBottom:  10,
                            }}>Week Coverage</div>
                            <WeekGrid
                              totalWks={totWks}
                              currentWk={curWeek}
                              weekCoverage={cov.weekCoverage}
                              selectedWeek={selectedWeek}
                              onSelect={setSelectedWeek}
                            />
                          </div>

                          {/* Strand cards */}
                          <div style={{ padding: "14px 16px" }}>
                            <div style={{
                              display:        "flex",
                              justifyContent: "space-between",
                              alignItems:     "center",
                              marginBottom:   12,
                            }}>
                              <div style={{
                                fontSize:      11,
                                fontWeight:    700,
                                color:         C.text3,
                                letterSpacing: 1,
                                textTransform: "uppercase",
                              }}>
                                Strands — Week {selectedWeek ?? curWeek}
                              </div>
                            </div>

                            <StrandCards
                              cls={cls}
                              subject={
                                activeSubject && cov.subjects.includes(activeSubject)
                                  ? activeSubject
                                  : cov.subjects[0]
                              }
                              schemes={schemes}
                              curriculum={curriculum}
                              week={selectedWeek ?? curWeek}
                              term={term?.term ?? 1}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Toast msg={toast} />
    </div>
  )
}
