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
  listMyTasks,
  type StudentPersonalizedPath,
  type StudentTask,
  type StudentTaskFeed,
} from "@/lib/student/tasks"
import {
  getLearnerTwinState,
  type LearnerTwinState,
  type TwinDecision,
} from "@/lib/student/twin"
import VibeTwin from "@/components/student/VibeTwin"

type WorkspaceView = "home" | "ask"

interface TwinWorkspaceContextValue {
  isOpen: boolean
  openTwin: (view?: WorkspaceView) => void
  closeTwin: () => void
  refreshTwin: () => Promise<void>
  brain: LearnerTwinState | null
  brainLoading: boolean
  brainError: string | null
}

const TwinWorkspaceContext = createContext<TwinWorkspaceContextValue | null>(null)

export function useTwinWorkspace() {
  const value = useContext(TwinWorkspaceContext)
  if (!value) throw new Error("useTwinWorkspace must be used inside TwinWorkspaceProvider")
  return value
}

export function useTwinBrain() {
  const value = useTwinWorkspace()
  return {
    state: value.brain,
    loading: value.brainLoading,
    error: value.brainError,
    refresh: value.refreshTwin,
  }
}

function dueLabel(value: string | null): string | null {
  if (!value) return null
  const due = new Date(value)
  if (Number.isNaN(due.getTime())) return null
  const diffHours = Math.round((due.getTime() - Date.now()) / 3_600_000)
  if (diffHours < 0) return "Overdue"
  if (diffHours < 24) return diffHours <= 1 ? "Due soon" : `Due in ${diffHours}h`
  const diffDays = Math.ceil(diffHours / 24)
  return diffDays === 1 ? "Due tomorrow" : `Due in ${diffDays} days`
}

function findTask(feed: StudentTaskFeed | null, decision: TwinDecision | null): StudentTask | null {
  if (!feed || !decision?.taskId) return null
  return feed.tasks.find(task => task.taskId === decision.taskId) ?? null
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <h3 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.1, color: "var(--vs-muted)", fontWeight: 800 }}>{title}</h3>
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

function ProgressCard({ state }: { state: LearnerTwinState | null }) {
  const subjects = state?.mastery.subjects
    .filter(item => item.totalTasks > 0 || item.masteryPercentage !== null || item.averageScore !== null)
    .sort((a, b) => (b.masteryPercentage ?? b.averageScore ?? 0) - (a.masteryPercentage ?? a.averageScore ?? 0))
    .slice(0, 3) ?? []

  if (subjects.length > 0) {
    return (
      <div style={{ ...cardStyle, display: "grid", gap: 12 }}>
        {subjects.map(item => {
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

  const outcomes = state?.mastery.outcomes.slice(0, 3) ?? []
  if (outcomes.length === 0) {
    return <div style={{ ...cardStyle, color: "var(--vs-muted)", fontSize: 13, lineHeight: 1.55 }}>Progress appears here as verified tasks and assessments produce evidence.</div>
  }

  return (
    <div style={{ ...cardStyle, display: "grid", gap: 12 }}>
      {outcomes.map(item => (
        <div key={item.outcomeId}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontSize: 11.5, fontWeight: 750, lineHeight: 1.4 }}>{item.outcomeText}</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: "var(--vs-accent)", flexShrink: 0 }}>{Math.round(item.effectiveMastery)}%</span>
          </div>
          <div style={{ marginTop: 5, fontSize: 10.5, color: "var(--vs-muted)" }}>Evidence {item.evidenceCount} · confidence {Math.round(item.confidence * 100)}%</div>
        </div>
      ))}
    </div>
  )
}

function DecisionCard({ decision }: { decision: TwinDecision | null }) {
  if (!decision) {
    return <div style={{ ...cardStyle, color: "var(--vs-muted)", fontSize: 13, lineHeight: 1.55 }}>No additional Twin action is active yet. Assigned work remains authoritative.</div>
  }
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--vs-text)", lineHeight: 1.4 }}>{decision.title}</div>
      <div style={{ marginTop: 6, fontSize: 12, color: "var(--vs-muted)", lineHeight: 1.55 }}>{decision.reason ?? "This follows your current verified learning state."}</div>
    </div>
  )
}

function TwinWorkspaceDrawer({
  isOpen,
  onClose,
  onAsk,
  loading,
  error,
  brain,
  path,
  taskFeed,
  onRefresh,
}: {
  isOpen: boolean
  onClose: () => void
  onAsk: () => void
  loading: boolean
  error: string | null
  brain: LearnerTwinState | null
  path: StudentPersonalizedPath | null
  taskFeed: StudentTaskFeed | null
  onRefresh: () => Promise<void>
}) {
  const { identity } = useStudent()
  const router = useRouter()
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const mission = brain?.decision.now ?? null
  const missionTask = findTask(taskFeed, mission)
  const nextDecision = brain?.decision.next[0] ?? null
  const upcomingDecision = brain?.decision.next[1] ?? brain?.decision.later[0] ?? null
  const upcomingTask = findTask(taskFeed, upcomingDecision)
  const goal = path?.motivation.dailyGoal

  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose() }
    window.addEventListener("keydown", onKeyDown)
    const timer = window.setTimeout(() => closeRef.current?.focus(), 0)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const missionUrl = mission?.actionUrl ?? missionTask?.actionUrl ?? null
  const startMission = () => {
    if (!missionUrl) return
    onClose()
    router.push(missionUrl)
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10020 }}>
      <button aria-label="Close VibeTwin workspace" onClick={onClose} style={{ position: "absolute", inset: 0, border: 0, background: "rgba(15,15,26,0.58)", cursor: "default" }} />
      <aside role="dialog" aria-modal="true" aria-labelledby="student-twin-title" style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "min(430px, 100vw)", background: "var(--vs-bg)", color: "var(--vs-text)", display: "flex", flexDirection: "column", boxShadow: "-20px 0 60px rgba(15,15,26,0.28)", animation: "studentTwinIn 220ms ease-out" }}>
        <header style={{ padding: "18px 18px 14px", borderBottom: "1px solid var(--vs-border)", background: "var(--vs-surface)", display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: 13, background: "var(--vs-accent)", color: "white", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 19, flexShrink: 0 }}>✦</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div id="student-twin-title" style={{ fontSize: 17, fontWeight: 900 }}>VibeTwin</div>
            <div style={{ color: "var(--vs-muted)", fontSize: 11, marginTop: 2 }}>{identity?.firstName ? `${identity.firstName}'s learning workspace` : "Your learning workspace"}</div>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Close VibeTwin" style={{ width: 44, height: 44, borderRadius: 14, border: "1px solid var(--vs-border)", background: "var(--vs-card)", color: "var(--vs-text)", cursor: "pointer", fontSize: 20 }}>×</button>
        </header>

        <div style={{ overflowY: "auto", padding: "16px 16px calc(28px + env(safe-area-inset-bottom))" }}>
          {loading && !brain ? (
            <div style={{ ...cardStyle, textAlign: "center", color: "var(--vs-muted)", fontSize: 13 }}>Loading your authoritative Twin state…</div>
          ) : error && !brain ? (
            <div style={cardStyle}>
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
                        <span style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: .8, color: "var(--vs-accent)" }}>{mission.subject ?? missionTask?.subject ?? "Learning"}</span>
                        {dueLabel(missionTask?.dueAt ?? null) && <span style={{ fontSize: 10, color: missionTask?.status === "overdue" ? "var(--vs-error)" : "var(--vs-muted)", fontWeight: 750 }}>{dueLabel(missionTask?.dueAt ?? null)}</span>}
                      </div>
                      <div style={{ fontSize: 17, lineHeight: 1.35, fontWeight: 900 }}>{mission.title}</div>
                      <div style={{ marginTop: 7, color: "var(--vs-muted)", fontSize: 12 }}>{mission.actionLabel ?? missionTask?.actionLabel ?? "Open learning"}</div>
                      {missionUrl && <button onClick={startMission} style={{ width: "100%", marginTop: 14, border: 0, borderRadius: 12, padding: "12px 14px", background: "var(--vs-accent)", color: "white", fontWeight: 900, cursor: "pointer" }}>Start now →</button>}
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 15, fontWeight: 850 }}>You're clear for now.</div>
                      <div style={{ marginTop: 6, color: "var(--vs-muted)", fontSize: 12, lineHeight: 1.5 }}>Twin has no authoritative NOW action from your current evidence.</div>
                      <button onClick={() => { onClose(); router.push("/student/vibelearn") }} style={{ marginTop: 12, border: 0, borderRadius: 12, padding: "10px 12px", background: "var(--vs-accent)", color: "white", fontWeight: 850, cursor: "pointer" }}>Open learning →</button>
                    </>
                  )}
                </div>
              </Section>

              <Section title="Twin thinking">
                <div style={cardStyle}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div aria-hidden="true" style={{ fontSize: 18 }}>↳</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--vs-muted)" }}>{mission?.reason ?? "Twin is waiting for enough verified evidence to make a learner-specific decision."}</div>
                      {(mission?.reasonChain.length ?? 0) > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}>{mission?.reasonChain.map(reason => <span key={reason} style={{ padding: "4px 7px", borderRadius: 999, background: "var(--vs-accent-soft)", color: "var(--vs-accent)", fontSize: 10, fontWeight: 800 }}>{reason}</span>)}</div>}
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="Do next"><DecisionCard decision={nextDecision} /></Section>

              <Section title="Progress" action={goal ? <span style={{ fontSize: 10.5, color: "var(--vs-muted)", fontWeight: 750 }}>{goal.completed}/{goal.target} goal</span> : undefined}>
                <ProgressCard state={brain} />
              </Section>

              <Section title="Upcoming">
                <div style={cardStyle}>
                  {upcomingDecision ? (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>{upcomingDecision.title}</div>
                      <div style={{ marginTop: 5, fontSize: 11.5, color: "var(--vs-muted)" }}>{upcomingDecision.subject ?? upcomingTask?.subject ?? "Learning task"}{dueLabel(upcomingTask?.dueAt ?? null) ? ` · ${dueLabel(upcomingTask?.dueAt ?? null)}` : ""}</div>
                    </>
                  ) : <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--vs-muted)" }}>No additional authoritative action is currently queued.</div>}
                  <button onClick={() => { onClose(); router.push("/student/tasks") }} style={{ marginTop: 10, border: 0, background: "transparent", color: "var(--vs-accent)", fontSize: 12, fontWeight: 850, padding: 0, cursor: "pointer" }}>View all tasks →</button>
                </div>
              </Section>

              <Section title="Goals">
                <div style={cardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div><div style={{ fontSize: 13, fontWeight: 850 }}>Daily learning goal</div><div style={{ marginTop: 4, fontSize: 11.5, color: "var(--vs-muted)" }}>{goal ? `${goal.completed} of ${goal.target} verified learning actions complete` : "Goal evidence will appear as you complete verified work."}</div></div>
                    {goal && <div style={{ fontSize: 18, fontWeight: 900, color: goal.complete ? "var(--vs-success)" : "var(--vs-accent)" }}>{goal.complete ? "✓" : `${Math.min(100, Math.round((goal.completed / Math.max(1, goal.target)) * 100))}%`}</div>}
                  </div>
                </div>
              </Section>

              <Section title="Ask Twin">
                <button onClick={onAsk} style={{ ...cardStyle, width: "100%", textAlign: "left", cursor: "pointer", color: "var(--vs-text)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 36, height: 36, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--vs-accent-soft)", color: "var(--vs-accent)", fontSize: 18 }}>✦</div><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 850 }}>Ask for help</div><div style={{ marginTop: 3, color: "var(--vs-muted)", fontSize: 11.5 }}>Explain or talk through the same learning state shown above.</div></div><span style={{ color: "var(--vs-accent)", fontSize: 18 }}>›</span></div>
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
  const [brain, setBrain] = useState<LearnerTwinState | null>(null)
  const [brainLoading, setBrainLoading] = useState(false)
  const [brainError, setBrainError] = useState<string | null>(null)
  const [path, setPath] = useState<StudentPersonalizedPath | null>(null)
  const [taskFeed, setTaskFeed] = useState<StudentTaskFeed | null>(null)
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [workspaceError, setWorkspaceError] = useState<string | null>(null)
  const loadedWorkspaceForStudentRef = useRef<string | null>(null)
  const attemptedBrainForStudentRef = useRef<string | null>(null)

  const refreshBrain = useCallback(async (force = false) => {
    if (!identity?.studentId) return null
    setBrainLoading(true)
    setBrainError(null)
    try {
      const nextBrain = await getLearnerTwinState({ force })
      if (nextBrain.studentId && nextBrain.studentId !== identity.studentId) {
        throw new Error("Your Twin state does not match the active learner profile.")
      }
      setBrain(nextBrain)
      attemptedBrainForStudentRef.current = identity.studentId
      return nextBrain
    } catch (cause) {
      attemptedBrainForStudentRef.current = identity.studentId
      setBrainError(cause instanceof Error ? cause.message : "Your Twin state could not be loaded.")
      return null
    } finally {
      setBrainLoading(false)
    }
  }, [identity?.studentId])

  const refreshWorkspace = useCallback(async () => {
    if (!identity?.studentId) return
    setWorkspaceLoading(true)
    setWorkspaceError(null)
    try {
      const [nextPath, nextFeed] = await Promise.all([getPersonalizedLearningPath(), listMyTasks()])
      setPath(nextPath)
      setTaskFeed(nextFeed)
      loadedWorkspaceForStudentRef.current = identity.studentId
    } catch (cause) {
      setWorkspaceError(cause instanceof Error ? cause.message : "Your learning workspace could not be loaded.")
    } finally {
      setWorkspaceLoading(false)
    }
  }, [identity?.studentId])

  const refreshTwin = useCallback(async () => {
    await Promise.all([refreshBrain(true), refreshWorkspace()])
  }, [refreshBrain, refreshWorkspace])

  const openTwin = useCallback((nextView: WorkspaceView = "home") => { setView(nextView); setIsOpen(true) }, [])
  const closeTwin = useCallback(() => { setIsOpen(false); setView("home") }, [])

  useEffect(() => {
    if (!identity?.studentId) {
      setBrain(null)
      setBrainError(null)
      attemptedBrainForStudentRef.current = null
      loadedWorkspaceForStudentRef.current = null
      return
    }
    if (brain?.studentId === identity.studentId) return
    if (attemptedBrainForStudentRef.current === identity.studentId || brainLoading) return
    attemptedBrainForStudentRef.current = identity.studentId
    void refreshBrain(false)
  }, [brain?.studentId, brainLoading, identity?.studentId, refreshBrain])

  useEffect(() => {
    if (!isOpen || view !== "home" || !identity?.studentId) return
    if (loadedWorkspaceForStudentRef.current !== identity.studentId && !workspaceLoading) void refreshWorkspace()
  }, [identity?.studentId, isOpen, refreshWorkspace, view, workspaceLoading])

  const value = useMemo<TwinWorkspaceContextValue>(() => ({
    isOpen,
    openTwin,
    closeTwin,
    refreshTwin,
    brain,
    brainLoading,
    brainError,
  }), [brain, brainError, brainLoading, closeTwin, isOpen, openTwin, refreshTwin])

  return (
    <TwinWorkspaceContext.Provider value={value}>
      {children}
      <button
        onClick={() => openTwin("home")}
        aria-label={brainError ? "Open VibeTwin learning workspace (limited mode)" : "Open VibeTwin learning workspace"}
        aria-expanded={isOpen}
        title={brainError ? "Twin is temporarily limited. The rest of Student OS remains available." : undefined}
        style={{ position: "fixed", right: 16, bottom: "calc(78px + env(safe-area-inset-bottom))", zIndex: 10010, width: 54, height: 54, borderRadius: 18, border: brainError ? "2px solid var(--vs-warning)" : "1px solid rgba(255,255,255,.18)", background: "var(--vs-accent)", color: "white", boxShadow: "0 12px 28px rgba(91,78,232,.34)", fontSize: 22, fontWeight: 900, cursor: "pointer", display: isOpen ? "none" : "grid", placeItems: "center" }}
      >✦</button>

      <TwinWorkspaceDrawer
        isOpen={isOpen && view === "home"}
        onClose={closeTwin}
        onAsk={() => setView("ask")}
        loading={brainLoading || workspaceLoading}
        error={brainError ?? workspaceError}
        brain={brain}
        path={path}
        taskFeed={taskFeed}
        onRefresh={refreshTwin}
      />

      <VibeTwin isOpen={isOpen && view === "ask"} onClose={closeTwin} userName={identity?.firstName ?? "Learner"} learnerState={brain} />
    </TwinWorkspaceContext.Provider>
  )
}
