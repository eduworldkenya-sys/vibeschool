"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useRouter } from "next/navigation"
import { useStudent } from "@/lib/student-context"
import {
  getPersonalizedLearningPath,
  type StudentLearningRecommendation,
  type StudentPersonalizedPath,
  type StudentSubjectProgress,
  type StudentTask,
} from "@/lib/student/tasks"
import VibeTwin from "@/components/student/VibeTwin"

type WorkspaceView = "home" | "ask"

interface TwinWorkspaceContextValue {
  isOpen: boolean
  openTwin: (view?: WorkspaceView) => void
  closeTwin: () => void
  refreshTwin: () => Promise<void>
}

const TwinWorkspaceContext = createContext<TwinWorkspaceContextValue | null>(null)

export function useTwinWorkspace() {
  const value = useContext(TwinWorkspaceContext)
  if (!value) throw new Error("useTwinWorkspace must be used inside TwinWorkspaceProvider")
  return value
}

function dueLabel(value: string | null): string | null {
  if (!value) return null
  const due = new Date(value)
  if (Number.isNaN(due.getTime())) return null
  const now = new Date()
  const diffMs = due.getTime() - now.getTime()
  const diffHours = Math.round(diffMs / 3_600_000)
  if (diffHours < 0) return "Overdue"
  if (diffHours < 24) return diffHours <= 1 ? "Due soon" : `Due in ${diffHours}h`
  const diffDays = Math.ceil(diffHours / 24)
  return diffDays === 1 ? "Due tomorrow" : `Due in ${diffDays} days`
}

function missionReason(task: StudentTask | null): string {
  if (!task) return "Twin will choose from your verified learning evidence when a task or recommendation is available."
  if (task.status === "overdue") return "This task is overdue, so Twin puts it first."
  if (task.status === "returned") return "Your teacher returned this work for revision, so it needs attention before new work."
  if (task.status === "in_progress") return "You already started this task. Finishing active work protects momentum."
  if (task.priority === "urgent") return "This is currently your most urgent assigned learning obligation."
  if (task.priority === "high") return "This assigned task has a high priority in your verified task queue."
  const due = dueLabel(task.dueAt)
  if (due) return `${due}. Twin prioritises assigned work before optional gap practice.`
  return "This is the highest-ranked active task in your verified learner queue."
}

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <h3 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.1, color: "var(--vs-muted)", fontWeight: 800 }}>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}

const cardStyle: React.CSSProperties = {
  border: "1px solid var(--vs-border)",
  background: "var(--vs-card)",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 8px 24px rgba(15,15,26,0.08)",
}

function ProgressCard({ progress }: { progress: StudentSubjectProgress[] }) {
  const ranked = [...progress]
    .filter(item => item.totalTasks > 0 || item.masteryPercentage !== null || item.averageScore !== null)
    .sort((a, b) => (b.masteryPercentage ?? b.averageScore ?? 0) - (a.masteryPercentage ?? a.averageScore ?? 0))
    .slice(0, 3)

  if (ranked.length === 0) {
    return <div style={{ ...cardStyle, color: "var(--vs-muted)", fontSize: 13, lineHeight: 1.55 }}>Progress appears here as verified tasks and assessments produce evidence.</div>
  }

  return (
    <div style={{ ...cardStyle, display: "grid", gap: 12 }}>
      {ranked.map(item => {
        const value = Math.max(0, Math.min(100, Math.round(item.masteryPercentage ?? item.averageScore ?? 0)))
        return (
          <div key={item.subjectId || item.subjectName}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 750, color: "var(--vs-text)" }}>{item.subjectName}</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: "var(--vs-accent)" }}>{value}%</span>
            </div>
            <div style={{ height: 7, borderRadius: 999, overflow: "hidden", background: "var(--vs-accent-soft)" }}>
              <div style={{ width: `${value}%`, height: "100%", borderRadius: 999, background: "var(--vs-accent)" }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RecommendationCard({ recommendation }: { recommendation: StudentLearningRecommendation | null }) {
  if (!recommendation) {
    return <div style={{ ...cardStyle, color: "var(--vs-muted)", fontSize: 13, lineHeight: 1.55 }}>No optional gap-practice recommendation is active yet. Assigned work remains your priority.</div>
  }

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--vs-text)", lineHeight: 1.4 }}>{recommendation.title}</div>
      <div style={{ marginTop: 6, fontSize: 12, color: "var(--vs-muted)", lineHeight: 1.55 }}>{recommendation.reason}</div>
    </div>
  )
}

function TwinWorkspaceDrawer({
  isOpen,
  onClose,
  onAsk,
  loading,
  error,
  path,
  onRefresh,
}: {
  isOpen: boolean
  onClose: () => void
  onAsk: () => void
  loading: boolean
  error: string | null
  path: StudentPersonalizedPath | null
  onRefresh: () => Promise<void>
}) {
  const { identity } = useStudent()
  const router = useRouter()
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const mission = path?.nextMission ?? path?.motivation.nextMission ?? null
  const recommendation = path?.recommendations[0] ?? null
  const goal = path?.motivation.dailyGoal
  const upcoming = path?.motivation.nextMission && path.motivation.nextMission.taskId !== mission?.taskId
    ? path.motivation.nextMission
    : null

  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    const timer = window.setTimeout(() => closeRef.current?.focus(), 0)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const startMission = () => {
    if (!mission?.actionUrl) return
    onClose()
    router.push(mission.actionUrl)
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9000 }}>
      <button
        aria-label="Close VibeTwin workspace"
        onClick={onClose}
        style={{ position: "absolute", inset: 0, border: 0, background: "rgba(15,15,26,0.58)", cursor: "default" }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-twin-title"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(430px, 100vw)",
          background: "var(--vs-bg)",
          color: "var(--vs-text)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-20px 0 60px rgba(15,15,26,0.28)",
          animation: "studentTwinIn 220ms ease-out",
        }}
      >
        <header style={{ padding: "18px 18px 14px", borderBottom: "1px solid var(--vs-border)", background: "var(--vs-surface)", display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: 13, background: "var(--vs-accent)", color: "white", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 19, flexShrink: 0 }}>✦</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div id="student-twin-title" style={{ fontSize: 17, fontWeight: 900 }}>VibeTwin</div>
            <div style={{ color: "var(--vs-muted)", fontSize: 11, marginTop: 2 }}>
              {identity?.firstName ? `${identity.firstName}'s learning workspace` : "Your learning workspace"}
            </div>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close VibeTwin"
            style={{ width: 44, height: 44, borderRadius: 14, border: "1px solid var(--vs-border)", background: "var(--vs-card)", color: "var(--vs-text)", cursor: "pointer", fontSize: 20 }}
          >
            ×
          </button>
        </header>

        <div style={{ overflowY: "auto", padding: "16px 16px calc(28px + env(safe-area-inset-bottom))" }}>
          {loading && !path ? (
            <div style={{ ...cardStyle, textAlign: "center", color: "var(--vs-muted)", fontSize: 13 }}>Building your current learning brief…</div>
          ) : error && !path ? (
            <div style={{ ...cardStyle }}>
              <div style={{ fontSize: 13, color: "var(--vs-error)", lineHeight: 1.5 }}>{error}</div>
              <button onClick={() => void onRefresh()} style={{ marginTop: 12, border: 0, borderRadius: 10, padding: "9px 12px", background: "var(--vs-accent)", color: "white", fontWeight: 800, cursor: "pointer" }}>Try again</button>
            </div>
          ) : (
            <>
              <Section title="Today's mission">
                <div style={{ ...cardStyle, background: "linear-gradient(135deg, var(--vs-accent-soft), var(--vs-card))" }}>
                  {mission ? (
                    <>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: .8, color: "var(--vs-accent)" }}>{mission.subject}</span>
                        {dueLabel(mission.dueAt) && <span style={{ fontSize: 10, color: mission.status === "overdue" ? "var(--vs-error)" : "var(--vs-muted)", fontWeight: 750 }}>{dueLabel(mission.dueAt)}</span>}
                      </div>
                      <div style={{ fontSize: 17, lineHeight: 1.35, fontWeight: 900 }}>{mission.title}</div>
                      <div style={{ marginTop: 7, color: "var(--vs-muted)", fontSize: 12 }}>{mission.actionLabel}</div>
                      <button onClick={startMission} style={{ width: "100%", marginTop: 14, border: 0, borderRadius: 12, padding: "12px 14px", background: "var(--vs-accent)", color: "white", fontWeight: 900, cursor: "pointer" }}>Start now →</button>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 15, fontWeight: 850 }}>You're clear for now.</div>
                      <div style={{ marginTop: 6, color: "var(--vs-muted)", fontSize: 12, lineHeight: 1.5 }}>No active assigned task is currently ranked as your next mission.</div>
                      <button onClick={() => { onClose(); router.push("/student/vibelearn") }} style={{ marginTop: 12, border: 0, borderRadius: 12, padding: "10px 12px", background: "var(--vs-accent)", color: "white", fontWeight: 850, cursor: "pointer" }}>Open learning →</button>
                    </>
                  )}
                </div>
              </Section>

              <Section title="Twin thinking">
                <div style={cardStyle}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div aria-hidden="true" style={{ fontSize: 18 }}>↳</div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--vs-muted)" }}>{missionReason(mission)}</div>
                  </div>
                </div>
              </Section>

              <Section title="Do next">
                <RecommendationCard recommendation={recommendation} />
              </Section>

              <Section title="Progress" action={goal ? <span style={{ fontSize: 10.5, color: "var(--vs-muted)", fontWeight: 750 }}>{goal.completed}/{goal.target} goal</span> : undefined}>
                <ProgressCard progress={path?.motivation.subjectProgress ?? []} />
              </Section>

              <Section title="Upcoming">
                <div style={cardStyle}>
                  {upcoming ? (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{upcoming.title}</div>
                      <div style={{ marginTop: 5, fontSize: 11.5, color: "var(--vs-muted)" }}>{upcoming.subject}{dueLabel(upcoming.dueAt) ? ` · ${dueLabel(upcoming.dueAt)}` : ""}</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--vs-muted)" }}>Open Tasks for your complete verified workload and upcoming assignments.</div>
                  )}
                  <button onClick={() => { onClose(); router.push("/student/tasks") }} style={{ marginTop: 10, border: 0, background: "transparent", color: "var(--vs-accent)", fontSize: 12, fontWeight: 850, padding: 0, cursor: "pointer" }}>View all tasks →</button>
                </div>
              </Section>

              <Section title="Goals">
                <div style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 850 }}>Daily learning goal</div>
                      <div style={{ marginTop: 4, fontSize: 11.5, color: "var(--vs-muted)" }}>{goal ? `${goal.completed} of ${goal.target} verified learning actions complete` : "Goal evidence will appear as you complete verified work."}</div>
                    </div>
                    {goal && <div style={{ fontSize: 18, fontWeight: 900, color: goal.complete ? "var(--vs-success)" : "var(--vs-accent)" }}>{goal.complete ? "✓" : `${Math.min(100, Math.round((goal.completed / Math.max(1, goal.target)) * 100))}%`}</div>}
                  </div>
                </div>
              </Section>

              <Section title="Ask Twin">
                <button onClick={onAsk} style={{ ...cardStyle, width: "100%", textAlign: "left", cursor: "pointer", color: "var(--vs-text)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--vs-accent-soft)", color: "var(--vs-accent)", fontSize: 18 }}>✦</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 850 }}>Ask for help</div>
                      <div style={{ marginTop: 3, color: "var(--vs-muted)", fontSize: 11.5 }}>Explain, search, or talk through what you're learning.</div>
                    </div>
                    <span style={{ color: "var(--vs-accent)", fontSize: 18 }}>›</span>
                  </div>
                </button>
              </Section>
            </>
          )}
        </div>
      </aside>
      <style>{`@keyframes studentTwinIn { from { transform: translateX(100%); opacity: .5; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </div>
  )
}

export default function TwinWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { identity } = useStudent()
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<WorkspaceView>("home")
  const [path, setPath] = useState<StudentPersonalizedPath | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadedForStudentRef = useRef<string | null>(null)

  const refreshTwin = useCallback(async () => {
    if (!identity?.studentId) return
    setLoading(true)
    setError(null)
    try {
      const next = await getPersonalizedLearningPath()
      setPath(next)
      loadedForStudentRef.current = identity.studentId
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your learning brief could not be loaded.")
    } finally {
      setLoading(false)
    }
  }, [identity?.studentId])

  const openTwin = useCallback((nextView: WorkspaceView = "home") => {
    setView(nextView)
    setIsOpen(true)
  }, [])

  const closeTwin = useCallback(() => {
    setIsOpen(false)
    setView("home")
  }, [])

  useEffect(() => {
    if (!isOpen || view !== "home" || !identity?.studentId) return
    if (loadedForStudentRef.current !== identity.studentId) void refreshTwin()
  }, [identity?.studentId, isOpen, refreshTwin, view])

  const value = useMemo<TwinWorkspaceContextValue>(() => ({ isOpen, openTwin, closeTwin, refreshTwin }), [closeTwin, isOpen, openTwin, refreshTwin])

  return (
    <TwinWorkspaceContext.Provider value={value}>
      {children}
      <button
        onClick={() => openTwin("home")}
        aria-label="Open VibeTwin learning workspace"
        aria-expanded={isOpen}
        style={{
          position: "fixed",
          right: 16,
          bottom: "calc(78px + env(safe-area-inset-bottom))",
          zIndex: 700,
          width: 54,
          height: 54,
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,.18)",
          background: "var(--vs-accent)",
          color: "white",
          boxShadow: "0 12px 28px rgba(91,78,232,.34)",
          fontSize: 22,
          fontWeight: 900,
          cursor: "pointer",
          display: isOpen ? "none" : "grid",
          placeItems: "center",
        }}
      >
        ✦
      </button>

      <TwinWorkspaceDrawer
        isOpen={isOpen && view === "home"}
        onClose={closeTwin}
        onAsk={() => setView("ask")}
        loading={loading}
        error={error}
        path={path}
        onRefresh={refreshTwin}
      />

      <VibeTwin
        isOpen={isOpen && view === "ask"}
        onClose={closeTwin}
        userName={identity?.firstName ?? "Learner"}
      />
    </TwinWorkspaceContext.Provider>
  )
}
